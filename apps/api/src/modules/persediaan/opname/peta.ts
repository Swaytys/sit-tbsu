import { nomorHari, type KelasABC } from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';

/*
 * K-240/K-227: peta opname bertahap (cycle count). Barang aktif milik sendiri dikelompokkan ABC menurut nilai keluar
 * terjual (HPP) 90 hari terakhir: A = penyumbang 80% pertama, B = 15% berikutnya, C = sisanya. Selang hitung A 30
 * hari, B 90, C 180; barang yang belum pernah diopname selalu jatuh tempo.
 *
 * K-227: barang **rawan** (berselisih di 2 dari 3 opname terakhirnya) dihitung paling lambat tiap 30 hari dan
 * bobot acaknya +2; barang **mahal** (HPP 10% teratas) dan barang yang pembeliannya wajib disetujui Owner +1.
 */

export const SELANG: Record<KelasABC, number> = { A: 30, B: 90, C: 180 };
export const BOBOT: Record<KelasABC, number> = { A: 3, B: 2, C: 1 };
const SELANG_RAWAN = 30;

export type BarangOpname = {
  idBarang: number;
  kelas: KelasABC;
  terakhir: string | null;
  selang: number;
  jatuhTempo: boolean;
  rawan: boolean;
  mahal: boolean;
  khusus: boolean;
  bobot: number;
};

export async function petaOpname(hariIni = tanggalOperasional()): Promise<BarangOpname[]> {
  const dari = tambahHari(hariIni, -90);
  const r = await db.execute<{
    id: string;
    nilai: string;
    terakhir: string | null;
    hpp: string;
    khusus: boolean;
    selisih3: string;
  }>(sql`
    select b.id::text id,
           coalesce((select sum(m.qty_keluar * m.hpp_satuan) from mutasi_persediaan m
                      where m.id_barang = b.id and m.jenis_mutasi = 'PENJUALAN'
                        and m.tanggal_operasional >= ${dari}), 0)::text nilai,
           (select max(p.waktu_selesai at time zone 'Asia/Jakarta')::date::text
              from penyesuaian_stok_detail d join penyesuaian_stok p on p.id = d.id_penyesuaian
             where d.id_barang = b.id and p.jenis = 'OPNAME' and p.status = 'SELESAI'
               and not d.dikecualikan) terakhir,
           coalesce(ps.hpp_rata2, 0)::text hpp,
           b.perlu_persetujuan_beli khusus,
           (select count(*) from (
              select d.qty_selisih from penyesuaian_stok_detail d
                join penyesuaian_stok p on p.id = d.id_penyesuaian
               where d.id_barang = b.id and p.jenis = 'OPNAME' and p.status = 'SELESAI' and not d.dikecualikan
               order by p.waktu_selesai desc limit 3) x
             where x.qty_selisih <> 0)::text selisih3
      from barang b left join persediaan ps on ps.id_barang = b.id
     where b.status_aktif = 'AKTIF' and b.kepemilikan = 'MILIK_SENDIRI'`);
  const baris = r.rows.map((x) => ({
    id: Number(x.id),
    nilai: Number(x.nilai),
    terakhir: x.terakhir,
    hpp: Number(x.hpp),
    khusus: x.khusus,
    rawan: Number(x.selisih3) >= 2,
  }));
  const total = baris.reduce((t, b) => t + b.nilai, 0);
  // Batas "mahal": HPP pada urutan 10% teratas (paling sedikit satu barang bila ada yang ber-HPP).
  const hppUrut = baris
    .map((b) => b.hpp)
    .filter((h) => h > 0)
    .sort((a, b) => b - a);
  const batasMahal =
    hppUrut.length === 0
      ? Infinity
      : (hppUrut[Math.max(0, Math.ceil(hppUrut.length / 10) - 1)] ?? 0);
  baris.sort((a, b) => b.nilai - a.nilai || a.id - b.id);
  let kumulatif = 0;
  return baris.map((b) => {
    const sebelum = kumulatif;
    kumulatif += b.nilai;
    const kelas: KelasABC =
      total > 0 && b.nilai > 0 && sebelum / total < 0.8
        ? 'A'
        : total > 0 && b.nilai > 0 && sebelum / total < 0.95
          ? 'B'
          : 'C';
    const selang = b.rawan ? Math.min(SELANG[kelas], SELANG_RAWAN) : SELANG[kelas];
    const mahal = b.hpp > 0 && b.hpp >= batasMahal;
    const jatuhTempo = b.terakhir === null || nomorHari(hariIni) - nomorHari(b.terakhir) >= selang;
    return {
      idBarang: b.id,
      kelas,
      terakhir: b.terakhir,
      selang,
      jatuhTempo,
      rawan: b.rawan,
      mahal,
      khusus: b.khusus,
      bobot: BOBOT[kelas] + (b.rawan ? 2 : 0) + (mahal ? 1 : 0) + (b.khusus ? 1 : 0),
    };
  });
}

/** Kelas ABC tiap barang aktif (barang lain dianggap C). */
export async function kelasBarang(): Promise<Map<number, KelasABC>> {
  return new Map((await petaOpname()).map((b) => [b.idBarang, b.kelas]));
}
