import { z } from 'zod';
import type { MetaHalaman } from '../api';
import type { StatusHutang } from '../enums';
import { tanggalSah } from '../tanggal';
import type { PembayaranPemasok } from './hutang';
import { skemaTanggal } from './persediaan';
import { skemaHalaman, teksOpsional } from './umum';

/*
 * Penyelesaian konsinyasi (Fase 11; docs/06 KS5–KS9, K-089): setoran ke pemasok penitip atas barang titipan yang
 * laku, dikurangi retur pelanggan kondisi baik. Semua angka dihitung API.
 */

const idPemasok = z.coerce
  .number('Pemasok wajib dipilih.')
  .int()
  .positive('Pemasok wajib dipilih.');

const periodeSelesai = skemaTanggal('Tanggal akhir periode').refine(
  tanggalSah,
  'Tanggal akhir periode tidak valid.',
);

/** Pratinjau setoran: semua penjualan titipan pemasok ini yang belum disetor s/d `periodeSelesai`. */
export const skemaPratinjauKonsinyasi = z.object({ idPemasok, periodeSelesai });
export type ParamPratinjauKonsinyasi = z.input<typeof skemaPratinjauKonsinyasi>;

export const skemaPenyelesaianKonsinyasi = z.object({
  idPemasok,
  periodeSelesai,
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputPenyelesaianKonsinyasi = z.input<typeof skemaPenyelesaianKonsinyasi>;
export type DataPenyelesaianKonsinyasi = z.output<typeof skemaPenyelesaianKonsinyasi>;

/** Satu baris setoran: per barang per harga titip saat jual (KS9). */
export type BarisSetoranKonsinyasi = {
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  hargaTitip: number;
  qtyTerjual: string;
  /** Retur pelanggan (baik maupun rusak; termasuk koreksi atas baris yang sudah disetor, K-092). */
  qtyRetur: string;
  /** Barang titipan yang dimusnahkan toko: toko menanggung, tetap dibayar ke penitip (K-092). */
  qtyGantiRugi: string;
  /** Terjual − retur + ganti rugi. */
  qtyNeto: string;
  subtotal: number;
};

export type PratinjauKonsinyasi = {
  idPemasok: number;
  namaPemasok: string;
  periodeMulai: string;
  periodeSelesai: string;
  baris: BarisSetoranKonsinyasi[];
  total: number;
  /** Jumlah baris penjualan yang akan ditandai disetor. */
  jumlahBarisJual: number;
  /** Jumlah baris pemusnahan barang titipan yang ditagihkan sebagai ganti rugi. */
  jumlahBarisGantiRugi: number;
  /** Retur atas baris yang sudah disetor yang belum bisa dikoreksi (penjualan baru belum cukup). */
  koreksiDitunda: number;
};

export type BarisDaftarPenyelesaianKonsinyasi = {
  id: number;
  nomor: string;
  tanggal: string;
  idPemasok: number;
  namaPemasok: string;
  periodeMulai: string;
  periodeSelesai: string;
  total: number;
  totalDibayar: number;
  sisaHutang: number;
  statusHutang: StatusHutang;
  namaPengguna: string;
};

export type DetailPenyelesaianKonsinyasi = BarisDaftarPenyelesaianKonsinyasi & {
  catatan: string | null;
  baris: BarisSetoranKonsinyasi[];
  pembayaran: PembayaranPemasok[];
};

export const skemaCariPenyelesaianKonsinyasi = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idPemasok: z.coerce.number().int().positive().optional(),
});
export type ParamCariPenyelesaianKonsinyasi = z.input<typeof skemaCariPenyelesaianKonsinyasi>;

/** KS8: posisi konsinyasi per pemasok penitip. */
export type RingkasanKonsinyasiPemasok = {
  idPemasok: number;
  namaPemasok: string;
  /** Barang titipan aktif yang masih ada stoknya. */
  jumlahBarang: number;
  /** Stok titipan (baik + rusak) × harga titip saat ini. */
  nilaiStokTitipan: number;
  /** Penjualan titipan + ganti rugi pemusnahan yang belum disetor (sebelum dikurangi retur). */
  nilaiBelumDisetor: number;
  sisaHutang: number;
  terakhirDisetor: string | null;
};

export type DaftarPenyelesaianKonsinyasi = {
  data: BarisDaftarPenyelesaianKonsinyasi[];
  meta: MetaHalaman;
};
