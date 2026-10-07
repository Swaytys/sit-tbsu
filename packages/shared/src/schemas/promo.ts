import { z } from 'zod';
import {
  JENIS_POTONGAN,
  SASARAN_PROMO,
  STATUS_AKTIF,
  STATUS_BERLAKU_PROMO,
  type JenisPotongan,
  type SasaranPromo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '../enums';
import { bandingQty } from '../qty';
import { skemaQtyPositif, skemaTanggal } from './persediaan';
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

export const skemaPromo = z
  .object({
    nama: z
      .string('Nama promo wajib diisi.')
      .trim()
      .min(1, 'Nama promo wajib diisi.')
      .max(100, 'Nama promo maksimal 100 karakter.'),
    tanggalMulai: skemaTanggal('Tanggal mulai'),
    tanggalSelesai: skemaTanggal('Tanggal selesai'),
    jenisPotongan: z.enum(JENIS_POTONGAN, 'Jenis potongan tidak valid.'),
    potonganPersen: z.preprocess(kosongJadiNull, skemaPersenPromo.nullable()).default(null),
    potonganNominal: rupiahPositif('Potongan harus lebih dari 0.').default(null),
    /** Batas potongan per baris (hanya PERSEN). */
    maksPotongan: rupiahPositif('Batas potongan harus lebih dari 0.').default(null),
    sasaran: z.enum(SASARAN_PROMO, 'Sasaran promo tidak valid.'),
    idKategori: z.number().int().positive().nullable().default(null),
    idBarang: z.number().int().positive().nullable().default(null),
    /** PR2: syarat qty per baris (satuan dasar). */
    minQty: z.preprocess(kosongJadiNull, skemaQtyPositif('Minimal qty').nullable()).default(null),
    /** PR2: syarat total belanja (total bruto transaksi). */
    minBelanja: rupiahPositif('Minimal belanja harus lebih dari 0.').default(null),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
  })
  .superRefine((d, ctx) => {
    const masalah = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (d.tanggalSelesai < d.tanggalMulai) {
      masalah('tanggalSelesai', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
    }
    if (d.jenisPotongan === 'PERSEN' && d.potonganPersen === null) {
      masalah('potonganPersen', 'Persen potongan wajib diisi.');
    }
    if (d.jenisPotongan === 'NOMINAL' && d.potonganNominal === null) {
      masalah('potonganNominal', 'Potongan per satuan wajib diisi.');
    }
    if (d.sasaran === 'KATEGORI' && d.idKategori === null) {
      masalah('idKategori', 'Kategori wajib dipilih.');
    }
    if (d.sasaran === 'BARANG' && d.idBarang === null) {
      masalah('idBarang', 'Barang wajib dipilih.');
    }
  });
export type InputPromo = z.input<typeof skemaPromo>;
export type DataPromo = z.output<typeof skemaPromo>;

export const skemaCariPromo = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
  berlaku: z.enum(STATUS_BERLAKU_PROMO).optional(),
});
export type ParamCariPromo = z.input<typeof skemaCariPromo>;

export type Promo = {
  id: number;
  kode: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jenisPotongan: JenisPotongan;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
  sasaran: SasaranPromo;
  idKategori: number | null;
  namaKategori: string | null;
  idBarang: number | null;
  kodeBarang: string | null;
  namaBarang: string | null;
  minQty: string | null;
  minBelanja: number | null;
  keterangan: string | null;
  statusAktif: StatusAktif;
  /** PR1, dihitung API dari tanggal operasional hari ini. */
  statusBerlaku: StatusBerlakuPromo;
  /** Baris penjualan (bukan void) yang memakai promo ini; promo terpakai tidak bisa diubah aturannya. */
  jumlahPemakaian: number;
};
