import type { KodeError } from '@sit/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Kesalahan yang disengaja (aturan bisnis, validasi, izin). `message` ditampilkan ke pengguna,
 * jadi ditulis dalam Bahasa Indonesia. Kesalahan lain dianggap INTERNAL oleh error handler.
 */
export class AppError extends Error {
  constructor(
    public readonly kode: KodeError,
    message: string,
    public readonly status: ContentfulStatusCode = 400,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Galat pada satu kolom isian: pesan yang sama tampil sebagai toast dan di bawah kolom form
 * (`detail.kolom`). `KONFLIK` (bentrok dengan data lain / keadaan dokumen) → 409, `VALIDASI` → 400.
 */
export function galatKolom(
  kolom: string,
  pesan: string,
  kode: 'VALIDASI' | 'KONFLIK' = 'VALIDASI',
): AppError {
  return new AppError(kode, pesan, kode === 'KONFLIK' ? 409 : 400, { kolom: { [kolom]: [pesan] } });
}

/**
 * Galat validasi pada baris ke-`i` (mulai 0) dokumen berbaris: pesan diawali "Baris n:" dan menempel di
 * kolom `baris.<i>.<kolom>` form.
 */
export function galatBaris(i: number, kolom: string, pesan: string): AppError {
  return new AppError('VALIDASI', `Baris ${i + 1}: ${pesan}`, 400, {
    kolom: { [`baris.${i}.${kolom}`]: [pesan] },
  });
}
