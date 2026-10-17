import { z } from 'zod';
import { STATUS_SARAN_PESAN, type StatusSaranPesan } from '../enums';

/*
 * Rekomendasi pemesanan ulang (K-113, docs/05 §17 RO1–RO8). Semua angka dihitung server dari ledger stok
 * (penjualan bersih N hari terakhir sampai kemarin) dan parameter pemasok/pengaturan; layar hanya menampilkan.
 */

export const skemaCariSaranPesan = z.object({
  /** PERLU = Pesan sekarang + Segera pesan (bawaan); SEMUA = termasuk Aman dan Tidak laku. */
  tampil: z.enum(['PERLU', ...STATUS_SARAN_PESAN, 'SEMUA']).default('PERLU'),
  idPemasok: z.coerce.number().int().positive().optional(),
  idKategori: z.coerce.number().int().positive().optional(),
  cari: z.string().trim().max(100).optional(),
});
export type ParamCariSaranPesan = z.input<typeof skemaCariSaranPesan>;

/** Parameter yang dipakai menghitung, ditampilkan agar setiap angka bisa ditelusuri. */
export type ParameterSaranPesan = {
  /** Hari pengamatan (RO1), mis. 30. */
  periodeHari: number;
  /** Rentang tanggal pengamatan (tanggal operasional, sampai kemarin). */
  dari: string;
  sampai: string;
  hariPengaman: number;
  lamaKirimBawaan: number;
  jarakBelanjaBawaan: number;
};

export type BarisSaranPesan = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  idPemasok: number | null;
  /** Pemasok penerimaan pembelian terakhir; `null` = belum pernah dibeli. */
  namaPemasok: string | null;
  /** Hari yang benar-benar diamati (≤ periode; lebih pendek untuk barang baru), RO1. */
  hariAmatan: number;
  /** Terjual bersih selama hari amatan (satuan dasar, teks desimal). */
  terjual: string;
  /** Rata-rata terjual per hari (teks desimal, 3 angka). */
  rataPerHari: string;
  stokTersedia: string;
  stokMinimum: string;
  lamaKirimHari: number;
  jarakBelanjaHari: number;
  /** RO2: rata × hari pengaman. */
  stokPengaman: string;
  /** RO3: rata × lama kirim + stok pengaman. */
  titikPesan: string;
  /** RO4: kebutuhan sampai belanja berikutnya tiba. */
  stokTarget: string;
  /** RO5: saran qty pesan (satuan dasar, bilangan bulat ke atas, ≥ 0). */
  saranPesan: string;
  /** Saran dalam kemasan beli terbesar yang aktif, mis. "6 dus (isi 10)"; `null` bila tidak ada kemasan. */
  saranKemasan: string | null;
  /** Stok tersedia ÷ rata per hari; `null` bila tidak terjual. */
  hariCukup: string | null;
  status: StatusSaranPesan;
  /** Hanya untuk pemegang `master.barang.lihat_hpp`. */
  hargaBeliTerakhir?: number;
  perkiraanBiaya?: number;
};

export type RingkasanPemasokSaran = {
  idPemasok: number | null;
  namaPemasok: string;
  jumlahBarang: number;
  /** Hanya untuk pemegang `master.barang.lihat_hpp`. */
  perkiraanBiaya?: number;
};

export type HasilSaranPesan = {
  parameter: ParameterSaranPesan;
  jumlah: Record<StatusSaranPesan, number>;
  baris: BarisSaranPesan[];
  perPemasok: RingkasanPemasokSaran[];
};
