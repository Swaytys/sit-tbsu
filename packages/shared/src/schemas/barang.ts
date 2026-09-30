import { z } from 'zod';
import {
  KEPEMILIKAN,
  STATUS_AKTIF,
  type Kepemilikan,
  type MetodeHarga,
  type StatusAktif,
  type TipeNilai,
} from '../enums';
import { POLA_QTY } from '../qty';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Barang, harga jual per tier, dan tingkat harga (docs/03 §3.2, docs/06 §1, K-047). Barang tidak dihapus;
 * dinonaktifkan (K-021). Field sensitif (harga modal, HPP, harga titip) hanya dikirim API ke pemegang
 * `master.barang.lihat_hpp` (CLAUDE.md aturan 6); di tipe respons ditandai opsional.
 */

const kosongJadiUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const angkaKeTeks = (v: unknown) =>
  typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : v;

/** Kode barang: huruf besar, angka, titik, garis bawah, strip; maks. 12 (N5: boleh kode sendiri). */
export const skemaKodeBarang = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Kode barang wajib diisi.')
  .max(12, 'Kode barang maksimal 12 karakter.')
  .regex(/^[A-Z0-9._-]+$/, 'Kode hanya boleh huruf, angka, titik, garis bawah, atau strip.');

/** Qty dari form (boleh koma) → string desimal, mis. "2,5" → "2.5". */
export const skemaQtyTeks = (label: string) =>
  z.preprocess(
    angkaKeTeks,
    z
      .string(`${label} wajib diisi.`)
      .regex(POLA_QTY, `${label} harus angka ≥ 0, maksimal 3 desimal.`),
  );

/** Persen markup numeric(6,2): 0–999,99. */
export const skemaPersen = z.preprocess(
  angkaKeTeks,
  z
    .string('Persen wajib diisi.')
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Persen harus angka 0–999 dengan maksimal 2 desimal.'),
);

const idWajib = (pesan: string) => z.number(pesan).int(pesan).positive(pesan);

// --- Atribut dan harga di form barang ---

export const skemaAtributBarang = z.object({
  idJenisAtribut: idWajib('Jenis atribut wajib dipilih.'),
  /** Teks apa adanya untuk atribut TEKS; angka (boleh koma) untuk atribut ANGKA. */
  nilai: z
    .string('Nilai atribut wajib diisi.')
    .trim()
    .min(1, 'Nilai atribut wajib diisi.')
    .max(150, 'Nilai atribut maksimal 150 karakter.'),
  idSatuan: z.number().int().positive().nullable().optional(),
});
export type InputAtributBarang = z.input<typeof skemaAtributBarang>;

/** Harga satu tier: angka = TETAP; `null` = IKUT_TIER (dihitung dari markup default tier, K-047). */
export const skemaHargaTier = z.object({
  idTingkatHarga: idWajib('Tier wajib dipilih.'),
  hargaTetap: skemaRupiah.nullable(),
});
export type InputHargaTier = z.input<typeof skemaHargaTier>;

// --- Barang ---

