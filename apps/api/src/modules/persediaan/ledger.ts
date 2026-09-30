import { eq } from 'drizzle-orm';
import type { Kepemilikan } from '@sit/shared';
import type { Tx } from '../../db/client';
import { persediaan } from '../../db/schema';
import { sekarang } from '../../lib/waktu';

/*
 * SATU-SATUNYA berkas yang menulis tabel `persediaan` (CLAUDE.md aturan 2, docs/05 §2).
 * Fase 3 hanya membuat baris awal (L10) dan menyelaraskan HPP dari data master (L7, K-060).
 * `catatMutasi()` (pergerakan stok lewat ledger) ditambahkan di Fase 4.
 */

type NilaiHppMaster = {
  kepemilikan: Kepemilikan;
  hargaModalAwal: number;
  hargaTitip: number | null;
};

/** L10: nilai awal HPP dari data master barang. */
function hppAwal(b: NilaiHppMaster): { hppRata2: number; hargaBeliTerakhir: number } {
  return b.kepemilikan === 'KONSINYASI'
    ? { hppRata2: b.hargaTitip ?? 0, hargaBeliTerakhir: 0 }
    : { hppRata2: b.hargaModalAwal, hargaBeliTerakhir: b.hargaModalAwal };
}

/** L10: baris `persediaan` dibuat bersamaan dengan barang, stok 0. */
export async function buatPersediaan(tx: Tx, idBarang: number, b: NilaiHppMaster): Promise<void> {
  await tx.insert(persediaan).values({ idBarang, ...hppAwal(b) });
}

/** Baris persediaan barang, dikunci sampai transaksi selesai (L1). */
export async function kunciPersediaan(tx: Tx, idBarang: number) {
  const [baris] = await tx
    .select({
      stokFisik: persediaan.stokFisik,
      stokRusak: persediaan.stokRusak,
      hppRata2: persediaan.hppRata2,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
      terakhirMutasi: persediaan.terakhirMutasi,
    })
    .from(persediaan)
    .where(eq(persediaan.idBarang, idBarang))
    .limit(1)
    .for('update');
  if (!baris) throw new Error(`Baris persediaan barang ${idBarang} tidak ada (L10 dilanggar)`);
  return baris;
}

/**
 * Menyelaraskan HPP persediaan setelah data master barang berubah:
 * - KONSINYASI: `hpp_rata2` selalu = `harga_titip` (L7).
 * - MILIK_SENDIRI tanpa mutasi sama sekali: nilai awal L10 mengikuti `harga_modal_awal` (K-060).
 * Setelah ada mutasi, HPP milik sendiri hanya berubah lewat ledger.
 * Mengembalikan nilai lama/baru bila berubah (untuk log), atau `null`.
 */
export async function selaraskanHppMaster(tx: Tx, idBarang: number, b: NilaiHppMaster) {
  const lama = await kunciPersediaan(tx, idBarang);
  const awal = hppAwal(b);
  let baru: { hppRata2: number; hargaBeliTerakhir: number };
  if (lama.terakhirMutasi === null) baru = awal;
  else if (b.kepemilikan === 'KONSINYASI')
    baru = { hppRata2: awal.hppRata2, hargaBeliTerakhir: lama.hargaBeliTerakhir };
  else return null;

  if (baru.hppRata2 === lama.hppRata2 && baru.hargaBeliTerakhir === lama.hargaBeliTerakhir) {
    return null;
  }
  await tx
    .update(persediaan)
    .set({ ...baru, diubahPada: sekarang() })
    .where(eq(persediaan.idBarang, idBarang));
  return {
    lama: { hppRata2: lama.hppRata2, hargaBeliTerakhir: lama.hargaBeliTerakhir },
    baru,
  };
}
