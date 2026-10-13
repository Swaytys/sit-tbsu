import {
  labelRekening,
  type DataRekening,
  type MetodePembayaran,
  type RekeningToko,
  type StatusAktif,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { selisih } from '../../../lib/perubahan';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Rekening toko (K-111): tujuan pembayaran non-tunai yang diterima toko (rekening bank, mesin EDC, QRIS).
 * Data master: tidak dihapus, dinonaktifkan. Kasir memilih dari daftar ini saat mencatat pembayaran, sehingga
 * tidak ada nomor rekening yang diketik ulang.
 */

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Rekening tidak ditemukan.', 404);
}

function keRespons(b: NonNullable<Awaited<ReturnType<typeof repo.byId>>>): RekeningToko {
  return { ...b, statusAktif: b.statusAktif === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF' };
}

export async function daftarRekening(status: StatusAktif | 'SEMUA'): Promise<RekeningToko[]> {
  return (await repo.daftar(db, status)).map(keRespons);
}

async function muat(id: number, ex: Executor = db): Promise<RekeningToko> {
  const b = await repo.byId(ex, id);
  if (!b) throw tidakDitemukan();
  return keRespons(b);
}

function nilaiDari(input: DataRekening): repo.NilaiRekening {
  return {
    jenis: input.jenis,
    bank: input.bank,
    nomor: input.nomor ?? null,
    atasNama: input.atasNama ?? null,
    nama: labelRekening(input),
    isDefault: input.isDefault,
  };
}

async function pastikanTidakKembar(tx: Tx, n: repo.NilaiRekening, kecuali?: number) {
  if (await repo.kembar(tx, n.jenis, n.nama, kecuali)) {
    throw galatKolom('bank', `Rekening "${n.nama}" sudah ada untuk jenis ini.`);
  }
}

export async function tambahRekening(
  input: DataRekening,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<RekeningToko> {
  const nilai = nilaiDari(input);
  const id = await dalamTransaksi(async (tx) => {
    await pastikanTidakKembar(tx, nilai);
    const waktu = sekarang();
    if (nilai.isDefault) await repo.lepasBawaan(tx, nilai.jenis, null, waktu);
    const idBaru = await repo.tambah(tx, nilai);
    await catatLog(tx, {
      aksi: 'REKENING_BUAT',
      idPengguna: pelaku.id,
      entitas: 'rekening_toko',
      idEntitas: idBaru,
      ringkasan: `Menambah rekening ${nilai.jenis.toLowerCase()} ${nilai.nama}${nilai.isDefault ? ' (bawaan)' : ''}`,
      dataBaru: nilai,
      ip: asal.ip,
    });
    return idBaru;
  });
  return muat(id);
}

export async function ubahRekening(
  id: number,
  input: DataRekening,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<RekeningToko> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunci(tx, id);
    if (!lama) throw tidakDitemukan();
    const baru = nilaiDari(input);
    const beda = selisih(
      {
        jenis: lama.jenis,
        bank: lama.bank,
        nomor: lama.nomor,
        atasNama: lama.atasNama,
        nama: lama.nama,
        isDefault: lama.isDefault,
      },
      baru,
    );
    if (beda.kolom.length === 0) return;
    if (baru.isDefault && lama.statusAktif !== 'AKTIF') {
      throw galatKolom('isDefault', 'Rekening nonaktif tidak bisa dijadikan bawaan.');
    }
    await pastikanTidakKembar(tx, baru, id);
    const waktu = sekarang();
    if (baru.isDefault) await repo.lepasBawaan(tx, baru.jenis, id, waktu);
    await repo.ubah(tx, id, baru, waktu);
    await catatLog(tx, {
      aksi: 'REKENING_UBAH',
      idPengguna: pelaku.id,
      entitas: 'rekening_toko',
      idEntitas: id,
      ringkasan: `Mengubah rekening ${lama.nama}: ${beda.kolom.join(', ')}`,
      dataLama: beda.dataLama,
      dataBaru: beda.dataBaru,
      ip: asal.ip,
    });
  });
  return muat(id);
}

export async function ubahStatusRekening(
  id: number,
  statusAktif: StatusAktif,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<RekeningToko> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kunci(tx, id);
    if (!lama) throw tidakDitemukan();
    if (lama.statusAktif === statusAktif) return;
    // Rekening yang diaktifkan lagi tidak otomatis menjadi bawaan (bisa bentrok dengan bawaan sekarang).
    await repo.ubah(tx, id, { statusAktif, isDefault: false }, sekarang());
    await catatLog(tx, {
      aksi: statusAktif === 'AKTIF' ? 'REKENING_AKTIFKAN' : 'REKENING_NONAKTIF',
      idPengguna: pelaku.id,
      entitas: 'rekening_toko',
      idEntitas: id,
      ringkasan: `${statusAktif === 'AKTIF' ? 'Mengaktifkan' : 'Menonaktifkan'} rekening ${lama.nama}`,
      dataLama: { statusAktif: lama.statusAktif },
      dataBaru: { statusAktif },
      ip: asal.ip,
    });
  });
  return muat(id);
}

/**
 * Rekening toko yang dipilih kasir untuk satu pembayaran non-tunai: harus ada, AKTIF, dan jenisnya sama
 * dengan metode pembayaran. Mengembalikan id dan label yang disalin ke pembayaran.
 */
export async function rekeningUntukBayar(
  tx: Tx,
  id: number,
  metode: MetodePembayaran,
  kolom: string,
): Promise<{ id: number; nama: string }> {
  const r = await repo.byId(tx, id);
  if (r?.statusAktif !== 'AKTIF' || r.jenis !== metode) {
    throw galatKolom(
      kolom,
      'Rekening tujuan tidak ditemukan, nonaktif, atau bukan untuk metode pembayaran ini.',
    );
  }
  return { id: r.id, nama: r.nama };
}
