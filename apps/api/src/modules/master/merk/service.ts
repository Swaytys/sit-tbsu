import type { DataMerk, Merk, StatusAktif } from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/** Merk barang (K-063). Tidak dihapus; dinonaktifkan (K-021). */

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Merk tidak ditemukan.', 404);
}

async function pastikanNamaBebas(tx: Tx, nama: string, kecualiId?: number): Promise<void> {
  if (await repo.namaDipakai(tx, nama, kecualiId)) {
    throw galatKolom('nama', `Merk "${nama}" sudah ada.`, 'KONFLIK');
  }
}

async function muat(id: number): Promise<Merk> {
  const baris = await repo.merkById(db, id);
  if (!baris) throw tidakDitemukan();
  return baris;
}

export function daftarMerk(status: StatusAktif | 'SEMUA'): Promise<Merk[]> {
  return repo.daftarMerk(db, status);
}

export async function tambahMerk(
  input: DataMerk,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Merk> {
  const data = { nama: input.nama, keterangan: input.keterangan ?? null };
  const id = await dalamTransaksi(async (tx) => {
    await pastikanNamaBebas(tx, data.nama);
    const idBaru = await repo.tambahMerk(tx, data);
    await catatLog(tx, {
      aksi: 'MERK_BUAT',
      idPengguna: pelaku.id,
      entitas: 'merk',
      idEntitas: idBaru,
      ringkasan: `Menambah merk ${data.nama}`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahMerk(
  id: number,
  input: DataMerk,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Merk> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciMerk(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = { nama: input.nama, keterangan: input.keterangan ?? null };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('nama')) await pastikanNamaBebas(tx, baru.nama, id);

    await repo.ubahMerk(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'MERK_UBAH',
      idPengguna: pelaku.id,
      entitas: 'merk',
      idEntitas: id,
      ringkasan: `Mengubah merk ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusMerk(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Merk> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciMerk(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahMerk(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'MERK_AKTIFKAN' : 'MERK_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'merk',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} merk ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
