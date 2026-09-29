import { getTableName, sql, type Table } from 'drizzle-orm';
import { db } from '../src/db/client';

/**
 * Mengosongkan tabel di database uji (TRUNCATE ... RESTART IDENTITY CASCADE).
 * Pengaman: menolak bila database yang tersambung bukan database *_test.
 */
export async function kosongkanTabel(...tabel: Table[]): Promise<void> {
  const hasil = await db.execute<{ nama: string }>(sql`select current_database() as nama`);
  const nama = hasil.rows[0]?.nama ?? '';
  if (!nama.endsWith('_test')) {
    throw new Error(`Menolak mengosongkan tabel: database "${nama}" bukan database uji.`);
  }
  const daftar = sql.join(
    tabel.map((t) => sql.identifier(getTableName(t))),
    sql`, `,
  );
  await db.execute(sql`truncate table ${daftar} restart identity cascade`);
}
