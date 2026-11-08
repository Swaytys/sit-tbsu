import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { StatusOrderPembelian } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  alokasiUangMuka,
  barang,
  orderPembelian,
  orderPembelianDetail,
  pembayaranPemasok,
  pemasok,
  penerimaanBarang,
  pengguna,
  satuan,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/* K-125: bacaan dan tulisan order pembelian. Kueri berparameter (Drizzle). */

const totalPerkiraan = sql<string>`coalesce((
  select sum(coalesce(d.qty_konfirmasi, d.qty_pesan) * coalesce(d.harga_konfirmasi, d.harga_perkiraan))
    from order_pembelian_detail d where d.id_order_pembelian = ${orderPembelian.id}), 0)::text`;

const kolomDaftar = {
  id: orderPembelian.id,
  nomor: orderPembelian.nomor,
  tanggal: orderPembelian.tanggal,
  idPemasok: orderPembelian.idPemasok,
  namaPemasok: pemasok.namaPemasok,
  status: orderPembelian.status,
  tanggalDipesan: orderPembelian.tanggalDipesan,
  tanggalJanjiKirim: orderPembelian.tanggalJanjiKirim,
  catatan: orderPembelian.catatan,
  alasanTutup: orderPembelian.alasanTutup,
  namaPembuat: pengguna.namaPengguna,
  jumlahBarang: sql<number>`(select count(*)::int from order_pembelian_detail d
    where d.id_order_pembelian = ${orderPembelian.id})`,
  totalPerkiraan,
};

export type BarisPO = Awaited<ReturnType<typeof daftar>>['baris'][number];

function syarat(p: {
  cari?: string | undefined;
  status?: StatusOrderPembelian | 'BERJALAN' | undefined;
  idPemasok?: number | undefined;
}): SQL | undefined {
  const s: (SQL | undefined)[] = [];
  if (p.status === 'BERJALAN') {
    s.push(inArray(orderPembelian.status, ['DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN']));
  } else if (p.status) s.push(eq(orderPembelian.status, p.status));
  if (p.idPemasok) s.push(eq(orderPembelian.idPemasok, p.idPemasok));
  if (p.cari) {
    const pola = polaCari(p.cari);
    s.push(or(ilike(orderPembelian.nomor, pola), ilike(pemasok.namaPemasok, pola)));
  }
  return and(...s);
}

export async function daftar(
  ex: Executor,
  p: Parameters<typeof syarat>[0] & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await ex
    .select(kolomDaftar)
    .from(orderPembelian)
    .innerJoin(pemasok, eq(pemasok.id, orderPembelian.idPemasok))
    .innerJoin(pengguna, eq(pengguna.id, orderPembelian.idPembuat))
    .where(where)
    .orderBy(desc(orderPembelian.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(orderPembelian)
    .innerJoin(pemasok, eq(pemasok.id, orderPembelian.idPemasok))
    .where(where);
  return { baris, total: h?.n ?? 0 };
}

export async function satu(ex: Executor, id: number) {
  const [b] = await ex
    .select(kolomDaftar)
    .from(orderPembelian)
    .innerJoin(pemasok, eq(pemasok.id, orderPembelian.idPemasok))
    .innerJoin(pengguna, eq(pengguna.id, orderPembelian.idPembuat))
    .where(eq(orderPembelian.id, id));
  return b;
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx.select().from(orderPembelian).where(eq(orderPembelian.id, id)).for('update');
  return b;
}

export async function detail(ex: Executor, id: number) {
  return ex
    .select({
      id: orderPembelianDetail.id,
      idBarang: orderPembelianDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      qtyPesan: orderPembelianDetail.qtyPesan,
      qtyKonfirmasi: orderPembelianDetail.qtyKonfirmasi,
      qtyDiterima: orderPembelianDetail.qtyDiterima,
      qtyDitolak: orderPembelianDetail.qtyDitolak,
      qtyDipotong: orderPembelianDetail.qtyDipotong,
      hargaPerkiraan: orderPembelianDetail.hargaPerkiraan,
      hargaKonfirmasi: orderPembelianDetail.hargaKonfirmasi,
    })
    .from(orderPembelianDetail)
    .innerJoin(barang, eq(barang.id, orderPembelianDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(orderPembelianDetail.idOrderPembelian, id))
    .orderBy(asc(orderPembelianDetail.id));
}

export async function kunciDetail(tx: Tx, idPO: number) {
  return tx
    .select()
    .from(orderPembelianDetail)
    .where(eq(orderPembelianDetail.idOrderPembelian, idPO))
    .orderBy(asc(orderPembelianDetail.id))
    .for('update');
}

export async function uangMuka(ex: Executor, idPO: number) {
  return ex
    .select({
      id: pembayaranPemasok.id,
      nomor: pembayaranPemasok.nomor,
      tanggal: pembayaranPemasok.tanggal,
      nominal: pembayaranPemasok.nominal,
      metode: pembayaranPemasok.metode,
      terpakai: sql<string>`coalesce((select sum(a.nominal) from alokasi_uang_muka a
        where a.id_pembayaran_pemasok = ${pembayaranPemasok.id}), 0)::text`,
    })
    .from(pembayaranPemasok)
    .where(eq(pembayaranPemasok.idOrderPembelian, idPO))
    .orderBy(asc(pembayaranPemasok.id));
}

export async function penerimaan(ex: Executor, idPO: number) {
  return ex
    .select({
      id: penerimaanBarang.id,
      nomor: penerimaanBarang.nomor,
      tanggal: penerimaanBarang.tanggalOperasional,
      totalFaktur: penerimaanBarang.totalFaktur,
    })
    .from(penerimaanBarang)
    .where(eq(penerimaanBarang.idOrderPembelian, idPO))
    .orderBy(asc(penerimaanBarang.id));
}

export async function tambahAlokasi(tx: Tx, nilai: typeof alokasiUangMuka.$inferInsert) {
  await tx.insert(alokasiUangMuka).values(nilai);
}

/**
 * K-125 / K-127 butir 3: qty yang sudah dipesan tetapi belum datang per barang (PO berjalan), dan lama kirim
 * aktual per pemasok (rata-rata hari dari tanggal dipesan sampai penerimaan pertama, beserta banyaknya PO).
 */
export async function sudahDipesan(ex: Executor): Promise<Map<number, string>> {
  const r = await ex.execute<{ id_barang: string; qty: string }>(sql`
    select d.id_barang, sum(greatest(coalesce(d.qty_konfirmasi, d.qty_pesan) - d.qty_diterima - d.qty_dipotong, 0))::text qty
      from order_pembelian_detail d join order_pembelian o on o.id = d.id_order_pembelian
     where o.status in ('DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN')
     group by d.id_barang`);
  return new Map(r.rows.map((x) => [Number(x.id_barang), x.qty]));
}

export async function lamaKirimAktual(
  ex: Executor,
): Promise<Map<number, { hari: number; jumlahPO: number }>> {
  const r = await ex.execute<{ id_pemasok: string; hari: string; n: string }>(sql`
    select o.id_pemasok, avg(p.pertama - o.tanggal_dipesan)::text hari, count(*)::text n
      from order_pembelian o
      join lateral (select min(b.tanggal_operasional) pertama from penerimaan_barang b
                     where b.id_order_pembelian = o.id) p on p.pertama is not null
     where o.tanggal_dipesan is not null
     group by o.id_pemasok`);
  return new Map(
    r.rows.map((x) => [
      Number(x.id_pemasok),
      { hari: Math.max(0, Math.round(Number(x.hari))), jumlahPO: Number(x.n) },
    ]),
  );
}
