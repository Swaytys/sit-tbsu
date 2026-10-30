import { z } from 'zod';
import { skemaPasswordBaru } from './auth';
import { skemaUsername } from './pengguna';
import { skemaNoHpOpsional } from './umum';

/*
 * K-205: setup awal pemakaian pertama (wizard). Langkah inti (data usaha + akun Owner) dikirim sekaligus ke rute publik
 * yang hanya berlaku selama belum ada pengguna; langkah lain dikerjakan setelah masuk dan boleh dilewati.
 * K-209: lupa password dengan kode verifikasi email. K-206: status tur fitur per pengguna.
 */

// --- Data usaha ---

export const JENIS_USAHA = [
  'BAHAN_BANGUNAN',
  'BESI_MATERIAL',
  'RITEL',
  'GROSIR',
  'LAINNYA',
] as const;
export type JenisUsaha = (typeof JENIS_USAHA)[number];
export const LABEL_JENIS_USAHA: Record<JenisUsaha, string> = {
  BAHAN_BANGUNAN: 'Toko bahan bangunan',
  BESI_MATERIAL: 'Toko besi & material',
  RITEL: 'Toko ritel / kelontong',
  GROSIR: 'Grosir / distributor',
  LAINNYA: 'Lainnya',
};

/** Cara toko melayani pembeli; dipakai untuk menyesuaikan panduan penyiapan dan tur. */
export const LAYANAN_TOKO = ['LANGSUNG', 'ORDER', 'ANTAR'] as const;
export type LayananToko = (typeof LAYANAN_TOKO)[number];
export const LABEL_LAYANAN_TOKO: Record<LayananToko, string> = {
  LANGSUNG: 'Jual langsung di kasir',
  ORDER: 'Order dicatat staf penjualan, dibayar di kasir',
  ANTAR: 'Antar barang ke pelanggan (surat jalan, kendaraan, sopir)',
};

const teks = (label: string, maks: number, wajib = false) => {
  const dasar = z.string().trim().max(maks, `${label} maksimal ${maks} karakter.`);
  return wajib ? dasar.min(1, `${label} wajib diisi.`) : dasar;
};

const POLA_TELEPON = /^[0-9+()\-\s]{6,30}$/;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const skemaDataUsaha = z
  .object({
    jenisUsaha: z.enum(JENIS_USAHA, 'Jenis usaha wajib dipilih.'),
    jenisUsahaLain: teks('Jenis usaha', 60),
    namaToko: teks('Nama usaha', 100, true),
    namaBadanUsaha: teks('Nama badan usaha', 100),
    sloganToko: teks('Slogan', 120),
    alamatToko: teks('Alamat', 255, true),
    kotaToko: teks('Kota/kabupaten', 80, true),
    telpToko: teks('Telepon usaha', 30, true).regex(
      POLA_TELEPON,
      'Telepon hanya angka, spasi, +, -, atau tanda kurung (6–30 karakter).',
    ),
    emailToko: z.union([z.literal(''), z.email('Format email tidak valid.')]),
  })
  .refine((v) => v.jenisUsaha !== 'LAINNYA' || v.jenisUsahaLain !== '', {
    path: ['jenisUsahaLain'],
    error: 'Tulis jenis usaha Anda.',
  });
export type InputDataUsaha = z.input<typeof skemaDataUsaha>;
export type DataUsaha = z.output<typeof skemaDataUsaha>;

export const skemaOperasionalAwal = z
  .object({
    layanan: z
      .array(z.enum(LAYANAN_TOKO))
      .min(1, 'Pilih minimal satu cara melayani pembeli.')
      .transform((v) => [...new Set(v)]),
    shiftJamBuka: z.union([
      z.literal(''),
      z.string().regex(POLA_JAM, 'Jam buka tidak valid (JJ:MM).'),
    ]),
    shiftJamTutup: z.union([
      z.literal(''),
      z.string().regex(POLA_JAM, 'Jam tutup tidak valid (JJ:MM).'),
    ]),
  })
  .refine((v) => (v.shiftJamBuka === '') === (v.shiftJamTutup === ''), {
    path: ['shiftJamTutup'],
    error: 'Isi jam buka dan jam tutup, atau kosongkan keduanya.',
  })
  .refine((v) => v.shiftJamBuka === '' || v.shiftJamBuka < v.shiftJamTutup, {
    path: ['shiftJamTutup'],
    error: 'Jam tutup harus setelah jam buka.',
  });
export type InputOperasionalAwal = z.input<typeof skemaOperasionalAwal>;
export type OperasionalAwal = z.output<typeof skemaOperasionalAwal>;

