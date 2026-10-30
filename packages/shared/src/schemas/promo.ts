import { z } from 'zod';
import {
  JENIS_POTONGAN,
  SASARAN_PEMBELI,
  SASARAN_PROMO,
  STATUS_AKTIF,
  STATUS_BERLAKU_PROMO,
  type JenisPotongan,
  type SasaranPembeli,
  type SasaranPromo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '../enums';
import { bandingQty } from '../qty';
import { skemaQtyPositif } from './persediaan';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Promo (docs/06 §3 PR1–PR8, K-087). Promo tidak dihapus; dinonaktifkan. Nilai potongan per baris selalu
 * dihitung API saat order/checkout (tidak pernah dikirim klien).
 */

const kosongJadiNull = (v: unknown) => (v === '' || v === undefined ? null : v);
const angkaKeTeks = (v: unknown) =>
  typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : v;

/** Persen potongan promo: lebih dari 0 sampai 100, maksimal 2 desimal (numeric(6,2)). */
export const skemaPersenPromo = z.preprocess(
  angkaKeTeks,
  z
    .string('Persen potongan wajib diisi.')
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Persen potongan harus angka dengan maksimal 2 desimal.')
    .refine(
      (v) => bandingQty(v, 0) > 0 && bandingQty(v, 100) <= 0,
      'Persen potongan harus lebih dari 0 dan paling besar 100.',
    ),
);

const rupiahPositif = (pesan: string) =>
  z.preprocess(kosongJadiNull, skemaRupiah.refine((v) => v > 0, pesan).nullable());

/** `HH:mm` 00:00–23:59. */
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const jamOpsional = z.preprocess(
  kosongJadiNull,
  z.string().regex(POLA_JAM, 'Jam harus HH:mm, mis. 13:00.').nullable(),
);

/**
 * Isian lama (sebelum K-163) tetap diterima: `tanggalMulai`/`tanggalSelesai` menjadi 00:00–23:59:59 WIB (zona
 * toko tanpa musim panas, +07:00), `idKategori`/`idBarang` menjadi `idSasaran` satu isi.
 */
function isianLama(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  const o = { ...(v as Record<string, unknown>) };
  if (o.mulaiPada === undefined && typeof o.tanggalMulai === 'string') {
    o.mulaiPada = `${o.tanggalMulai}T00:00:00+07:00`;
  }
  if (o.selesaiPada === undefined && typeof o.tanggalSelesai === 'string') {
    o.selesaiPada = `${o.tanggalSelesai}T23:59:59.999+07:00`;
  }
  if (o.idSasaran === undefined) {
    const lama =
      o.sasaran === 'KATEGORI' ? o.idKategori : o.sasaran === 'BARANG' ? o.idBarang : null;
    o.idSasaran = typeof lama === 'number' ? [lama] : [];
  }
  return o;
}

/**
 * K-185: satu kelompok sasaran = kategori DAN merk DAN barang (yang diisi saja, minimal satu). Mis. kategori Cat +
 * merk Avian = hanya cat merk Avian.
 */
export const skemaKelompokSasaran = z
  .object({
    idKategori: z.number().int().positive().nullable().default(null),
    idMerk: z.number().int().positive().nullable().default(null),
    idBarang: z.number().int().positive().nullable().default(null),
  })
  .refine(
    (k) => k.idKategori !== null || k.idMerk !== null || k.idBarang !== null,
    'Isi minimal satu dari kategori, merk, atau barang pada setiap kelompok.',
  );
export type KelompokSasaran = z.output<typeof skemaKelompokSasaran>;

/** Kunci teks satu kelompok (mis. "3-7-0"), untuk membuang kelompok ganda dan membandingkan perubahan. */
export const kunciKelompok = (k: KelompokSasaran) =>
  `${k.idKategori ?? 0}-${k.idMerk ?? 0}-${k.idBarang ?? 0}`;

/** Isian promo (form web dan API). */
export const skemaIsianPromo = z
  .object({
    nama: z
      .string('Nama promo wajib diisi.')
      .trim()
      .min(1, 'Nama promo wajib diisi.')
      .max(100, 'Nama promo maksimal 100 karakter.'),
    /** K-163: mulai dan selesai sampai menit (ISO dengan zona, mis. 2026-11-01T08:00:00+07:00). */
    mulaiPada: z.iso.datetime({ offset: true, error: 'Waktu mulai wajib diisi.' }),
    selesaiPada: z.iso.datetime({ offset: true, error: 'Waktu selesai wajib diisi.' }),
    /** Hari berlaku (1 = Senin … 7 = Minggu); kosong = setiap hari. */
    hariBerlaku: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .default([])
      .transform((h) => [...new Set(h)].sort((a, b) => a - b)),
    /** Jam harian (zona toko), mis. 13:00–15:00; kosong = sepanjang hari. */
    jamMulai: jamOpsional.default(null),
    jamSelesai: jamOpsional.default(null),
    jenisPotongan: z.enum(JENIS_POTONGAN, 'Jenis manfaat tidak valid.'),
    potonganPersen: z.preprocess(kosongJadiNull, skemaPersenPromo.nullable()).default(null),
    potonganNominal: rupiahPositif('Potongan harus lebih dari 0.').default(null),
    /** Batas potongan per baris (hanya PERSEN). */
    maksPotongan: rupiahPositif('Batas potongan harus lebih dari 0.').default(null),
    /** K-163 HARGA_KHUSUS: harga per satuan dasar. */
    hargaKhusus: rupiahPositif('Harga khusus harus lebih dari 0.').default(null),
    /** K-163 GRATIS: setiap beli `beliQty` gratis `gratisQty` (satuan dasar, barang yang sama). */
    beliQty: z.preprocess(kosongJadiNull, skemaQtyPositif('Qty beli').nullable()).default(null),
    gratisQty: z.preprocess(kosongJadiNull, skemaQtyPositif('Qty gratis').nullable()).default(null),
    /** K-194: GRATIS/BELI_POTONG paling banyak sekian kali per baris (1 = sekali); kosong = tanpa batas. */
    maksKelipatan: z
      .preprocess(
        kosongJadiNull,
        z.coerce
          .number('Batas berlaku harus angka.')
          .int('Batas berlaku harus bilangan bulat.')
          .min(1, 'Batas berlaku minimal 1 kali.')
          .max(1000, 'Batas berlaku maksimal 1000 kali.')
          .nullable(),
      )
      .default(null),
    sasaran: z.enum(SASARAN_PROMO, 'Sasaran promo tidak valid.'),
    /** K-163: id barang/kategori/merk sesuai `sasaran` (boleh beberapa). */
    idSasaran: z
      .array(z.number().int().positive())
      .max(200, 'Maksimal 200 pilihan per promo.')
      .default([])
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
    /** K-185: kelompok sasaran (hanya `sasaran` KELOMPOK); antar kelompok = ATAU. */
    kelompok: z
      .array(skemaKelompokSasaran)
      .max(50, 'Maksimal 50 kelompok per promo.')
      .default([])
      .transform((d) => {
        const lihat = new Set<string>();
        return d.filter((k) => !lihat.has(kunciKelompok(k)) && lihat.add(kunciKelompok(k)));
      }),
    /** PR2: syarat qty per baris (satuan dasar). */
    minQty: z.preprocess(kosongJadiNull, skemaQtyPositif('Minimal qty').nullable()).default(null),
    /** PR2: syarat total belanja (total bruto transaksi). */
    minBelanja: rupiahPositif('Minimal belanja harus lebih dari 0.').default(null),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
    /** K-097: pembeli yang berhak: semua, satu golongan pelanggan, atau pelanggan tertentu. */
    sasaranPembeli: z.enum(SASARAN_PEMBELI, 'Sasaran pembeli tidak valid.').default('SEMUA'),
    idGolongan: z.number().int().positive().nullable().default(null),
    idPelanggan: z
      .array(z.number().int().positive())
      .max(200, 'Maksimal 200 pelanggan per promo.')
      .default([]),
    /** K-097: belanja pelanggan (neto) dalam `hariBelanja` hari terakhir minimal sekian rupiah. */
    minBelanjaPelanggan: rupiahPositif('Belanja minimal harus lebih dari 0.').default(null),
    hariBelanja: z
      .preprocess(
        kosongJadiNull,
        z.coerce
          .number('Jumlah hari harus angka.')
          .int('Jumlah hari harus bilangan bulat.')
          .min(1, 'Jumlah hari minimal 1.')
          .max(3650, 'Jumlah hari maksimal 3650.')
          .nullable(),
      )
      .default(null),
    /**
     * K-110: anggaran promo (jumlah seluruh potongan yang boleh diberikan; kosong = tanpa batas) dan potongan
     * paling banyak untuk satu pembeli (kosong = tanpa batas).
     */
    anggaran: rupiahPositif('Anggaran promo harus lebih dari 0.').default(null),
    maksPerPembeli: rupiahPositif('Batas per pembeli harus lebih dari 0.').default(null),
    /** K-163: simpan sebagai templat kampanye (tidak pernah berlaku; dipakai untuk membuat promo baru). */
    templat: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    const masalah = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (new Date(d.selesaiPada) <= new Date(d.mulaiPada)) {
      masalah('selesaiPada', 'Waktu selesai harus setelah waktu mulai.');
    }
    if ((d.jamMulai === null) !== (d.jamSelesai === null)) {
      masalah(
        d.jamMulai === null ? 'jamMulai' : 'jamSelesai',
        'Isi jam mulai dan jam selesai, atau kosongkan keduanya.',
      );
    } else if (d.jamMulai !== null && d.jamSelesai !== null && d.jamSelesai <= d.jamMulai) {
      masalah('jamSelesai', 'Jam selesai harus setelah jam mulai (tidak melewati tengah malam).');
    }
    if (d.jenisPotongan === 'PERSEN' && d.potonganPersen === null) {
      masalah('potonganPersen', 'Persen potongan wajib diisi.');
    }
    if (d.jenisPotongan === 'NOMINAL' && d.potonganNominal === null) {
      masalah('potonganNominal', 'Potongan per satuan wajib diisi.');
    }
    if (d.jenisPotongan === 'HARGA_KHUSUS' && d.hargaKhusus === null) {
      masalah('hargaKhusus', 'Harga khusus wajib diisi.');
    }
    if (d.jenisPotongan === 'GRATIS') {
      if (d.beliQty === null) masalah('beliQty', 'Isi qty yang harus dibeli.');
      if (d.gratisQty === null) masalah('gratisQty', 'Isi qty gratisnya.');
    }
    if (
      d.maksKelipatan !== null &&
      d.jenisPotongan !== 'GRATIS' &&
      d.jenisPotongan !== 'BELI_POTONG'
    ) {
      masalah('maksKelipatan', 'Batas berlaku hanya untuk beli X gratis Y dan beli N potong Rp X.');
    }
    if (d.jenisPotongan === 'BELI_POTONG') {
      if (d.beliQty === null) masalah('beliQty', 'Isi qty yang harus dibeli.');
      if (d.potonganNominal === null) masalah('potonganNominal', 'Isi potongannya (rupiah).');
    }
    if (d.sasaran === 'KELOMPOK') {
      if (d.kelompok.length === 0) masalah('kelompok', 'Tambah minimal satu kelompok sasaran.');
    } else if (d.sasaran !== 'SEMUA' && d.idSasaran.length === 0) {
      masalah(
        'idSasaran',
        d.sasaran === 'BARANG'
          ? 'Pilih minimal satu barang.'
          : d.sasaran === 'KATEGORI'
            ? 'Pilih minimal satu kategori.'
            : 'Pilih minimal satu merk.',
      );
    }
    if (d.sasaranPembeli === 'GOLONGAN' && d.idGolongan === null) {
      masalah('idGolongan', 'Golongan pelanggan wajib dipilih.');
    }
    if (d.sasaranPembeli === 'PELANGGAN' && d.idPelanggan.length === 0) {
      masalah('idPelanggan', 'Pilih minimal satu pelanggan.');
    }
    if (d.anggaran !== null && d.maksPerPembeli !== null && d.maksPerPembeli >= d.anggaran) {
      masalah(
        'maksPerPembeli',
        'Batas per pembeli harus lebih kecil dari anggaran promo, supaya satu pembeli tidak menghabiskan seluruh anggaran.',
      );
    }
    if ((d.minBelanjaPelanggan === null) !== (d.hariBelanja === null)) {
      masalah(
        d.minBelanjaPelanggan === null ? 'minBelanjaPelanggan' : 'hariBelanja',
        'Isi belanja minimal dan jumlah harinya, atau kosongkan keduanya.',
      );
    }
  });

/** Skema API: isian lama (sebelum K-163) diterjemahkan dulu. */
export const skemaPromo = z.preprocess(isianLama, skemaIsianPromo);

export type InputPromo = z.input<typeof skemaIsianPromo>;
export type DataPromo = z.output<typeof skemaIsianPromo>;

export const skemaCariPromo = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
  berlaku: z.enum(STATUS_BERLAKU_PROMO).optional(),
  /** K-163: `1` = hanya templat kampanye; bawaan hanya promo biasa. */
  templat: z.enum(['0', '1']).default('0'),
});
export type ParamCariPromo = z.input<typeof skemaCariPromo>;

