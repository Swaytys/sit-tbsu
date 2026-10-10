import { GalatAngka, type KodeError, type ResponsGalat } from '@sit/shared';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Kode galat PostgreSQL (SQLSTATE) atau kode galat jaringan Node (mis. `ECONNREFUSED`); Drizzle membungkus
 * galat pg di `cause`.
 */
function kodePostgres(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 3 && typeof e === 'object' && e !== null; i++) {
    const kode = (e as { code?: unknown }).code;
    if (typeof kode === 'string') return kode;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

type JawabanPostgres = {
  status: 400 | 409 | 503;
  kode: KodeError;
  pesan: string;
  /** `error` = celah di kode kita yang perlu diperbaiki; `warn` = keadaan wajar saat ramai. */
  tingkat: 'warn' | 'error';
};

const BENTROK: JawabanPostgres = {
  status: 409,
  kode: 'KONFLIK',
  pesan: 'Data bentrok dengan data lain yang baru saja disimpan. Muat ulang lalu coba lagi.',
  tingkat: 'warn',
};
const SEDANG_DIPAKAI: JawabanPostgres = {
  status: 409,
  kode: 'KONFLIK',
  pesan: 'Data sedang diproses pengguna lain. Tunggu sebentar lalu coba lagi.',
  tingkat: 'warn',
};
const DITOLAK_DATABASE: JawabanPostgres = {
  status: 400,
  kode: 'VALIDASI',
  pesan: 'Data tidak bisa disimpan karena tidak memenuhi aturan data. Periksa kembali isian Anda.',
  tingkat: 'error',
};

const KEHABISAN_SUMBER: JawabanPostgres = {
  status: 503,
  kode: 'INTERNAL',
  pesan:
    'Komputer server kehabisan memori, ruang penyimpanan, atau koneksi database. Coba lagi sebentar; bila terulang, hubungi admin.',
  tingkat: 'error',
};
const DATABASE_TIDAK_SIAP: JawabanPostgres = {
  status: 503,
  kode: 'INTERNAL',
  pesan: 'Database tidak bisa dihubungi. Coba lagi sebentar; bila terulang, hubungi admin.',
  tingkat: 'error',
};

/**
 * Galat database yang punya jawaban lebih berguna daripada "kesalahan server". Semuanya membatalkan
 * transaksi secara utuh, jadi permintaan aman diulang.
 */
const JAWABAN_POSTGRES: Record<string, JawabanPostgres> = {
  // UNIQUE yang lolos pemeriksaan service: dua simpan bersamaan dengan kode yang sama.
  '23505': BENTROK,
  // Kebuntuan (deadlock), gagal serialisasi, atau menunggu kunci baris melewati `lock_timeout`.
  '40P01': SEDANG_DIPAKAI,
  '40001': SEDANG_DIPAKAI,
  '55P03': SEDANG_DIPAKAI,
  // Pernyataan melewati `statement_timeout` (db/client.ts).
  '57014': {
    status: 503,
    kode: 'INTERNAL',
    pesan:
      'Permintaan terlalu lama diproses lalu dihentikan. Persempit rentang data, lalu coba lagi.',
    tingkat: 'error',
  },
  // CHECK, foreign key, angka di luar rentang kolom, teks terlalu panjang: aturan database menolak data
  // yang lolos validasi service. Pengguna mendapat 400, pengembang mendapat log `error`.
  '23514': DITOLAK_DATABASE,
  '23503': DITOLAK_DATABASE,
  '22003': DITOLAK_DATABASE,
  '22001': DITOLAK_DATABASE,
  // Sumber daya komputer server habis: ruang penyimpanan, memori, atau jatah koneksi PostgreSQL.
  '53100': KEHABISAN_SUMBER,
  '53200': KEHABISAN_SUMBER,
  '53300': KEHABISAN_SUMBER,
  // PostgreSQL sedang dimatikan/dinyalakan, atau koneksinya putus.
  '57P01': DATABASE_TIDAK_SIAP,
  '57P02': DATABASE_TIDAK_SIAP,
  '57P03': DATABASE_TIDAK_SIAP,
  '08000': DATABASE_TIDAK_SIAP,
  '08003': DATABASE_TIDAK_SIAP,
  '08006': DATABASE_TIDAK_SIAP,
  ECONNREFUSED: DATABASE_TIDAK_SIAP,
  ECONNRESET: DATABASE_TIDAK_SIAP,
};

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

  const asal = { err, method: c.req.method, path: c.req.path };

  // Hasil kali isian yang sah per kolom melampaui batas angka (packages/shared `GalatAngka`).
  if (err instanceof GalatAngka) {
    logger.warn(asal, 'Angka di luar batas');
    const body: ResponsGalat = {
      error: {
        kode: 'VALIDASI',
        pesan: 'Angka terlalu besar untuk dihitung. Periksa qty dan harga yang diisi.',
      },
    };
    return c.json(body, 400);
  }

  const kode = kodePostgres(err);
  const jawaban = kode === undefined ? undefined : JAWABAN_POSTGRES[kode];
  if (jawaban) {
    logger[jawaban.tingkat]({ ...asal, sqlstate: kode }, 'Galat database');
    const body: ResponsGalat = { error: { kode: jawaban.kode, pesan: jawaban.pesan } };
    return c.json(body, jawaban.status);
  }

  // Tak terduga: detail hanya ke log, klien menerima pesan umum.
  logger.error(asal, 'Kesalahan tak terduga');
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
