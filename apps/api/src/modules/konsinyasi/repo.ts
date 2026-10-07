import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Executor, Tx } from '../../db/client';
import {
  barang,
  pemasok,
  pembayaranPemasok,
  pengguna,
  penjualan,
  penjualanDetail,
  penyelesaianKonsinyasi,
  penyelesaianKonsinyasiDetail,
  penyesuaianStok,
  penyesuaianStokDetail,
  persediaan,
  returPenjualan,
  returPenjualanDetail,
  satuan,
} from '../../db/schema';
import { polaCari } from '../../lib/paginasi';

/** Kunci baris pemasok: penyelesaian konsinyasi satu pemasok dibuat satu per satu. */
export async function kunciPemasok(tx: Tx, id: number) {
  const [p] = await tx
    .select({ id: pemasok.id, nama: pemasok.namaPemasok })
    .from(pemasok)
    .where(eq(pemasok.id, id))
    .for('update');
  return p;
}

export async function namaPemasok(ex: Executor, id: number) {
  const [p] = await ex
    .select({ id: pemasok.id, nama: pemasok.namaPemasok })
    .from(pemasok)
    .where(eq(pemasok.id, id));
  return p;
}

const titipanPemasok = (idPemasok: number) =>
  and(eq(barang.kepemilikan, 'KONSINYASI'), eq(barang.idPemasokKonsinyasi, idPemasok));

