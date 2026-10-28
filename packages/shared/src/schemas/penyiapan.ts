import { z } from 'zod';

/*
 * K-168: panduan penyiapan pertama. Langkah berstatus dihitung dari data (bukan dicentang manual), kecuali profil
 * toko yang isinya sudah terisi seed sehingga cukup ditandai "sudah diperiksa". Printer struk diatur per komputer
 * dan statusnya dibaca peramban. Contoh data: 5 per jenis (kendaraan/sopir 2), bisa dinonaktifkan sekali klik.
 */

export const LANGKAH_PENYIAPAN = [
  'PROFIL',
  'REKENING',
  'PENGGUNA',
  'BARANG',
  'STOK',
  'PELANGGAN',
  'PEMASOK',
  'ARMADA',
  'PRINTER',
] as const;
export type LangkahPenyiapan = (typeof LANGKAH_PENYIAPAN)[number];

export const JENIS_CONTOH = ['BARANG', 'PELANGGAN', 'PEMASOK', 'ARMADA'] as const;
export type JenisContoh = (typeof JENIS_CONTOH)[number];

export type StatusLangkahPenyiapan = {
  langkah: LangkahPenyiapan;
  selesai: boolean;
  /** Jumlah data asli (tanpa contoh) yang sudah ada, bila langkah itu menghitung data. */
  jumlah: number | null;
};

export type PanduanPenyiapan = {
  langkah: StatusLangkahPenyiapan[];
  /** Jumlah contoh yang masih tercatat (aktif) per jenis. */
  contoh: Record<JenisContoh, number>;
  /** Pemilik menyembunyikan pengingat panduan di dashboard. */
  disembunyikan: boolean;
};

export const skemaTandaiPenyiapan = z.object({
  langkah: z.enum(['PROFIL'], 'Langkah ini tidak bisa ditandai manual.'),
  selesai: z.boolean(),
});

export const skemaIsiContoh = z.object({
  jenis: z.enum(JENIS_CONTOH, 'Jenis contoh tidak dikenal.'),
});

export const skemaSembunyikanPanduan = z.object({ sembunyikan: z.boolean() });

export type HasilContoh = {
  dibuat: number;
  dinonaktifkan: number;
  /** Contoh yang gagal dibuat/dinonaktifkan beserta sebabnya (mis. kendaraan sedang jalan). */
  gagal: string[];
  panduan: PanduanPenyiapan;
};
