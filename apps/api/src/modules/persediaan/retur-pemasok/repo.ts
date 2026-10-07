import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PenyelesaianReturPemasok } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  pemasok,
  pembayaranPemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  pengguna,
  returPemasok,
  returPemasokDetail,
  satuan,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const jumlahBaris = sql<number>`(select count(*)::int from ${returPemasokDetail}
  where ${returPemasokDetail.idReturPemasok} = ${returPemasok.id})`;

const kolom = {
  id: returPemasok.id,
  nomor: returPemasok.nomor,
  tanggal: returPemasok.tanggal,
  tanggalOperasional: returPemasok.tanggalOperasional,
  idPemasok: returPemasok.idPemasok,
  namaPemasok: pemasok.namaPemasok,
  idPenerimaan: returPemasok.idPenerimaan,
  nomorPenerimaan: penerimaanBarang.nomor,
  penyelesaian: returPemasok.penyelesaian,
  totalRetur: returPemasok.totalRetur,
  jumlahBaris,
  namaPengguna: pengguna.namaPengguna,
  alasan: returPemasok.alasan,
  catatan: returPemasok.catatan,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(returPemasok)
    .innerJoin(pemasok, eq(pemasok.id, returPemasok.idPemasok))
    .innerJoin(pengguna, eq(pengguna.id, returPemasok.idPengguna))
    .leftJoin(penerimaanBarang, eq(penerimaanBarang.id, returPemasok.idPenerimaan));
}

export type SaringReturPemasok = {
  cari?: string | undefined;
  idPemasok?: number | undefined;
  penyelesaian?: PenyelesaianReturPemasok | undefined;
};

function syarat(p: SaringReturPemasok): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.idPemasok === undefined ? undefined : eq(returPemasok.idPemasok, p.idPemasok),
    p.penyelesaian === undefined ? undefined : eq(returPemasok.penyelesaian, p.penyelesaian),
    pola ? or(ilike(returPemasok.nomor, pola), ilike(pemasok.namaPemasok, pola)) : undefined,
  );
}

export async function daftar(
  ex: Executor,
  p: SaringReturPemasok & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(returPemasok.tanggal), desc(returPemasok.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(returPemasok)
    .innerJoin(pemasok, eq(pemasok.id, returPemasok.idPemasok))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function returById(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(returPemasok.id, id)).limit(1);
  return b;
}

export function detail(ex: Executor, id: number) {
  return ex
    .select({
      id: returPemasokDetail.id,
      idBarang: returPemasokDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      kondisiAsal: returPemasokDetail.kondisiAsal,
      qty: returPemasokDetail.qtyDasar,
      hppSatuan: returPemasokDetail.hppSatuan,
      subtotal: returPemasokDetail.subtotal,
      keterangan: returPemasokDetail.keterangan,
    })
    .from(returPemasokDetail)
    .innerJoin(barang, eq(barang.id, returPemasokDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(returPemasokDetail.idReturPemasok, id))
    .orderBy(asc(returPemasokDetail.id));
}

/** RP5: penerimaan pengganti = penerimaan yang dibayar KOMPENSASI oleh retur ini. */
export async function penerimaanPengganti(ex: Executor, idRetur: number) {
  const [b] = await ex
    .select({ nomor: penerimaanBarang.nomor })
    .from(pembayaranPemasok)
    .innerJoin(penerimaanBarang, eq(penerimaanBarang.id, pembayaranPemasok.idPenerimaan))
    .where(eq(pembayaranPemasok.idReturPemasok, idRetur))
    .limit(1);
  return b?.nomor ?? null;
}

export function dataBarang(ex: Executor, id: number[]) {
  return ex
    .select({
      id: barang.id,
      namaBarang: barang.namaBarang,
      kepemilikan: barang.kepemilikan,
      idPemasokKonsinyasi: barang.idPemasokKonsinyasi,
    })
    .from(barang)
    .where(inArray(barang.id, id));
}

/** RP1: barang milik sendiri yang pernah dibeli dari pemasok ini. */
export async function pernahDibeli(ex: Executor, idPemasok: number, idBarang: number[]) {
  if (idBarang.length === 0) return new Set<number>();
  const baris = await ex
    .selectDistinct({ id: penerimaanBarangDetail.idBarang })
    .from(penerimaanBarangDetail)
    .innerJoin(penerimaanBarang, eq(penerimaanBarang.id, penerimaanBarangDetail.idPenerimaan))
    .where(
      and(
        eq(penerimaanBarang.idPemasok, idPemasok),
        eq(penerimaanBarang.jenis, 'PEMBELIAN'),
        inArray(penerimaanBarangDetail.idBarang, idBarang),
      ),
    );
  return new Set(baris.map((b) => b.id));
}

export async function tambahHeader(tx: Tx, nilai: typeof returPemasok.$inferInsert) {
  const [b] = await tx.insert(returPemasok).values(nilai).returning({ id: returPemasok.id });
  if (!b) throw new Error('insert retur pemasok tidak mengembalikan id');
  return b.id;
}

export async function tambahDetail(tx: Tx, nilai: typeof returPemasokDetail.$inferInsert) {
  const [b] = await tx
    .insert(returPemasokDetail)
    .values(nilai)
    .returning({ id: returPemasokDetail.id });
  if (!b) throw new Error('insert detail retur pemasok tidak mengembalikan id');
  return b.id;
}