/** KS5: baris penjualan barang titipan pemasok yang belum disetor, s/d tanggal akhir periode. */
export function jualBelumDisetor(ex: Executor, idPemasok: number, periodeSelesai: string) {
  return ex
    .select({
      id: penjualanDetail.id,
      idBarang: penjualanDetail.idBarang,
      qtyDasar: penjualanDetail.qtyDasar,
      hargaTitip: penjualanDetail.hppSaatTransaksi,
      tanggalOperasional: penjualan.tanggalOperasional,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .where(
      and(
        titipanPemasok(idPemasok),
        isNull(penjualanDetail.idPenyelesaianKonsinyasi),
        ne(penjualanDetail.statusItem, 'VOID'),
        lte(penjualan.tanggalOperasional, periodeSelesai),
      ),
    )
    .orderBy(asc(penjualan.tanggalOperasional), asc(penjualanDetail.id));
}

/**
 * KS5–KS6 (K-092): retur pelanggan DISETUJUI atas barang titipan pemasok yang belum diperhitungkan, apa pun
 * kondisinya (barang kembali menjadi milik penitip; yang rusak diselesaikan lewat kembalikan/musnahkan). Tukar
 * barang (ada barang pengganti) netral bagi pemasok sehingga tidak ikut (K-089).
 */
export function returBelumDihitung(ex: Executor, idPemasok: number, periodeSelesai: string) {
  return ex
    .select({
      id: returPenjualanDetail.id,
      idBarang: returPenjualanDetail.idBarang,
      idPenjualanDetail: returPenjualanDetail.idPenjualanDetail,
      qtyDasar: returPenjualanDetail.qtyReturDasar,
      hargaTitip: penjualanDetail.hppSaatTransaksi,
      sudahDisetor: sql<boolean>`${penjualanDetail.idPenyelesaianKonsinyasi} is not null`,
    })
    .from(returPenjualanDetail)
    .innerJoin(returPenjualan, eq(returPenjualan.id, returPenjualanDetail.idRetur))
    .innerJoin(penjualanDetail, eq(penjualanDetail.id, returPenjualanDetail.idPenjualanDetail))
    .innerJoin(barang, eq(barang.id, returPenjualanDetail.idBarang))
    .where(
      and(
        titipanPemasok(idPemasok),
        eq(returPenjualan.status, 'DISETUJUI'),
        isNull(returPenjualanDetail.idBarangPengganti),
        isNull(returPenjualanDetail.idPenyelesaianKonsinyasi),
        lte(returPenjualan.tanggalOperasional, periodeSelesai),
      ),
    )
    .orderBy(asc(returPenjualan.tanggalOperasional), asc(returPenjualanDetail.id));
}

/**
 * K-092: pemusnahan barang titipan pemasok (penyesuaian MUSNAH selesai) yang belum ditagihkan: toko menanggung,
 * nilainya (harga titip saat dimusnahkan) dibayar ke penitip lewat setoran.
 */
export function musnahBelumDihitung(ex: Executor, idPemasok: number, periodeSelesai: string) {
  return ex
    .select({
      id: penyesuaianStokDetail.id,
      idBarang: penyesuaianStokDetail.idBarang,
      qtySelisih: penyesuaianStokDetail.qtySelisih,
      hargaTitip: penyesuaianStokDetail.hppSatuan,
    })
    .from(penyesuaianStokDetail)
    .innerJoin(penyesuaianStok, eq(penyesuaianStok.id, penyesuaianStokDetail.idPenyesuaian))
    .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
    .where(
      and(
        titipanPemasok(idPemasok),
        eq(penyesuaianStok.jenis, 'MUSNAH'),
        eq(penyesuaianStok.status, 'SELESAI'),
        isNull(penyesuaianStokDetail.idPenyelesaianKonsinyasi),
        lte(penyesuaianStok.tanggalOperasional, periodeSelesai),
      ),
    )
    .orderBy(asc(penyesuaianStokDetail.id));
}

/** Kolom penanda (K-092): pemusnahan titipan sudah ditagihkan di KSG ini. */
export async function tandaiMusnah(tx: Tx, idDetail: number[], idKsg: number) {
  if (idDetail.length === 0) return;
  await tx
    .update(penyesuaianStokDetail)
    .set({ idPenyelesaianKonsinyasi: idKsg })
    .where(
      and(
        inArray(penyesuaianStokDetail.id, idDetail),
        isNull(penyesuaianStokDetail.idPenyelesaianKonsinyasi),
      ),
    );
}

export function infoBarang(ex: Executor, id: number[]) {
  if (id.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
    })
    .from(barang)
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(inArray(barang.id, id));
}

/** Akhir periode penyelesaian terakhir pemasok (awal periode berikutnya = sehari sesudahnya). */
export async function periodeTerakhir(ex: Executor, idPemasok: number) {
  const [b] = await ex
    .select({ periodeSelesai: penyelesaianKonsinyasi.periodeSelesai })
    .from(penyelesaianKonsinyasi)
    .where(eq(penyelesaianKonsinyasi.idPemasok, idPemasok))
    .orderBy(desc(penyelesaianKonsinyasi.periodeSelesai), desc(penyelesaianKonsinyasi.id))
    .limit(1);
  return b?.periodeSelesai ?? null;
}

export async function tambahHeader(tx: Tx, nilai: typeof penyelesaianKonsinyasi.$inferInsert) {
  const [b] = await tx
    .insert(penyelesaianKonsinyasi)
    .values(nilai)
    .returning({ id: penyelesaianKonsinyasi.id });
  if (!b) throw new Error('insert penyelesaian konsinyasi tidak mengembalikan id');
  return b.id;
}

export async function tambahDetail(
  tx: Tx,
  nilai: (typeof penyelesaianKonsinyasiDetail.$inferInsert)[],
) {
  if (nilai.length > 0) await tx.insert(penyelesaianKonsinyasiDetail).values(nilai);
}

/** Kolom penanda (docs/03): baris penjualan disetor oleh KSG ini. */
export async function tandaiJual(tx: Tx, idDetail: number[], idKsg: number) {
  if (idDetail.length === 0) return;
  await tx
    .update(penjualanDetail)
    .set({ idPenyelesaianKonsinyasi: idKsg })
    .where(
      and(inArray(penjualanDetail.id, idDetail), isNull(penjualanDetail.idPenyelesaianKonsinyasi)),
    );
}

/** Kolom penanda (K-089): retur pelanggan sudah diperhitungkan oleh KSG ini. */
export async function tandaiRetur(tx: Tx, idDetail: number[], idKsg: number) {
  if (idDetail.length === 0) return;
  await tx
    .update(returPenjualanDetail)
    .set({ idPenyelesaianKonsinyasi: idKsg })
    .where(
      and(
        inArray(returPenjualanDetail.id, idDetail),
        isNull(returPenjualanDetail.idPenyelesaianKonsinyasi),
      ),
    );
}

const kolomDaftar = {
  id: penyelesaianKonsinyasi.id,
  nomor: penyelesaianKonsinyasi.nomor,
  tanggal: penyelesaianKonsinyasi.tanggal,
  tanggalOperasional: penyelesaianKonsinyasi.tanggalOperasional,
  idPemasok: penyelesaianKonsinyasi.idPemasok,
  namaPemasok: pemasok.namaPemasok,
  periodeMulai: penyelesaianKonsinyasi.periodeMulai,
  periodeSelesai: penyelesaianKonsinyasi.periodeSelesai,
  total: penyelesaianKonsinyasi.total,
  totalDibayar: penyelesaianKonsinyasi.totalDibayar,
  sisaHutang: penyelesaianKonsinyasi.sisaHutang,
  statusHutang: penyelesaianKonsinyasi.statusHutang,
  namaPengguna: pengguna.namaPengguna,
  catatan: penyelesaianKonsinyasi.catatan,
};

function dasar(ex: Executor) {
  return ex
    .select(kolomDaftar)
    .from(penyelesaianKonsinyasi)
    .innerJoin(pemasok, eq(pemasok.id, penyelesaianKonsinyasi.idPemasok))
    .innerJoin(pengguna, eq(pengguna.id, penyelesaianKonsinyasi.idPengguna));
}

export type SaringPenyelesaian = { cari?: string | undefined; idPemasok?: number | undefined };

function syarat(p: SaringPenyelesaian): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.idPemasok === undefined ? undefined : eq(penyelesaianKonsinyasi.idPemasok, p.idPemasok),
    pola
      ? or(ilike(penyelesaianKonsinyasi.nomor, pola), ilike(pemasok.namaPemasok, pola))
      : undefined,
  );
}

