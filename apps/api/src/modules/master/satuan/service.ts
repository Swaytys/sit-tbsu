import {
  JENIS_DIMENSI_FISIK,
  bandingQty,
  type DataSatuan,
  type Satuan,
  type StatusAktif,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Master satuan (docs/03 §3.2, K-014). Aturan:
 * - Dimensi fisik (PANJANG, LUAS, VOLUME, BERAT, DAYA): tepat satu satuan basis berfaktor 1; satuan lain
 *   berfaktor terhadap basis itu, sehingga basis harus ada lebih dulu.
 * - Satuan hitung (JUMLAH) dan LAINNYA berdiri sendiri: selalu basis, faktor 1.
 * - Satuan yang sudah dipakai barang tidak boleh diubah dimensi, faktor, atau status basisnya, karena
 *   arti angka pada barang/atribut ikut berubah.
 */

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Satuan tidak ditemukan.', 404);
}

/** Satuan hitung/lainnya selalu basis berfaktor 1. */
function normalisasi(input: DataSatuan): DataSatuan {
  return DIMENSI_FISIK.includes(input.jenisDimensi)
    ? input
    : { ...input, isBasis: true, faktorKeBasis: '1' };
}

async function periksaAturan(tx: Tx, data: DataSatuan, kecualiId?: number): Promise<void> {
  if (await repo.kodeDipakai(tx, data.kode, kecualiId)) {
    throw galatKolom('kode', `Kode satuan "${data.kode}" sudah dipakai.`, 'KONFLIK');
  }
  if (!DIMENSI_FISIK.includes(data.jenisDimensi)) return;

  const basis = await repo.basisDimensi(tx, data.jenisDimensi, kecualiId);
  if (data.isBasis && basis) {
    throw galatKolom(
      'isBasis',
      `Dimensi ${data.jenisDimensi.toLowerCase()} sudah punya satuan basis (${basis.kode}).`,
      'KONFLIK',
    );
  }
  if (!data.isBasis && !basis) {
    throw galatKolom(
      'isBasis',
      `Dimensi ${data.jenisDimensi.toLowerCase()} belum punya satuan basis; buat satuan basis lebih dulu.`,
      'KONFLIK',
    );
  }
}

async function muat(id: number): Promise<Satuan> {
  const baris = await repo.satuanById(db, id);
  if (!baris) throw tidakDitemukan();
  return baris;
}

/** Daftar satuan untuk halaman master dan pilihan satuan di form. */
export async function daftarSatuan(status: StatusAktif | 'SEMUA' = 'SEMUA'): Promise<Satuan[]> {
  return repo.semuaSatuan(db, status);
}

export async function tambahSatuan(
  input: DataSatuan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Satuan> {
  const data = normalisasi(input);
  const id = await dalamTransaksi(async (tx) => {
    await periksaAturan(tx, data);
    const idBaru = await repo.tambahSatuan(tx, data);
    await catatLog(tx, {
      aksi: 'SATUAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'satuan',
      idEntitas: idBaru,
      ringkasan: `Menambah satuan ${data.kode} (${data.nama})`,
      dataBaru: data,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahSatuan(
  id: number,
  input: DataSatuan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Satuan> {
  const data = normalisasi(input);
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciSatuan(tx, id);
    if (!lama) throw tidakDitemukan();

    const faktorSama = bandingQty(lama.faktorKeBasis, data.faktorKeBasis) === 0;
    const inti = {
      jenisDimensi: data.jenisDimensi,
      isBasis: data.isBasis,
      faktorKeBasis: faktorSama ? lama.faktorKeBasis : data.faktorKeBasis,
    };
    const beda = selisih(lama, { kode: data.kode, nama: data.nama, ...inti });
    if (beda.kolom.length === 0) return;

    const intiBerubah = beda.kolom.some((k) => k in inti);
    if (intiBerubah && lama.jumlahDipakai > 0) {
      throw new AppError(
        'KONFLIK',
        `Satuan ${lama.kode} sudah dipakai ${lama.jumlahDipakai} kali; dimensi, faktor, dan status basis tidak bisa diubah.`,
        409,
      );
    }
    await periksaAturan(tx, data, id);

    await repo.ubahSatuan(tx, id, { kode: data.kode, nama: data.nama, ...inti }, sekarang());
    await catatLog(tx, {
      aksi: 'SATUAN_UBAH',
      idPengguna: pelaku.id,
      entitas: 'satuan',
      idEntitas: id,
      ringkasan: `Mengubah satuan ${lama.kode}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusSatuan(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Satuan> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunciSatuan(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    await repo.ubahSatuan(tx, id, { statusAktif }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'SATUAN_AKTIFKAN' : 'SATUAN_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'satuan',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} satuan ${lama.kode}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}
