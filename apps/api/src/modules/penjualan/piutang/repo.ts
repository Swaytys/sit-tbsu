import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Executor } from '../../../db/client';
import { pelanggan, penjualan } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/** PT1: penjualan pelanggan terdata, tidak VOID, belum LUNAS. */
const syaratPiutang = and(
  isNotNull(penjualan.idPelanggan),
  ne(penjualan.statusTransaksi, 'VOID'),
  ne(penjualan.statusPembayaran, 'LUNAS'),
);

export type SaringPiutang = {
  cari?: string | undefined;
  idPelanggan?: number | undefined;
  terlambat?: boolean | undefined;
};

function syarat(p: SaringPiutang, hariIni: string): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    syaratPiutang,
    p.idPelanggan === undefined ? undefined : eq(penjualan.idPelanggan, p.idPelanggan),
    p.terlambat ? lt(penjualan.tanggalJatuhTempo, hariIni) : undefined,
    pola ? or(ilike(penjualan.nomor, pola), ilike(pelanggan.namaPelanggan, pola)) : undefined,
  );
}

export async function daftar(
  ex: Executor,
  p: SaringPiutang & { limit: number; offset: number },
  hariIni: string,
) {
  const where = syarat(p, hariIni);
  const baris = await ex
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggal,
      jenisPenjualan: penjualan.jenisPenjualan,
      idPelanggan: penjualan.idPelanggan,
      namaPelanggan: pelanggan.namaPelanggan,
      totalNeto: penjualan.totalNeto,
      totalDibayar: penjualan.totalDibayar,
      sisaTagihan: penjualan.sisaTagihan,
      statusPembayaran: penjualan.statusPembayaran,
      tanggalJatuhTempo: penjualan.tanggalJatuhTempo,
      hariTerlambat: sql<
        number | null
      >`(${hariIni}::date - ${penjualan.tanggalJatuhTempo})`.mapWith((v) =>
        v === null ? null : Number(v),
      ),
    })
    .from(penjualan)
    .innerJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where)
    .orderBy(asc(penjualan.tanggalJatuhTempo), desc(penjualan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(penjualan)
    .innerJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

const lewat = (hariIni: string) => sql`${penjualan.tanggalJatuhTempo} < ${hariIni}::date`;

/** Ringkasan seluruh piutang (tidak ikut saringan) dan per pelanggan (PT3). */
export async function ringkasan(ex: Executor, hariIni: string) {
  const [total] = await ex
    .select({
      totalSisa: sql<number>`coalesce(sum(${penjualan.sisaTagihan}), 0)::bigint`.mapWith(Number),
      jumlah: count(),
      jumlahTerlambat: sql<number>`count(*) filter (where ${lewat(hariIni)})`.mapWith(Number),
      totalTerlambat:
        sql<number>`coalesce(sum(${penjualan.sisaTagihan}) filter (where ${lewat(hariIni)}), 0)::bigint`.mapWith(
          Number,
        ),
    })
    .from(penjualan)
    .where(syaratPiutang);
  const perPelanggan = await ex
    .select({
      idPelanggan: pelanggan.id,
      namaPelanggan: pelanggan.namaPelanggan,
      jumlahInvoice: count(),
      totalSisa: sql<number>`coalesce(sum(${penjualan.sisaTagihan}), 0)::bigint`.mapWith(Number),
      jatuhTempoTerlama: sql<string | null>`min(${penjualan.tanggalJatuhTempo})::text`,
    })
    .from(penjualan)
    .innerJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(syaratPiutang)
    .groupBy(pelanggan.id, pelanggan.namaPelanggan)
    .orderBy(desc(sql`sum(${penjualan.sisaTagihan})`));
  return {
    totalSisa: total?.totalSisa ?? 0,
    jumlah: total?.jumlah ?? 0,
    jumlahTerlambat: total?.jumlahTerlambat ?? 0,
    totalTerlambat: total?.totalTerlambat ?? 0,
    perPelanggan,
  };
}

/** ST2/PT4: jumlah piutang terlambat dan yang jatuh tempo sampai `batas`. */
export async function hitungJatuhTempo(ex: Executor, hariIni: string, batas: string) {
  const [h] = await ex
    .select({
      terlambat: sql<number>`count(*) filter (where ${lewat(hariIni)})`.mapWith(Number),
      segera: sql<number>`count(*) filter (where not ${lewat(hariIni)})`.mapWith(Number),
    })
    .from(penjualan)
    .where(and(syaratPiutang, lte(penjualan.tanggalJatuhTempo, batas)));
  return { terlambat: h?.terlambat ?? 0, segera: h?.segera ?? 0 };
}