export const skemaOwnerAwal = z
  .object({
    namaPengguna: teks('Nama lengkap', 100, true),
    username: skemaUsername,
    /** K-209: tujuan kode verifikasi lupa password. Boleh kosong (tetap ada kode pemulihan). */
    email: z.union([z.literal(''), z.email('Format email tidak valid.')]),
    noHp: skemaNoHpOpsional,
    password: skemaPasswordBaru,
    konfirmasi: z.string(),
  })
  .refine((v) => v.password === v.konfirmasi, {
    path: ['konfirmasi'],
    error: 'Ulangi password tidak sama.',
  });
export type InputOwnerAwal = z.input<typeof skemaOwnerAwal>;

/** Rute publik `POST /api/auth/setup-awal`: data usaha + operasional + akun Owner dalam satu transaksi. */
export const skemaSetupAwal = z.object({
  usaha: skemaDataUsaha,
  operasional: skemaOperasionalAwal,
  owner: skemaOwnerAwal,
});
export type InputSetupAwal = z.input<typeof skemaSetupAwal>;
export type DataSetupAwal = z.output<typeof skemaSetupAwal>;

/** Mengulang setup awal dari Pengaturan (Owner sudah masuk): data usaha + operasional saja. */
export const skemaUbahDataUsaha = z.object({
  usaha: skemaDataUsaha,
  operasional: skemaOperasionalAwal,
});
export type InputUbahDataUsaha = z.input<typeof skemaUbahDataUsaha>;

/** Langkah setup awal yang dikerjakan setelah masuk dan boleh dilewati. */
export const LANGKAH_SETUP_LANJUT = [
  'TAMPILAN',
  'PEMBAYARAN',
  'EMAIL',
  'CADANGAN',
  'KARYAWAN',
  'DATA_AWAL',
] as const;
export type LangkahSetupLanjut = (typeof LANGKAH_SETUP_LANJUT)[number];
export const LABEL_LANGKAH_SETUP: Record<LangkahSetupLanjut, string> = {
  TAMPILAN: 'Logo dan struk',
  PEMBAYARAN: 'Cara bayar dan rekening',
  EMAIL: 'Email toko',
  CADANGAN: 'Cadangan data',
  KARYAWAN: 'Akun karyawan',
  DATA_AWAL: 'Data barang awal',
};

export type StatusSetupAwal = {
  /** Setup awal sudah diselesaikan (tombol Selesai di langkah terakhir). */
  selesai: boolean;
  /** Langkah yang dilewati saat setup ("atur nanti"); diingatkan di Dashboard. */
  dilewati: LangkahSetupLanjut[];
  usaha: DataUsaha;
  operasional: OperasionalAwal;
};

export const skemaSelesaiSetupAwal = z.object({
  dilewati: z.array(z.enum(LANGKAH_SETUP_LANJUT)).transform((v) => [...new Set(v)]),
});

// --- K-209: lupa password lewat email ---

export const skemaMintaKodeEmail = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Username wajib diisi.').max(50),
});

export const skemaResetLewatEmail = z
  .object({
    username: z.string().trim().toLowerCase().min(1, 'Username wajib diisi.').max(50),
    kode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Kode verifikasi berupa 6 angka.'),
    passwordBaru: skemaPasswordBaru,
    konfirmasi: z.string(),
  })
  .refine((v) => v.passwordBaru === v.konfirmasi, {
    path: ['konfirmasi'],
    error: 'Ulangi password tidak sama.',
  });
export type InputResetLewatEmail = z.input<typeof skemaResetLewatEmail>;

/** Jawaban permintaan kode: sama untuk username tidak dikenal (tidak membocorkan akun). */
export type HasilMintaKodeEmail = { pesan: string; berlakuMenit: number };

// --- K-206: tur fitur ---

export const KODE_TUR = [
  'PENGENALAN',
  'DASHBOARD',
  'BARANG',
  'MITRA',
  'ORDER',
  'KASIR',
  'PENGANTARAN',
  'PENGIRIMAN',
  'SHIFT',
  'PENERIMAAN',
  'STOK',
  'KOREKSI',
  'LAPORAN',
  'PENGATURAN',
] as const;
export type KodeTur = (typeof KODE_TUR)[number];

export type StatusTur = { selesai: KodeTur[]; dilewati: KodeTur[] };

export const skemaCatatTur = z.object({
  kode: z.enum(KODE_TUR, 'Tur tidak dikenal.'),
  hasil: z.enum(['SELESAI', 'DILEWATI']),
});
/** Mengulang: satu tur, atau SEMUA (tur pembuka tampil lagi saat halaman dimuat). */
export const skemaUlangTur = z.object({ kode: z.enum([...KODE_TUR, 'SEMUA']) });
