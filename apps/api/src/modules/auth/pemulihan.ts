import { randomInt } from 'node:crypto';
import {
  ALFABET_KODE_PEMULIHAN,
  PANJANG_KODE_PEMULIHAN,
  rapikanKodePemulihan,
  type DataAkunPertama,
  type HasilKodePemulihan,
  type InfoKodePemulihan,
  type StatusPenyiapan,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError, galatKolom } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { cocokPassword, hashPassword, verifikasiTiruan } from '../../lib/password';
import { dalamTransaksi } from '../../lib/transaksi';
import { sekarang } from '../../lib/waktu';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../sistem/penomoran';
import * as repo from './repo';
import {
  buatSesiLogin,
  normalisasiUsername,
  pastikanPanjangPassword,
  type HasilLogin,
} from './service';

/*
 * K-191: akun pertama (tanpa password bawaan di jendela pesan) dan pemulihan password dengan kode sekali pakai.
 * Kode pemulihan 20 huruf/angka acak (± 99 bit) disimpan sebagai hash argon2id, ditampilkan sekali saat dibuat, dan
 * diganti kode baru setiap kali dipakai. Pengguna selain Owner tetap bisa di-reset Owner/Admin di Data Pengguna.
 */

const PESAN_GAGAL = 'Username atau kode pemulihan salah.';

/** Kode acak berkelompok 5: XXXXX-XXXXX-XXXXX-XXXXX. */
function kodeAcak(): string {
  let k = '';
  for (let i = 0; i < PANJANG_KODE_PEMULIHAN; i++) {
    k += ALFABET_KODE_PEMULIHAN[randomInt(ALFABET_KODE_PEMULIHAN.length)];
  }
  return k.match(/.{1,5}/g)?.join('-') ?? k;
}

async function kodeBaru(): Promise<{ kode: string; hash: string }> {
  const kode = kodeAcak();
  return { kode, hash: await hashPassword(rapikanKodePemulihan(kode)) };
}

export async function statusPenyiapan(): Promise<StatusPenyiapan> {
  return { perluAkunPertama: (await repo.jumlahPengguna(db)) === 0 };
}

/**
 * Membuat akun Owner pertama dan langsung masuk. Hanya bila belum ada pengguna sama sekali; dua permintaan
 * bersamaan diantrekan dengan kunci advisory sehingga hanya satu yang berhasil.
 */
