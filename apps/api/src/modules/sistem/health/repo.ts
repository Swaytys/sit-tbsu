import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';

/** Query paling ringan untuk memastikan database menjawab. */
export async function ping(): Promise<void> {
  await db.execute(sql`select 1`);
}

/** K-166: jumlah migrasi yang sudah diterapkan ke database (tabel riwayat drizzle); `null` bila belum ada. */
export async function jumlahMigrasiTerpasang(): Promise<number | null> {
  try {
    const r = await db.execute<{ n: string }>(
      sql`select count(*) n from drizzle.__drizzle_migrations`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}
