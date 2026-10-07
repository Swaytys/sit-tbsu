import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { StatusPersetujuan } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  barangSatuanJual,
  pelanggan,
  pengguna,
  penjualan,
  penjualanDetail,
  returPenjualan,
  returPenjualanDetail,
  satuan,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';
import { kodeSatuanBaris, satuanBaris } from '../../penjualan/satuan-baris';

const pengaju = aliasedTable(pengguna, 'pengaju');
const namaPenyetuju = sql<string | null>`(select p.nama_pengguna from ${pengguna} p
  where p.id = ${returPenjualan.idPenyetuju})`;

const kolom = {
  id: returPenjualan.id,
  nomor: returPenjualan.nomor,
  tanggal: returPenjualan.tanggal,
  idPenjualan: returPenjualan.idPenjualan,
  nomorPenjualan: penjualan.nomor,
  status: returPenjualan.status,
  alasan: returPenjualan.alasan,
  alasanPenolakan: returPenjualan.alasanPenolakan,
  penyelesaian: returPenjualan.penyelesaian,
  totalRetur: returPenjualan.totalRetur,
  metodeRefund: returPenjualan.metodeRefund,
  rekeningRefund: returPenjualan.rekeningRefund,
  referensiRefund: returPenjualan.referensiRefund,
  namaPengaju: pengaju.namaPengguna,
  namaPenyetuju,
  waktuPersetujuan: returPenjualan.waktuPersetujuan,
  catatan: returPenjualan.catatan,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .innerJoin(pengaju, eq(pengaju.id, returPenjualan.idPengaju));
}

export type SaringRetur = { cari?: string | undefined; status?: StatusPersetujuan | undefined };

function syarat(p: SaringRetur): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status ? eq(returPenjualan.status, p.status) : undefined,
    pola ? or(ilike(returPenjualan.nomor, pola), ilike(penjualan.nomor, pola)) : undefined,
  );
}

export async function daftar(ex: Executor, p: SaringRetur & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(returPenjualan.tanggal), desc(returPenjualan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex
    .select({ total: count() })
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .where(where);
  return { baris, total: h?.total ?? 0 };
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(returPenjualan.id, id)).limit(1);
  return b;
}

export function detail(ex: Executor, idRetur: number[]) {
  if (idRetur.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: returPenjualanDetail.id,
      idRetur: returPenjualanDetail.idRetur,
      idPenjualanDetail: returPenjualanDetail.idPenjualanDetail,
      idBarang: returPenjualanDetail.idBarang,
      namaBarang: barang.namaBarang,
      kodeSatuan: kodeSatuanBaris,
      qtyRetur: returPenjualanDetail.qtyRetur,
      qtyReturDasar: returPenjualanDetail.qtyReturDasar,
      kondisi: returPenjualanDetail.kondisi,
      nominalRetur: returPenjualanDetail.nominalRetur,
      idBarangPengganti: returPenjualanDetail.idBarangPengganti,
      qtyPenggantiDasar: returPenjualanDetail.qtyPenggantiDasar,
    })
    .from(returPenjualanDetail)
    .innerJoin(penjualanDetail, eq(penjualanDetail.id, returPenjualanDetail.idPenjualanDetail))
    .innerJoin(barang, eq(barang.id, returPenjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(inArray(returPenjualanDetail.idRetur, idRetur))
    .orderBy(asc(returPenjualanDetail.id));
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: returPenjualan.id,
      nomor: returPenjualan.nomor,
      idPenjualan: returPenjualan.idPenjualan,
      status: returPenjualan.status,
      penyelesaian: returPenjualan.penyelesaian,
      metodeRefund: returPenjualan.metodeRefund,
      rekeningRefund: returPenjualan.rekeningRefund,
      referensiRefund: returPenjualan.referensiRefund,
    })
    .from(returPenjualan)
    .where(eq(returPenjualan.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Baris penjualan + qty retur yang masih menunggu persetujuan (agar tidak diajukan dobel, T1). */
export function barisPenjualan(ex: Executor, idPenjualan: number) {
  const menunggu = sql<string>`coalesce((select sum(d.qty_retur_dasar) from ${returPenjualanDetail} d
    join ${returPenjualan} r on r.id = d.id_retur
    where d.id_penjualan_detail = ${penjualanDetail.id} and r.status = 'MENUNGGU'), 0)::text`;
  return ex
    .select({
      id: penjualanDetail.id,
      idBarang: penjualanDetail.idBarang,
      namaBarang: barang.namaBarang,
      kodeSatuan: kodeSatuanBaris,
      faktor: penjualanDetail.faktor,
      qty: penjualanDetail.qty,
      qtyDasar: penjualanDetail.qtyDasar,
      qtyReturDasar: penjualanDetail.qtyReturDasar,
      subtotal: penjualanDetail.subtotal,
      hppSaatTransaksi: penjualanDetail.hppSaatTransaksi,
      statusItem: penjualanDetail.statusItem,
      qtyMenunggu: menunggu,
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(eq(penjualanDetail.idPenjualan, idPenjualan))
    .orderBy(asc(penjualanDetail.id));
}

/** Kandidat retur (T1): penjualan SELESAI/VOID_SEBAGIAN yang dicari nomor/pembeli. */
export function kandidat(ex: Executor, cari: string) {
  const pola = polaCari(cari);
  return ex
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggal,
      jenisPenjualan: penjualan.jenisPenjualan,
      statusTransaksi: penjualan.statusTransaksi,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      totalNeto: penjualan.totalNeto,
      sisaTagihan: penjualan.sisaTagihan,
      totalDibayar: penjualan.totalDibayar,
      totalRefund: penjualan.totalRefund,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        inArray(penjualan.statusTransaksi, ['SELESAI', 'VOID_SEBAGIAN']),
        or(
          ilike(penjualan.nomor, pola),
          ilike(penjualan.namaPembeli, pola),
          ilike(pelanggan.namaPelanggan, pola),
        ),
      ),
    )
    .orderBy(desc(penjualan.tanggal))
    .limit(20);
}

export async function tambahHeader(tx: Tx, nilai: typeof returPenjualan.$inferInsert) {
  const [b] = await tx.insert(returPenjualan).values(nilai).returning({ id: returPenjualan.id });
  if (!b) throw new Error('insert retur tidak mengembalikan id');
  return b.id;
}

export async function tambahDetail(tx: Tx, nilai: (typeof returPenjualanDetail.$inferInsert)[]) {
  await tx.insert(returPenjualanDetail).values(nilai);
}

export async function ubahHeader(
  tx: Tx,
  id: number,
  nilai: Partial<typeof returPenjualan.$inferInsert>,
) {
  await tx.update(returPenjualan).set(nilai).where(eq(returPenjualan.id, id));
}

export async function ubahBarisPenjualan(
  tx: Tx,
  id: number,
  nilai: Partial<typeof penjualanDetail.$inferInsert>,
) {
  await tx.update(penjualanDetail).set(nilai).where(eq(penjualanDetail.id, id));
}

export async function jumlahMenunggu(ex: Executor): Promise<number> {
  const [h] = await ex
    .select({ n: count() })
    .from(returPenjualan)
    .where(eq(returPenjualan.status, 'MENUNGGU'));
  return h?.n ?? 0;
}
