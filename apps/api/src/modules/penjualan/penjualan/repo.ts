import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type {
  JenisPenjualan,
  StatusPembayaran,
  StatusPengambilan,
  StatusPengiriman,
} from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  orderPenjualan,
  pelanggan,
  pembayaranPenjualan,
  pengguna,
  penjualan,
  penjualanDetail,
  satuan,
  shiftKasir,
  tingkatHarga,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const kolom = {
  id: penjualan.id,
  nomor: penjualan.nomor,
  tanggal: penjualan.tanggal,
  tanggalOperasional: penjualan.tanggalOperasional,
  jenisPenjualan: penjualan.jenisPenjualan,
  idPelanggan: penjualan.idPelanggan,
  namaPelanggan: pelanggan.namaPelanggan,
  noHpPelanggan: pelanggan.noHp,
  namaPembeli: penjualan.namaPembeli,
  namaKasir: pengguna.namaPengguna,
  idOrder: penjualan.idOrder,
  nomorOrder: orderPenjualan.nomor,
  nomorShift: shiftKasir.nomor,
  totalBruto: penjualan.totalBruto,
  totalDiskon: penjualan.totalDiskon,
  diskonTransaksi: penjualan.diskonTransaksi,
  ongkir: penjualan.ongkir,
  totalNeto: penjualan.totalNeto,
  totalVoid: penjualan.totalVoid,
  totalRetur: penjualan.totalRetur,
  totalDibayar: penjualan.totalDibayar,
  totalRefund: penjualan.totalRefund,
  sisaTagihan: penjualan.sisaTagihan,
  statusPembayaran: penjualan.statusPembayaran,
  statusTransaksi: penjualan.statusTransaksi,
  statusPengambilan: penjualan.statusPengambilan,
  statusPengiriman: penjualan.statusPengiriman,
  tanggalJatuhTempo: penjualan.tanggalJatuhTempo,
  bayarSaatTerima: penjualan.bayarSaatTerima,
  alamatKirim: penjualan.alamatKirim,
  catatanKirim: penjualan.catatanKirim,
  catatan: penjualan.catatan,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(penjualan)
    .innerJoin(pengguna, eq(pengguna.id, penjualan.idKasir))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .leftJoin(orderPenjualan, eq(orderPenjualan.id, penjualan.idOrder))
    .leftJoin(shiftKasir, eq(shiftKasir.id, penjualan.idShift));
}

export type SaringPenjualan = {
  cari?: string | undefined;
  jenis?: JenisPenjualan | undefined;
  statusPembayaran?: StatusPembayaran | undefined;
  statusPengambilan?: StatusPengambilan | undefined;
  statusPengiriman?: StatusPengiriman | undefined;
  dari?: string | undefined;
  sampai?: string | undefined;
};

function syarat(p: SaringPenjualan): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.jenis ? eq(penjualan.jenisPenjualan, p.jenis) : undefined,
    p.statusPembayaran ? eq(penjualan.statusPembayaran, p.statusPembayaran) : undefined,
    p.statusPengambilan ? eq(penjualan.statusPengambilan, p.statusPengambilan) : undefined,
    p.statusPengiriman ? eq(penjualan.statusPengiriman, p.statusPengiriman) : undefined,
    p.dari ? gte(penjualan.tanggalOperasional, p.dari) : undefined,
    p.sampai ? lte(penjualan.tanggalOperasional, p.sampai) : undefined,
    pola
      ? or(
          ilike(penjualan.nomor, pola),
          ilike(penjualan.namaPembeli, pola),
          ilike(pelanggan.namaPelanggan, pola),
        )
      : undefined,
  );
}

export async function daftarPenjualan(
  ex: Executor,
  p: SaringPenjualan & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(penjualan.tanggal), desc(penjualan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function penjualanById(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(penjualan.id, id)).limit(1);
  return b;
}

export function detailPenjualan(ex: Executor, id: number) {
  return ex
    .select({
      id: penjualanDetail.id,
      idBarang: penjualanDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      qty: penjualanDetail.qty,
      namaTier: tingkatHarga.nama,
      hargaSatuan: penjualanDetail.hargaSatuan,
      hargaManual: penjualanDetail.hargaManual,
      diskonBaris: penjualanDetail.diskonBaris,
      subtotal: penjualanDetail.subtotal,
      statusItem: penjualanDetail.statusItem,
      hppSaatTransaksi: penjualanDetail.hppSaatTransaksi,
    })
    .from(penjualanDetail)
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(tingkatHarga, eq(tingkatHarga.id, penjualanDetail.idTingkatHarga))
    .where(eq(penjualanDetail.idPenjualan, id))
    .orderBy(asc(penjualanDetail.id));
}

export function pembayaran(ex: Executor, id: number) {
  return ex
    .select({
      id: pembayaranPenjualan.id,
      nomor: pembayaranPenjualan.nomor,
      tanggal: pembayaranPenjualan.tanggal,
      jenis: pembayaranPenjualan.jenis,
      metode: pembayaranPenjualan.metode,
      nominal: pembayaranPenjualan.nominal,
      uangDiterima: pembayaranPenjualan.uangDiterima,
      kembalian: pembayaranPenjualan.kembalian,
      rekening: pembayaranPenjualan.rekening,
      referensi: pembayaranPenjualan.referensi,
      namaPengguna: pengguna.namaPengguna,
    })
    .from(pembayaranPenjualan)
    .innerJoin(pengguna, eq(pengguna.id, pembayaranPenjualan.idPengguna))
    .where(eq(pembayaranPenjualan.idPenjualan, id))
    .orderBy(asc(pembayaranPenjualan.id));
}

export async function kunciPenjualan(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      jenisPenjualan: penjualan.jenisPenjualan,
      idPelanggan: penjualan.idPelanggan,
      statusTransaksi: penjualan.statusTransaksi,
      statusPengambilan: penjualan.statusPengambilan,
      totalNeto: penjualan.totalNeto,
      totalVoid: penjualan.totalVoid,
      totalRetur: penjualan.totalRetur,
      totalDibayar: penjualan.totalDibayar,
      totalRefund: penjualan.totalRefund,
      tanggalJatuhTempo: penjualan.tanggalJatuhTempo,
    })
    .from(penjualan)
    .where(eq(penjualan.id, id))
    .limit(1)
    .for('update');
  return b;
}

export async function termPelanggan(ex: Executor, id: number): Promise<number> {
  const [p] = await ex
    .select({ termHari: pelanggan.termHari })
    .from(pelanggan)
    .where(eq(pelanggan.id, id));
  return p?.termHari ?? 0;
}
