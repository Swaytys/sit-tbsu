// Skrip `pnpm db:audit` (docs/05 L9): mencocokkan cache `persediaan` dengan ledger untuk semua barang.
// Hanya membaca; tidak mengubah data. Selisih apa pun = bug, keluar dengan kode 1.
import { asc } from 'drizzle-orm';
import { env } from '../env';
import { namaDatabase } from '../lib/env-file';
import { logger } from '../lib/logger';
import { hitungUlangCache } from '../modules/persediaan/ledger';
import { db, pool } from './client';
import { barang } from './schema';

try {
  const daftar = await db
    .select({ id: barang.id, kode: barang.kode })
    .from(barang)
    .orderBy(asc(barang.id));
  let selisih = 0;
  for (const b of daftar) {
    const hasil = await hitungUlangCache(db, b.id);
    if (!hasil.cocok) {
      selisih++;
      logger.error(
        { kode: b.kode, masalah: hasil.masalah },
        `Barang ${b.kode} tidak cocok dengan ledger`,
      );
    }
  }
  logger.info(
    `Audit persediaan ${namaDatabase(env.DATABASE_URL)}: ${daftar.length} barang diperiksa, ${selisih} tidak cocok.`,
  );
  if (selisih > 0) process.exitCode = 1;
} catch (err) {
  logger.error(err, 'Audit gagal.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
