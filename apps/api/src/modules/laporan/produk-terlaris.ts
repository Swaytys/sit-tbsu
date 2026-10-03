import {
  keQty,
  teksPeriode,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanProdukTerlaris,
} from '@sit/shared';
import { and, asc, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { barang, kategori, penjualan, penjualanDetail, satuan } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { namaKategori } from './stok-rekap';
import {
  angka,
  KOSONG,
  persen,
  persenDari,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  teks,
  uang,
} from './umum';

/*
 * Laporan Produk Terlaris (docs/05 §14): per barang Σ qty_dasar dan Σ subtotal baris status_item ≠ VOID
 * (tanpa dikurangi retur), peringkat menurut nilai; kontribusi % terhadap total seluruh barang periode.
 */

export type DataProdukTerlaris = z.output<typeof skemaLaporanProdukTerlaris>;

export type BarisProdukTerlaris = {
  peringkat: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  qty: string;
  nilai: number;
  kontribusi: number | null;
  kumulatif: number | null;
};

export type HasilProdukTerlaris = {
  /** Seluruh barang terjual, berperingkat (batas diterapkan saat menyusun dokumen). */
  baris: BarisProdukTerlaris[];
  totalNilai: number;
};

export async function hitungProdukTerlaris(p: DataProdukTerlaris): Promise<HasilProdukTerlaris> {
  const nilai = sql<string>`sum(${penjualanDetail.subtotal})::text`;
  const r = await db
    .select({
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      qty: sql<string>`sum(${penjualanDetail.qtyDasar})::text`,
      nilai,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(
      and(
        ne(penjualanDetail.statusItem, 'VOID'),
        gte(penjualan.tanggalOperasional, p.dari),
        lte(penjualan.tanggalOperasional, p.sampai),
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
      ),
    )
    .groupBy(barang.id, kategori.nama, satuan.kode)
    .orderBy(
      desc(sql`sum(${penjualanDetail.subtotal})`),
      desc(sql`sum(${penjualanDetail.qtyDasar})`),
      asc(barang.namaBarang),
    );

  const totalNilai = r.reduce((t, x) => t + Number(x.nilai), 0);
  let kum = 0;
  const baris = r.map((x, i) => {
    const n = Number(x.nilai);
    kum += n;
    return {
      peringkat: i + 1,
      kode: x.kode,
      namaBarang: x.namaBarang,
      namaKategori: x.namaKategori,
      kodeSatuan: x.kodeSatuan,
      qty: keQty(x.qty),
      nilai: n,
      kontribusi: persenDari(n, totalNilai),
      kumulatif: persenDari(kum, totalNilai),
    };
  });
  return { baris, totalNilai };
}

export async function laporanProdukTerlaris(
  p: DataProdukTerlaris,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungProdukTerlaris(p);
  const tampil = p.batas > 0 ? h.baris.slice(0, p.batas) : h.baris;
  const sisa = h.baris.slice(tampil.length);
  const isi: BarisTabelLaporan[] = tampil.map((b) => ({
    gaya: 'data',
    sel: [
      angka(b.peringkat),
      teks(b.kode, { mono: true }),
      teks(b.namaBarang, { tebal: b.peringkat <= 3 }),
      teks(b.namaKategori),
      teks(b.kodeSatuan),
      qty(b.qty),
      uang(b.nilai),
      persen(b.kontribusi),
      persen(b.kumulatif),
    ],
  }));
  if (sisa.length > 0) {
    const nilaiSisa = sisa.reduce((t, b) => t + b.nilai, 0);
    isi.push({
      gaya: 'subtotal',
      label: `Barang lainnya (${sisa.length} barang)`,
      sel: [
        KOSONG,
        KOSONG,
        KOSONG,
        KOSONG,
        KOSONG,
        KOSONG,
        uang(nilaiSisa),
        persen(persenDari(nilaiSisa, h.totalNilai)),
        KOSONG,
      ],
    });
  }
  isi.push({
    gaya: 'total',
    label: `Jumlah (${h.baris.length} barang)`,
    sel: [
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      uang(h.totalNilai),
      persen(h.totalNilai > 0 ? 100 : null),
      KOSONG,
    ],
  });

  return susunDokumen('produk-terlaris', pelaku, {
    subjudul: [
      teksPeriode(p.dari, p.sampai),
      `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'} · ${p.batas > 0 ? `${p.batas} barang teratas` : 'semua barang'}`,
      SATUAN_RUPIAH,
    ],
    orientasi: 'potret',
    bagian: [
      {
        jenis: 'tabel',
        tabel: {
          kolom: [
            { judul: 'Peringkat', jenis: 'angka', lebar: 9 },
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 30 },
            { judul: 'Kategori', jenis: 'teks', lebar: 14 },
            { judul: 'Satuan', jenis: 'teks', lebar: 8 },
            { judul: 'Qty Terjual', jenis: 'qty', lebar: 11 },
            { judul: 'Nilai Penjualan', jenis: 'uang', lebar: 15 },
            { judul: 'Kontribusi', jenis: 'persen', lebar: 10 },
            { judul: 'Kumulatif', jenis: 'persen', lebar: 10 },
          ],
          baris: isi,
          kosong: 'Tidak ada penjualan dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Peringkat menurut nilai penjualan barang (harga × kuantitas setelah diskon per barang), tidak dikurangi retur dan belum termasuk diskon transaksi maupun ongkos kirim; barang yang di-void tidak dihitung.',
      'Kontribusi = nilai penjualan barang ÷ jumlah nilai penjualan seluruh barang (sesuai kriteria). Kumulatif membantu membaca prinsip Pareto: sedikit barang teratas biasanya menyumbang sebagian besar penjualan.',
      'Qty dalam satuan dasar barang.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
