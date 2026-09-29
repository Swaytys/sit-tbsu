/*
 * Skrip `pnpm db:reset` — HANYA untuk database pengembangan.
 * Menghapus SEMUA isi database dev, lalu migrasi ulang dan mengisi data awal.
 * Pengaman: ditolak di produksi, ditolak bila nama database tidak berakhiran `_dev`,
 * dan hanya berjalan bila diberi konfirmasi `--ya` (pnpm db:reset --ya).
 */
import pg from 'pg';
import { env } from '../env';
import { namaDatabase } from '../lib/env-file';
import { logger } from '../lib/logger';
import { db, pool } from './client';
import { isiDataAwal } from './data-awal';
import { jalankanMigrasi } from './migrator';

const nama = namaDatabase(env.DATABASE_URL);

try {
  if (env.NODE_ENV === 'production' || !nama.endsWith('_dev')) {
    throw new Error(
      `db:reset ditolak: hanya untuk database *_dev di luar produksi (saat ini: ${nama}).`,
    );
  }
  if (!process.argv.includes('--ya')) {
    logger.warn(
      `db:reset akan MENGHAPUS SEMUA DATA di database ${nama}. Bila yakin, jalankan: pnpm db:reset --ya`,
    );
    process.exitCode = 1;
  } else {
    const passwordOwner = process.env.SEED_OWNER_PASSWORD ?? '';
    if (passwordOwner.length < 8 || passwordOwner === 'ganti') {
      throw new Error('SEED_OWNER_PASSWORD di .env wajib diisi, minimal 8 karakter.');
    }

    const client = new pg.Client({ connectionString: env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('drop schema if exists drizzle cascade');
      await client.query('drop schema public cascade');
      await client.query('create schema public');
    } finally {
      await client.end();
    }

    await jalankanMigrasi(env.DATABASE_URL);
    const barisBaru = await isiDataAwal(db, { passwordOwner });
    logger.info({ barisBaru }, `Database ${nama} dibuat ulang: migrasi + data awal.`);
  }
} catch (err) {
  logger.error(err, 'db:reset gagal.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
