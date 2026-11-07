import { z } from 'zod';
import { PERAN } from '../enums';
import type { Izin } from '../permissions';

/** Batas bawah panjang password. Nilai efektif dari `konfigurasi.password_min` (boleh lebih besar). */
export const PASSWORD_MIN_DASAR = 8;
export const PASSWORD_MAKS = 128;

export const skemaLogin = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi.').max(50),
  password: z.string().min(1, 'Password wajib diisi.').max(PASSWORD_MAKS),
});
export type InputLogin = z.infer<typeof skemaLogin>;

export const skemaPasswordBaru = z
  .string()
  .min(PASSWORD_MIN_DASAR, `Password minimal ${PASSWORD_MIN_DASAR} karakter.`)
  .max(PASSWORD_MAKS, `Password maksimal ${PASSWORD_MAKS} karakter.`);

export const skemaGantiPassword = z
  .object({
    passwordLama: z.string().min(1, 'Password lama wajib diisi.').max(PASSWORD_MAKS),
    passwordBaru: skemaPasswordBaru,
    konfirmasi: z.string(),
  })
  .refine((v) => v.passwordBaru === v.konfirmasi, {
    path: ['konfirmasi'],
    error: 'Konfirmasi password tidak sama.',
  })
  .refine((v) => v.passwordBaru !== v.passwordLama, {
    path: ['passwordBaru'],
    error: 'Password baru harus berbeda dari password lama.',
  });
export type InputGantiPassword = z.infer<typeof skemaGantiPassword>;

/** Masuk cepat per peran — HANYA ada saat NODE_ENV=development (K-021). */
export const skemaMasukCepat = z.object({ peran: z.enum(PERAN) });

/** Akun demo per peran, dibuat seed hanya saat NODE_ENV=development (docs/03 §6). */
export const USERNAME_DEMO: Record<(typeof PERAN)[number], string> = {
  OWNER: 'demo.owner',
  ADMIN: 'demo.admin',
  KASIR: 'demo.kasir',
  STAF_PENJUALAN: 'demo.staf',
  ADMIN_SISTEM: 'demo.sistem',
  ADMIN_PERSEDIAAN: 'demo.persediaan',
  PETUGAS_GUDANG: 'demo.gudang',
};

/** Pengguna yang sedang login, beserta izinnya (untuk menyaring menu di web). */
export type PenggunaSaya = {
  id: number;
  kode: string;
  username: string;
  namaPengguna: string;
  peran: (typeof PERAN)[number];
  izin: Izin[];
  wajibGantiPassword: boolean;
};
