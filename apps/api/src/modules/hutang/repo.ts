import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { JenisDokumenHutang, StatusHutang } from '@sit/shared';
import type { Executor, Tx } from '../../db/client';
import {
  pemasok,
  pembayaranPemasok,
  penerimaanBarang,
  perpanjanganJatuhTempo,
  pengguna,
  penyelesaianKonsinyasi,
} from '../../db/schema';

/*
 * Data hutang pemasok (docs/06 HT1): penerimaan PEMBELIAN tempo yang belum lunas dan penyelesaian
 * konsinyasi yang belum lunas. Jumlah dokumen terbuka toko kecil, jadi saringan & halaman diolah service.
 */

export type DokumenHutang = {
  jenis: JenisDokumenHutang;
  id: number;
  nomor: string;
  tanggalOperasional: string;
  idPemasok: number;
  namaPemasok: string;
  noFaktur: string | null;
  tanggalJatuhTempo: string | null;
  total: number;
  dibayar: number;
  returPotong: number;
  sisa: number;
  statusHutang: StatusHutang;
  jumlahPerpanjang: number;
};

export async function semuaHutang(ex: Executor): Promise<DokumenHutang[]> {
  const penerimaan = await ex
    .select({
      id: penerimaanBarang.id,
      nomor: penerimaanBarang.nomor,
      tanggalOperasional: penerimaanBarang.tanggalOperasional,
      idPemasok: penerimaanBarang.idPemasok,
      namaPemasok: pemasok.namaPemasok,
      noFaktur: penerimaanBarang.noFakturPemasok,
      tanggalJatuhTempo: penerimaanBarang.tanggalJatuhTempo,
      total: penerimaanBarang.totalFaktur,
      dibayar: penerimaanBarang.totalDibayar,
      returPotong: penerimaanBarang.totalReturPotong,
      sisa: penerimaanBarang.sisaHutang,
      statusHutang: penerimaanBarang.statusHutang,
      jumlahPerpanjang: sql<number>`(select count(*)::int from ${perpanjanganJatuhTempo}
        where ${perpanjanganJatuhTempo.idPenerimaan} = ${penerimaanBarang.id})`,
    })
    .from(penerimaanBarang)
    .innerJoin(pemasok, eq(pemasok.id, penerimaanBarang.idPemasok))
    .where(
      and(
        eq(penerimaanBarang.jenis, 'PEMBELIAN'),
        inArray(penerimaanBarang.statusHutang, ['BELUM_LUNAS', 'SEBAGIAN']),
      ),
    );
  const konsinyasi = await ex
    .select({
      id: penyelesaianKonsinyasi.id,
      nomor: penyelesaianKonsinyasi.nomor,
      tanggalOperasional: penyelesaianKonsinyasi.tanggalOperasional,
      idPemasok: penyelesaianKonsinyasi.idPemasok,
      namaPemasok: pemasok.namaPemasok,
      total: penyelesaianKonsinyasi.total,
      dibayar: penyelesaianKonsinyasi.totalDibayar,
      sisa: penyelesaianKonsinyasi.sisaHutang,
      statusHutang: penyelesaianKonsinyasi.statusHutang,
    })
    .from(penyelesaianKonsinyasi)
    .innerJoin(pemasok, eq(pemasok.id, penyelesaianKonsinyasi.idPemasok))
    .where(ne(penyelesaianKonsinyasi.statusHutang, 'LUNAS'));
  return [
    ...penerimaan.map((x) => ({
      ...x,
      jenis: 'PENERIMAAN' as const,
      sisa: Number(x.sisa ?? 0),
    })),
    ...konsinyasi.map((x) => ({
      ...x,
      jenis: 'KONSINYASI' as const,
      noFaktur: null,
      tanggalJatuhTempo: null,
      returPotong: 0,
      jumlahPerpanjang: 0,
      sisa: Number(x.sisa ?? 0),
    })),
  ];
}

