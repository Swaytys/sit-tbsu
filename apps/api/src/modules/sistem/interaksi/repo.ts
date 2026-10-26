import { and, count, countDistinct, desc, eq, ilike, max, min, sql, type SQL } from 'drizzle-orm';
import type { JenisInteraksi } from '@sit/shared';
import type { Executor } from '../../../db/client';
import { logInteraksi, pengguna } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

export type SaringInteraksi = {
  idPengguna?: number | undefined;
  jenis?: JenisInteraksi | undefined;
  lokasi?: string | undefined;
  /** Tanggal lokal toko (Asia/Jakarta), inklusif. */
  dari?: string | undefined;
  sampai?: string | undefined;
};

function syarat(p: SaringInteraksi): SQL | undefined {
  const daftar: (SQL | undefined)[] = [];
  const tanggal = sql`(${logInteraksi.waktu} at time zone 'Asia/Jakarta')::date`;
  if (p.dari) daftar.push(sql`${tanggal} >= ${p.dari}::date`);
  if (p.sampai) daftar.push(sql`${tanggal} <= ${p.sampai}::date`);
  if (p.idPengguna) daftar.push(eq(logInteraksi.idPengguna, p.idPengguna));
  if (p.jenis) daftar.push(eq(logInteraksi.jenis, p.jenis));
  if (p.lokasi) daftar.push(ilike(logInteraksi.halaman, polaCari(p.lokasi)));
  return and(...daftar);
}

export async function tambah(
  ex: Executor,
  baris: (typeof logInteraksi.$inferInsert)[],
): Promise<void> {
  if (baris.length > 0) await ex.insert(logInteraksi).values(baris);
}

/** Kejadian terbaru lebih dulu, beserta nama dan peran penggunanya. */
export async function daftar(ex: Executor, p: SaringInteraksi & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await ex
    .select({
      id: logInteraksi.id,
      waktu: logInteraksi.waktu,
      idPengguna: logInteraksi.idPengguna,
      namaPengguna: pengguna.namaPengguna,
      peran: pengguna.peran,
      idSesiKlien: logInteraksi.idSesiKlien,
      jenis: logInteraksi.jenis,
      halaman: logInteraksi.halaman,
      elemen: logInteraksi.elemen,
      keterangan: logInteraksi.keterangan,
      angka: logInteraksi.angka,
    })
    .from(logInteraksi)
    .innerJoin(pengguna, eq(logInteraksi.idPengguna, pengguna.id))
    .where(where)
    .orderBy(desc(logInteraksi.waktu), desc(logInteraksi.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(logInteraksi).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function ringkasan(ex: Executor) {
  const [r] = await ex
    .select({
      jumlah: count(),
      jumlahPengguna: countDistinct(logInteraksi.idPengguna),
      pertama: min(logInteraksi.waktu),
      terakhir: max(logInteraksi.waktu),
    })
    .from(logInteraksi);
  return r ?? { jumlah: 0, jumlahPengguna: 0, pertama: null, terakhir: null };
}
