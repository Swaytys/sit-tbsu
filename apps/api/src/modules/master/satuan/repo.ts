import { asc, desc, sql } from 'drizzle-orm';
import { JENIS_DIMENSI } from '@sit/shared';
import { db } from '../../../db/client';
import { satuan } from '../../../db/schema';

/** Urutan dimensi mengikuti daftar enum (PANJANG, LUAS, ..., LAINNYA), bukan abjad. */
const urutanDimensi = sql`case ${satuan.jenisDimensi} ${sql.join(
  JENIS_DIMENSI.map((d, i) => sql`when ${d} then ${sql.raw(String(i))}`),
  sql` `,
)} end`;

/** Semua satuan: per dimensi, satuan basis dulu, lalu dari faktor terbesar. */
export function semuaSatuan() {
  return db
    .select({
      id: satuan.id,
      kode: satuan.kode,
      nama: satuan.nama,
      jenisDimensi: satuan.jenisDimensi,
      faktorKeBasis: satuan.faktorKeBasis,
      isBasis: satuan.isBasis,
      statusAktif: satuan.statusAktif,
    })
    .from(satuan)
    .orderBy(urutanDimensi, desc(satuan.isBasis), desc(satuan.faktorKeBasis), asc(satuan.nama));
}
