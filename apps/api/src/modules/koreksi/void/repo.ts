import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
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
  satuan,
  shiftKasir,
  suratJalan,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';
import { polaCari } from '../../../lib/paginasi';
import { kodeSatuanBaris, satuanBaris } from '../../penjualan/satuan-baris';
import { sekarang } from '../../../lib/waktu';

const pengaju = aliasedTable(pengguna, 'pengaju');
const namaPenyetuju = sql<string | null>`(select p.nama_pengguna from ${pengguna} p
  where p.id = ${kolomPenuh(voidTransaksi.idPenyetuju)})`;

const kolom = {
  id: voidTransaksi.id,
  nomor: voidTransaksi.nomor,
  tanggal: voidTransaksi.tanggal,
  idPenjualan: voidTransaksi.idPenjualan,
  nomorPenjualan: penjualan.nomor,
  lingkup: voidTransaksi.lingkup,
  status: voidTransaksi.status,
  alasan: voidTransaksi.alasan,
  alasanPenolakan: voidTransaksi.alasanPenolakan,
  nominalVoid: voidTransaksi.nominalVoid,
  nominalRefund: voidTransaksi.nominalRefund,
  metodeRefund: voidTransaksi.metodeRefund,
  idPengaju: voidTransaksi.idPengaju,
  namaPengaju: pengaju.namaPengguna,
  namaPenyetuju,
  caraPersetujuan: voidTransaksi.caraPersetujuan,
  waktuPersetujuan: voidTransaksi.waktuPersetujuan,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(voidTransaksi)
    .innerJoin(penjualan, eq(penjualan.id, voidTransaksi.idPenjualan))
    .innerJoin(pengaju, eq(pengaju.id, voidTransaksi.idPengaju));
}

export type SaringVoid = { cari?: string | undefined; status?: StatusPersetujuan | undefined };

function syarat(p: SaringVoid): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status ? eq(voidTransaksi.status, p.status) : undefined,
    pola ? or(ilike(voidTransaksi.nomor, pola), ilike(penjualan.nomor, pola)) : undefined,
  );
}

export async function daftar(ex: Executor, p: SaringVoid & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(voidTransaksi.tanggal), desc(voidTransaksi.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex
    .select({ total: count() })
    .from(voidTransaksi)
    .innerJoin(penjualan, eq(penjualan.id, voidTransaksi.idPenjualan))
    .where(where);
  return { baris, total: h?.total ?? 0 };
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(voidTransaksi.id, id)).limit(1);
  return b;
}

export function detail(ex: Executor, idVoid: number[]) {
  if (idVoid.length === 0) return Promise.resolve([]);
  return ex
    .select({
      idVoid: voidTransaksiDetail.idVoid,
      idPenjualanDetail: voidTransaksiDetail.idPenjualanDetail,
      idBarang: voidTransaksiDetail.idBarang,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      qtyDasar: voidTransaksiDetail.qtyDasar,
      nominal: voidTransaksiDetail.nominal,
    })
    .from(voidTransaksiDetail)
    .innerJoin(barang, eq(barang.id, voidTransaksiDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(inArray(voidTransaksiDetail.idVoid, idVoid))
    .orderBy(asc(voidTransaksiDetail.id));
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: voidTransaksi.id,
      nomor: voidTransaksi.nomor,
      idPenjualan: voidTransaksi.idPenjualan,
      idPengaju: voidTransaksi.idPengaju,
      status: voidTransaksi.status,
      lingkup: voidTransaksi.lingkup,
    })
    .from(voidTransaksi)
    .where(eq(voidTransaksi.id, id))
    .limit(1)
    .for('update');
  return b;
}

/**
 * Nilai void yang sedang berjalan (MENUNGGU atau DISETUJUI) per penjualan, untuk batas tanpa persetujuan
 * (K-099): batas dihitung per transaksi agar tidak diakali dengan memecah void per barang.
 */
export async function nilaiBerjalan(
  ex: Executor,
  idPenjualan: number[],
): Promise<Map<number, number>> {
  if (idPenjualan.length === 0) return new Map();
  const baris = await ex
    .select({
      idPenjualan: voidTransaksi.idPenjualan,
      nilai: sql<number>`coalesce(sum(${voidTransaksi.nominalVoid}), 0)::bigint`.mapWith(Number),
    })
    .from(voidTransaksi)
    .where(
      and(
        inArray(voidTransaksi.idPenjualan, idPenjualan),
        inArray(voidTransaksi.status, ['MENUNGGU', 'DISETUJUI']),
      ),
    )
    .groupBy(voidTransaksi.idPenjualan);
  return new Map(baris.map((b) => [b.idPenjualan, b.nilai]));
}

