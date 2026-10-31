import { z } from 'zod';

/*
 * K-213: kelola data aplikasi. Satu data aktif (database yang sedang dipakai) dan Pustaka data: salinan data lain
 * yang tersimpan di folder data aplikasi (bukan di database), bisa dilihat, dipakai, dihapus, diekspor/diimpor.
 */

export const JENIS_DATA = ['SALINAN', 'LAMA', 'IMPOR', 'CADANGAN_HARIAN', 'PENGAMAN'] as const;
export type JenisData = (typeof JENIS_DATA)[number];
export const LABEL_JENIS_DATA: Record<JenisData, string> = {
  SALINAN: 'Salinan manual',
  LAMA: 'Data lama',
  IMPOR: 'Impor dari berkas',
  CADANGAN_HARIAN: 'Dari cadangan harian',
  PENGAMAN: 'Pengaman otomatis',
};

/** Pengaman otomatis yang disimpan (yang lebih lama dibuang) agar disk tidak membengkak. */
export const SIMPAN_PENGAMAN = 3;

export type PenggunaData = {
  username: string;
  namaPengguna: string;
  peran: string;
  aktif: boolean;
};

/** Ringkasan isi sebuah data (dari database itu sendiri). */
export type RingkasData = {
  namaToko: string;
  namaBadanUsaha: string;
  kotaToko: string;
  versiAplikasi: string;
  migrasi: number;
  pengguna: PenggunaData[];
  jumlah: { barang: number; pelanggan: number; pemasok: number; penjualan: number };
  /** Tanggal penjualan pertama dan terakhir (ISO), `null` bila belum ada penjualan. */
  transaksiPertama: string | null;
  transaksiTerakhir: string | null;
};

export type ManifestData = RingkasData & {
  id: string;
  jenis: JenisData;
  label: string;
  dibuatPada: string;
  ukuranByte: number;
};

export type StatusData = {
  aktif: RingkasData & { ukuranByte: number };
  pustaka: ManifestData[];
  pengaman: ManifestData[];
  totalUkuranByte: number;
  /** Program cadangan harian tersedia (untuk "Ambil dari cadangan harian"). */
  cadanganHarianSiap: boolean;
};

export type SnapshotHarian = { id: string; waktu: string; ukuranByte: number | null };

const password = z.string().min(1, 'Password Anda wajib diisi untuk konfirmasi.').max(128);

export const skemaSalinanData = z.object({
  label: z
    .string()
    .trim()
    .min(3, 'Nama salinan minimal 3 karakter.')
    .max(80, 'Nama salinan maksimal 80 karakter.'),
});

export const skemaKonfirmasiData = z.object({ password });

export const skemaEksporData = z
  .object({
    /** Kosong = data aktif; selain itu id data di Pustaka. */
    id: z.string().max(60).optional(),
    sandi: z.string().min(8, 'Sandi berkas minimal 8 karakter.').max(100),
    sandiUlang: z.string(),
    password,
  })
  .refine((v) => v.sandi === v.sandiUlang, {
    path: ['sandiUlang'],
    error: 'Ulangi sandi tidak sama.',
  });
export type InputEksporData = z.input<typeof skemaEksporData>;

export const skemaSandiImpor = z.object({
  sandi: z.string().min(1, 'Sandi berkas wajib diisi.').max(100),
});

/** Ukuran berkas .bonsai maksimal yang diterima lewat unggahan. */
export const UKURAN_BERKAS_DATA_MAKS = 500 * 1024 * 1024;

/** K-216: catatan mati mendadak dari peluncur desktop. */
export type MatiMendadak = {
  terdeteksi: string;
  terakhirHidup: string | null;
  shift: string | null;
};

export const POLA_ID_DATA = /^[a-z0-9-]{8,60}$/;
