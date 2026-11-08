import { z } from 'zod';
import { STATUS_AKTIF, type StatusAktif } from '../enums';
import { formatRupiah } from '../money';
import { skemaKodePersetujuan } from './saluran';
import { skemaHalaman, skemaNoHpWajib, skemaRupiah, teksOpsional } from './umum';

/*
 * Mitra: pelanggan dan pemasok (docs/03 §3.2). Kode `PLG-00001` / `PMS-00001` dari penomoran, tidak bisa
 * diubah (N5). Tidak ada hapus; dinonaktifkan (K-021).
 */

/** Daftar mitra: cari (nama, kode, No. HP), saring status, berhalaman. */
export const skemaCariMitra = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
});
export type ParamCariMitra = z.input<typeof skemaCariMitra>;

const email = teksOpsional(100, 'Email maksimal 100 karakter.').refine(
  (v) => v === null || v === undefined || z.email().safeParse(v).success,
  'Format email tidak valid.',
);

// --- Pelanggan ---

/** Isian kosong pada form berarti "tidak diisi". */
const kosongJadiUndefined = (v: unknown) => (v === '' ? undefined : v);
const kosongJadiNull = (v: unknown) => (v === '' ? null : v);
const hariOpsional = (label: string, min: number, maks: number) =>
  z.coerce
    .number(`${label} harus berupa angka.`)
    .int(`${label} harus bilangan bulat.`)
    .min(min, `${label} minimal ${min} hari.`)
    .max(maks, `${label} maksimal ${maks} hari.`)
    .nullable()
    .optional();

/**
 * Term hari dan limit kredit hanya boleh diatur pemegang `master.pelanggan.atur_kredit` (K-059). Kolom yang
 * tidak dikirim (`undefined`) berarti: pelanggan baru memakai bawaan toko; ubah data mempertahankan nilai lama.
 * Golongan (K-097) dipakai sasaran promo, bukan harga jual.
 */