/** Baris penjualan beserta hpp snapshot (untuk mutasi VOID, V4). */
/** Baris penjualan; `idPenjualan` boleh banyak sekaligus (kandidat retur/void tanpa kueri per penjualan). */
export function barisPenjualan(ex: Executor, idPenjualan: number | number[]) {
  return ex
    .select({
      id: penjualanDetail.id,
      idPenjualan: penjualanDetail.idPenjualan,
      idBarang: penjualanDetail.idBarang,
      namaBarang: barang.namaBarang,
      kodeSatuan: kodeSatuanBaris,
      qty: penjualanDetail.qty,
      qtyDasar: penjualanDetail.qtyDasar,
      subtotal: penjualanDetail.subtotal,
      hppSaatTransaksi: penjualanDetail.hppSaatTransaksi,
      statusItem: penjualanDetail.statusItem,
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(
      Array.isArray(idPenjualan)
        ? inArray(penjualanDetail.idPenjualan, idPenjualan.length ? idPenjualan : [0])
        : eq(penjualanDetail.idPenjualan, idPenjualan),
    )
    .orderBy(asc(penjualanDetail.id));
}

/** V1: status shift asal, retur aktif, surat jalan sudah berangkat, void lain yang masih menunggu. */
export async function halanganVoid(ex: Executor, idPenjualan: number, idShift: number | null) {
  const [shift] = idShift
    ? await ex
        .select({ status: shiftKasir.status })
        .from(shiftKasir)
        .where(eq(shiftKasir.id, idShift))
    : [];
  const [retur] = await ex
    .select({ n: count() })
    .from(returPenjualan)
    .where(
      and(
        eq(returPenjualan.idPenjualan, idPenjualan),
        inArray(returPenjualan.status, ['MENUNGGU', 'DISETUJUI']),
      ),
    );
  const [sj] = await ex
    .select({ n: count() })
    .from(suratJalan)
    .where(
      and(
        eq(suratJalan.idPenjualan, idPenjualan),
        inArray(suratJalan.status, ['DIKIRIM', 'SELESAI']),
      ),
    );
  const menunggu = await ex
    .select({ idPenjualanDetail: voidTransaksiDetail.idPenjualanDetail })
    .from(voidTransaksiDetail)
    .innerJoin(voidTransaksi, eq(voidTransaksi.id, voidTransaksiDetail.idVoid))
    .where(and(eq(voidTransaksi.idPenjualan, idPenjualan), eq(voidTransaksi.status, 'MENUNGGU')));
  // KS5 (K-089): baris barang titipan yang sudah disetor ke pemasok tidak bisa di-void.
  const disetor = await ex
    .select({ id: penjualanDetail.id })
    .from(penjualanDetail)
    .where(
      and(
        eq(penjualanDetail.idPenjualan, idPenjualan),
        isNotNull(penjualanDetail.idPenyelesaianKonsinyasi),
      ),
    );
  return {
    statusShift: shift?.status ?? null,
    adaRetur: (retur?.n ?? 0) > 0,
    adaKirim: (sj?.n ?? 0) > 0,
    detailMenunggu: new Set(menunggu.map((m) => m.idPenjualanDetail)),
    detailDisetor: new Set(disetor.map((d) => d.id)),
  };
}

/**
 * Penjualan kandidat void (V1): belum VOID, dan shift asalnya masih BUKA, atau tanpa shift dan hari ini.
 * Pemeriksaan retur/surat jalan dilakukan saat pengajuan.
 */
export async function kandidat(ex: Executor, cari: string | undefined, hariIni: string) {
  const pola = cari ? polaCari(cari) : undefined;
  return ex
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggal,
      jenisPenjualan: penjualan.jenisPenjualan,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      namaKasir: pengguna.namaPengguna,
      totalNeto: penjualan.totalNeto,
      sisaTagihan: penjualan.sisaTagihan,
      totalDibayar: penjualan.totalDibayar,
    })
    .from(penjualan)
    .innerJoin(pengguna, eq(pengguna.id, penjualan.idKasir))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .leftJoin(shiftKasir, eq(shiftKasir.id, penjualan.idShift))
    .where(
      and(
        ne(penjualan.statusTransaksi, 'VOID'),
        or(
          eq(shiftKasir.status, 'BUKA'),
          and(isNull(penjualan.idShift), eq(penjualan.tanggalOperasional, hariIni)),
        ),
        pola
          ? or(
              ilike(penjualan.nomor, pola),
              ilike(penjualan.namaPembeli, pola),
              ilike(pelanggan.namaPelanggan, pola),
            )
          : undefined,
      ),
    )
    .orderBy(desc(penjualan.tanggal))
    .limit(30);
}

export async function tambahHeader(tx: Tx, nilai: typeof voidTransaksi.$inferInsert) {
  const [b] = await tx.insert(voidTransaksi).values(nilai).returning({ id: voidTransaksi.id });
  if (!b) throw new Error('insert void tidak mengembalikan id');
  return b.id;
}

export async function tambahDetail(tx: Tx, nilai: (typeof voidTransaksiDetail.$inferInsert)[]) {
  await tx.insert(voidTransaksiDetail).values(nilai);
}

export async function ubahHeader(
  tx: Tx,
  id: number,
  nilai: Partial<typeof voidTransaksi.$inferInsert>,
) {
  await tx.update(voidTransaksi).set(nilai).where(eq(voidTransaksi.id, id));
}

export async function tandaiBarisVoid(tx: Tx, idDetail: number[]) {
  await tx
    .update(penjualanDetail)
    .set({ statusItem: 'VOID', diubahPada: sekarang() })
    .where(inArray(penjualanDetail.id, idDetail));
}

export async function jumlahMenunggu(ex: Executor): Promise<number> {
  const [h] = await ex
    .select({ n: count() })
    .from(voidTransaksi)
    .where(eq(voidTransaksi.status, 'MENUNGGU'));
  return h?.n ?? 0;
}

export async function idDetail(tx: Tx, idVoid: number, idPenjualanDetail: number) {
  const [b] = await tx
    .select({ id: voidTransaksiDetail.id })
    .from(voidTransaksiDetail)
    .where(
      and(
        eq(voidTransaksiDetail.idVoid, idVoid),
        eq(voidTransaksiDetail.idPenjualanDetail, idPenjualanDetail),
      ),
    );
  return b?.id;
}
