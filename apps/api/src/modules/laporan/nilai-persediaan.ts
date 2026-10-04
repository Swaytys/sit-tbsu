import {
  keQty,
  subtotalRupiah,
  teksTanggalPanjang,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type Kepemilikan,
  type skemaLaporanNilaiPersediaan,
} from '@sit/shared';
import { and, desc, eq, lte } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { barang, kategori, mutasiPersediaan, persediaan, satuan } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { namaKategori } from './stok-rekap';
import { angka, KOSONG, qty, SATUAN_RUPIAH, susunDokumen, teks, uang } from './umum';

/*
 * Laporan Nilai Persediaan per tanggal (docs/05 §14, docs/06 KS4): kuantitas × HPP rata-rata tertimbang
 * (K-008), bucket BAIK. Hari ini = Σ stok_fisik × hpp_rata2 (cache); tanggal lampau = saldo & HPP sesudah
 * mutasi terakhir tiap barang ≤ tanggal itu. Barang titipan dipisah: bukan aset toko, hanya informasi.
 */

export type DataNilaiPersediaan = z.output<typeof skemaLaporanNilaiPersediaan>;

export type BarisNilaiPersediaan = {
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  qty: string;
  hpp: number;
  nilai: number;
};

export type HasilNilaiPersediaan = {
  milikSendiri: BarisNilaiPersediaan[];
  titipan: BarisNilaiPersediaan[];
  totalMilikSendiri: number;
  totalTitipan: number;
};

export async function hitungNilaiPersediaan(p: DataNilaiPersediaan): Promise<HasilNilaiPersediaan> {
  const hariIni = tanggalOperasional();
  if (p.tanggal > hariIni) {
    throw new AppError('VALIDASI', 'Tanggal laporan tidak boleh setelah hari ini.', 400, {
      kolom: { tanggal: ['Tanggal tidak boleh setelah hari ini.'] },
    });
  }
  const master = await db
    .select({
      idBarang: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      stokFisik: persediaan.stokFisik,
      hppRata2: persediaan.hppRata2,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori));

  let posisi: Map<number, { qty: string; hpp: number }>;
  if (p.tanggal === hariIni) {
    posisi = new Map(master.map((b) => [b.idBarang, { qty: b.stokFisik, hpp: b.hppRata2 }]));
  } else {
    const m = mutasiPersediaan;
    const r = await db
      .selectDistinctOn([m.idBarang], {
        idBarang: m.idBarang,
        qty: m.saldoSetelah,
        hpp: m.hppSetelah,
      })
      .from(m)
      .where(and(eq(m.kondisi, 'BAIK'), lte(m.tanggalOperasional, p.tanggal)))
      .orderBy(m.idBarang, desc(m.id));
    posisi = new Map(r.map((x) => [x.idBarang, { qty: x.qty, hpp: x.hpp }]));
  }

  const hasil: HasilNilaiPersediaan = {
    milikSendiri: [],
    titipan: [],
    totalMilikSendiri: 0,
    totalTitipan: 0,
  };
  const urut = [...master].sort(
    (a, b) =>
      a.namaKategori.localeCompare(b.namaKategori, 'id') ||
      a.namaBarang.localeCompare(b.namaBarang, 'id') ||
      a.idBarang - b.idBarang,
  );
  for (const b of urut) {
    const x = posisi.get(b.idBarang);
    if (!x || /^0(\.0+)?$/.test(x.qty)) continue;
    const baris: BarisNilaiPersediaan = {
      kode: b.kode,
      namaBarang: b.namaBarang,
      namaKategori: b.namaKategori,
      kodeSatuan: b.kodeSatuan,
      kepemilikan: b.kepemilikan,
      qty: keQty(x.qty),
      hpp: x.hpp,
      nilai: subtotalRupiah(x.qty, x.hpp),
    };
    if (b.kepemilikan === 'KONSINYASI') {
      hasil.titipan.push(baris);
      hasil.totalTitipan += baris.nilai;
    } else {
      hasil.milikSendiri.push(baris);
      hasil.totalMilikSendiri += baris.nilai;
    }
  }
  return hasil;
}

const KOLOM = [
  { judul: 'No', jenis: 'angka', lebar: 5 },
  { judul: 'Kode', jenis: 'teks', lebar: 12 },
  { judul: 'Nama Barang', jenis: 'teks', lebar: 34 },
  { judul: 'Satuan', jenis: 'teks', lebar: 8 },
  { judul: 'Kuantitas', jenis: 'qty', lebar: 11 },
  { judul: 'HPP Rata-rata', jenis: 'uang', lebar: 13 },
  { judul: 'Nilai Persediaan', jenis: 'uang', lebar: 16 },
] as const;

