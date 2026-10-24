import { bagiQty, keQty, type Keterjualan, type LabelKeterjualan } from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { sekarang, tambahHari, tanggalOperasional } from '../../../lib/waktu';

/*
 * K-123: label keterjualan dari penjualan 30 hari terakhir (baris dan penjualan bukan VOID), dihitung untuk semua
 * barang sekaligus dan disimpan di memori server paling lama 10 menit (tidak ada tabel baru).
 * - BARU: barang dibuat kurang dari 30 hari lalu (labelnya mengalahkan yang lain).
 * - TIDAK_LAKU: tidak terjual 30 hari.
 * - LARIS: termasuk 20 % barang terjual dengan nilai penjualan tertinggi.
 * - LAMBAT: terjual, tetapi nilai penjualannya di bawah median barang yang terjual.
 * - selebihnya tanpa label.
 */

const HARI = 30;
const UMUR_CACHE_MS = 10 * 60 * 1000;

export const KETERJUALAN_KOSONG: Keterjualan = {
  label: null,
  terjual30: '0',
  rataPerHari: '0',
  terakhirTerjual: null,
};

let cache: { dibuat: number; peta: Map<number, Keterjualan> } | null = null;

/** Untuk tes: paksa hitung ulang. */
export function lupakanKeterjualan(): void {
  cache = null;
}

type Baris = {
  id: string;
  baru: boolean;
  nilai: string | null;
  qty: string | null;
  terakhir: string | null;
};

export async function petaKeterjualan(): Promise<Map<number, Keterjualan>> {
  const kini = sekarang().getTime();
  if (cache && kini - cache.dibuat < UMUR_CACHE_MS) return cache.peta;
  const hariIni = tanggalOperasional();
  const awal = tambahHari(hariIni, -(HARI - 1));
  const r = (
    await db.execute(sql`
      with jual as (
        select d.id_barang, sum(d.subtotal) nilai, sum(d.qty_dasar - d.qty_retur_dasar) qty
          from penjualan_detail d join penjualan p on p.id = d.id_penjualan
         where p.status_transaksi <> 'VOID' and d.status_item <> 'VOID'
           and p.tanggal_operasional between ${awal} and ${hariIni}
         group by d.id_barang
      ),
      akhir as (
        select d.id_barang, max(p.tanggal_operasional)::text terakhir
          from penjualan_detail d join penjualan p on p.id = d.id_penjualan
         where p.status_transaksi <> 'VOID' and d.status_item <> 'VOID'
         group by d.id_barang
      )
      select b.id, b.dibuat_pada > now() - interval '30 days' baru,
             j.nilai::text nilai, j.qty::text qty, a.terakhir
        from barang b
        left join jual j on j.id_barang = b.id
        left join akhir a on a.id_barang = b.id`)
  ).rows as Baris[];

  const terjual = r
    .filter((b) => b.nilai !== null && Number(b.nilai) > 0)
    .sort((x, y) => Number(y.nilai) - Number(x.nilai));
  const batasLaris = Math.max(1, Math.ceil(terjual.length * 0.2));
  const laris = new Set(terjual.slice(0, batasLaris).map((b) => b.id));
  const median =
    terjual.length > 0 ? Number(terjual[Math.floor(terjual.length / 2)]?.nilai ?? 0) : 0;

  const peta = new Map<number, Keterjualan>();
  for (const b of r) {
    const qty = keQty(b.qty ?? '0');
    let label: LabelKeterjualan | null = null;
    if (b.baru) label = 'BARU';
    else if (b.nilai === null || Number(b.nilai) <= 0) label = 'TIDAK_LAKU';
    else if (laris.has(b.id)) label = 'LARIS';
    else if (Number(b.nilai) < median) label = 'LAMBAT';
    peta.set(Number(b.id), {
      label,
      terjual30: qty,
      rataPerHari: bagiQty(qty, HARI),
      terakhirTerjual: b.terakhir,
    });
  }
  cache = { dibuat: kini, peta };
  return peta;
}
