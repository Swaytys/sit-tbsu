import { z } from 'zod';

/** Parameter daftar berhalaman (docs/02 §4): `?halaman=1&perHalaman=25`. */
export const skemaHalaman = z.object({
  halaman: z.coerce.number().int().min(1).default(1),
  perHalaman: z.coerce.number().int().min(1).max(100).default(25),
});

/** Parameter rute `/:id`. */
export const skemaIdParam = z.object({
  id: z.coerce.number().int().positive('ID tidak valid.'),
});

/** Teks opsional: spasi di tepi dibuang; kosong menjadi `null`. */
export const teksOpsional = (maks: number, pesanMaks: string) =>
  z
    .string()
    .trim()
    .max(maks, pesanMaks)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
