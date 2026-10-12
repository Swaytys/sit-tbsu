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
  persediaan,
  penjualan,
  penjualanDetail,
  returPenjualan,
  returPenjualanDetail,
  satuan,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';
import { polaCari } from '../../../lib/paginasi';
import { kodeSatuanBaris, satuanBaris } from '../../penjualan/satuan-baris';

const pengaju = aliasedTable(pengguna, 'pengaju');
const namaPenyetuju = sql<string | null>`(select p.nama_pengguna from ${pengguna} p
  where p.id = ${kolomPenuh(returPenjualan.idPenyetuju)})`;

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
  idPengaju: returPenjualan.idPengaju,
  namaPengaju: pengaju.namaPengguna,
  namaPenyetuju,
  caraPersetujuan: returPenjualan.caraPersetujuan,
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

/** Semua retur atas sekumpulan penjualan, terbaru dulu (riwayat di form ajukan retur, K-099). */
export function perPenjualan(ex: Executor, idPenjualan: number[]) {
  if (idPenjualan.length === 0) return Promise.resolve([]);
  return dasar(ex)
    .where(inArray(returPenjualan.idPenjualan, idPenjualan))
    .orderBy(desc(returPenjualan.tanggal), desc(returPenjualan.id));
}

/**
 * Nilai retur yang sedang berjalan (MENUNGGU atau DISETUJUI) per penjualan, untuk batas tanpa persetujuan
 * (K-099): batas dihitung per transaksi, bukan per dokumen, agar tidak diakali dengan memecah retur.
 */
export async function nilaiBerjalan(
  ex: Executor,
  idPenjualan: number[],
): Promise<Map<number, number>> {
  if (idPenjualan.length === 0) return new Map();
  const baris = await ex
    .select({
      idPenjualan: returPenjualan.idPenjualan,
      nilai: sql<number>`coalesce(sum(${returPenjualan.totalRetur}), 0)::bigint`.mapWith(Number),
    })
    .from(returPenjualan)
    .where(
      and(
        inArray(returPenjualan.idPenjualan, idPenjualan),
        inArray(returPenjualan.status, ['MENUNGGU', 'DISETUJUI']),
      ),
    )
    .groupBy(returPenjualan.idPenjualan);
  return new Map(baris.map((b) => [b.idPenjualan, b.nilai]));
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
      idPengaju: returPenjualan.idPengaju,
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
/** Baris penjualan; `idPenjualan` boleh banyak sekaligus (kandidat retur/void tanpa kueri per penjualan). */
export function barisPenjualan(ex: Executor, idPenjualan: number | number[]) {
  const menunggu = sql<string>`coalesce((select sum(d.qty_retur_dasar) from ${returPenjualanDetail} d
    join ${returPenjualan} r on r.id = d.id_retur
    where d.id_penjualan_detail = ${kolomPenuh(penjualanDetail.id)} and r.status = 'MENUNGGU'), 0)::text`;
  return ex
    .select({
      id: penjualanDetail.id,
      idPenjualan: penjualanDetail.idPenjualan,
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
    .where(
      Array.isArray(idPenjualan)
        ? inArray(penjualanDetail.idPenjualan, idPenjualan.length ? idPenjualan : [0])
        : eq(penjualanDetail.idPenjualan, idPenjualan),
    )
    .orderBy(asc(penjualanDetail.id));
}

/**
 * Kandidat retur (T1): penjualan SELESAI/VOID_SEBAGIAN yang dicari nomor/pembeli; tanpa kata cari = 20
 * transaksi terbaru, supaya pembeli yang baru saja bertransaksi bisa langsung dipilih (K-106).
 */
export function kandidat(ex: Executor, cari: string) {
  const pola = cari ? polaCari(cari) : undefined;
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

/** Stok tersedia (stok baik − dipesan) satu barang, untuk barang pengganti tukar (T5). */
export async function stokTersedia(ex: Executor, idBarang: number): Promise<string> {
  const [p] = await ex
    .select({ tersedia: sql<string>`${persediaan.stokTersedia}::text` })
    .from(persediaan)
    .where(eq(persediaan.idBarang, idBarang));
  return p?.tersedia ?? '0';
}
