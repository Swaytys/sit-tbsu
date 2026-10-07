import {
  bolehLihatLaporan,
  infoLaporan,
  skemaIdParam,
  skemaLaporanDaftarHarga,
  skemaLaporanHutang,
  skemaLaporanKartuStok,
  skemaLaporanKonsinyasi,
  skemaLaporanLabaKotor,
  skemaLaporanNilaiPersediaan,
  skemaLaporanPenjualan,
  skemaLaporanPiutang,
  skemaLaporanProdukTerlaris,
  skemaLaporanPromo,
  skemaLaporanRetur,
  skemaLaporanRiwayatHargaBeli,
  skemaLaporanStokMinimum,
  skemaLaporanStokRekap,
  type DokumenLaporan,
  type JenisLaporan,
} from '@sit/shared';
import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { galatValidasi } from '../../lib/validasi';
import { catatLog } from '../sistem/log-aktivitas';
import { tampilanToko } from '../sistem/pengaturan/service';
import { laporanDaftarHarga } from './daftar-harga';
import { laporanDetailInvoice } from './detail-invoice';
import { eksporExcel } from './ekspor';
import { laporanHutang } from './hutang';
import { laporanKartuStok } from './kartu-stok';
import { laporanKonsinyasi } from './konsinyasi';
import { laporanLabaKotor } from './laba-kotor';
import { laporanNilaiPersediaan } from './nilai-persediaan';
import { laporanPenjualanPeriode } from './penjualan-periode';
import { laporanPiutang } from './piutang';
import { laporanProdukTerlaris } from './produk-terlaris';
import { laporanPromo } from './promo';
import { laporanReturPenjualan } from './retur-penjualan';
import { laporanRiwayatHargaBeli } from './riwayat-harga-beli';
import { laporanStokMinimum } from './stok-minimum';
import { laporanStokRekap } from './stok-rekap';

/** Satu pintu menyusun laporan dari parameter query mentah (dipakai ekspor Excel). */

function urai<S extends z.ZodType>(skema: S, query: Record<string, string>): z.output<S> {
  const hasil = skema.safeParse(query);
  if (!hasil.success) throw galatValidasi(hasil.error);
  return hasil.data;
}

export function susunLaporan(
  kode: JenisLaporan,
  query: Record<string, string>,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  switch (kode) {
    case 'stok-rekap':
      return laporanStokRekap(urai(skemaLaporanStokRekap, query), pelaku);
    case 'kartu-stok':
      return laporanKartuStok(urai(skemaLaporanKartuStok, query), pelaku);
    case 'stok-minimum':
      return laporanStokMinimum(urai(skemaLaporanStokMinimum, query), pelaku);
    case 'nilai-persediaan':
      return laporanNilaiPersediaan(urai(skemaLaporanNilaiPersediaan, query), pelaku);
    case 'penjualan':
      return laporanPenjualanPeriode(urai(skemaLaporanPenjualan, query), pelaku);
    case 'produk-terlaris':
      return laporanProdukTerlaris(urai(skemaLaporanProdukTerlaris, query), pelaku);
    case 'detail-invoice':
      return laporanDetailInvoice(urai(skemaIdParam, query).id, pelaku);
    case 'retur-penjualan':
      return laporanReturPenjualan(urai(skemaLaporanRetur, query), pelaku);
    case 'laba-kotor':
      return laporanLabaKotor(urai(skemaLaporanLabaKotor, query), pelaku);
    case 'piutang':
      return laporanPiutang(urai(skemaLaporanPiutang, query), pelaku);
    case 'promo':
      return laporanPromo(urai(skemaLaporanPromo, query), pelaku);
    case 'riwayat-harga-beli':
      return laporanRiwayatHargaBeli(urai(skemaLaporanRiwayatHargaBeli, query), pelaku);
    case 'hutang':
      return laporanHutang(urai(skemaLaporanHutang, query), pelaku);
    case 'konsinyasi':
      return laporanKonsinyasi(urai(skemaLaporanKonsinyasi, query), pelaku);
    case 'daftar-harga':
      return laporanDaftarHarga(urai(skemaLaporanDaftarHarga, query), pelaku);
  }
}

function pastikanBoleh(kode: JenisLaporan, pelaku: PenggunaAktif) {
  if (!bolehLihatLaporan(pelaku.izin, kode)) {
    throw new AppError('TIDAK_BERIZIN', 'Anda tidak memiliki izin untuk laporan ini.', 403);
  }
}

/** Ekspor Excel (izin `laporan.ekspor` + izin laporannya), dicatat LAPORAN_EKSPOR. */
export async function eksporLaporan(
  kode: JenisLaporan,
  query: Record<string, string>,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  pastikanBoleh(kode, pelaku);
  const dokumen = await susunLaporan(kode, query, pelaku);
  const berkas = await eksporExcel(dokumen, await tampilanToko());
  await catatLog(db, {
    aksi: 'LAPORAN_EKSPOR',
    idPengguna: pelaku.id,
    entitas: 'laporan',
    ringkasan: `Ekspor Excel ${dokumen.judul} — ${dokumen.subjudul[0] ?? ''}`.slice(0, 255),
    dataBaru: { kode, format: 'XLSX', parameter: query },
    ip: asal.ip,
  });
  return berkas;
}

/** Cetak PDF dilakukan peramban; server hanya mencatat log-nya. */
export async function catatCetak(
  kode: JenisLaporan,
  keterangan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  pastikanBoleh(kode, pelaku);
  const judul = infoLaporan(kode).judul;
  await catatLog(db, {
    aksi: 'LAPORAN_EKSPOR',
    idPengguna: pelaku.id,
    entitas: 'laporan',
    ringkasan: `Cetak ${judul}${keterangan ? ` — ${keterangan}` : ''}`.slice(0, 255),
    dataBaru: { kode, format: 'PDF' },
    ip: asal.ip,
  });
}