export type Promo = {
  id: number;
  kode: string;
  nama: string;
  /** Tanggal lokal dari `mulaiPada`/`selesaiPada` (saringan dan laporan). */
  tanggalMulai: string;
  tanggalSelesai: string;
  mulaiPada: string;
  selesaiPada: string;
  hariBerlaku: number[];
  jamMulai: string | null;
  jamSelesai: string | null;
  jenisPotongan: JenisPotongan;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
  hargaKhusus: number | null;
  beliQty: string | null;
  gratisQty: string | null;
  /** K-194: batas kelipatan per baris; `null` = tanpa batas. */
  maksKelipatan: number | null;
  templat: boolean;
  sasaran: SasaranPromo;
  /** K-163: barang/kategori/merk sasaran (`kode` hanya untuk barang). Kosong untuk sasaran KELOMPOK. */
  sasaranDaftar: { id: number; kode: string | null; nama: string }[];
  /** K-185: kelompok sasaran beserta namanya (sasaran KELOMPOK). */
  kelompok: (KelompokSasaran & {
    namaKategori: string | null;
    namaMerk: string | null;
    kodeBarang: string | null;
    namaBarang: string | null;
  })[];
  minQty: string | null;
  minBelanja: number | null;
  keterangan: string | null;
  sasaranPembeli: SasaranPembeli;
  idGolongan: number | null;
  namaGolongan: string | null;
  /** Pelanggan yang berhak (sasaran PELANGGAN). */
  pelanggan: { id: number; nama: string }[];
  minBelanjaPelanggan: number | null;
  hariBelanja: number | null;
  statusAktif: StatusAktif;
  /** PR1, dihitung API dari tanggal operasional hari ini. */
  statusBerlaku: StatusBerlakuPromo;
  /** Baris penjualan (bukan void) yang memakai promo ini; promo terpakai tidak bisa diubah aturannya. */
  jumlahPemakaian: number;
  /** K-110: anggaran dan batas per pembeli (`null` = tanpa batas). */
  anggaran: number | null;
  maksPerPembeli: number | null;
  /** Jumlah potongan promo ini yang sudah diberikan (baris penjualan bukan void). */
  totalDiskon: number;
  /** `anggaran − totalDiskon`, tidak kurang dari 0; `null` bila tanpa anggaran. */
  sisaAnggaran: number | null;
};
