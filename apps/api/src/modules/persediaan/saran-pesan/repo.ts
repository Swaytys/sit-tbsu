import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { Executor } from '../../../db/client';
import { barang, kategori, pemasok, persediaan, satuan } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/*
 * Bacaan untuk rekomendasi pemesanan ulang (K-113). Hanya SELECT; angka terjual dihitung dari ledger
 * `mutasi_persediaan` sehingga void, retur, dan tukar barang ikut diperhitungkan (RO1).
 */

export type BarisBarangSaran = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  stokTersedia: string;
  stokMinimum: string;
  hargaBeliTerakhir: number;
  hppRata2: number;
  /** Terjual bersih dalam rentang tanggal (bisa negatif bila retur lebih banyak). */
  terjual: string;
  /** Tanggal operasional mutasi pertama barang ini (awal riwayat), `null` bila belum ada mutasi. */
  mutasiPertama: string | null;
  /** Pemasok penerimaan pembelian terakhir. */
  idPemasok: number | null;
  faktorKemasan: string | null;
  kodeKemasan: string | null;
};

export async function barangUntukSaran(
  ex: Executor,
  p: { dari: string; sampai: string; idKategori?: number | undefined; cari?: string | undefined },
): Promise<BarisBarangSaran[]> {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return ex
    .select({
      idBarang: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
      stokMinimum: barang.stokMinimum,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      hppRata2: persediaan.hppRata2,
      terjual: sql<string>`coalesce((
        select sum(case m.jenis_mutasi
                     when 'PENJUALAN' then m.qty_keluar
                     when 'TUKAR_RETUR' then m.qty_keluar
                     when 'RETUR_JUAL' then -m.qty_masuk
                     when 'VOID' then -m.qty_masuk
                     else 0 end)
          from mutasi_persediaan m
         where m.id_barang = ${barang.id}
           and m.tanggal_operasional between ${p.dari} and ${p.sampai}), 0)::text`,
      mutasiPertama: sql<string | null>`(
        select min(m.tanggal_operasional)::text from mutasi_persediaan m where m.id_barang = ${barang.id})`,
      idPemasok: sql<number | null>`(
        select pb.id_pemasok::int
          from penerimaan_barang_detail d
          join penerimaan_barang pb on pb.id = d.id_penerimaan
         where d.id_barang = ${barang.id} and pb.jenis = 'PEMBELIAN'
         order by pb.tanggal desc, pb.id desc
         limit 1)`,
      faktorKemasan: sql<string | null>`(
        select sj.faktor_ke_dasar::text from barang_satuan_jual sj
         where sj.id_barang = ${barang.id} and sj.status_aktif = 'AKTIF' and sj.faktor_ke_dasar > 1
         order by sj.faktor_ke_dasar desc, sj.id limit 1)`,
      kodeKemasan: sql<string | null>`(
        select s2.kode from barang_satuan_jual sj join satuan s2 on s2.id = sj.id_satuan
         where sj.id_barang = ${barang.id} and sj.status_aktif = 'AKTIF' and sj.faktor_ke_dasar > 1
         order by sj.faktor_ke_dasar desc, sj.id limit 1)`,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(
      and(
        eq(barang.statusAktif, 'AKTIF'),
        // RO8: barang titipan diisi penitipnya, bukan dibeli toko.
        eq(barang.kepemilikan, 'MILIK_SENDIRI'),
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
        pola ? or(ilike(barang.namaBarang, pola), ilike(barang.kode, pola)) : undefined,
      ),
    )
    .orderBy(asc(barang.namaBarang), asc(barang.id));
}

export async function pemasokSaran(ex: Executor, id: number[]) {
  if (id.length === 0) return [];
  return ex
    .select({
      id: pemasok.id,
      namaPemasok: pemasok.namaPemasok,
      lamaKirimHari: pemasok.lamaKirimHari,
      jarakBelanjaHari: pemasok.jarakBelanjaHari,
    })
    .from(pemasok)
    .where(inArray(pemasok.id, id));
}
