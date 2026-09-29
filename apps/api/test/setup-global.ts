import { jalankanMigrasi } from '../src/db/migrator';
import { muatEnvFile, namaDatabase } from '../src/lib/env-file';

/** Sekali sebelum semua tes: pastikan database uji benar, lalu terapkan migrasi terbaru. */
export default async function setup(): Promise<void> {
  muatEnvFile();
  const url = process.env.DATABASE_URL_TEST ?? '';
  if (!url || !namaDatabase(url).endsWith('_test')) {
    throw new Error(
      'DATABASE_URL_TEST wajib diisi di .env dan nama database-nya berakhiran _test.',
    );
  }
  await jalankanMigrasi(url);
}
