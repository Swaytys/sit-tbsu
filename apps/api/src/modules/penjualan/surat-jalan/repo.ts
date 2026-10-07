import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { StatusSuratJalan } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  barangSatuanJual,
  pelanggan,
  pengguna,
  penjualan,
  penjualanDetail,
  satuan,
  suratJalan,
  suratJalanDetail,
} from '../../../db/schema';
import { kodeSatuanBaris, satuanBaris } from '../satuan-baris';
import { polaCari } from '../../../lib/paginasi';

const kolom = {
  id: suratJalan.id,
  nomor: suratJalan.nomor,
  tanggal: suratJalan.tanggal,
  idPenjualan: suratJalan.idPenjualan,
  nomorPenjualan: penjualan.nomor,
  namaPelanggan: pelanggan.namaPelanggan,
  alamatKirim: suratJalan.alamatKirim,
  namaPenerima: suratJalan.namaPenerima,
  noHpPenerima: suratJalan.noHpPenerima,
  sopir: suratJalan.sopir,
  kendaraan: suratJalan.kendaraan,
  status: suratJalan.status,
  waktuDimuat: suratJalan.waktuDimuat,
  waktuDikirim: suratJalan.waktuDikirim,
  waktuSelesai: suratJalan.waktuSelesai,
  alasanBatal: suratJalan.alasanBatal,
  catatan: suratJalan.catatan,
  namaPengguna: pengguna.namaPengguna,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(suratJalan)
    .innerJoin(penjualan, eq(penjualan.id, suratJalan.idPenjualan))
    .innerJoin(pengguna, eq(pengguna.id, suratJalan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan));
}

export type SaringSuratJalan = {
  cari?: string | undefined;
  status?: StatusSuratJalan | 'AKTIF' | undefined;
  idPenjualan?: number | undefined;
};

function syarat(p: SaringSuratJalan): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'AKTIF'
      ? inArray(suratJalan.status, ['DIPROSES', 'DIMUAT', 'DIKIRIM'])
      : p.status
        ? eq(suratJalan.status, p.status)
        : undefined,
    p.idPenjualan === undefined ? undefined : eq(suratJalan.idPenjualan, p.idPenjualan),
    pola
      ? or(
          ilike(suratJalan.nomor, pola),
          ilike(penjualan.nomor, pola),
          ilike(pelanggan.namaPelanggan, pola),
        )
      : undefined,
  );
}

export async function daftar(
  ex: Executor,
  p: SaringSuratJalan & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(suratJalan.tanggal), desc(suratJalan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(suratJalan)
    .innerJoin(penjualan, eq(penjualan.id, suratJalan.idPenjualan))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(suratJalan.id, id)).limit(1);
  return b;
}

export function detail(ex: Executor, idSuratJalan: number[]) {
  if (idSuratJalan.length === 0) return Promise.resolve([]);
  return ex
    .select({
      idSuratJalan: suratJalanDetail.idSuratJalan,
      idPenjualanDetail: suratJalanDetail.idPenjualanDetail,
      namaBarang: barang.namaBarang,
      kodeBarang: barang.kode,
      kodeSatuan: kodeSatuanBaris,
      qtyKirim: suratJalanDetail.qtyKirim,
    })
    .from(suratJalanDetail)
    .innerJoin(penjualanDetail, eq(penjualanDetail.id, suratJalanDetail.idPenjualanDetail))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(inArray(suratJalanDetail.idSuratJalan, idSuratJalan))
    .orderBy(asc(suratJalanDetail.id));
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: suratJalan.id,
      nomor: suratJalan.nomor,
      idPenjualan: suratJalan.idPenjualan,
      status: suratJalan.status,
      sopir: suratJalan.sopir,
      kendaraan: suratJalan.kendaraan,
    })
    .from(suratJalan)
    .where(eq(suratJalan.id, id))
    .limit(1)
    .for('update');
  return b;
}

const sjAktif = (id: SQL | typeof penjualanDetail.id, status: SQL) => sql<string>`coalesce((
  select sum(d.qty_kirim) from ${suratJalanDetail} d join ${suratJalan} s on s.id = d.id_surat_jalan
  where d.id_penjualan_detail = ${id} and ${status}), 0)::text`;

/** Per baris invoice: qty, retur, status item, qty di SJ non-BATAL, dan qty di SJ SELESAI (S2, S4). */
export function qtyBaris(ex: Executor, idPenjualan: number) {
  return ex
    .select({
      id: penjualanDetail.id,
      namaBarang: barang.namaBarang,
      qty: penjualanDetail.qty,
      faktor: penjualanDetail.faktor,
      qtyReturDasar: penjualanDetail.qtyReturDasar,
      statusItem: penjualanDetail.statusItem,
      qtyDikirim: sjAktif(penjualanDetail.id, sql`s.status <> 'BATAL'`),
      qtyTerkirim: sjAktif(penjualanDetail.id, sql`s.status = 'SELESAI'`),
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .where(eq(penjualanDetail.idPenjualan, idPenjualan))
    .orderBy(asc(penjualanDetail.id));
}

/** Ada surat jalan non-BATAL untuk penjualan ini? (S4) */
export async function adaSuratJalanAktif(ex: Executor, idPenjualan: number): Promise<boolean> {
  const [h] = await ex
    .select({ n: count() })
    .from(suratJalan)
    .where(and(eq(suratJalan.idPenjualan, idPenjualan), ne(suratJalan.status, 'BATAL')));
  return (h?.n ?? 0) > 0;
}
