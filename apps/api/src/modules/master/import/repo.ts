import { asc, inArray } from 'drizzle-orm';
import type { Executor } from '../../../db/client';
import {
  barang,
  jenisAtribut,
  kategori,
  merk,
  pemasok,
  satuan,
  tingkatHarga,
} from '../../../db/schema';

/** Data referensi untuk templat dan untuk mencocokkan isi sel (nama/kode) ke id. */
export async function referensiImport(ex: Executor) {
  // Berurutan: di dalam transaksi satu koneksi tidak boleh menjalankan kueri bersamaan.
  const daftarMerk = await ex
    .select({ id: merk.id, nama: merk.nama, statusAktif: merk.statusAktif })
    .from(merk)
    .orderBy(asc(merk.nama));
  const daftarKategori = await ex
    .select({ id: kategori.id, nama: kategori.nama, statusAktif: kategori.statusAktif })
    .from(kategori)
    .orderBy(asc(kategori.urutan), asc(kategori.nama));
  const daftarSatuan = await ex
    .select({
      id: satuan.id,
      kode: satuan.kode,
      nama: satuan.nama,
      statusAktif: satuan.statusAktif,
    })
    .from(satuan)
    .orderBy(asc(satuan.kode));
  const daftarPemasok = await ex
    .select({
      id: pemasok.id,
      kode: pemasok.kode,
      nama: pemasok.namaPemasok,
      statusAktif: pemasok.statusAktif,
    })
    .from(pemasok)
    .orderBy(asc(pemasok.kode));
  const daftarTier = await ex
    .select({
      id: tingkatHarga.id,
      kode: tingkatHarga.kode,
      nama: tingkatHarga.nama,
      isDefault: tingkatHarga.isDefault,
      statusAktif: tingkatHarga.statusAktif,
    })
    .from(tingkatHarga)
    .orderBy(asc(tingkatHarga.urutan));
  const daftarJenis = await ex
    .select({
      id: jenisAtribut.id,
      kode: jenisAtribut.kode,
      nama: jenisAtribut.nama,
      tipeNilai: jenisAtribut.tipeNilai,
      jenisDimensi: jenisAtribut.jenisDimensi,
      statusAktif: jenisAtribut.statusAktif,
    })
    .from(jenisAtribut)
    .orderBy(asc(jenisAtribut.urutan), asc(jenisAtribut.nama));
  return {
    kategori: daftarKategori,
    merk: daftarMerk,
    satuan: daftarSatuan,
    pemasok: daftarPemasok,
    tier: daftarTier,
    jenisAtribut: daftarJenis,
  };
}

export type ReferensiImport = Awaited<ReturnType<typeof referensiImport>>;

/** Kode barang yang sudah ada di database (dari daftar kode di berkas). */
export async function kodeAda(ex: Executor, kode: string[]): Promise<Set<string>> {
  if (kode.length === 0) return new Set();
  const baris = await ex
    .select({ kode: barang.kode })
    .from(barang)
    .where(inArray(barang.kode, kode));
  return new Set(baris.map((b) => b.kode));
}
