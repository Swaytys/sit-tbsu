import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const FOLDER_MIGRASI = fileURLToPath(new URL('./migrations', import.meta.url));

/**
 * Menjalankan migrasi yang belum pernah dijalankan pada database `url`. Riwayatnya dicatat
 * drizzle di tabel `drizzle.__drizzle_migrations`, jadi aman dipanggil berulang.
 */
export async function jalankanMigrasi(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: FOLDER_MIGRASI });
  } finally {
    await pool.end();
  }
}
