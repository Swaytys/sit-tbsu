import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  KONDISI_STOK,
  PENYELESAIAN_RETUR_PEMASOK,
  type Kepemilikan,
  type KondisiStok,
  type MetodePembayaranPemasok,
  type PenyelesaianReturPemasok,
  type StatusHutang,
} from '../enums';
import { skemaQtyPositif } from './persediaan';
import {
  PESAN_REFERENSI_KELUAR,
  referensiSah,
  skemaHalaman,
  skemaRupiah,
  teksOpsional,
} from './umum';

/*
 * Hutang pemasok, pembayaran pemasok, dan retur ke pemasok (Fase 10; docs/06 §5–6, K-088). Dokumen sumber
 * hutang: penerimaan PEMBELIAN tempo dan penyelesaian konsinyasi (Fase 11). Semua angka dihitung API.
 */

// --- Umur hutang/piutang (PT5, HT3) ---

/** Kelompok umur menurut hari lewat jatuh tempo (≤ 0 = belum jatuh tempo, termasuk jatuh tempo hari ini). */
export const KELOMPOK_UMUR = ['BELUM', 'H1_30', 'H31_60', 'H61_90', 'H90'] as const;
export type KelompokUmur = (typeof KELOMPOK_UMUR)[number];

export const LABEL_KELOMPOK_UMUR: Record<KelompokUmur, string> = {
  BELUM: 'Belum jatuh tempo',
  H1_30: '1–30 hari',
  H31_60: '31–60 hari',
  H61_90: '61–90 hari',
  H90: '> 90 hari',
};

export function kelompokUmur(hariLewat: number | null): KelompokUmur {
  if (hariLewat === null || hariLewat <= 0) return 'BELUM';
  if (hariLewat <= 30) return 'H1_30';
  if (hariLewat <= 60) return 'H31_60';
  if (hariLewat <= 90) return 'H61_90';
  return 'H90';
}

// --- Hutang pemasok (HT1–HT4) ---

/** K-241: HUTANG_AWAL = hutang ke pemasok dari sebelum memakai aplikasi (tanpa barang masuk). */
export const JENIS_DOKUMEN_HUTANG = ['PENERIMAAN', 'KONSINYASI', 'HUTANG_AWAL'] as const;
export type JenisDokumenHutang = (typeof JENIS_DOKUMEN_HUTANG)[number];

export const skemaCariHutang = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idPemasok: z.coerce.number().int().positive().optional(),
  terlambat: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariHutang = z.input<typeof skemaCariHutang>;

export type BarisHutang = {
  jenis: JenisDokumenHutang;
  id: number;
  nomor: string;
  tanggalOperasional: string;
  idPemasok: number;
  namaPemasok: string;
  noFaktur: string | null;
  /** Penyelesaian konsinyasi tidak punya jatuh tempo (`null`). */
  tanggalJatuhTempo: string | null;
  total: number;
  dibayar: number;
  /** Potongan dari retur pemasok POTONG_HUTANG (HT6). */
  returPotong: number;
  sisa: number;
  statusHutang: StatusHutang;
  /** Hari lewat jatuh tempo (negatif = belum jatuh tempo); `null` bila tanpa jatuh tempo. */
  hariLewat: number | null;
  /** K-237: berapa kali jatuh tempo diperpanjang (Owner). */
  jumlahPerpanjang: number;
  kelompokUmur: KelompokUmur;
};

export type RingkasanHutangPemasok = {
  idPemasok: number;
  namaPemasok: string;
  jumlahDokumen: number;
  totalSisa: number;
  jatuhTempoTerlama: string | null;
};

export type DaftarHutang = {
  data: BarisHutang[];
  meta: MetaHalaman;
  ringkasan: {
    totalSisa: number;
    jumlah: number;
    jumlahTerlambat: number;
    totalTerlambat: number;
    perPemasok: RingkasanHutangPemasok[];
    /** Sisa hutang per kelompok umur (seluruh hutang, tidak ikut saringan). */
    umur: Record<KelompokUmur, number>;
  };
};