export const skemaBarang = z
  .object({
    /** Kosong = otomatis `BRG-00001` (N5). */
    kode: z.preprocess(kosongJadiUndefined, skemaKodeBarang.optional()),
    barcode: teksOpsional(64, 'Barcode maksimal 64 karakter.').refine(
      (v) => v === null || v === undefined || /^[\x21-\x7E]+$/.test(v),
      'Barcode tidak boleh berisi spasi atau karakter khusus.',
    ),
    namaBarang: z
      .string('Nama barang wajib diisi.')
      .trim()
      .min(1, 'Nama barang wajib diisi.')
      .max(150, 'Nama barang maksimal 150 karakter.'),
    idKategori: idWajib('Kategori wajib dipilih.'),
    /** `null` = tanpa merk (K-063). */
    idMerk: z.number().int().positive().nullable().optional(),
    idSatuanDasar: idWajib('Satuan dasar wajib dipilih.'),
    /** Kosong = `konfigurasi.stok_minimum_default` untuk barang baru; nilai lama untuk ubah. */
    stokMinimum: z.preprocess(kosongJadiUndefined, skemaQtyTeks('Stok minimum').optional()),
    hargaModalAwal: z.preprocess((v) => (v === null || v === '' ? 0 : v), skemaRupiah).default(0),
    kepemilikan: z.enum(KEPEMILIKAN).default('MILIK_SENDIRI'),
    idPemasokKonsinyasi: z.number().int().positive().nullable().optional(),
    hargaTitip: skemaRupiah.nullable().optional(),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
    atribut: z.array(skemaAtributBarang).max(30, 'Maksimal 30 atribut.').default([]),
    /** Wajib saat tambah (tier default harus TETAP). Saat ubah: tidak dikirim = harga tidak diubah. */
    hargaTier: z.array(skemaHargaTier).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kepemilikan === 'KONSINYASI') {
      if (!d.idPemasokKonsinyasi) {
        ctx.addIssue({
          code: 'custom',
          path: ['idPemasokKonsinyasi'],
          message: 'Pemasok konsinyasi wajib dipilih.',
        });
      }
      if (d.hargaTitip === null || d.hargaTitip === undefined) {
        ctx.addIssue({ code: 'custom', path: ['hargaTitip'], message: 'Harga titip wajib diisi.' });
      }
    }
    const terlihat = new Set<number>();
    d.atribut.forEach((a, i) => {
      if (terlihat.has(a.idJenisAtribut)) {
        ctx.addIssue({
          code: 'custom',
          path: ['atribut', i, 'idJenisAtribut'],
          message: 'Atribut ini sudah ada di baris lain.',
        });
      }
      terlihat.add(a.idJenisAtribut);
    });
  });
export type InputBarang = z.input<typeof skemaBarang>;
export type DataBarang = z.output<typeof skemaBarang>;

export const skemaCariBarang = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
  idMerk: z.coerce.number().int().positive().optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
  perluTinjau: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariBarang = z.input<typeof skemaCariBarang>;

export type HargaTierBarang = {
  idTingkatHarga: number;
  metode: MetodeHarga;
  hargaTetap: number | null;
  hargaJual: number;
};

/** Baris daftar barang. Kolom bertanda `?` hanya untuk pemegang `master.barang.lihat_hpp`. */
export type BarisBarang = {
  id: number;
  kode: string;
  barcode: string | null;
  namaBarang: string;
  idKategori: number;
  namaKategori: string;
  idMerk: number | null;
  namaMerk: string | null;
  idSatuanDasar: number;
  kodeSatuan: string;
  stokMinimum: string;
  stokFisik: string;
  stokTersedia: string;
  kepemilikan: Kepemilikan;
  idPemasokKonsinyasi: number | null;
  namaPemasokKonsinyasi: string | null;
  perluTinjauHarga: boolean;
  /** URL gambar (dilayani API dengan izin), `null` bila belum ada. */
  gambar: string | null;
  statusAktif: StatusAktif;
  /** Harga per tier (satuan dasar). */
  harga: HargaTierBarang[];
  hargaModalAwal?: number;
  hargaTitip?: number | null;
  hppRata2?: number;
  hargaBeliTerakhir?: number;
  /** Dasar markup `D` saat ini (docs/06 H3). */
  dasarMarkup?: number;
};

export type AtributBarang = {
  idJenisAtribut: number;
  kodeJenis: string;
  namaJenis: string;
  tipeNilai: TipeNilai;
  /** Angka sebagai teks desimal (tanpa nol di belakang) atau teks. */
  nilai: string;
  idSatuan: number | null;
  kodeSatuan: string | null;
};

export type DetailBarang = BarisBarang & {
  keterangan: string | null;
  atribut: AtributBarang[];
  /** Sudah ada mutasi stok: satuan dasar dan harga modal awal dikunci (K-060). */
  sudahAdaMutasi: boolean;
};

// --- Harga jual massal (halaman Harga Jual, H13) ---

