import type { DataJenisAtribut, JenisAtribut, StatusAktif } from '@sit/shared';
import { db } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Jenis atribut barang (K-014): Panjang, Lebar, Warna, dll. Atribut ANGKA berdimensi mewajibkan satuan
 * berdimensi sama pada barang. Setelah dipakai barang, tipe nilai dan dimensinya dikunci.
 */

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Jenis atribut tidak ditemukan.', 404);
}

async function muat(id: number): Promise<JenisAtribut> {
  const baris = await repo.jenisAtributById(db, id);
  if (!baris) throw tidakDitemukan();
  return baris;
}

export function daftarJenisAtribut(status: StatusAktif | 'SEMUA'): Promise<JenisAtribut[]> {
  return repo.daftarJenisAtribut(db, status);
}

export async function tambahJenisAtribut(
  input: DataJenisAtribut,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<JenisAtribut> {
  const id = await dalamTransaksi(async (tx) => {
    if (await repo.kodeDipakai(tx, input.kode)) {
      throw galatKolom('kode', `Kode atribut "${input.kode}" sudah dipakai.`, 'KONFLIK');
    }
    const idBaru = await repo.tambahJenisAtribut(tx, input);
    await catatLog(tx, {
      aksi: 'JENIS_ATRIBUT_BUAT',
      idPengguna: pelaku.id,
      entitas: 'jenis_atribut',
      idEntitas: idBaru,
      ringkasan: `Menambah jenis atribut ${input.nama}`,
      dataBaru: input,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahJenisAtribut(
  id: number,
  input: DataJenisAtribut,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<JenisAtribut> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciJenisAtribut(tx, id);
    if (!lama) throw tidakDitemukan();
    const beda = selisih(lama, input);
    if (beda.kolom.length === 0) return;

    if (beda.kolom.includes('kode') && (await repo.kodeDipakai(tx, input.kode, id))) {
      throw galatKolom('kode', `Kode atribut "${input.kode}" sudah dipakai.`, 'KONFLIK');
    }
    const intiBerubah = beda.kolom.includes('tipeNilai') || beda.kolom.includes('jenisDimensi');
    if (intiBerubah && lama.jumlahBarang > 0) {
      throw new AppError(
        'KONFLIK',
        `Atribut ${lama.nama} sudah dipakai ${lama.jumlahBarang} barang; tipe nilai dan dimensinya tidak bisa diubah.`,
        409,
      );
    }

    await repo.ubahJenisAtribut(tx, id, input, sekarang());
    await catatLog(tx, {
      aksi: 'JENIS_ATRIBUT_UBAH',
      idPengguna: pelaku.id,
      entitas: 'jenis_atribut',
      idEntitas: id,
      ringkasan: `Mengubah jenis atribut ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusJenisAtribut(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<JenisAtribut> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciJenisAtribut(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahJenisAtribut(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'JENIS_ATRIBUT_AKTIFKAN' : 'JENIS_ATRIBUT_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'jenis_atribut',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} jenis atribut ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
