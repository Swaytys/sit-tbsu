import {
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
  skemaLaporanRekomendasiPesan,
  skemaLaporanStokMinimum,
  skemaLaporanStokRekap,
  type JenisLaporan,
} from '@sit/shared';
import type { z } from 'zod';
import { tanggalHariIni } from '@/lib/format';
import { rentangPreset } from './periode';

/** Skema parameter yang sama dengan API (CLAUDE.md aturan 10): pesan galat identik. */
const SKEMA: Record<JenisLaporan, z.ZodType> = {
  'stok-rekap': skemaLaporanStokRekap,
  'kartu-stok': skemaLaporanKartuStok,
  'stok-minimum': skemaLaporanStokMinimum,
  'rekomendasi-pesan': skemaLaporanRekomendasiPesan,
  'nilai-persediaan': skemaLaporanNilaiPersediaan,
  penjualan: skemaLaporanPenjualan,
  'produk-terlaris': skemaLaporanProdukTerlaris,
  'detail-invoice': skemaIdParam,
  'retur-penjualan': skemaLaporanRetur,
  'laba-kotor': skemaLaporanLabaKotor,
  piutang: skemaLaporanPiutang,
  promo: skemaLaporanPromo,
  'riwayat-harga-beli': skemaLaporanRiwayatHargaBeli,
  hutang: skemaLaporanHutang,
  konsinyasi: skemaLaporanKonsinyasi,
  'daftar-harga': skemaLaporanDaftarHarga,
};

/** Pesan galat pertama parameter laporan, atau null bila sah. */
export function periksaParam(kode: JenisLaporan, param: Record<string, string>): string | null {
  const r = SKEMA[kode].safeParse(param);
  return r.success ? null : (r.error.issues[0]?.message ?? 'Parameter laporan tidak valid.');
}

/** Laporan berbasis rentang tanggal (memakai pilihan periode). */
export const BERPERIODE: ReadonlySet<JenisLaporan> = new Set([
  'stok-rekap',
  'kartu-stok',
  'penjualan',
  'produk-terlaris',
  'retur-penjualan',
  'laba-kotor',
  'promo',
  'riwayat-harga-beli',
  'konsinyasi',
]);

/** Parameter awal saat laporan dipilih. */
export function paramAwal(kode: JenisLaporan): Record<string, string> {
  const bulanIni = rentangPreset('bulan-ini');
  switch (kode) {
    case 'nilai-persediaan':
      return { tanggal: tanggalHariIni() };
    case 'stok-minimum':
    case 'rekomendasi-pesan':
    case 'piutang':
    case 'hutang':
    case 'daftar-harga':
    case 'detail-invoice':
      return {};
    case 'produk-terlaris':
      return { ...bulanIni, batas: '10' };
    case 'laba-kotor':
      return { ...bulanIni, tampilan: 'BARANG' };
    default:
      return bulanIni;
  }
}
