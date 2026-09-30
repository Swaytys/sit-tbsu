import { z } from 'zod';
import { PERAN, STATUS_AKTIF } from '../enums';
import { skemaPasswordBaru } from './auth';
import { skemaHalaman, teksOpsional } from './umum';

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
  noHp: teksOpsional(20, 'No. HP maksimal 20 karakter.').refine(
    (v) => v === null || v === undefined || /^[0-9+\-\s]+$/.test(v),
    'No. HP hanya boleh angka, spasi, +, atau -.',
  ),
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
