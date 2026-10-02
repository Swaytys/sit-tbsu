import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  KONDISI_RETUR,
  LINGKUP_VOID,
  METODE_REFUND,
  PENYELESAIAN_RETUR,
  STATUS_PERSETUJUAN,
  type JenisPenjualan,
  type KondisiRetur,
  type LingkupVoid,
  type MetodeRefund,
  type PenyelesaianRetur,
  type StatusItem,
  type StatusPersetujuan,
  type StatusTransaksi,
} from '../enums';
import { skemaQtyPositif } from './persediaan';
import { skemaHalaman, teksOpsional } from './umum';

/*
 * Koreksi penjualan (Fase 6): void (docs/05 §9, V1–V7) dan retur (§8, T1–T10), dengan persetujuan docs/04 §6.
 */

const skemaAlasan = (label: string) =>
  z
    .string(`${label} wajib diisi.`)
    .trim()
    .min(3, `${label} wajib diisi (min. 3 huruf).`)
    .max(255, `${label} maksimal 255 karakter.`);

/** Persetujuan: refund tunai keluar dari laci shift penyetuju; transfer cukup referensi. */
export const skemaSetujui = z.object({
  metodeRefund: z.enum(METODE_REFUND).nullable().default(null),
  rekeningRefund: teksOpsional(60, 'Rekening maksimal 60 karakter.'),
  referensiRefund: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
});
export type DataSetujui = z.output<typeof skemaSetujui>;

export const skemaTolak = z.object({ alasan: skemaAlasan('Alasan penolakan') });

export const skemaCariKoreksi = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum(STATUS_PERSETUJUAN).optional(),
});
export type ParamCariKoreksi = z.input<typeof skemaCariKoreksi>;

// --- Void ---

export const skemaVoid = z
  .object({
    idPenjualan: z.number('Pilih transaksi.').int().positive('Pilih transaksi.'),
    lingkup: z.enum(LINGKUP_VOID),
    /** ITEM: baris yang di-void (TRANSAKSI: semua baris NORMAL, diisi server). */
    idDetail: z.array(z.number().int().positive()).default([]),
    alasan: skemaAlasan('Alasan void'),
    /** Dipakai bila pengaju langsung menyetujui (Admin/Owner, K-017). */
    persetujuan: skemaSetujui.default({ metodeRefund: null }),
  })
  .refine((d) => d.lingkup === 'TRANSAKSI' || d.idDetail.length > 0, {
    message: 'Pilih minimal satu barang yang di-void.',
    path: ['idDetail'],
  });
export type InputVoid = z.input<typeof skemaVoid>;
export type DataVoid = z.output<typeof skemaVoid>;

/** Penjualan yang masih boleh di-void (V1) beserta baris NORMAL-nya. */
export type KandidatVoid = {
  id: number;
  nomor: string;
  tanggal: string;
  jenisPenjualan: JenisPenjualan;
  namaPembeli: string | null;
  namaKasir: string;
  totalNeto: number;
  sisaTagihan: number;
  totalDibayar: number;
  baris: {
    id: number;
    namaBarang: string;
    qty: string;
    kodeSatuan: string;
    subtotal: number;
    statusItem: StatusItem;
  }[];
};

export type BarisVoid = {
  id: number;
  nomor: string;
  tanggal: string;
  idPenjualan: number;
  nomorPenjualan: string;
  lingkup: LingkupVoid;
  status: StatusPersetujuan;
  alasan: string;
  alasanPenolakan: string | null;
  nominalVoid: number;
  nominalRefund: number;
  metodeRefund: MetodeRefund | null;
  namaPengaju: string;
  namaPenyetuju: string | null;
  waktuPersetujuan: string | null;
  baris: { namaBarang: string; qtyDasar: string; kodeSatuan: string; nominal: number }[];
};

export type DaftarVoid = { data: BarisVoid[]; meta: MetaHalaman };

// --- Retur ---

export const skemaBarisRetur = z.object({
  idPenjualanDetail: z.number().int().positive(),
  qtyRetur: skemaQtyPositif('Qty retur'),
  kondisi: z.enum(KONDISI_RETUR).default('BAIK'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});

export const skemaRetur = z.object({
  idPenjualan: z.number('Pilih transaksi.').int().positive('Pilih transaksi.'),
  alasan: skemaAlasan('Alasan retur'),
  penyelesaian: z.enum(PENYELESAIAN_RETUR),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
  baris: z.array(skemaBarisRetur).min(1, 'Isi qty retur minimal satu barang.'),
  persetujuan: skemaSetujui.default({ metodeRefund: null }),
});
export type InputRetur = z.input<typeof skemaRetur>;
export type DataRetur = z.output<typeof skemaRetur>;

/** Penjualan yang bisa diretur (T1) dengan sisa qty per baris. */
export type KandidatRetur = {
  id: number;
  nomor: string;
  tanggal: string;
  jenisPenjualan: JenisPenjualan;
  statusTransaksi: StatusTransaksi;
  namaPembeli: string | null;
  totalNeto: number;
  sisaTagihan: number;
  dibayarBersih: number;
  baris: {
    id: number;
    namaBarang: string;
    kodeSatuan: string;
    qty: string;
    /** qty − retur − void yang masih bisa diretur. */
    qtyBisaRetur: string;
    hargaSatuanEfektif: number;
    statusItem: StatusItem;
  }[];
};

export type BarisRetur = {
  id: number;
  nomor: string;
  tanggal: string;
  idPenjualan: number;
  nomorPenjualan: string;
  status: StatusPersetujuan;
  alasan: string;
  alasanPenolakan: string | null;
  penyelesaian: PenyelesaianRetur;
  totalRetur: number;
  metodeRefund: MetodeRefund | null;
  namaPengaju: string;
  namaPenyetuju: string | null;
  waktuPersetujuan: string | null;
  catatan: string | null;
  baris: {
    namaBarang: string;
    kodeSatuan: string;
    qtyRetur: string;
    kondisi: KondisiRetur;
    nominalRetur: number;
  }[];
};

export type DaftarRetur = { data: BarisRetur[]; meta: MetaHalaman };
