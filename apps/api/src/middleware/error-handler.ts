import type { ResponsGalat } from '@sit/shared';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Kode galat PostgreSQL (SQLSTATE); Drizzle membungkus galat pg di `cause`. */
function kodePostgres(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 3 && typeof e === 'object' && e !== null; i++) {
    const kode = (e as { code?: unknown }).code;
    if (typeof kode === 'string') return kode;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Mengubah setiap kesalahan menjadi respons `{ error: { kode, pesan, detail? } }`. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    const body: ResponsGalat = {
      error: {
        kode: err.kode,
        pesan: err.message,
        ...(err.detail === undefined ? {} : { detail: err.detail }),
      },
    };
    return c.json(body, err.status);
  }

  if (err instanceof HTTPException) {
    // Dilempar middleware Hono (mis. JSON rusak, CSRF ditolak). Pesan aslinya berbahasa Inggris.
    const body: ResponsGalat =
      err.status === 403
        ? {
            error: {
              kode: 'TIDAK_BERIZIN',
              pesan: 'Permintaan ditolak: asal permintaan tidak dikenal.',
            },
          }
        : { error: { kode: 'VALIDASI', pesan: 'Format permintaan tidak valid.' } };
    return c.json(body, err.status);
  }

  // Pelanggaran UNIQUE yang lolos pemeriksaan service (dua simpan bersamaan dengan kode yang sama).
  if (kodePostgres(err) === '23505') {
    logger.warn({ err, method: c.req.method, path: c.req.path }, 'Bentrok unique');
    const body: ResponsGalat = {
      error: {
        kode: 'KONFLIK',
        pesan: 'Data bentrok dengan data lain yang baru saja disimpan. Muat ulang lalu coba lagi.',
      },
    };
    return c.json(body, 409);
  }

  // Tak terduga: detail hanya ke log, klien menerima pesan umum.
  logger.error({ err, method: c.req.method, path: c.req.path }, 'Kesalahan tak terduga');
  const body: ResponsGalat = {
    error: {
      kode: 'INTERNAL',
      pesan: 'Terjadi kesalahan pada server. Coba lagi atau hubungi admin.',
    },
  };
  return c.json(body, 500);
};

export const notFoundHandler: NotFoundHandler = (c) => {
  const body: ResponsGalat = {
    error: { kode: 'TIDAK_DITEMUKAN', pesan: 'Alamat API tidak ditemukan.' },
  };
  return c.json(body, 404);
};
