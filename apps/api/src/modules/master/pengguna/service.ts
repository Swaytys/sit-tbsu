import {
  LABEL_PERAN,
  type InputResetPassword,
  type MetaHalaman,
  type PenggunaDaftar,
  type Peran,
  type StatusAktif,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { hashPassword } from '../../../lib/password';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import * as repoAuth from '../../auth/repo';
import { pastikanPanjangPassword } from '../../auth/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanKodeMaster } from '../../sistem/penomoran';
import * as repo from './repo';

/*
 * Kelola pengguna — hanya Owner (`master.pengguna.kelola`, docs/04). Aturan docs/04 §7:
 * reset password → wajib ganti saat login berikutnya; menonaktifkan → semua sesinya dicabut;
 * Owner terakhir tidak bisa dinonaktifkan atau diturunkan perannya.
 */

type DataPengguna = {
  username: string;
  namaPengguna: string;
  peran: Peran;
  noHp?: string | null | undefined;
};

function keDaftar(b: repo.BarisPengguna): PenggunaDaftar {
  return {
    ...b,
    terkunciSampai: b.terkunciSampai?.toISOString() ?? null,
    loginTerakhir: b.loginTerakhir?.toISOString() ?? null,
  };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.', 404);
}

async function muatDaftar(id: number): Promise<PenggunaDaftar> {
  const baris = await repo.penggunaById(db, id);
  if (!baris) throw tidakDitemukan();
  return keDaftar(baris);
}

async function pastikanUsernameBebas(tx: Tx, username: string, kecualiId?: number): Promise<void> {
  if (await repo.usernameDipakai(tx, username, kecualiId)) {
    throw galatKolom('username', `Username "${username}" sudah dipakai.`, 'KONFLIK');
  }
}

/** Menolak bila `target` adalah satu-satunya Owner aktif (docs/04 §7). */
async function pastikanBukanOwnerTerakhir(
  tx: Tx,
  target: repo.BarisPengguna,
  aksi: string,
): Promise<void> {
  if (target.peran !== 'OWNER' || target.statusAktif !== 'AKTIF') return;
  if ((await repo.hitungOwnerAktifLain(tx, target.id)) === 0) {
    throw new AppError(
      'KONFLIK',
      `${target.namaPengguna} adalah satu-satunya Owner aktif, sehingga tidak bisa ${aksi}. Tambahkan Owner lain lebih dulu.`,
      409,
    );
  }
}

export async function daftarPengguna(p: {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
  halaman: number;
  perHalaman: number;
}): Promise<{ data: PenggunaDaftar[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPengguna(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keDaftar), meta: metaHalaman(total, p) };
}

export async function tambahPengguna(
  input: DataPengguna & { password: string },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  await pastikanPanjangPassword(input.password, 'password');
  const passwordHash = await hashPassword(input.password);

  const id = await dalamTransaksi(async (tx) => {
    await pastikanUsernameBebas(tx, input.username);
    const kode = await terbitkanKodeMaster(tx, 'USR');
    const data = {
      kode,
      username: input.username,
      namaPengguna: input.namaPengguna,
      peran: input.peran,
      noHp: input.noHp ?? null,
    };
    const idBaru = await repo.tambahPengguna(tx, { ...data, passwordHash });
    await catatLog(tx, {
      aksi: 'PENGGUNA_BUAT',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: idBaru,
      ringkasan: `Menambah ${data.namaPengguna} (${data.username}) sebagai ${LABEL_PERAN[data.peran]}`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });

  return muatDaftar(id);
}

export async function ubahPengguna(
  id: number,
  input: DataPengguna,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  await dalamTransaksi(async (tx) => {
    const target = await repo.kunciPengguna(tx, id);
    if (!target) throw tidakDitemukan();
    if (input.username !== target.username) await pastikanUsernameBebas(tx, input.username, id);
    if (input.peran !== target.peran)
      await pastikanBukanOwnerTerakhir(tx, target, 'diturunkan perannya');

    const lama = {
      username: target.username,
      namaPengguna: target.namaPengguna,
      peran: target.peran,
      noHp: target.noHp,
    };
    const baru = { ...lama, ...input, noHp: input.noHp ?? null };
    const kolomBerubah = (Object.keys(lama) as (keyof typeof lama)[]).filter(
      (k) => lama[k] !== baru[k],
    );
    if (kolomBerubah.length === 0) return;

    await repo.ubahPengguna(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'PENGGUNA_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: id,
      ringkasan: `Mengubah ${target.namaPengguna}: ${kolomBerubah.join(', ')}`,
      dataLama: Object.fromEntries(kolomBerubah.map((k) => [k, lama[k]])),
      dataBaru: Object.fromEntries(kolomBerubah.map((k) => [k, baru[k]])),
      ip: asal.ip,
    });
  });

  return muatDaftar(id);
}

export async function nonaktifkanPengguna(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  if (id === pelaku.id) {
    throw new AppError('KONFLIK', 'Anda tidak bisa menonaktifkan akun sendiri.', 409);
  }
  await dalamTransaksi(async (tx) => {
    const target = await repo.kunciPengguna(tx, id);
    if (!target) throw tidakDitemukan();
    if (target.statusAktif === 'NONAKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `${target.namaPengguna} sudah nonaktif.`, 409);
    }
    await pastikanBukanOwnerTerakhir(tx, target, 'dinonaktifkan');

    const waktu = sekarang();
    await repo.ubahStatusPengguna(tx, id, 'NONAKTIF', waktu);
    const dicabut = await repoAuth.cabutSesiPengguna(tx, id, 'NONAKTIF', waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: id,
      ringkasan: `Menonaktifkan ${target.namaPengguna}; ${dicabut} sesi dicabut`,
      dataLama: { statusAktif: 'AKTIF' },
      dataBaru: { statusAktif: 'NONAKTIF' },
      ip: asal.ip,
    });
  });
  return muatDaftar(id);
}

export async function aktifkanPengguna(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  await dalamTransaksi(async (tx) => {
    const target = await repo.kunciPengguna(tx, id);
    if (!target) throw tidakDitemukan();
    if (target.statusAktif === 'AKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `${target.namaPengguna} sudah aktif.`, 409);
    }
    await repo.ubahStatusPengguna(tx, id, 'AKTIF', sekarang());
    await catatLog(tx, {
      aksi: 'PENGGUNA_AKTIFKAN',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: id,
      ringkasan: `Mengaktifkan kembali ${target.namaPengguna}`,
      dataLama: { statusAktif: 'NONAKTIF' },
      dataBaru: { statusAktif: 'AKTIF' },
      ip: asal.ip,
    });
  });
  return muatDaftar(id);
}

/** Owner mengisi password baru; pengguna wajib menggantinya saat login berikutnya (docs/04 §7). */
export async function resetPassword(
  id: number,
  input: InputResetPassword,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  if (id === pelaku.id) {
    throw new AppError(
      'KONFLIK',
      'Untuk akun sendiri, gunakan menu Ganti password di pojok kanan atas.',
      409,
    );
  }
  await pastikanPanjangPassword(input.passwordBaru, 'passwordBaru');
  const passwordHash = await hashPassword(input.passwordBaru);

  await dalamTransaksi(async (tx) => {
    const target = await repo.kunciPengguna(tx, id);
    if (!target) throw tidakDitemukan();
    const waktu = sekarang();
    await repoAuth.ubahPassword(tx, id, passwordHash, true, waktu);
    const dicabut = await repoAuth.cabutSesiPengguna(tx, id, 'RESET_PASSWORD', waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_RESET_PASSWORD',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: id,
      ringkasan: `Mereset password ${target.namaPengguna}; wajib ganti saat login; ${dicabut} sesi dicabut`,
      ip: asal.ip,
    });
  });
  return muatDaftar(id);
}

/** Mencabut semua sesi seorang pengguna (sesi Owner yang sedang dipakai tidak ikut dicabut). */
export async function cabutSesiPengguna(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PenggunaDaftar> {
  await dalamTransaksi(async (tx) => {
    const target = await repo.kunciPengguna(tx, id);
    if (!target) throw tidakDitemukan();
    const kecuali = id === pelaku.id ? pelaku.idSesi : undefined;
    const dicabut = await repoAuth.cabutSesiPengguna(tx, id, 'DICABUT_OWNER', sekarang(), kecuali);
    await catatLog(tx, {
      aksi: 'PENGGUNA_CABUT_SESI',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: id,
      ringkasan: `Mencabut ${dicabut} sesi ${target.namaPengguna}`,
      ip: asal.ip,
    });
  });
  return muatDaftar(id);
}
