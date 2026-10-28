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
  returPenjualan,
  returPenjualanDetail,
  satuan,
  suratJalan,
  suratJalanDetail,
  suratJalanHasil,
  suratJalanHasilDetail,
  perjalanan,
} from '../../../db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { kolomPenuh } from '../../../db/kolom-penuh';
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
  idPerjalanan: suratJalan.idPerjalanan,
  nomorPerjalanan: perjalanan.nomor,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(suratJalan)
    .innerJoin(penjualan, eq(penjualan.id, suratJalan.idPenjualan))
    .innerJoin(pengguna, eq(pengguna.id, suratJalan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .leftJoin(perjalanan, eq(perjalanan.id, suratJalan.idPerjalanan));
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
      idPerjalanan: suratJalan.idPerjalanan,
    })
    .from(suratJalan)
    .where(eq(suratJalan.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Baris surat jalan untuk dicatat hasilnya (S10). */
export function detailUntukHasil(ex: Executor, idSuratJalan: number) {
  return ex
    .select({
      id: suratJalanDetail.id,
      idPenjualanDetail: suratJalanDetail.idPenjualanDetail,
      qtyKirim: suratJalanDetail.qtyKirim,
      namaBarang: barang.namaBarang,
      kodeSatuan: kodeSatuanBaris,
    })
    .from(suratJalanDetail)
    .innerJoin(penjualanDetail, eq(penjualanDetail.id, suratJalanDetail.idPenjualanDetail))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(eq(suratJalanDetail.idSuratJalan, idSuratJalan))
    .orderBy(asc(suratJalanDetail.id));
}

const returTukar = alias(returPenjualan, 'retur_tukar');
const returUang = alias(returPenjualan, 'retur_uang');
const returRusak = alias(returPenjualan, 'retur_rusak');

/** Header hasil pengantaran beserta retur yang dibuatnya (S10). */
export function hasilHeader(ex: Executor, idSuratJalan: number[]) {
  if (idSuratJalan.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: suratJalanHasil.id,
      idSuratJalan: suratJalanHasil.idSuratJalan,
      waktu: suratJalanHasil.waktu,
      namaPengguna: pengguna.namaPengguna,
      namaPenerima: suratJalanHasil.namaPenerima,
      penangananRusak: suratJalanHasil.penangananRusak,
      catatan: suratJalanHasil.catatan,
      idReturTukar: suratJalanHasil.idReturTukar,
      nomorReturTukar: returTukar.nomor,
      statusReturTukar: returTukar.status,
      idReturUang: suratJalanHasil.idReturUang,
      nomorReturUang: returUang.nomor,
      statusReturUang: returUang.status,
      idReturRusak: suratJalanHasil.idReturRusak,
      nomorReturRusak: returRusak.nomor,
      statusReturRusak: returRusak.status,
    })
    .from(suratJalanHasil)
    .innerJoin(pengguna, eq(pengguna.id, suratJalanHasil.idPengguna))
    .leftJoin(returTukar, eq(returTukar.id, suratJalanHasil.idReturTukar))
    .leftJoin(returUang, eq(returUang.id, suratJalanHasil.idReturUang))
    .leftJoin(returRusak, eq(returRusak.id, suratJalanHasil.idReturRusak))
    .where(inArray(suratJalanHasil.idSuratJalan, idSuratJalan));
}

export function hasilDetail(ex: Executor, idHasil: number[]) {
  if (idHasil.length === 0) return Promise.resolve([]);
  return ex
    .select({
      idHasil: suratJalanHasilDetail.idHasil,
      idPenjualanDetail: suratJalanDetail.idPenjualanDetail,
      qtyDiterima: suratJalanHasilDetail.qtyDiterima,
      qtyKembali: suratJalanHasilDetail.qtyKembali,
      qtyRusak: suratJalanHasilDetail.qtyRusak,
      qtyDitolak: suratJalanHasilDetail.qtyDitolak,
      kondisiDitolak: suratJalanHasilDetail.kondisiDitolak,
      alasanKembali: suratJalanHasilDetail.alasanKembali,
      alasanRusak: suratJalanHasilDetail.alasanRusak,
    })
    .from(suratJalanHasilDetail)
    .innerJoin(suratJalanDetail, eq(suratJalanDetail.id, suratJalanHasilDetail.idSuratJalanDetail))
    .where(inArray(suratJalanHasilDetail.idHasil, idHasil))
    .orderBy(asc(suratJalanHasilDetail.id));
}

/**
 * Invoice pengantaran yang mungkin masih punya barang belum dikirim (disaring lagi per baris di service). Invoice yang
 * semua barangnya sedang berada di surat jalan aktif (di rit, dimuat, di jalan) tidak diambil, agar batas jumlah tidak
 * terisi invoice yang sudah dijadwalkan dan order baru tetap tampil di Backlog.
 */
export function calonPerluDikirim(ex: Executor) {
  return ex
    .select({
      idPenjualan: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggal,
      namaPelanggan: pelanggan.namaPelanggan,
      alamatKirim: penjualan.alamatKirim,
      bayarSaatTerima: penjualan.bayarSaatTerima,
      kirimUlang: sql<boolean>`exists (select 1 from ${suratJalan} s
        where s.id_penjualan = ${kolomPenuh(penjualan.id)} and s.status = 'SELESAI')`,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        eq(penjualan.jenisPenjualan, 'PENGANTARAN'),
        ne(penjualan.statusTransaksi, 'VOID'),
        ne(penjualan.statusPengiriman, 'SELESAI'),
        sql`exists (select 1 from ${penjualanDetail} d
          where d.id_penjualan = ${kolomPenuh(penjualan.id)} and d.status_item <> 'VOID'
            and d.qty > coalesce((select sum(x.qty_kirim) from ${suratJalanDetail} x
              join ${suratJalan} s on s.id = x.id_surat_jalan
              where x.id_penjualan_detail = d.id and s.status in ('DIPROSES', 'DIMUAT', 'DIKIRIM')), 0))`,
      ),
    )
    .orderBy(asc(penjualan.tanggal))
    .limit(300);
}

/**
 * Σ qty per baris invoice dari surat jalan yang memenuhi `status`. Surat jalan yang hasilnya sudah dicatat
 * (S10) dihitung qty diterimanya; yang belum (sedang berjalan, atau SELESAI sebelum K-149) qty kirimnya.
 */
const sjAktif = (id: SQL | typeof penjualanDetail.id, status: SQL) => sql<string>`coalesce((
  select sum(coalesce(h.qty_diterima, d.qty_kirim)) from ${suratJalanDetail} d
  join ${suratJalan} s on s.id = d.id_surat_jalan
  left join ${suratJalanHasilDetail} h on h.id_surat_jalan_detail = d.id
  where d.id_penjualan_detail = ${id} and ${status}), 0)::text`;

/** Qty retur yang masih MENUNGGU persetujuan (satuan dasar). */
const returMenunggu = sql<string>`coalesce((select sum(d.qty_retur_dasar) from ${returPenjualanDetail} d
  join ${returPenjualan} r on r.id = d.id_retur
  where d.id_penjualan_detail = ${kolomPenuh(penjualanDetail.id)} and r.status = 'MENUNGGU'), 0)::text`;

/** Qty di surat jalan yang belum selesai (DIPROSES/DIMUAT/DIKIRIM): barangnya belum jelas nasibnya. */
const dalamPerjalanan = sql<string>`coalesce((
  select sum(d.qty_kirim) from ${suratJalanDetail} d join ${suratJalan} s on s.id = d.id_surat_jalan
  where d.id_penjualan_detail = ${kolomPenuh(penjualanDetail.id)}
    and s.status in ('DIPROSES', 'DIMUAT', 'DIKIRIM')), 0)::text`;

/** Per baris invoice: qty, retur (disetujui dan menunggu), status item, qty di SJ non-BATAL dan SELESAI (S2, S4). */
export function qtyBaris(ex: Executor, idPenjualan: number) {
  return ex
    .select({
      id: penjualanDetail.id,
      namaBarang: barang.namaBarang,
      kodeSatuan: kodeSatuanBaris,
      qty: penjualanDetail.qty,
      faktor: penjualanDetail.faktor,
      qtyReturDasar: penjualanDetail.qtyReturDasar,
      statusItem: penjualanDetail.statusItem,
      qtyReturMenungguDasar: returMenunggu,
      qtyDikirim: sjAktif(penjualanDetail.id, sql`s.status <> 'BATAL'`),
      qtyTerkirim: sjAktif(penjualanDetail.id, sql`s.status = 'SELESAI'`),
      qtyDalamPerjalanan: dalamPerjalanan,
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
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