export const METODE_BAYAR_HUTANG = ['TUNAI', 'TRANSFER'] as const;

export const skemaBayarHutang = z
  .object({
    jenis: z.enum(JENIS_DOKUMEN_HUTANG),
    id: z.number().int().positive(),
    nominal: skemaRupiah.refine((v) => v > 0, 'Nominal harus lebih dari 0.'),
    metode: z.enum(METODE_BAYAR_HUTANG, 'Metode bayar tidak valid.'),
    rekening: teksOpsional(60, 'Rekening maksimal 60 karakter.'),
    referensi: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
  })
  .superRefine((d, ctx) => {
    if (d.metode === 'TRANSFER' && !d.rekening) {
      ctx.addIssue({
        code: 'custom',
        path: ['rekening'],
        message: 'Rekening tujuan wajib diisi untuk transfer.',
      });
    }
    if (d.metode === 'TRANSFER' && !referensiSah(d.referensi)) {
      ctx.addIssue({ code: 'custom', path: ['referensi'], message: PESAN_REFERENSI_KELUAR });
    }
  });
export type InputBayarHutang = z.input<typeof skemaBayarHutang>;
export type DataBayarHutang = z.output<typeof skemaBayarHutang>;

export type PembayaranPemasok = {
  id: number;
  nomor: string;
  tanggal: string;
  metode: MetodePembayaranPemasok;
  nominal: number;
  rekening: string | null;
  referensi: string | null;
  catatan: string | null;
  namaPengguna: string;
};

export type HasilBayarHutang = {
  nomor: string;
  sisa: number;
  statusHutang: StatusHutang;
};

// --- Retur ke pemasok (RP1–RP7) ---

export const METODE_REFUND_PEMASOK = ['TUNAI', 'TRANSFER'] as const;

export const skemaBarisReturPemasok = z.object({
  idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
  kondisiAsal: z.enum(KONDISI_STOK).default('BAIK'),
  qty: skemaQtyPositif('Qty'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});

export const skemaReturPemasok = z
  .object({
    idPemasok: z.number('Pemasok wajib dipilih.').int().positive('Pemasok wajib dipilih.'),
    /** Penerimaan asal; wajib untuk POTONG_HUTANG (RP4). */
    idPenerimaan: z.number().int().positive().nullable().default(null),
    alasan: z
      .string('Alasan wajib diisi.')
      .trim()
      .min(3, 'Alasan wajib diisi (min. 3 huruf).')
      .max(255, 'Alasan maksimal 255 karakter.'),
    penyelesaian: z.enum(PENYELESAIAN_RETUR_PEMASOK, 'Penyelesaian tidak valid.'),
    /** REFUND: uang kembali tunai (laci shift) atau transfer (RP6). */
    metodeRefund: z.enum(METODE_REFUND_PEMASOK).nullable().default(null),
    referensi: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    baris: z
      .array(skemaBarisReturPemasok)
      .min(1, 'Tambahkan minimal satu barang.')
      .max(100, 'Maksimal 100 barang per retur.'),
  })
  .superRefine((d, ctx) => {
    if (d.penyelesaian === 'POTONG_HUTANG' && d.idPenerimaan === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['idPenerimaan'],
        message: 'Pilih penerimaan yang hutangnya dipotong.',
      });
    }
    if (d.penyelesaian === 'REFUND' && d.metodeRefund === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['metodeRefund'],
        message: 'Pilih cara pengembalian uang.',
      });
    }
    // K-196: uang masuk lewat transfer dari pemasok juga wajib bukti.
    if (
      d.penyelesaian === 'REFUND' &&
      d.metodeRefund === 'TRANSFER' &&
      !referensiSah(d.referensi)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['referensi'],
        message: 'No. referensi wajib, 4–40 huruf/angka: lihat mutasi rekening toko.',
      });
    }
    const terlihat = new Set<string>();
    d.baris.forEach((b, i) => {
      const k = `${b.idBarang}:${b.kondisiAsal}`;
      if (terlihat.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'idBarang'],
          message: 'Barang dengan kondisi yang sama sudah ada di baris lain.',
        });
      }
      terlihat.add(k);
    });
  });
