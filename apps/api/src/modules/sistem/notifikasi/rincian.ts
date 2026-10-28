import { formatRupiah, teksTanggalAngka } from '@sit/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';

/*
 * K-131: rincian singkat notifikasi (paling banyak 3 baris teratas: nomor, nama, nilai/umur). Kueri baca saja
 * dengan parameter terikat; urutan sama dengan halaman tujuan (yang paling mendesak dulu).
 */

const MAKS = 3;

async function baris<T extends Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(q)).rows as T[];
}

const nama = sql`coalesce(p.nama_pelanggan, j.nama_pembeli, 'Umum')`;

/** Piutang terlambat (`terlambat`) atau jatuh tempo ≤ 3 hari (`segera`). */
export async function rincianPiutang(jenis: 'terlambat' | 'segera'): Promise<string[]> {
  const hariIni = tanggalOperasional();
  const syarat =
    jenis === 'terlambat'
      ? sql`j.tanggal_jatuh_tempo < ${hariIni}`
      : sql`j.tanggal_jatuh_tempo between ${hariIni} and ${tambahHari(hariIni, 3)}`;
  const r = await baris<{ nomor: string; nama: string; sisa: string; jt: string }>(sql`
    select j.nomor, ${nama} nama, j.sisa_tagihan::text sisa, j.tanggal_jatuh_tempo::text jt
      from penjualan j left join pelanggan p on p.id = j.id_pelanggan
     where j.status_transaksi <> 'VOID' and j.sisa_tagihan > 0 and ${syarat}
     order by j.tanggal_jatuh_tempo, j.id limit ${MAKS}`);
  return r.map(
    (x) =>
      `${x.nomor} · ${x.nama} · ${formatRupiah(Number(x.sisa))} · jatuh tempo ${teksTanggalAngka(x.jt)}`,
  );
}

export async function rincianHutang(jenis: 'terlambat' | 'segera'): Promise<string[]> {
  const hariIni = tanggalOperasional();
  const syarat =
    jenis === 'terlambat'
      ? sql`h.tanggal_jatuh_tempo < ${hariIni}`
      : sql`h.tanggal_jatuh_tempo between ${hariIni} and ${tambahHari(hariIni, 3)}`;
  const r = await baris<{ nomor: string; nama: string; sisa: string; jt: string }>(sql`
    select h.nomor, s.nama_pemasok nama, h.sisa_hutang::text sisa, h.tanggal_jatuh_tempo::text jt
      from penerimaan_barang h join pemasok s on s.id = h.id_pemasok
     where h.sisa_hutang > 0 and ${syarat}
     order by h.tanggal_jatuh_tempo, h.id limit ${MAKS}`);
  return r.map(
    (x) =>
      `${x.nomor} · ${x.nama} · ${formatRupiah(Number(x.sisa))} · jatuh tempo ${teksTanggalAngka(x.jt)}`,
  );
}

/** Retur/void yang menunggu persetujuan, terlama dulu. */
export async function rincianPengajuan(
  tabel: 'retur_penjualan' | 'void_transaksi',
): Promise<string[]> {
  const nilai = tabel === 'retur_penjualan' ? sql`k.total_retur` : sql`k.nominal_void`;
  const r = await baris<{ nomor: string; pengaju: string; nilai: string }>(sql`
    select k.nomor, u.nama_pengguna pengaju, ${nilai}::text nilai
      from ${sql.identifier(tabel)} k join pengguna u on u.id = k.id_pengaju
     where k.status = 'MENUNGGU' order by k.id limit ${MAKS}`);
  return r.map((x) => `${x.nomor} · ${formatRupiah(Number(x.nilai))} · diajukan ${x.pengaju}`);
}

/** K-176: refund transfer yang belum dikonfirmasi (terlama dulu). */
export async function rincianRefundTransfer(): Promise<{ jumlah: number; rincian: string[] }> {
  const [n] = await baris<{ n: string }>(
    sql`select count(*)::text n from retur_penjualan where status_transfer = 'MENUNGGU'`,
  );
  const r = await baris<{ nomor: string; nilai: string }>(sql`
    select nomor, nominal_refund::text nilai from retur_penjualan
     where status_transfer = 'MENUNGGU' order by waktu_persetujuan, id limit ${MAKS}`);
  return {
    jumlah: Number(n?.n ?? 0),
    rincian: r.map((x) => `${x.nomor} · ${formatRupiah(Number(x.nilai))}`),
  };
}