export async function buatAkunPertama(
  input: DataAkunPertama,
  asal: AsalRequest,
): Promise<HasilLogin & HasilKodePemulihan> {
  await pastikanPanjangPassword(input.password, 'password');
  const passwordHash = await hashPassword(input.password);
  const pemulihan = await kodeBaru();
  const waktu = sekarang();
  const id = await dalamTransaksi(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('akun_pertama'))`);
    if ((await repo.jumlahPengguna(tx)) > 0) {
      throw new AppError('KONFLIK', 'Akun pertama sudah dibuat. Silakan masuk.', 409);
    }
    const kode = await terbitkanKodeMaster(tx, 'USR');
    const idBaru = await repo.tambahOwnerPertama(tx, {
      kode,
      username: input.username,
      namaPengguna: input.namaPengguna,
      passwordHash,
    });
    await repo.simpanKodePemulihan(tx, idBaru, pemulihan.hash, waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_AKUN_PERTAMA',
      idPengguna: idBaru,
      entitas: 'pengguna',
      idEntitas: idBaru,
      ringkasan: `Akun pertama (Owner) dibuat: ${input.namaPengguna} (${input.username}); kode pemulihan dibuat`,
      ip: asal.ip,
    });
    return idBaru;
  });
  const calon = await repo.penggunaUntukLogin(db, input.username);
  if (!calon || calon.id !== id) throw new Error('akun pertama tidak ditemukan setelah dibuat');
  const sesi = await buatSesiLogin(calon, asal, 'Masuk pertama setelah membuat akun');
  return { ...sesi, kodePemulihan: pemulihan.kode };
}

/**
 * Lupa password: username + kode pemulihan → password baru. Kode lama hangus dan kode baru diberikan (sekali
 * tampil); semua sesi pengguna itu dicabut dan kunci akun dibuka. Pengguna lalu masuk seperti biasa.
 */
export async function pulihkanPassword(
  input: { username: string; kodePemulihan: string; passwordBaru: string },
  asal: AsalRequest,
): Promise<HasilKodePemulihan> {
  const username = normalisasiUsername(input.username);
  const target = await repo.penggunaUntukPemulihan(db, username);
  const kode = rapikanKodePemulihan(input.kodePemulihan);
  const cocok =
    target?.kodePemulihanHash != null
      ? await cocokPassword(target.kodePemulihanHash, kode)
      : (await verifikasiTiruan(kode), false);
  if (!target || !cocok) {
    await catatLog(
      db,
      target
        ? {
            aksi: 'PENGGUNA_PULIHKAN_GAGAL',
            idPengguna: target.id,
            entitas: 'pengguna',
            idEntitas: target.id,
            ringkasan: 'Kode pemulihan salah atau belum dibuat',
            ip: asal.ip,
          }
        : {
            aksi: 'PENGGUNA_PULIHKAN_GAGAL',
            idPengguna: null,
            usernamePercobaan: username,
            ringkasan: 'Username tidak dikenal',
            ip: asal.ip,
          },
    );
    throw new AppError('BELUM_LOGIN', PESAN_GAGAL, 401);
  }
  if (target.statusAktif !== 'AKTIF') {
    throw new AppError('STATUS_TIDAK_VALID', 'Akun ini nonaktif. Hubungi Owner.', 409);
  }
  await pastikanPanjangPassword(input.passwordBaru, 'passwordBaru');
  const passwordHash = await hashPassword(input.passwordBaru);
  const pemulihan = await kodeBaru();
  const waktu = sekarang();
  await dalamTransaksi(async (tx) => {
    await repo.ubahPassword(tx, target.id, passwordHash, false, waktu);
    await repo.bukaKunciAkun(tx, target.id);
    await repo.simpanKodePemulihan(tx, target.id, pemulihan.hash, waktu);
    const dicabut = await repo.cabutSesiPengguna(tx, target.id, 'PEMULIHAN', waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_PULIHKAN_PASSWORD',
      idPengguna: target.id,
      entitas: 'pengguna',
      idEntitas: target.id,
      ringkasan: `Password dipulihkan dengan kode pemulihan; kode baru dibuat; ${dicabut} sesi dicabut`,
      ip: asal.ip,
    });
  });
  return { kodePemulihan: pemulihan.kode };
}

export async function infoKodePemulihan(idPengguna: number): Promise<InfoKodePemulihan> {
  const b = await repo.infoKodePemulihan(db, idPengguna);
  return { ada: b?.ada ?? false, dibuatPada: b?.dibuatPada?.toISOString() ?? null };
}

/** Membuat (atau mengganti) kode pemulihan akun sendiri; konfirmasi dengan password saat ini. */
export async function buatKodePemulihan(
  pengguna: PenggunaAktif,
  password: string,
  asal: AsalRequest,
): Promise<HasilKodePemulihan> {
  const hashLama = await repo.passwordHashPengguna(db, pengguna.id);
  if (!hashLama || !(await cocokPassword(hashLama, password))) {
    throw galatKolom('password', 'Password salah.');
  }
  const pemulihan = await kodeBaru();
  await dalamTransaksi(async (tx) => {
    await repo.simpanKodePemulihan(tx, pengguna.id, pemulihan.hash, sekarang());
    await catatLog(tx, {
      aksi: 'PENGGUNA_KODE_PEMULIHAN',
      idPengguna: pengguna.id,
      entitas: 'pengguna',
      idEntitas: pengguna.id,
      ringkasan: 'Membuat kode pemulihan baru (kode lama tidak berlaku)',
      ip: asal.ip,
    });
  });
  return { kodePemulihan: pemulihan.kode };
}
