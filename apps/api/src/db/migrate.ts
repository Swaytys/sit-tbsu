// Skrip `pnpm db:migrate`: menerapkan migrasi baru ke DATABASE_URL.
import { env } from '../env';
import { namaDatabase } from '../lib/env-file';
import { logger } from '../lib/logger';
import { jalankanMigrasi } from './migrator';

try {
  await jalankanMigrasi(env.DATABASE_URL);
  logger.info(`Migrasi selesai pada database ${namaDatabase(env.DATABASE_URL)}.`);
} catch (err) {
  logger.error(err, 'Migrasi gagal.');
  process.exitCode = 1;
}