export async function daftar(
  ex: Executor,
  p: SaringPenyelesaian & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(penyelesaianKonsinyasi.tanggal), desc(penyelesaianKonsinyasi.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(penyelesaianKonsinyasi)
    .innerJoin(pemasok, eq(pemasok.id, penyelesaianKonsinyasi.idPemasok))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(penyelesaianKonsinyasi.id, id)).limit(1);
  return b;
}

export function detail(ex: Executor, id: number) {
  return ex
    .select({
      idBarang: penyelesaianKonsinyasiDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      hargaTitip: penyelesaianKonsinyasiDetail.hargaTitip,
      qtyTerjual: penyelesaianKonsinyasiDetail.qtyTerjual,
      qtyRetur: penyelesaianKonsinyasiDetail.qtyRetur,
      qtyGantiRugi: penyelesaianKonsinyasiDetail.qtyGantiRugi,
      qtyNeto: penyelesaianKonsinyasiDetail.qtyNeto,
      subtotal: penyelesaianKonsinyasiDetail.subtotal,
    })
    .from(penyelesaianKonsinyasiDetail)
    .innerJoin(barang, eq(barang.id, penyelesaianKonsinyasiDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(penyelesaianKonsinyasiDetail.idPenyelesaian, id))
    .orderBy(asc(barang.namaBarang), asc(penyelesaianKonsinyasiDetail.hargaTitip));
}

/** KS8: stok titipan per pemasok (baik + rusak) dengan harga titip saat ini. */
export function stokTitipan(ex: Executor) {
  return ex
    .select({
      idPemasok: barang.idPemasokKonsinyasi,
      idBarang: barang.id,
      stokFisik: persediaan.stokFisik,
      stokRusak: persediaan.stokRusak,
      hargaTitip: barang.hargaTitip,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(
      and(
        eq(barang.kepemilikan, 'KONSINYASI'),
        or(gt(persediaan.stokFisik, '0'), gt(persediaan.stokRusak, '0')),
      ),
    );
}

/** KS8: semua penjualan titipan yang belum disetor (semua pemasok). */
export function semuaJualBelumDisetor(ex: Executor) {
  return ex
    .select({
      idPemasok: barang.idPemasokKonsinyasi,
      qtyDasar: penjualanDetail.qtyDasar,
      hargaTitip: penjualanDetail.hppSaatTransaksi,
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .where(
      and(
        eq(barang.kepemilikan, 'KONSINYASI'),
        isNull(penjualanDetail.idPenyelesaianKonsinyasi),
        ne(penjualanDetail.statusItem, 'VOID'),
      ),
    );
}

/** KS8: sisa hutang dan setoran terakhir per pemasok. */
export function rekapPenyelesaian(ex: Executor) {
  return ex
    .select({
      idPemasok: penyelesaianKonsinyasi.idPemasok,
      sisaHutang:
        sql<number>`coalesce(sum(${penyelesaianKonsinyasi.sisaHutang}), 0)::bigint`.mapWith(Number),
      terakhir: sql<string | null>`max(${penyelesaianKonsinyasi.periodeSelesai})::text`,
    })
    .from(penyelesaianKonsinyasi)
    .groupBy(penyelesaianKonsinyasi.idPemasok);
}

export function pemasokTitipan(ex: Executor) {
  return ex
    .selectDistinct({ id: pemasok.id, nama: pemasok.namaPemasok })
    .from(pemasok)
    .innerJoin(barang, eq(barang.idPemasokKonsinyasi, pemasok.id))
    .where(eq(barang.kepemilikan, 'KONSINYASI'));
}

/** Laporan Konsinyasi: penyelesaian yang dibuat dalam periode. */
export function penyelesaianPeriode(
  ex: Executor,
  p: { dari: string; sampai: string; idPemasok?: number | undefined },
) {
  return dasar(ex)
    .where(
      and(
        gte(penyelesaianKonsinyasi.tanggalOperasional, p.dari),
        lte(penyelesaianKonsinyasi.tanggalOperasional, p.sampai),
        p.idPemasok === undefined ? undefined : eq(penyelesaianKonsinyasi.idPemasok, p.idPemasok),
      ),
    )
    .orderBy(asc(penyelesaianKonsinyasi.tanggalOperasional), asc(penyelesaianKonsinyasi.id));
}

/** Laporan Konsinyasi: pembayaran setoran konsinyasi dalam periode. */
export async function bayarPeriode(
  ex: Executor,
  p: { dari: string; sampai: string; idPemasok?: number | undefined },
) {
  const [b] = await ex
    .select({
      total: sql<number>`coalesce(sum(${pembayaranPemasok.nominal}), 0)::bigint`.mapWith(Number),
    })
    .from(pembayaranPemasok)
    .where(
      and(
        isNotNull(pembayaranPemasok.idPenyelesaianKonsinyasi),
        gte(pembayaranPemasok.tanggalOperasional, p.dari),
        lte(pembayaranPemasok.tanggalOperasional, p.sampai),
        p.idPemasok === undefined ? undefined : eq(pembayaranPemasok.idPemasok, p.idPemasok),
      ),
    );
  return b?.total ?? 0;
}

/** KS8 + K-092: pemusnahan barang titipan yang belum ditagihkan (semua pemasok). */
export function semuaMusnahBelumDihitung(ex: Executor) {
  return ex
    .select({
      idPemasok: barang.idPemasokKonsinyasi,
      qtySelisih: penyesuaianStokDetail.qtySelisih,
      hargaTitip: penyesuaianStokDetail.hppSatuan,
    })
    .from(penyesuaianStokDetail)
    .innerJoin(penyesuaianStok, eq(penyesuaianStok.id, penyesuaianStokDetail.idPenyesuaian))
    .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
    .where(
      and(
        eq(barang.kepemilikan, 'KONSINYASI'),
        eq(penyesuaianStok.jenis, 'MUSNAH'),
        eq(penyesuaianStok.status, 'SELESAI'),
        isNull(penyesuaianStokDetail.idPenyelesaianKonsinyasi),
      ),
    );
}
