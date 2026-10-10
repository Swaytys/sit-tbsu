import {
  IZIN_PER_PERAN,
  PASSWORD_MIN_DASAR,
  USERNAME_DEMO,
  izinPeran,
  type InputGantiPassword,
  type InputLogin,
  type Izin,
  type PenggunaSaya,
  type Peran,
} from '@sit/shared';
import { db } from '../../db/client';
import { env } from '../../env';
import { catatPercobaan, type OpsiBatas } from '../../lib/batas-percobaan';
import { AppError, galatKolom } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { cocokPassword, hashPassword, verifikasiTiruan } from '../../lib/password';
import { dalamTransaksi } from '../../lib/transaksi';
import { jamLokal, sekarang, selisihDetik, tambahJam, tambahMenit } from '../../lib/waktu';
import { ambilAngka } from '../sistem/konfigurasi/service';
import { catatLog } from '../sistem/log-aktivitas';
import * as repo from './repo';
import { buatTokenSesi, hashToken } from './token';

const PESAN_GAGAL_LOGIN = 'Username atau password salah.';
/** Kolom `terakhir_aktif` sesi diperbarui paling sering sekali per menit (mengurangi tulis ke DB). */
const JEDA_PERBARUI_AKTIVITAS_DETIK = 60;

export type HasilLogin = { token: string; kadaluarsa: Date; pengguna: PenggunaSaya };

export function normalisasiUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function keSaya(p: {
  id: number;
  kode: string;
  username: string;
  namaPengguna: string;
  peran: Peran;
  wajibGantiPassword: boolean;
}): PenggunaSaya {
  return {
    id: p.id,
    kode: p.kode,
    username: p.username,
    namaPengguna: p.namaPengguna,
    peran: p.peran,
    izin: izinPeran(p.peran),
    wajibGantiPassword: p.wajibGantiPassword,
  };
}

/** Panjang minimal password = max(8, konfigurasi.password_min) (docs/04 §7). */
export async function pastikanPanjangPassword(password: string, kolom: string): Promise<void> {
  const minimal = Math.max(
    PASSWORD_MIN_DASAR,
    await ambilAngka('password_min', PASSWORD_MIN_DASAR),
  );
  if (password.length < minimal) {
    throw galatKolom(kolom, `Password minimal ${minimal} karakter.`);
  }
}

async function buatSesiLogin(
  calon: repo.CalonLogin,
  asal: AsalRequest,
  ringkasan: string,
): Promise<HasilLogin> {
  const waktu = sekarang();
  const token = buatTokenSesi();
  const kadaluarsa = tambahJam(waktu, env.SESSION_ABSOLUT_JAM);
  await dalamTransaksi(async (tx) => {
    await repo.catatLoginSukses(tx, calon.id, waktu);
    await repo.buatSesi(tx, {
      idPengguna: calon.id,
      tokenHash: hashToken(token),
      kadaluarsaAbsolut: kadaluarsa,
      terakhirAktif: waktu,
      ip: asal.ip,
      userAgent: asal.userAgent,
    });
    await catatLog(tx, {
      aksi: 'LOGIN_SUKSES',
      idPengguna: calon.id,
      entitas: 'pengguna',
      idEntitas: calon.id,
      ringkasan,
      ip: asal.ip,
    });
  });
  return { token, kadaluarsa, pengguna: keSaya(calon) };
}

type HasilKredensial = { calon: repo.CalonLogin } | { galat: string };

/**
 * Memeriksa username + password (docs/04 §7), dipakai login dan persetujuan di tempat. Setiap kegagalan
 * dicatat di log dengan `aksi`; gagal berturut sebanyak `konfigurasi.login_maks_gagal` mengunci akun selama
 * `login_kunci_menit`. Mengembalikan pesan galat untuk pengguna, bukan melempar, agar pemanggil memilih
 * kode HTTP-nya sendiri.
 */
