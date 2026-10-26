// Skrip `pnpm db:seed`: mengisi data awal (idempoten) ke DATABASE_URL.
import { env } from '../env';
import { namaDatabase } from '../lib/env-file';
import { logger } from '../lib/logger';
import { db, pool } from './client';
import { isiDataAwal } from './data-awal';

try {
  const passwordOwner = (process.env.SEED_OWNER_PASSWORD ?? '').trim();
  const akunDemo = env.NODE_ENV === 'development';
  // K-191: tanpa SEED_OWNER_PASSWORD, akun Owner dibuat pengguna di halaman "Buat akun pertama" (produksi).
  // Pengembangan tetap wajib mengisinya karena akun demo per peran memakai password yang sama.
  if (passwordOwner === '' && akunDemo) {
    throw new Error('SEED_OWNER_PASSWORD di .env wajib diisi saat pengembangan (akun demo).');
  }
  if (passwordOwner !== '' && (passwordOwner.length < 8 || passwordOwner === 'ganti')) {
    throw new Error('SEED_OWNER_PASSWORD minimal 8 karakter (atau kosongkan untuk akun pertama).');
  }
  // Akun demo per peran hanya untuk pengembangan (docs/03 §6).
  const barisBaru = await isiDataAwal(db, {
    passwordOwner: passwordOwner === '' ? null : passwordOwner,
    akunDemo,
  });
  logger.info({ barisBaru }, `Seed selesai pada database ${namaDatabase(env.DATABASE_URL)}.`);
} catch (err) {
  logger.error(err, 'Seed gagal.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