export const skemaSimpanHarga = z.object({
  perubahan: z
    .array(skemaHargaTier.extend({ idBarang: idWajib('Barang tidak valid.') }))
    .min(1, 'Tidak ada perubahan harga.')
    .max(1000, 'Maksimal 1000 perubahan sekali simpan.'),
});
export type InputSimpanHarga = z.input<typeof skemaSimpanHarga>;

// --- Tingkat harga (tier) ---

export const skemaTingkatHargaInput = z.object({
  kode: z
    .string('Kode tier wajib diisi.')
    .trim()
    .toUpperCase()
    .min(1, 'Kode tier wajib diisi.')
    .max(20, 'Kode tier maksimal 20 karakter.')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Kode tier huruf besar/angka/garis bawah, diawali huruf.'),
  nama: z
    .string('Nama tier wajib diisi.')
    .trim()
    .min(1, 'Nama tier wajib diisi.')
    .max(50, 'Nama tier maksimal 50 karakter.'),
  markupDefaultPersen: skemaPersen,
  saranMinQty: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    skemaQtyTeks('Saran qty minimum').nullable(),
  ),
  urutan: z.coerce
    .number('Urutan harus berupa angka.')
    .int('Urutan harus bilangan bulat.')
    .min(0, 'Urutan minimal 0.')
    .max(9999, 'Urutan maksimal 9999.')
    .default(0),
});
export type InputTingkatHarga = z.input<typeof skemaTingkatHargaInput>;
export type DataTingkatHarga = z.output<typeof skemaTingkatHargaInput>;

// --- Import Excel barang (K-056: hanya menambah barang baru) ---

export const STATUS_BARIS_IMPORT = ['SIAP', 'DILEWATI', 'GALAT', 'DISIMPAN'] as const;
export type StatusBarisImport = (typeof STATUS_BARIS_IMPORT)[number];

export type BarisImportBarang = {
  /** Nomor baris di lembar Excel (seperti yang terlihat di Excel). */
  nomorBaris: number;
  kode: string | null;
  namaBarang: string;
  status: StatusBarisImport;
  pesan: string[];
};

export type HasilImportBarang = {
  baris: BarisImportBarang[];
  ringkasan: { total: number; siap: number; dilewati: number; galat: number; disimpan: number };
  disimpan: boolean;
};

/** Jenis isian kolom import (menentukan kontrol di layar sunting baris). */
export const JENIS_KOLOM_IMPORT = [
  'TEKS',
  'RUPIAH',
  'QTY',
  'KATEGORI',
  'MERK',
  'SATUAN',
  'KEPEMILIKAN',
  'PEMASOK',
  'STATUS',
] as const;
export type JenisKolomImport = (typeof JENIS_KOLOM_IMPORT)[number];

export type KolomImportBarang = {
  /** Kunci kolom huruf kecil, mis. `nama_barang`, `harga_normal`, `atribut_panjang`. */
  kunci: string;
  label: string;
  jenis: JenisKolomImport;
  wajib: boolean;
  petunjuk: string;
};

/** Satu baris berkas: isi sel sebagai teks per kunci kolom (kosong tidak dikirim). */
export const skemaBarisImport = z.object({
  nomorBaris: z.number().int().positive(),
  nilai: z.record(z.string().max(60), z.string().max(255)),
});
export type BarisImportMentah = z.infer<typeof skemaBarisImport>;

/** Hasil membaca berkas: kolom yang dikenali, baris, dan peringatan (kolom tak dikenal diabaikan). */
export type BacaImportBarang = {
  namaBerkas: string;
  kolom: KolomImportBarang[];
  baris: BarisImportMentah[];
  peringatan: string[];
};

export const skemaProsesImport = z.object({
  namaBerkas: z.string().trim().max(100).default('berkas'),
  baris: z.array(skemaBarisImport).min(1, 'Tidak ada baris.').max(2000, 'Maksimal 2000 baris.'),
  /** Kode di baris lain berkas (untuk cek kode ganda saat hanya sebagian baris diperiksa ulang). */
  kodeLain: z.array(z.string().max(12)).max(2000).default([]),
});
export type InputProsesImport = z.input<typeof skemaProsesImport>;
