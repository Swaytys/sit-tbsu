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
  idKategori: number;
  namaKategori: string;
  kodeSatuan: string;
  stokTersedia: string;
  stokMinimum: string;
  stokMaksimum: string | null;
  hargaBeliTerakhir: number;
  hppRata2: number;
  /** K-242: harga jual tier dasar satuan dasar (0 bila belum ada). */
  hargaJual: number;
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
      idKategori: barang.idKategori,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
      stokMinimum: barang.stokMinimum,
      stokMaksimum: barang.stokMaksimum,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      hppRata2: persediaan.hppRata2,
      hargaJual: sql<number>`coalesce((
        select hb.harga_jual from harga_barang hb join tingkat_harga t on t.id = hb.id_tingkat_harga
         where hb.id_barang = ${barang.id} and t.is_default and hb.id_satuan_jual is null
         limit 1), 0)::bigint`.mapWith(Number),
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

/** K-127: penjualan bersih per barang per tanggal operasional (RO1), hanya hari yang ada mutasinya. */
export async function penjualanHarian(
  ex: Executor,
  p: { dari: string; sampai: string },
): Promise<{ idBarang: number; tanggal: string; qty: string }[]> {
  const r = await ex.execute<{ id_barang: string; tanggal: string; qty: string }>(sql`
    select m.id_barang, m.tanggal_operasional::text tanggal,
           sum(case m.jenis_mutasi
                 when 'PENJUALAN' then m.qty_keluar
                 when 'TUKAR_RETUR' then m.qty_keluar
                 when 'RETUR_JUAL' then -m.qty_masuk
                 when 'VOID' then -m.qty_masuk
                 else 0 end)::text qty
      from mutasi_persediaan m
     where m.tanggal_operasional between ${p.dari} and ${p.sampai}
       and m.jenis_mutasi in ('PENJUALAN', 'TUKAR_RETUR', 'RETUR_JUAL', 'VOID')
     group by m.id_barang, m.tanggal_operasional`);
  return r.rows.map((x) => ({ idBarang: Number(x.id_barang), tanggal: x.tanggal, qty: x.qty }));
}

/**
 * K-127 RO13: penanda versi data yang dipakai saran pesan: id mutasi persediaan terakhir (penjualan, retur, void,
 * penerimaan, penyesuaian) dan waktu ubah terakhir data barang/pemasok (stok min/maks, lama kirim).
 */
export async function versiDataSaran(ex: Executor): Promise<string> {
  const r = await ex.execute<{ v: string | null }>(sql`
    select concat_ws('|',
      (select max(id) from mutasi_persediaan),
      (select max(coalesce(diubah_pada, dibuat_pada)) from barang),
      (select max(coalesce(diubah_pada, dibuat_pada)) from pemasok),
      (select max(coalesce(diubah_pada, dibuat_pada)) from order_pembelian),
      (select count(*) from barang)) v`);
  return r.rows[0]?.v ?? '';
}

/** K-242: baris order pembelian berjalan yang masih ditunggu, dengan tanggal datang yang diketahui. */
export async function kedatanganOrder(ex: Executor) {
  const r = await ex.execute<{
    id_barang: string;
    nomor: string | null;
    id_pemasok: string;
    nama_pemasok: string;
    no_hp: string | null;
    janji: string | null;
    diminta: string | null;
    dipesan: string | null;
  }>(sql`
    select d.id_barang, o.nomor, o.id_pemasok, p.nama_pemasok, p.no_hp,
           o.tanggal_janji_kirim::text janji, o.tanggal_kirim_diminta::text diminta,
           o.tanggal_dipesan::text dipesan
      from order_pembelian_detail d
      join order_pembelian o on o.id = d.id_order_pembelian
      join pemasok p on p.id = o.id_pemasok
     where o.status in ('DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN')
       and coalesce(d.qty_konfirmasi, d.qty_pesan) - d.qty_diterima - d.qty_dipotong > 0`);
  return r.rows.map((x) => ({
    idBarang: Number(x.id_barang),
    nomor: x.nomor,
    idPemasok: Number(x.id_pemasok),
    namaPemasok: x.nama_pemasok,
    noHp: x.no_hp,
    janji: x.janji,
    diminta: x.diminta,
    dipesan: x.dipesan,
  }));
}

/** K-242: pemasok yang pernah memasok tiap barang (penerimaan pembelian). */
export async function pemasokPernah(ex: Executor): Promise<Map<number, number[]>> {
  const r = await ex.execute<{ id_barang: string; id_pemasok: string }>(sql`
    select distinct d.id_barang, pb.id_pemasok
      from penerimaan_barang_detail d join penerimaan_barang pb on pb.id = d.id_penerimaan
     where pb.jenis = 'PEMBELIAN'`);
  const peta = new Map<number, number[]>();
  for (const x of r.rows) {
    const id = Number(x.id_barang);
    peta.set(id, [...(peta.get(id) ?? []), Number(x.id_pemasok)]);
  }
  return peta;
}
