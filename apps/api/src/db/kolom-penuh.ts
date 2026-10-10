import { getTableName, sql, type AnyColumn, type SQL } from 'drizzle-orm';

/**
 * Kolom lengkap dengan nama tabelnya, mis. `"merk"."id"`. Wajib dipakai untuk kolom di dalam subquery SQL
 * mentah (`sql\`(select ... where ...)\``): pada select satu tabel drizzle menulis kolom tanpa nama tabel
 * (`"id"`), sehingga Postgres mengartikannya sebagai kolom tabel di dalam subquery, bukan tabel luar.
 */
export function kolomPenuh(kolom: AnyColumn): SQL {
  return sql`${sql.identifier(getTableName(kolom.table))}.${sql.identifier(kolom.name)}`;
}