export async function kunciPenerimaan(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: penerimaanBarang.id,
      nomor: penerimaanBarang.nomor,
      jenis: penerimaanBarang.jenis,
      idPemasok: penerimaanBarang.idPemasok,
      totalFaktur: penerimaanBarang.totalFaktur,
      totalDibayar: penerimaanBarang.totalDibayar,
      totalReturPotong: penerimaanBarang.totalReturPotong,
      statusHutang: penerimaanBarang.statusHutang,
    })
    .from(penerimaanBarang)
    .where(eq(penerimaanBarang.id, id))
    .limit(1)
    .for('update');
  return b;
}

export async function kunciPenyelesaian(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: penyelesaianKonsinyasi.id,
      nomor: penyelesaianKonsinyasi.nomor,
      idPemasok: penyelesaianKonsinyasi.idPemasok,
      total: penyelesaianKonsinyasi.total,
      totalDibayar: penyelesaianKonsinyasi.totalDibayar,
      statusHutang: penyelesaianKonsinyasi.statusHutang,
    })
    .from(penyelesaianKonsinyasi)
    .where(eq(penyelesaianKonsinyasi.id, id))
    .limit(1)
    .for('update');
  return b;
}

export async function aturHutangPenerimaan(
  tx: Tx,
  id: number,
  nilai: { totalDibayar?: number; totalReturPotong?: number; statusHutang: StatusHutang },
  waktu: Date,
) {
  await tx
    .update(penerimaanBarang)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(penerimaanBarang.id, id));
}

export async function aturHutangPenyelesaian(
  tx: Tx,
  id: number,
  nilai: { totalDibayar: number; statusHutang: StatusHutang },
  waktu: Date,
) {
  await tx
    .update(penyelesaianKonsinyasi)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(penyelesaianKonsinyasi.id, id));
}

export function pembayaranDokumen(ex: Executor, jenis: JenisDokumenHutang, id: number) {
  return ex
    .select({
      id: pembayaranPemasok.id,
      nomor: pembayaranPemasok.nomor,
      tanggal: pembayaranPemasok.tanggal,
      metode: pembayaranPemasok.metode,
      nominal: pembayaranPemasok.nominal,
      rekening: pembayaranPemasok.rekening,
      referensi: pembayaranPemasok.referensi,
      catatan: pembayaranPemasok.catatan,
      namaPengguna: pengguna.namaPengguna,
    })
    .from(pembayaranPemasok)
    .innerJoin(pengguna, eq(pengguna.id, pembayaranPemasok.idPengguna))
    .where(
      jenis === 'PENERIMAAN'
        ? eq(pembayaranPemasok.idPenerimaan, id)
        : eq(pembayaranPemasok.idPenyelesaianKonsinyasi, id),
    )
    .orderBy(asc(pembayaranPemasok.tanggal), asc(pembayaranPemasok.id));
}

/** Penerimaan pemasok yang masih berhutang, terbaru dulu (pilihan sumber retur POTONG_HUTANG). */
export function penerimaanBerhutang(ex: Executor, idPemasok: number) {
  return ex
    .select({
      id: penerimaanBarang.id,
      nomor: penerimaanBarang.nomor,
      tanggalOperasional: penerimaanBarang.tanggalOperasional,
      noFaktur: penerimaanBarang.noFakturPemasok,
      sisa: sql<number>`${penerimaanBarang.sisaHutang}`.mapWith(Number),
    })
    .from(penerimaanBarang)
    .where(
      and(
        eq(penerimaanBarang.idPemasok, idPemasok),
        eq(penerimaanBarang.jenis, 'PEMBELIAN'),
        inArray(penerimaanBarang.statusHutang, ['BELUM_LUNAS', 'SEBAGIAN']),
      ),
    )
    .orderBy(desc(penerimaanBarang.tanggalOperasional), desc(penerimaanBarang.id));
}
