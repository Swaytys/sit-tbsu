import type { DataKategori, Kategori, StatusAktif } from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/** Kategori barang (K-036). Tidak dihapus; dinonaktifkan (K-021). */

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Kategori tidak ditemukan.', 404);
}

async function pastikanNamaBebas(tx: Tx, nama: string, kecualiId?: number): Promise<void> {
  if (await repo.namaDipakai(tx, nama, kecualiId)) {
    const pesan = `Kategori "${nama}" sudah ada.`;
    throw new AppError('KONFLIK', pesan, 409, { kolom: { nama: [pesan] } });
  }
}

async function muat(id: number): Promise<Kategori> {
  const baris = await repo.kategoriById(db, id);
  if (!baris) throw tidakDitemukan();
  return baris;
}

export function daftarKategori(status: StatusAktif | 'SEMUA'): Promise<Kategori[]> {
  return repo.daftarKategori(db, status);
}

export async function tambahKategori(
  input: DataKategori,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kategori> {
  const data = { nama: input.nama, keterangan: input.keterangan ?? null, urutan: input.urutan };
  const id = await dalamTransaksi(async (tx) => {
    await pastikanNamaBebas(tx, data.nama);
    const idBaru = await repo.tambahKategori(tx, data);
    await catatLog(tx, {
      aksi: 'KATEGORI_BUAT',
      idPengguna: pelaku.id,
      entitas: 'kategori',
      idEntitas: idBaru,
      ringkasan: `Menambah kategori ${data.nama}`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahKategori(
  id: number,
  input: DataKategori,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kategori> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciKategori(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = { nama: input.nama, keterangan: input.keterangan ?? null, urutan: input.urutan };
    const beda = selisih(lama, baru);
    if (beda.kolom.length === 0) return;
    if (beda.kolom.includes('nama')) await pastikanNamaBebas(tx, baru.nama, id);

    await repo.ubahKategori(tx, id, baru, sekarang());
    await catatLog(tx, {
      aksi: 'KATEGORI_UBAH',
      idPengguna: pelaku.id,
      entitas: 'kategori',
      idEntitas: id,
      ringkasan: `Mengubah kategori ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusKategori(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Kategori> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciKategori(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahKategori(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'KATEGORI_AKTIFKAN' : 'KATEGORI_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'kategori',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} kategori ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