async function periksaKredensial(
  kredensial: { username: string; password: string },
  asal: AsalRequest,
  aksi: 'LOGIN_GAGAL' | 'PERSETUJUAN_GAGAL',
  konteks = '',
): Promise<HasilKredensial> {
  const username = normalisasiUsername(kredensial.username);
  const calon = await repo.penggunaUntukLogin(db, username);
  const waktu = sekarang();

  if (!calon) {
    await verifikasiTiruan(kredensial.password);
    await catatLog(db, {
      aksi,
      idPengguna: null,
      usernamePercobaan: username,
      ringkasan: `Username tidak dikenal${konteks}`,
      ip: asal.ip,
    });
    return { galat: PESAN_GAGAL_LOGIN };
  }

  const logGagal = (ringkasan: string) => ({
    aksi,
    idPengguna: calon.id,
    entitas: 'pengguna',
    idEntitas: calon.id,
    ringkasan: ringkasan + konteks,
    ip: asal.ip,
  });

  if (calon.terkunciSampai && calon.terkunciSampai > waktu) {
    await catatLog(db, logGagal('Akun sedang terkunci'));
    return {
      galat: `Akun terkunci sampai pukul ${jamLokal(calon.terkunciSampai)} karena terlalu banyak percobaan gagal.`,
    };
  }

  if (!(await cocokPassword(calon.passwordHash, kredensial.password))) {
    const maks = await ambilAngka('login_maks_gagal', 5);
    const menit = await ambilAngka('login_kunci_menit', 15);
    const terkunciSampai = await dalamTransaksi(async (tx) => {
      const hasil = await repo.catatGagalLogin(tx, calon.id, maks, tambahMenit(waktu, menit));
      const baruDikunci = hasil !== null && hasil > waktu;
      await catatLog(
        tx,
        logGagal(baruDikunci ? `Password salah; akun dikunci ${menit} menit` : 'Password salah'),
      );
      return baruDikunci ? hasil : null;
    });
    return {
      galat: terkunciSampai
        ? `Password salah ${maks} kali berturut-turut. Akun dikunci sampai pukul ${jamLokal(terkunciSampai)}.`
        : PESAN_GAGAL_LOGIN,
    };
  }

  if (calon.statusAktif !== 'AKTIF') {
    await catatLog(db, logGagal('Akun nonaktif'));
    return { galat: 'Akun Anda nonaktif. Hubungi Owner.' };
  }
  return { calon };
}

/** Login dengan username + password (docs/02 §8, docs/04 §7). */
export async function login(input: InputLogin, asal: AsalRequest): Promise<HasilLogin> {
  const hasil = await periksaKredensial(input, asal, 'LOGIN_GAGAL');
  if ('galat' in hasil) throw new AppError('BELUM_LOGIN', hasil.galat, 401);
  return buatSesiLogin(hasil.calon, asal, 'Login berhasil');
}

/** Atasan yang menyetujui di tempat: cukup identitasnya (tidak punya sesi di perangkat itu). */
export type Atasan = Pick<PenggunaAktif, 'id' | 'username' | 'namaPengguna' | 'peran'>;

/** Percobaan persetujuan di tempat: 20 per menit per pengaju (docs/04 §6), berhasil maupun gagal. */
export const BATAS_PERSETUJUAN_DI_TEMPAT: OpsiBatas = { maks: 20, jendelaDetik: 60 };

/**
 * Persetujuan di tempat (docs/04 §6, K-099): Admin/Owner mengetik akunnya sendiri di layar pengaju. Tidak
 * membuat sesi dan tidak mengubah sesi pengaju. Kegagalan dihitung seperti gagal login (kunci akun) dan dicatat
 * `PERSETUJUAN_GAGAL`, sehingga dialog ini tidak bisa dipakai menebak password. Dipanggil SEBELUM transaksi
 * dokumen agar hitungan gagal tidak ikut dibatalkan. Galat memakai 400/403 (bukan 401) supaya sesi pengaju
 * tidak dianggap berakhir.
 */
export async function verifikasiAtasan(
  kredensial: { username: string; password: string },
  izin: Izin,
  pengaju: PenggunaAktif,
  asal: AsalRequest,
): Promise<Atasan> {
  // Batas laju per pengaju, sama seperti login per IP: tebakan password dari sesi kasir tidak bisa beruntun.
  catatPercobaan(`atasan:${pengaju.id}`, BATAS_PERSETUJUAN_DI_TEMPAT);
  const konteks = ` (persetujuan di tempat, sesi ${pengaju.username})`;
  const hasil = await periksaKredensial(kredensial, asal, 'PERSETUJUAN_GAGAL', konteks);
  if ('galat' in hasil) {
    throw galatKolom('atasan.password', hasil.galat);
  }
  const { calon } = hasil;
  if (!IZIN_PER_PERAN[calon.peran].has(izin)) {
    await catatLog(db, {
      aksi: 'PERSETUJUAN_GAGAL',
      idPengguna: calon.id,
      entitas: 'pengguna',
      idEntitas: calon.id,
      ringkasan: `Akun tidak berwenang menyetujui${konteks}`,
      ip: asal.ip,
    });
    throw new AppError(
      'TIDAK_BERIZIN',
      `Akun ${calon.username} tidak berwenang menyetujui. Gunakan akun Admin atau Owner.`,
      403,
    );
  }
  // Kredensial benar: hitungan gagal dikembalikan ke nol, tanpa mencatat login.
  await repo.hapusHitunganGagal(db, calon.id);
  return {
    id: calon.id,
    username: calon.username,
    namaPengguna: calon.namaPengguna,
    peran: calon.peran,
  };
}

