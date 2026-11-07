import { z } from 'zod';
import { PERAN, STATUS_AKTIF } from '../enums';
import { skemaPasswordBaru } from './auth';
import { skemaHalaman, skemaNoHpOpsional } from './umum';

/** Username: 3–50 karakter huruf kecil, angka, titik, garis bawah, atau strip; disimpan huruf kecil. */
export const skemaUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username minimal 3 karakter.')
  .max(50, 'Username maksimal 50 karakter.')
  .regex(/^[a-z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.');

const dataPengguna = {
  namaPengguna: z
    .string()
    .trim()
    .min(1, 'Nama pengguna wajib diisi.')
    .max(100, 'Nama pengguna maksimal 100 karakter.'),
  username: skemaUsername,
  peran: z.enum(PERAN, 'Peran wajib dipilih.'),
  noHp: skemaNoHpOpsional,
};

/** Tambah pengguna (Owner). Password awal wajib diganti pengguna saat login pertama (docs/04 §7). */
export const skemaTambahPengguna = z.object({ ...dataPengguna, password: skemaPasswordBaru });
/** Nilai form sebelum divalidasi (mis. No. HP boleh string kosong). */
export type InputTambahPengguna = z.input<typeof skemaTambahPengguna>;
/** Nilai setelah divalidasi (username huruf kecil, No. HP kosong → null). */
export type DataTambahPengguna = z.output<typeof skemaTambahPengguna>;

/** Ubah data pengguna (tanpa password; password lewat reset). */
export const skemaUbahPengguna = z.object(dataPengguna);
export type InputUbahPengguna = z.input<typeof skemaUbahPengguna>;
export type DataUbahPengguna = z.output<typeof skemaUbahPengguna>;

export const skemaResetPassword = z.object({ passwordBaru: skemaPasswordBaru });
export type InputResetPassword = z.infer<typeof skemaResetPassword>;

export const skemaCariPengguna = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
});
export type ParamCariPengguna = z.input<typeof skemaCariPengguna>;

/** Satu baris daftar pengguna (tanpa password hash; docs/04 §5). */
export type PenggunaDaftar = {
  id: number;
  kode: string;
  username: string;
  namaPengguna: string;
  peran: (typeof PERAN)[number];
  statusAktif: (typeof STATUS_AKTIF)[number];
  noHp: string | null;
  wajibGantiPassword: boolean;
  terkunciSampai: string | null;
  loginTerakhir: string | null;
  sesiAktif: number;
};

// --- K-191: akun pertama dan pemulihan password ---

/** Huruf/angka kode pemulihan: tanpa 0/O dan 1/I/L agar tidak salah baca saat diketik ulang dari kertas. */
export const ALFABET_KODE_PEMULIHAN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Panjang kode pemulihan (tanpa strip), ditampilkan berkelompok 5: XXXXX-XXXXX-XXXXX-XXXXX. */
export const PANJANG_KODE_PEMULIHAN = 20;

/** Kode pemulihan seperti yang diketik pengguna → huruf besar tanpa spasi/strip (bentuk yang di-hash). */
export function rapikanKodePemulihan(kode: string): string {
  return kode.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Halaman "Buat akun pertama": hanya ada selama belum ada satu pengguna pun. Akun ini menjadi Owner. */
export const skemaAkunPertama = z
  .object({
    namaPengguna: dataPengguna.namaPengguna,
    username: skemaUsername,
    password: skemaPasswordBaru,
    konfirmasi: z.string(),
  })
  .refine((v) => v.password === v.konfirmasi, {
    path: ['konfirmasi'],
    error: 'Ulangi password tidak sama.',
  });
export type InputAkunPertama = z.input<typeof skemaAkunPertama>;
export type DataAkunPertama = z.output<typeof skemaAkunPertama>;

/** Lupa password: username + kode pemulihan + password baru. */
export const skemaPulihkanPassword = z
  .object({
    username: z.string().trim().min(1, 'Username wajib diisi.').max(50),
    kodePemulihan: z
      .string()
      .trim()
      .min(1, 'Kode pemulihan wajib diisi.')
      .max(40, 'Kode pemulihan terlalu panjang.'),
    passwordBaru: skemaPasswordBaru,
    konfirmasi: z.string(),
  })
  .refine((v) => v.passwordBaru === v.konfirmasi, {
    path: ['konfirmasi'],
    error: 'Ulangi password tidak sama.',
  });
export type InputPulihkanPassword = z.input<typeof skemaPulihkanPassword>;

/** Membuat kode pemulihan baru untuk akun sendiri: konfirmasi dengan password saat ini. */
export const skemaBuatKodePemulihan = z.object({
  password: z.string().min(1, 'Password wajib diisi.').max(128),
});

/** Rute publik: dibaca halaman masuk dan setup awal sebelum login (K-191, K-207). */
export type StatusPenyiapan = {
  perluAkunPertama: boolean;
  /** Identitas usaha untuk halaman masuk; kosong sebelum setup awal. */
  namaToko: string;
  sloganToko: string;
  kotaToko: string;
  /** K-168: data yang sedang dipakai adalah data latihan (pita MODE LATIHAN). */
  modeLatihan: boolean;
};
export type InfoKodePemulihan = { ada: boolean; dibuatPada: string | null };
export type HasilKodePemulihan = { kodePemulihan: string };
