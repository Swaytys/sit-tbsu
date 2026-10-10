import { zValidator } from '@hono/zod-validator';
import { skemaIdParam } from '@sit/shared';
import { z } from 'zod';
import { AppError } from './errors';

/** Mengubah kegagalan Zod menjadi AppError VALIDASI (400) dengan detail pesan per kolom. */
export function galatValidasi(error: unknown): AppError {
  if (error instanceof z.ZodError) {
    const pesan = error.issues[0]?.message ?? 'Data tidak valid.';
    return new AppError('VALIDASI', pesan, 400, { kolom: z.flattenError(error).fieldErrors });
  }
  return new AppError('VALIDASI', 'Data tidak valid.', 400);
}

/** Kait untuk `zValidator(target, skema, kaitValidasi)`: format galat seragam `{ error: { kode, pesan } }`. */
export function kaitValidasi(hasil: { success: boolean; error?: unknown }): void {
  if (!hasil.success) throw galatValidasi(hasil.error);
}

/** Validator parameter rute `/:id` (bilangan bulat positif), dipakai semua modul. */
export const paramId = zValidator('param', skemaIdParam, kaitValidasi);