export type InputReturPemasok = z.input<typeof skemaReturPemasok>;
export type DataReturPemasok = z.output<typeof skemaReturPemasok>;

export const skemaCariReturPemasok = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idPemasok: z.coerce.number().int().positive().optional(),
  penyelesaian: z.enum(PENYELESAIAN_RETUR_PEMASOK).optional(),
});
export type ParamCariReturPemasok = z.input<typeof skemaCariReturPemasok>;

export type BarisDaftarReturPemasok = {
  id: number;
  nomor: string;
  tanggal: string;
  tanggalOperasional: string;
  idPemasok: number;
  namaPemasok: string;
  idPenerimaan: number | null;
  nomorPenerimaan: string | null;
  penyelesaian: PenyelesaianReturPemasok;
  totalRetur: number;
  jumlahBaris: number;
  namaPengguna: string;
};

export type BarisDetailReturPemasok = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  kondisiAsal: KondisiStok;
  qty: string;
  hppSatuan: number;
  subtotal: number;
  keterangan: string | null;
};

export type DetailReturPemasok = BarisDaftarReturPemasok & {
  alasan: string;
  catatan: string | null;
  baris: BarisDetailReturPemasok[];
  /** GANTI_BARANG: penerimaan barang pengganti (RP5). */
  nomorPenerimaanPengganti: string | null;
  /** Peringatan non-penolakan (RP1: barang belum pernah dibeli dari pemasok ini). */
  peringatan: string[];
};

/** Penerimaan pemasok yang masih berhutang (pilihan sumber POTONG_HUTANG). */
export type PenerimaanBerhutang = {
  id: number;
  nomor: string;
  tanggalOperasional: string;
  noFaktur: string | null;
  sisa: number;
};

/** K-237: perpanjangan jatuh tempo hutang penerimaan (hanya Owner). */
export const skemaPerpanjangJatuhTempo = z.object({
  tanggalBaru: z
    .string('Tanggal jatuh tempo baru wajib diisi.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal jatuh tempo baru tidak valid.'),
  alasan: z
    .string('Alasan wajib diisi.')
    .trim()
    .min(5, 'Alasan minimal 5 karakter.')
    .max(255, 'Alasan maksimal 255 karakter.'),
});
export type DataPerpanjangJatuhTempo = z.output<typeof skemaPerpanjangJatuhTempo>;

/** K-241: catat hutang awal pemasok (faktur lama yang belum lunas saat mulai memakai aplikasi). */
export const skemaHutangAwal = z.object({
  idPemasok: z.number('Pemasok wajib dipilih.').int().positive('Pemasok wajib dipilih.'),
  noFakturLama: z
    .string()
    .trim()
    .max(50, 'No. faktur maksimal 50 karakter.')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  tanggalFaktur: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal faktur tidak valid.')
    .nullable()
    .optional(),
  sisa: z
    .number('Sisa hutang wajib diisi.')
    .int('Sisa hutang dalam rupiah utuh.')
    .positive('Sisa hutang harus lebih dari 0.'),
  tanggalJatuhTempo: z
    .string('Jatuh tempo wajib diisi.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Jatuh tempo wajib diisi.'),
  catatan: z
    .string()
    .trim()
    .max(255, 'Catatan maksimal 255 karakter.')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});
export type InputHutangAwal = z.input<typeof skemaHutangAwal>;
export type DataHutangAwal = z.output<typeof skemaHutangAwal>;
