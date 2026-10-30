import { sql } from 'drizzle-orm';
import type { AksiLog } from '@sit/shared';
import { db } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { dalamTransaksi } from '../../lib/transaksi';
import { catatLog } from '../sistem/log-aktivitas';
import type { JenisMirip } from './mirip';

/*
 * K-199: hapus permanen data master yang tercatat ganda dan BELUM PERNAH dipakai. Pengecualian aturan "data master
 * tidak dihapus" (CLAUDE.md aturan 4), diputuskan pemilik untuk membersihkan data ganda persis. Yang dihapus hanya
 * baris master beserta pelengkap miliknya sendiri (atribut, satuan jual, harga, baris persediaan kosong). Bila ada
 * transaksi, promo, atau data lain yang merujuknya, kunci asing database menolak penghapusan sehingga tidak ada data
 * transaksi yang ikut hilang; pesan menyebut tempat data itu dipakai. Tercatat di log dengan salinan datanya.
 */

const DEF: Record<
  JenisMirip,
  { tabel: string; nama: string; pelengkap: string[]; aksi: AksiLog; label: string }
> = {
  barang: {
    tabel: 'barang',
    nama: 'nama_barang',
    pelengkap: ['barang_atribut', 'barang_satuan_jual', 'harga_barang', 'persediaan'],
    aksi: 'BARANG_HAPUS',
    label: 'Barang',
  },
  pelanggan: {
    tabel: 'pelanggan',
    nama: 'nama_pelanggan',
    pelengkap: [],
    aksi: 'PELANGGAN_HAPUS',
    label: 'Pelanggan',
  },
  pemasok: {
    tabel: 'pemasok',
    nama: 'nama_pemasok',
    pelengkap: [],
    aksi: 'PEMASOK_HAPUS',
    label: 'Pemasok',
  },
};

/** Nama tabel perujuk → kata yang dimengerti pengguna. */
const TEMPAT: Record<string, string> = {
  penjualan: 'penjualan',
  penjualan_detail: 'penjualan',
  order_penjualan: 'order',
  order_penjualan_detail: 'order',
  mutasi_persediaan: 'riwayat stok',
  penerimaan_barang: 'penerimaan barang',
  penerimaan_barang_detail: 'penerimaan barang',
  penyesuaian_stok_detail: 'penyesuaian stok',
  order_pembelian: 'order pembelian',
  order_pembelian_detail: 'order pembelian',
  retur_penjualan_detail: 'retur',
  void_transaksi_detail: 'void',
  retur_pemasok: 'retur ke pemasok',
  retur_pemasok_detail: 'retur ke pemasok',
  pembayaran_pemasok: 'pembayaran pemasok',
  penyelesaian_konsinyasi: 'penyelesaian titipan',
  penyelesaian_konsinyasi_detail: 'penyelesaian titipan',
  promo_sasaran: 'promo',
  promo_pelanggan: 'promo',
  permintaan_persetujuan: 'persetujuan',
  barang: 'barang titipan',
};

/** Galat kunci asing PostgreSQL (23503) → nama tabel yang masih merujuk. */
function tabelPerujuk(err: unknown): string | null {
  const e = err as { code?: string; detail?: string; cause?: { code?: string; detail?: string } };
  const kode = e.code ?? e.cause?.code;
  if (kode !== '23503') return null;
  const detail = e.detail ?? e.cause?.detail ?? '';
  return /from table "(\w+)"/.exec(detail)?.[1] ?? '';
}

export async function hapusMaster(
  jenis: JenisMirip,
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  const d = DEF[jenis];
  try {
    await dalamTransaksi(async (tx) => {
      const [baris] = (
        await tx.execute(sql`select * from ${sql.identifier(d.tabel)} where id = ${id} for update`)
      ).rows;
      if (!baris) throw new AppError('TIDAK_DITEMUKAN', `${d.label} tidak ditemukan.`, 404);
      for (const t of d.pelengkap) {
        await tx.execute(sql`delete from ${sql.identifier(t)} where id_barang = ${id}`);
      }
      await tx.execute(sql`delete from ${sql.identifier(d.tabel)} where id = ${id}`);
      await catatLog(tx, {
        aksi: d.aksi,
        idPengguna: pelaku.id,
        entitas: d.tabel,
        idEntitas: id,
        ringkasan: `Hapus permanen ${d.label.toLowerCase()} ganda ${String(baris.kode)} ${String(baris[d.nama])} (belum pernah dipakai)`,
        dataLama: baris,
        ip: asal.ip,
      });
    });
  } catch (err) {
    const t = tabelPerujuk(err);
    if (t === null) throw err;
    throw new AppError(
      'KONFLIK',
      `${d.label} ini sudah dipakai di ${TEMPAT[t] ?? 'data lain'}, jadi tidak bisa dihapus. ` +
        'Ubah nama atau No. HP salah satunya supaya tidak sama persis.',
      409,
    );
  }
}

/** Untuk tes: jumlah baris master (memastikan benar-benar terhapus). */
export async function adaMaster(jenis: JenisMirip, id: number): Promise<boolean> {
  const r = await db.execute(
    sql`select 1 from ${sql.identifier(DEF[jenis].tabel)} where id = ${id}`,
  );
  return r.rows.length > 0;
}
