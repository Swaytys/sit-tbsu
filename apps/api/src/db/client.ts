import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import { logger } from '../lib/logger';
import * as schema from './schema';

/*
 * Batas waktu koneksi, dalam milidetik. Tanpa batas, satu query macet atau satu transaksi yang tidak pernah
 * ditutup menahan kunci barisnya selamanya, dan semua kasir yang menyentuh barang yang sama ikut menunggu
 * tanpa akhir. Dengan batas, yang macet dibatalkan (transaksinya batal utuh) dan `error-handler.ts` menjawab
 * "coba lagi". Migrasi dan cadangan memakai koneksi sendiri (migrator.ts, modul cadangan), tidak terkena.
 */
const BATAS_WAKTU = {
  /** Menunggu koneksi kosong dari pool. */
  connectionTimeoutMillis: 10_000,
  /** Satu pernyataan SQL. Laporan terberat (rentang 366 hari) jauh di bawah ini. */
  statement_timeout: 60_000,
  /** Menunggu kunci baris (`FOR UPDATE`) milik transaksi lain → SQLSTATE 55P03 → HTTP 409. */
  lock_timeout: 15_000,
  /** Transaksi terbuka tanpa kegiatan: diputus server database supaya kuncinya lepas. */
  idle_in_transaction_session_timeout: 60_000,
} as const;

/** Kumpulan koneksi ke PostgreSQL (dipakai bersama seluruh request). */
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  application_name: 'sit-tbsu-api',
  ...BATAS_WAKTU,
});

// Koneksi menganggur yang diputus database (restart PostgreSQL, jaringan) memancarkan 'error' di pool.
// Tanpa pendengar, Node menghentikan proses; pool sendiri sudah membuang koneksi itu dan membuat yang baru.
pool.on('error', (err) => logger.error({ err }, 'Koneksi database menganggur terputus'));

export const db = drizzle({ client: pool, schema });

export type Db = typeof db;

/** Transaksi yang sedang berjalan (argumen callback `db.transaction`). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Tempat menjalankan query: koneksi biasa atau di dalam transaksi. Dipakai fungsi repo. */
export type Executor = Db | Tx;
