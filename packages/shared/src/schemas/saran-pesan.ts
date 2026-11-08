import { z } from 'zod';
import {
  METODE_SARAN_PESAN,
  STATUS_SARAN_PESAN,
  TINGKAT_LAYANAN_SARAN,
  type MetodeSaranPesan,
  type StatusSaranPesan,
  type TingkatLayananSaran,
} from '../enums';

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
  /** K-127: metode hitung (bawaan A rata-rata) dan tingkat layanan metode B. */
  metode: z.enum(METODE_SARAN_PESAN).default('RATA'),
  layanan: z.coerce
    .number()
    .refine(
      (v): v is TingkatLayananSaran => (TINGKAT_LAYANAN_SARAN as readonly number[]).includes(v),
      'Tingkat layanan hanya 90, 95, atau 98.',
    )
    .default(95),
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
  /** K-127. */
  metode: MetodeSaranPesan;
  tingkatLayanan: TingkatLayananSaran;
};

/**
 * K-242: stok diperkirakan habis sebelum barang berikutnya datang (dari order berjalan, atau bila dipesan hari ini).
 * Nilai rupiah: omzet hilang memakai harga jual dasar; laba kotor hilang hanya untuk `master.barang.lihat_hpp`.
 */
export type CelahStok = {
  habisPada: string;
  datangPada: string;
  /** JANJI = janji pemasok; DIMINTA = tanggal kirim diminta di order; PERKIRAAN = tanggal pesan + lama kirim;
   * PESAN_HARI_INI = belum ada order, bila dipesan hari ini. */
  sumberDatang: 'JANJI' | 'DIMINTA' | 'PERKIRAAN' | 'PESAN_HARI_INI';
  nomorOrder: string | null;
  namaPemasokOrder: string | null;
  noHpPemasokOrder: string | null;
  hariKosong: number;
  qtyHilang: string;
  omzetHilang: number;
  labaHilang?: number;
  /** Pemasok lain yang pernah memasok barang ini dan bisa datang lebih cepat (lama kirim terpendek dulu). */
  pemasokCepat: {
    idPemasok: number;
    namaPemasok: string;
    lamaKirimHari: number;
    datangPada: string;
  }[];
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
  /** K-127: metode yang benar-benar dipakai untuk baris ini (bisa A bila syarat metode pilihan tidak terpenuhi). */
  metode: MetodeSaranPesan;
  /** Alasan memakai metode lain, atau keterangan hitungan (mis. tren naik). */
  catatan: string | null;
  stokMaksimum: string | null;
  /** K-125: qty di order pembelian berjalan yang belum datang (mengurangi saran). */
  sudahDipesan: string;
  /** Lama kirim dari rata-rata order pembelian (≥ 3 PO), bukan isian Data Pemasok. */
  lamaKirimAktual: boolean;
  /** Hanya untuk pemegang `master.barang.lihat_hpp`. */
  hargaBeliTerakhir?: number;
  perkiraanBiaya?: number;
  /** K-242: kekosongan stok sebelum barang datang; `null` bila aman atau tidak terjual. */
  celah: CelahStok | null;
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
  /** K-242: ringkasan kekosongan stok (jumlah barang, omzet hilang; laba hanya dengan izin harga modal). */
  celah: { jumlahBarang: number; omzetHilang: number; labaHilang?: number };
  /** K-127 RO13: waktu hitung (ISO) dan apakah diambil dari simpanan memori server. */
  dihitungPada: string;
  dariSimpanan: boolean;
};