/** Baris per kategori dengan subtotal kategori dan total akhir. */
function barisBerkategori(daftar: BarisNilaiPersediaan[], labelTotal: string): BarisTabelLaporan[] {
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  let total = 0;
  for (let i = 0; i < daftar.length;) {
    const kat = daftar[i]!.namaKategori;
    isi.push({ gaya: 'grup', sel: [], label: kat });
    let sub = 0;
    for (; i < daftar.length && daftar[i]!.namaKategori === kat; i++) {
      const b = daftar[i]!;
      sub += b.nilai;
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(b.kode, { mono: true }),
          teks(b.namaBarang),
          teks(b.kodeSatuan),
          qty(b.qty),
          uang(b.hpp),
          uang(b.nilai),
        ],
      });
    }
    total += sub;
    isi.push({
      gaya: 'subtotal',
      label: `Jumlah ${kat}`,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(sub)],
    });
  }
  if (daftar.length > 0) {
    isi.push({
      gaya: 'total',
      label: labelTotal,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(total)],
    });
  }
  return isi;
}

/** Nilai per kategori, urut nama kategori. */
function perKategori(daftar: BarisNilaiPersediaan[]): [string, number][] {
  const m = new Map<string, number>();
  for (const b of daftar) m.set(b.namaKategori, (m.get(b.namaKategori) ?? 0) + b.nilai);
  return [...m.entries()];
}

export async function laporanNilaiPersediaan(
  p: DataNilaiPersediaan,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungNilaiPersediaan(p);
  const kategoriTeks = (await namaKategori(p.idKategori)) ?? 'semua';
  return susunDokumen('nilai-persediaan', pelaku, {
    subjudul: [`Per ${teksTanggalPanjang(p.tanggal)}`, `Kategori: ${kategoriTeks}`, SATUAN_RUPIAH],
    orientasi: 'potret',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ikhtisar per Kategori',
        baris: [
          { label: 'Persediaan milik sendiri', gaya: 'judul' },
          ...perKategori(h.milikSendiri).map(([kat, nilai]) => ({
            label: kat,
            nilai: uang(nilai),
            tingkat: 1 as const,
          })),
          {
            label: `Jumlah nilai persediaan milik sendiri (${h.milikSendiri.length} barang)`,
            nilai: uang(h.totalMilikSendiri),
            gaya: 'total',
          },
          {
            label: `Barang titipan/konsinyasi — informasi, bukan aset toko (${h.titipan.length} barang)`,
            nilai: uang(h.totalTitipan),
            tingkat: 1,
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'A. Persediaan Milik Sendiri',
        tabel: {
          kolom: [...KOLOM],
          baris: barisBerkategori(h.milikSendiri, 'Jumlah Persediaan Milik Sendiri'),
          kosong: 'Tidak ada persediaan bernilai pada tanggal ini.',
        },
      },
      ...(h.titipan.length > 0
        ? [
            {
              jenis: 'tabel' as const,
              judul: 'B. Barang Titipan (Konsinyasi) — Informasi',
              tabel: {
                kolom: KOLOM.map((k) =>
                  k.judul === 'HPP Rata-rata' ? { ...k, judul: 'Harga Titip' } : { ...k },
                ),
                baris: barisBerkategori(h.titipan, 'Jumlah Barang Titipan'),
              },
            },
          ]
        : []),
    ],
    catatan: [
      'Metode penilaian: rata-rata tertimbang bergerak (moving average). Nilai = kuantitas × HPP rata-rata, dibulatkan ke rupiah utuh per barang.',
      p.tanggal === tanggalOperasional()
        ? 'Kuantitas dan HPP adalah posisi saat laporan disusun.'
        : `Kuantitas dan HPP adalah posisi akhir hari ${teksTanggalPanjang(p.tanggal)} menurut buku persediaan.`,
      'Hanya stok kondisi baik; stok rusak tidak dinilai. Barang dengan kuantitas nol tidak dicantumkan.',
      'Barang titipan (konsinyasi) milik pemasok dan bukan aset toko; nilainya (harga titip) disajikan sebagai informasi.',
    ],
    berkas: p.tanggal,
  });
}
