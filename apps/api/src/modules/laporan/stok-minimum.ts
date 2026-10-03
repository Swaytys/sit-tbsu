import {
  keQty,
  kurangQty,
  LABEL_STATUS_STOK,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type Kepemilikan,
  type NadaSel,
  type StatusStok,
  type skemaLaporanStokMinimum,
} from '@sit/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { barang, kategori, persediaan, satuan } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { ambilAngka } from '../sistem/konfigurasi/service';
import { sqlStatusStok } from '../persediaan/stok/repo';
import { namaKategori } from './stok-rekap';
import { angka, qty, susunDokumen, teks, teksPerSaatIni } from './umum';

/*
 * Laporan Stok Minimum (docs/05 §14, ST1): barang AKTIF berstatus selain AMAN, HABIS/KRITIS lebih dulu.
 * Posisi saat laporan disusun (stok fisik dari cache persediaan yang selalu sama dengan ledger, L9).
 */

export type DataStokMinimum = z.output<typeof skemaLaporanStokMinimum>;

export type BarisStokMinimum = {
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  stokFisik: string;
  stokDipesan: string;
  stokTersedia: string;
  stokMinimum: string;
  /** Stok fisik − stok minimum (negatif = di bawah minimum). */
  selisih: string;
  status: StatusStok;
};

export type HasilStokMinimum = {
  ambangPersen: number;
  jumlah: Record<StatusStok, number>;
  baris: BarisStokMinimum[];
};

const URUTAN: Record<StatusStok, number> = { HABIS: 0, KRITIS: 1, PERLU_RESTOCK: 2, AMAN: 3 };

export async function hitungStokMinimum(p: DataStokMinimum): Promise<HasilStokMinimum> {
  const ambangPersen = await ambilAngka('ambang_restock_persen', 20);
  const status = sqlStatusStok(ambangPersen);
  const semua = await db
    .select({
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      stokFisik: persediaan.stokFisik,
      stokDipesan: persediaan.stokDipesan,
      stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
      stokMinimum: barang.stokMinimum,
      status,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(
      and(
        eq(barang.statusAktif, 'AKTIF'),
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
      ),
    )
    .orderBy(asc(barang.namaBarang), asc(barang.id));

  const jumlah: Record<StatusStok, number> = { HABIS: 0, KRITIS: 0, PERLU_RESTOCK: 0, AMAN: 0 };
  for (const b of semua) jumlah[b.status] += 1;
  const baris = semua
    .filter((b) => b.status !== 'AMAN')
    .sort((a, b) => URUTAN[a.status] - URUTAN[b.status])
    .map((b) => ({
      ...b,
      stokFisik: keQty(b.stokFisik),
      stokDipesan: keQty(b.stokDipesan),
      stokTersedia: keQty(b.stokTersedia),
      stokMinimum: keQty(b.stokMinimum),
      selisih: kurangQty(b.stokFisik, b.stokMinimum),
    }));
  return { ambangPersen, jumlah, baris };
}

const NADA: Record<StatusStok, NadaSel> = {
  HABIS: 'bahaya',
  KRITIS: 'bahaya',
  PERLU_RESTOCK: 'peringatan',
  AMAN: 'baik',
};

export async function laporanStokMinimum(
  p: DataStokMinimum,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungStokMinimum(p);
  const isi: BarisTabelLaporan[] = h.baris.map((b, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      teks(b.kode, { mono: true }),
      teks(b.kepemilikan === 'KONSINYASI' ? `${b.namaBarang} (titipan)` : b.namaBarang),
      teks(b.namaKategori),
      teks(b.kodeSatuan),
      qty(b.stokFisik),
      qty(b.stokDipesan),
      qty(b.stokTersedia),
      qty(b.stokMinimum),
      qty(b.selisih),
      teks(LABEL_STATUS_STOK[b.status], { tebal: true, nada: NADA[b.status] }),
    ],
  }));
  const total = h.jumlah.HABIS + h.jumlah.KRITIS + h.jumlah.PERLU_RESTOCK + h.jumlah.AMAN;
  return susunDokumen('stok-minimum', pelaku, {
    subjudul: [
      teksPerSaatIni(),
      `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'}`,
      '(Kuantitas dalam satuan dasar barang)',
    ],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ringkasan Kondisi Stok',
        baris: [
          { label: 'Habis (stok 0)', nilai: angka(h.jumlah.HABIS), tingkat: 1 },
          { label: 'Kritis (di bawah stok minimum)', nilai: angka(h.jumlah.KRITIS), tingkat: 1 },
          {
            label: `Perlu restock (sampai ${h.ambangPersen}% di atas minimum)`,
            nilai: angka(h.jumlah.PERLU_RESTOCK),
            tingkat: 1,
          },
          { label: 'Aman', nilai: angka(h.jumlah.AMAN), tingkat: 1 },
          { label: 'Jumlah barang aktif', nilai: angka(total), gaya: 'total' },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'Daftar Barang yang Perlu Ditindaklanjuti',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 32 },
            { judul: 'Kategori', jenis: 'teks', lebar: 14 },
            { judul: 'Satuan', jenis: 'teks', lebar: 8 },
            { judul: 'Fisik', jenis: 'qty', lebar: 10, grup: 'Stok Saat Ini' },
            { judul: 'Dipesan', jenis: 'qty', lebar: 10, grup: 'Stok Saat Ini' },
            { judul: 'Tersedia', jenis: 'qty', lebar: 10, grup: 'Stok Saat Ini' },
            { judul: 'Stok Minimum', jenis: 'qty', lebar: 11 },
            { judul: 'Selisih', jenis: 'qty', lebar: 10 },
            { judul: 'Status', jenis: 'teks', lebar: 13 },
          ],
          baris: isi,
          kosong: 'Semua barang aktif dalam kondisi aman.',
        },
      },
    ],
    catatan: [
      'Habis: stok fisik 0. Kritis: stok fisik di bawah stok minimum. Perlu restock: stok fisik sampai ambang di atas stok minimum (Pengaturan › Operasional).',
      'Selisih = stok fisik − stok minimum; angka dalam kurung berarti kekurangan terhadap stok minimum.',
      'Dipesan = stok yang dicadangkan untuk order yang belum dibayar; tersedia = fisik − dipesan.',
      'Barang berstatus Habis dan Kritis perlu segera dipesan ulang; Perlu restock disarankan segera ditindaklanjuti.',
    ],
    berkas: tanggalOperasional(),
  });
}