export const skemaPelanggan = z.object({
  namaPelanggan: z
    .string('Nama pelanggan wajib diisi.')
    .trim()
    .min(1, 'Nama pelanggan wajib diisi.')
    .max(100, 'Nama pelanggan maksimal 100 karakter.')
    // K-137: spasi berlebih dirapikan.
    .transform((v) => v.replace(/\s+/g, ' ')),
  noHp: skemaNoHpWajib,
  email,
  alamat: teksOpsional(255, 'Alamat maksimal 255 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
  /** Golongan pelanggan untuk sasaran promo (K-097); `null` = tanpa golongan. */
  idGolongan: z.number().int().positive().nullable().optional(),
  /** K-164: versi data yang dimuat form; beda dengan versi sekarang = ditolak. */
  versi: z.string().max(40).nullable().optional(),
  termHari: z.preprocess(
    kosongJadiUndefined,
    z.coerce
      .number('Term harus berupa angka.')
      .int('Term harus bilangan bulat.')
      .min(0, 'Term minimal 0 hari.')
      .max(365, 'Term maksimal 365 hari.')
      .optional(),
  ),
  /** `null` = tanpa limit. Disimpan saja; ditegakkan di M2 (docs/06 PT6). */
  limitKredit: z.preprocess(kosongJadiNull, skemaRupiah.nullable().optional()),
  /**
   * K-104: saat menambah pelanggan, simpan `limitKredit` isian ini sebagai limit bawaan pelanggan baru
   * (`konfigurasi.limit_kredit_default`; kosong = tanpa limit). Butuh `master.pelanggan.atur_kredit`.
   */
  jadikanLimitBawaan: z.boolean().optional(),
  /** K-137: pengguna menegaskan ini pelanggan berbeda walau ada yang mirip (nama/No. HP sama). */
  abaikanMirip: z.boolean().optional(),
});
export type InputPelanggan = z.input<typeof skemaPelanggan>;
export type DataPelanggan = z.output<typeof skemaPelanggan>;

/*
 * K-107: mengubah data pelanggan yang sudah ada, menonaktifkan, atau mengaktifkannya kembali oleh pengguna
 * tanpa `master.pelanggan.atur_kredit` (Kasir, Staf Penjualan) butuh kode sekali pakai dari Admin/Owner.
 * Menambah pelanggan baru tidak butuh kode. `kodeAtasan` diabaikan untuk pemegang izin itu.
 */
export const skemaUbahPelanggan = skemaPelanggan.extend({
  kodeAtasan: skemaKodePersetujuan.nullable().optional(),
});
export type DataUbahPelanggan = z.output<typeof skemaUbahPelanggan>;

export const skemaStatusPelanggan = z.object({
  statusAktif: z.enum(STATUS_AKTIF),
  kodeAtasan: skemaKodePersetujuan.nullable().optional(),
});
export type DataStatusPelanggan = z.output<typeof skemaStatusPelanggan>;

/** Permintaan kode untuk SATU perubahan; kode hanya berlaku untuk perubahan yang persis sama. */
export const skemaMintaKodePelanggan = z.discriminatedUnion('aksi', [
  z.object({ aksi: z.literal('UBAH'), data: skemaPelanggan }),
  z.object({ aksi: z.literal('STATUS'), statusAktif: z.enum(STATUS_AKTIF) }),
]);
export type DataMintaKodePelanggan = z.output<typeof skemaMintaKodePelanggan>;

/**
 * Posisi kredit pelanggan saat ini (K-107), dihitung dari penjualan yang belum lunas (bukan VOID). Tampil di
 * Data Pelanggan agar limit, tagihan berjalan, dan keterlambatan terlihat tanpa membuka halaman Piutang.
 */
export type PosisiKreditPelanggan = {
  /** Jumlah sisa tagihan semua nota yang belum lunas. */
  piutang: number;
  jumlahNota: number;
  /** `limitKredit − piutang`; `null` = tanpa limit; negatif = sudah melewati limit. */
  sisaLimit: number | null;
  /** Jatuh tempo paling awal di antara nota yang belum lunas (`YYYY-MM-DD`). */
  jatuhTempoTerdekat: string | null;
  /** Selisih hari dari jatuh tempo terdekat ke hari ini: negatif = sudah lewat (terlambat). */
  hariKeJatuhTempo: number | null;
  /** Sisa tagihan nota yang sudah lewat jatuh tempo. */
  piutangTerlambat: number;
};

/** Nilai kredit yang diisikan otomatis untuk pelanggan baru (Pengaturan dan K-104). */
export type BawaanPelanggan = { termHari: number; limitKredit: number | null };

export type Pelanggan = {
  id: number;
  kode: string;
  namaPelanggan: string;
  noHp: string | null;
  email: string | null;
  alamat: string | null;
  keterangan: string | null;
  idGolongan: number | null;
  namaGolongan: string | null;
  termHari: number;
  limitKredit: number | null;
  statusAktif: StatusAktif;
  dibuatPada: string;
  /** K-164: waktu ubah terakhir (ISO). */
  versi: string;
  kredit: PosisiKreditPelanggan;
};

// --- Golongan pelanggan (K-097: sasaran promo) ---

export const skemaGolonganPelanggan = z.object({
  nama: z
    .string('Nama golongan wajib diisi.')
    .trim()
    .min(1, 'Nama golongan wajib diisi.')
    .max(60, 'Nama golongan maksimal 60 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});
export type InputGolonganPelanggan = z.input<typeof skemaGolonganPelanggan>;
export type DataGolonganPelanggan = z.output<typeof skemaGolonganPelanggan>;

export type GolonganPelanggan = {
  id: number;
  nama: string;
  keterangan: string | null;
  statusAktif: StatusAktif;
  /** Pelanggan aktif dalam golongan ini. */
  jumlahPelanggan: number;
};

// --- Pemasok ---

export const skemaPemasok = z.object({
  namaPemasok: z
    .string('Nama pemasok wajib diisi.')
    .trim()
    .min(1, 'Nama pemasok wajib diisi.')
    .max(100, 'Nama pemasok maksimal 100 karakter.')
    // K-137: spasi berlebih dirapikan.
    .transform((v) => v.replace(/\s+/g, ' ')),
  noHp: skemaNoHpWajib,
  kontakPerson: teksOpsional(100, 'Kontak person maksimal 100 karakter.'),
  alamat: teksOpsional(255, 'Alamat maksimal 255 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
  /** K-113: hari dari memesan sampai barang tiba (rekomendasi pemesanan ulang); kosong = bawaan toko. */
  lamaKirimHari: z.preprocess(kosongJadiNull, hariOpsional('Lama kirim', 0, 365)),
  /** K-113: jarak hari antara dua kali belanja ke pemasok ini; kosong = bawaan toko. */
  jarakBelanjaHari: z.preprocess(kosongJadiNull, hariOpsional('Jarak belanja', 1, 365)),
  /** K-237: lama tempo bayar yang biasa diberikan pemasok; bawaan order bertempo; kosong = tidak memberi tempo. */
  tempoHari: z.preprocess(kosongJadiNull, hariOpsional('Lama tempo', 1, 365)),
  /** K-164: versi data yang dimuat form; beda dengan versi sekarang = ditolak. */
  versi: z.string().max(40).nullable().optional(),
  /** K-137: pengguna menegaskan ini pemasok berbeda walau ada yang mirip. */
  abaikanMirip: z.boolean().optional(),
});
export type InputPemasok = z.input<typeof skemaPemasok>;
export type DataPemasok = z.output<typeof skemaPemasok>;

export type Pemasok = {
  id: number;
  kode: string;
  namaPemasok: string;
  noHp: string | null;
  kontakPerson: string | null;
  alamat: string | null;
  keterangan: string | null;
  lamaKirimHari: number | null;
  jarakBelanjaHari: number | null;
  tempoHari: number | null;
  statusAktif: StatusAktif;
  dibuatPada: string;
  /** K-164: waktu ubah terakhir (ISO). */
  versi: string;
};

// --- Tingkat harga (tier) ---

export type TingkatHarga = {
  id: number;
  kode: string;
  nama: string;
  /** Hanya untuk pemegang `master.barang.lihat_hpp` (markup membuka margin; docs/06 H12). */
  markupDefaultPersen?: string;
  /**
   * K-098: total nilai belanja transaksi agar tier dipakai otomatis untuk semua barang; `null` = tier dasar,
   * atau tier nonaktif yang syaratnya belum diisi (K-099).
   */
  minBelanja: number | null;
  urutan: number;
  /** Tier dasar: harga semua transaksi sebelum syarat belanja tier lain tercapai (tepat satu, H1). */
  isDefault: boolean;
  statusAktif: StatusAktif;
  /** Susunan tier janggal (mis. syarat belanja lebih besar tetapi markup lebih besar); bersama markup. */
  peringatan?: string;
};

/** K-098: kapan sebuah tier dipakai, untuk daftar tier, tabel Harga Jual, dan form barang. */
export function teksSyaratTier(t: Pick<TingkatHarga, 'isDefault' | 'minBelanja'>): string {
  if (t.isDefault) return 'semua transaksi';
  // Tier aktif selain tier dasar selalu punya syarat belanja (K-099); kosong hanya pada tier nonaktif lama.
  return t.minBelanja === null
    ? 'belum ada syarat belanja'
    : `belanja mulai ${formatRupiah(t.minBelanja)}`;
}
