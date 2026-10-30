import { randomInt } from 'node:crypto';
import {
  ALFABET_KODE_PEMULIHAN,
  PANJANG_KODE_PEMULIHAN,
  rapikanKodePemulihan,
  type DataSetupAwal,
  type HasilKodePemulihan,
  type InfoKodePemulihan,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError, galatKolom } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { cocokPassword, hashPassword, verifikasiTiruan } from '../../lib/password';
import { dalamTransaksi } from '../../lib/transaksi';
import { sekarang } from '../../lib/waktu';
import { invalidasiKonfigurasi } from '../sistem/konfigurasi/service';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../sistem/penomoran';
import { mulaiCatatanSetup, simpanDataUsaha } from '../sistem/setup-awal/service';
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

export async function kodeBaru(): Promise<{ kode: string; hash: string }> {
  const kode = kodeAcak();
  return { kode, hash: await hashPassword(rapikanKodePemulihan(kode)) };
}

/**
 * K-205 (menggantikan "Buat akun pertama" K-191): setup awal membuat akun Owner pertama bersama data usaha dan
 * operasional, lalu langsung masuk. Hanya bila belum ada pengguna sama sekali; dua permintaan bersamaan diantrekan
 * dengan kunci advisory sehingga hanya satu yang berhasil.
 */
export async function buatSetupAwal(
  input: DataSetupAwal,
  asal: AsalRequest,
): Promise<HasilLogin & HasilKodePemulihan> {
  const owner = input.owner;
  await pastikanPanjangPassword(owner.password, 'owner.password');
  const passwordHash = await hashPassword(owner.password);
  const pemulihan = await kodeBaru();
  const waktu = sekarang();
  const id = await dalamTransaksi(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('akun_pertama'))`);
    if ((await repo.jumlahPengguna(tx)) > 0) {
      throw new AppError('KONFLIK', 'Setup awal sudah dikerjakan. Silakan masuk.', 409);
    }
    const kode = await terbitkanKodeMaster(tx, 'USR');
    const idBaru = await repo.tambahOwnerPertama(tx, {
      kode,
      username: owner.username,
      namaPengguna: owner.namaPengguna,
      passwordHash,
      email: owner.email === '' ? null : owner.email,
      noHp: owner.noHp ?? null,
    });
    await repo.simpanKodePemulihan(tx, idBaru, pemulihan.hash, waktu);
    await simpanDataUsaha(tx, input.usaha, input.operasional);
    await mulaiCatatanSetup(tx);
    await catatLog(tx, {
      aksi: 'SETUP_AWAL',
      idPengguna: idBaru,
      entitas: 'pengguna',
      idEntitas: idBaru,
      ringkasan: `Setup awal: usaha ${input.usaha.namaToko}; akun Owner ${owner.namaPengguna} (${owner.username}); kode pemulihan dibuat`,
      dataBaru: { ...input.usaha, layanan: input.operasional.layanan },
      ip: asal.ip,
    });
    return idBaru;
  });
  invalidasiKonfigurasi();
  const calon = await repo.penggunaUntukLogin(db, owner.username);
  if (!calon || calon.id !== id) throw new Error('akun pertama tidak ditemukan setelah dibuat');
  const sesi = await buatSesiLogin(calon, asal, 'Masuk pertama setelah setup awal');
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

/**
 * K-211: memulihkan akses Owner dari komputer tempat BonsaiUrip terpasang (menu Start › Pulihkan akses Owner).
 * Tidak ada rute API untuk ini: hanya bisa dijalankan oleh akun Windows yang memegang folder data dan database.
 * Owner aktif paling awal diberi password sementara (wajib diganti saat masuk), kunci dibuka, semua sesi dicabut,
 * dan kode pemulihan baru dibuat.
 */
export async function pulihkanAksesOwnerLokal(): Promise<{
  username: string;
  namaPengguna: string;
  passwordSementara: string;
  kodePemulihan: string;
}> {
  const owner = await repo.ownerPertama(db);
  if (!owner) {
    throw new AppError(
      'TIDAK_DITEMUKAN',
      'Belum ada akun Owner aktif. Buka BonsaiUrip untuk mengerjakan setup awal.',
      404,
    );
  }
  let sementara = '';
  for (let i = 0; i < 12; i++) {
    sementara += ALFABET_KODE_PEMULIHAN[randomInt(ALFABET_KODE_PEMULIHAN.length)];
  }
  sementara = sementara.toLowerCase().replace(/^(.{4})(.{4})(.{4})$/, '$1-$2-$3');
  const passwordHash = await hashPassword(sementara);
  const pemulihan = await kodeBaru();
  const waktu = sekarang();
  await dalamTransaksi(async (tx) => {
    await repo.ubahPassword(tx, owner.id, passwordHash, true, waktu);
    await repo.bukaKunciAkun(tx, owner.id);
    await repo.simpanKodePemulihan(tx, owner.id, pemulihan.hash, waktu);
    const dicabut = await repo.cabutSesiPengguna(tx, owner.id, 'PEMULIHAN', waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_PULIH_LOKAL',
      idPengguna: owner.id,
      entitas: 'pengguna',
      idEntitas: owner.id,
      ringkasan: `Akses Owner dipulihkan dari komputer server: password sementara dan kode pemulihan baru; ${dicabut} sesi dicabut`,
      ip: null,
    });
  });
  return {
    username: owner.username,
    namaPengguna: owner.namaPengguna,
    passwordSementara: sementara,
    kodePemulihan: pemulihan.kode,
  };
}