/**
 * Masuk cepat dengan akun demo per peran — HANYA NODE_ENV=development (K-021, docs/04 §7).
 * Tidak pernah memakai akun Owner sungguhan.
 */
export async function masukCepat(peran: Peran, asal: AsalRequest): Promise<HasilLogin> {
  if (env.NODE_ENV !== 'development') {
    throw new AppError('TIDAK_DITEMUKAN', 'Alamat API tidak ditemukan.', 404);
  }
  const calon = await repo.penggunaUntukLogin(db, USERNAME_DEMO[peran]);
  if (!calon || calon.statusAktif !== 'AKTIF') {
    throw new AppError(
      'TIDAK_DITEMUKAN',
      'Akun demo belum ada atau nonaktif. Jalankan pnpm db:seed (NODE_ENV=development).',
      404,
    );
  }
  return buatSesiLogin(calon, asal, 'Masuk cepat (mode pengembangan)');
}

/**
 * Memuat pengguna dari token cookie. Sesi berakhir bila dicabut, melewati batas absolut, menganggur
 * lebih dari batas idle, atau penggunanya nonaktif (docs/02 §8).
 */
export async function sesiDariToken(token: string): Promise<PenggunaAktif | null> {
  const sesi = await repo.sesiDenganPengguna(db, hashToken(token));
  if (!sesi || sesi.dicabutPada) return null;

  const waktu = sekarang();
  let alasanBerakhir: string | null = null;
  if (sesi.kadaluarsaAbsolut <= waktu) alasanBerakhir = 'KADALUARSA';
  else if (tambahMenit(sesi.terakhirAktif, env.SESSION_IDLE_MENIT) <= waktu)
    alasanBerakhir = 'IDLE';
  else if (sesi.statusAktif !== 'AKTIF') alasanBerakhir = 'NONAKTIF';

  if (alasanBerakhir) {
    await repo.cabutSesi(db, sesi.idSesi, alasanBerakhir, waktu);
    return null;
  }

  if (selisihDetik(waktu, sesi.terakhirAktif) >= JEDA_PERBARUI_AKTIVITAS_DETIK) {
    await repo.perbaruiAktivitasSesi(db, sesi.idSesi, waktu);
  }

  return {
    id: sesi.id,
    kode: sesi.kode,
    username: sesi.username,
    namaPengguna: sesi.namaPengguna,
    peran: sesi.peran,
    izin: IZIN_PER_PERAN[sesi.peran],
    wajibGantiPassword: sesi.wajibGantiPassword,
    idSesi: sesi.idSesi,
  };
}

export async function logout(pengguna: PenggunaAktif, asal: AsalRequest): Promise<void> {
  await dalamTransaksi(async (tx) => {
    await repo.cabutSesi(tx, pengguna.idSesi, 'LOGOUT', sekarang());
    await catatLog(tx, {
      aksi: 'LOGOUT',
      idPengguna: pengguna.id,
      entitas: 'pengguna',
      idEntitas: pengguna.id,
      ip: asal.ip,
    });
  });
}

/** Pengguna mengganti password sendiri. Sesi lain miliknya dicabut; sesi yang dipakai tetap. */
export async function gantiPassword(
  pengguna: PenggunaAktif,
  input: InputGantiPassword,
  asal: AsalRequest,
): Promise<PenggunaSaya> {
  const hashLama = await repo.passwordHashPengguna(db, pengguna.id);
  if (!hashLama || !(await cocokPassword(hashLama, input.passwordLama))) {
    throw galatKolom('passwordLama', 'Password lama salah.');
  }
  await pastikanPanjangPassword(input.passwordBaru, 'passwordBaru');
  const hashBaru = await hashPassword(input.passwordBaru);
  const waktu = sekarang();

  await dalamTransaksi(async (tx) => {
    await repo.ubahPassword(tx, pengguna.id, hashBaru, false, waktu);
    const dicabut = await repo.cabutSesiPengguna(
      tx,
      pengguna.id,
      'GANTI_PASSWORD',
      waktu,
      pengguna.idSesi,
    );
    await catatLog(tx, {
      aksi: 'PENGGUNA_GANTI_PASSWORD',
      idPengguna: pengguna.id,
      entitas: 'pengguna',
      idEntitas: pengguna.id,
      ringkasan: `Mengganti password sendiri; ${dicabut} sesi lain dicabut`,
      ip: asal.ip,
    });
  });

  return keSaya({ ...pengguna, wajibGantiPassword: false });
}
