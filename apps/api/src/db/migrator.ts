import { readFileSync } from 'node:fs';
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

/**
 * K-234: jumlah migrasi di folder yang belum tercatat dijalankan pada database `pool`. Dipakai server saat menyala
 * agar tidak berjalan dengan skema lama (kolom baru belum ada → galat server di halaman tertentu).
 */
export async function jumlahMigrasiTertunda(pool: pg.Pool): Promise<number> {
  const jurnal = JSON.parse(
    readFileSync(new URL('./migrations/meta/_journal.json', import.meta.url), 'utf8'),
  ) as { entries: unknown[] };
  const ada = await pool.query<{ ada: boolean }>(
    "select to_regclass('drizzle.__drizzle_migrations') is not null as ada",
  );
  if (!ada.rows[0]?.ada) return jurnal.entries.length;
  const r = await pool.query<{ n: string }>(
    'select count(*) as n from drizzle.__drizzle_migrations',
  );
  return Math.max(0, jurnal.entries.length - Number(r.rows[0]?.n ?? 0));
}
