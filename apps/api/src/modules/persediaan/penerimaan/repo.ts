import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { JenisPenerimaan } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  pembayaranPemasok,
  pemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  pengguna,
  satuan,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';
import { polaCari } from '../../../lib/paginasi';

const jumlahBaris = sql<number>`(select count(*)::int from ${penerimaanBarangDetail}
  where ${kolomPenuh(penerimaanBarangDetail.idPenerimaan)} = ${kolomPenuh(penerimaanBarang.id)})`;

const kolom = {
  id: penerimaanBarang.id,
  nomor: penerimaanBarang.nomor,
  tanggal: penerimaanBarang.tanggal,
  tanggalOperasional: penerimaanBarang.tanggalOperasional,
  idPemasok: penerimaanBarang.idPemasok,
  namaPemasok: pemasok.namaPemasok,
  kodePemasok: pemasok.kode,
  jenis: penerimaanBarang.jenis,
  syaratBayar: penerimaanBarang.syaratBayar,
  tanggalJatuhTempo: penerimaanBarang.tanggalJatuhTempo,
  noFakturPemasok: penerimaanBarang.noFakturPemasok,
  noSuratJalanPemasok: penerimaanBarang.noSuratJalanPemasok,
  catatan: penerimaanBarang.catatan,
  totalFaktur: penerimaanBarang.totalFaktur,
  totalDibayar: penerimaanBarang.totalDibayar,
  sisaHutang: sql<number>`coalesce(${penerimaanBarang.sisaHutang}, 0)::bigint`.mapWith(Number),
  statusHutang: penerimaanBarang.statusHutang,
  jumlahBaris,
  namaPengguna: pengguna.namaPengguna,
};

export type SaringPenerimaan = {
  cari?: string | undefined;
  jenis?: JenisPenerimaan | undefined;
  idPemasok?: number | undefined;
  dari?: string | undefined;
  sampai?: string | undefined;
};

function syarat(p: SaringPenerimaan): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.jenis ? eq(penerimaanBarang.jenis, p.jenis) : undefined,
    p.idPemasok ? eq(penerimaanBarang.idPemasok, p.idPemasok) : undefined,
    p.dari ? gte(penerimaanBarang.tanggalOperasional, p.dari) : undefined,
    p.sampai ? lte(penerimaanBarang.tanggalOperasional, p.sampai) : undefined,
    pola
      ? or(
          ilike(penerimaanBarang.nomor, pola),
          ilike(penerimaanBarang.noFakturPemasok, pola),
          ilike(penerimaanBarang.noSuratJalanPemasok, pola),
          ilike(pemasok.namaPemasok, pola),
        )
      : undefined,
  );
}

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(penerimaanBarang)
    .innerJoin(pemasok, eq(pemasok.id, penerimaanBarang.idPemasok))
    .innerJoin(pengguna, eq(pengguna.id, penerimaanBarang.idPengguna));
}

export async function daftarPenerimaan(
  ex: Executor,
  p: SaringPenerimaan & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(penerimaanBarang.tanggal), desc(penerimaanBarang.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(penerimaanBarang)
    .innerJoin(pemasok, eq(pemasok.id, penerimaanBarang.idPemasok))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function penerimaanById(ex: Executor, id: number) {
  const [baris] = await dasar(ex).where(eq(penerimaanBarang.id, id)).limit(1);
  return baris;
}

export function detailPenerimaan(ex: Executor, idPenerimaan: number) {
  return ex
    .select({
      id: penerimaanBarangDetail.id,
      idBarang: penerimaanBarangDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      qtyMasuk: penerimaanBarangDetail.qtyMasuk,
      hargaModalMasuk: penerimaanBarangDetail.hargaModalMasuk,
      subtotal: penerimaanBarangDetail.subtotal,
      keterangan: penerimaanBarangDetail.keterangan,
    })
    .from(penerimaanBarangDetail)
    .innerJoin(barang, eq(barang.id, penerimaanBarangDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(penerimaanBarangDetail.idPenerimaan, idPenerimaan))
    .orderBy(asc(penerimaanBarangDetail.id));
}

export function pembayaranPenerimaan(ex: Executor, idPenerimaan: number) {
  return ex
    .select({
      nomor: pembayaranPemasok.nomor,
      tanggal: pembayaranPemasok.tanggal,
      nominal: pembayaranPemasok.nominal,
      metode: pembayaranPemasok.metode,
    })
    .from(pembayaranPemasok)
    .where(eq(pembayaranPemasok.idPenerimaan, idPenerimaan))
    .orderBy(asc(pembayaranPemasok.id));
}

export async function pemasokAktif(ex: Executor, id: number) {
  const [p] = await ex
    .select({ id: pemasok.id, nama: pemasok.namaPemasok, statusAktif: pemasok.statusAktif })
    .from(pemasok)
    .where(eq(pemasok.id, id));
  return p;
}

export function barangUntukPenerimaan(ex: Executor, id: number[]) {
  return ex
    .select({
      id: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      statusAktif: barang.statusAktif,
      kepemilikan: barang.kepemilikan,
      idPemasokKonsinyasi: barang.idPemasokKonsinyasi,
      hargaTitip: barang.hargaTitip,
    })
    .from(barang)
    .where(inArray(barang.id, id));
}

export async function tambahHeader(tx: Tx, nilai: typeof penerimaanBarang.$inferInsert) {
  const [b] = await tx
    .insert(penerimaanBarang)
    .values(nilai)
    .returning({ id: penerimaanBarang.id });
  if (!b) throw new Error('insert penerimaan tidak mengembalikan id');
  return b.id;
}

export async function tambahDetail(tx: Tx, nilai: typeof penerimaanBarangDetail.$inferInsert) {
  const [b] = await tx
    .insert(penerimaanBarangDetail)
    .values(nilai)
    .returning({ id: penerimaanBarangDetail.id });
  if (!b) throw new Error('insert detail penerimaan tidak mengembalikan id');
  return b.id;
}

export async function tambahPembayaran(
  tx: Tx,
  nilai: typeof pembayaranPemasok.$inferInsert,
): Promise<number> {
  const [b] = await tx
    .insert(pembayaranPemasok)
    .values(nilai)
    .returning({ id: pembayaranPemasok.id });
  if (!b) throw new Error('insert pembayaran pemasok tidak mengembalikan id');
  return b.id;
}
