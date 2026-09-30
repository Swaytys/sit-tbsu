import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

/** Kumpulan koneksi ke PostgreSQL (dipakai bersama seluruh request). */
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle({ client: pool, schema });

export type Db = typeof db;

/** Transaksi yang sedang berjalan (argumen callback `db.transaction`). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Tempat menjalankan query: koneksi biasa atau di dalam transaksi. Dipakai fungsi repo. */
export type Executor = Db | Tx;
