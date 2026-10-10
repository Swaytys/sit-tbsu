import type { DataGolonganPelanggan, GolonganPelanggan, StatusAktif } from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/** Golongan pelanggan (K-097): sasaran promo. Tidak dihapus; dinonaktifkan (K-021). */

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Golongan pelanggan tidak ditemukan.', 404);
}

async function pastikanNamaBebas(tx: Tx, nama: string, kecualiId?: number): Promise<void> {
  if (await repo.namaDipakai(tx, nama, kecualiId)) {
    throw galatKolom('nama', `Golongan "${nama}" sudah ada.`, 'KONFLIK');
  }
}

async function muat(id: number): Promise<GolonganPelanggan> {
  const baris = await repo.golonganById(db, id);
  if (!baris) throw tidakDitemukan();
  return baris;
}

export function daftarGolongan(status: StatusAktif | 'SEMUA'): Promise<GolonganPelanggan[]> {
  return repo.daftarGolongan(db, status);
}

export async function tambahGolongan(
  input: DataGolonganPelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<GolonganPelanggan> {
  const data = { nama: input.nama, keterangan: input.keterangan ?? null };
  const id = await dalamTransaksi(async (tx) => {
    await pastikanNamaBebas(tx, data.nama);
    const idBaru = await repo.tambahGolongan(tx, data);
    await catatLog(tx, {
      aksi: 'GOLONGAN_PELANGGAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'golongan_pelanggan',
      idEntitas: idBaru,
      ringkasan: `Menambah golongan pelanggan ${data.nama}`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahGolongan(
  id: number,
  input: DataGolonganPelanggan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<GolonganPelanggan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciGolongan(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = { nama: input.nama, keterangan: input.keterangan ?? null };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('nama')) await pastikanNamaBebas(tx, baru.nama, id);

    await repo.ubahGolongan(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'GOLONGAN_PELANGGAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'golongan_pelanggan',
      idEntitas: id,
      ringkasan: `Mengubah golongan pelanggan ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusGolongan(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<GolonganPelanggan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciGolongan(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahGolongan(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'GOLONGAN_PELANGGAN_AKTIFKAN' : 'GOLONGAN_PELANGGAN_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'golongan_pelanggan',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} golongan pelanggan ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
