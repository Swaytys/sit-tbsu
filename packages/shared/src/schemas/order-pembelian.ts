import { z } from 'zod';
import { STATUS_ORDER_PEMBELIAN, type StatusOrderPembelian } from '../enums';
import { METODE_BAYAR_HUTANG } from './hutang';
import { skemaQtyPositif, skemaTanggal } from './persediaan';
import {
  PESAN_REFERENSI_KELUAR,
  referensiSah,
  skemaHalaman,
  skemaRupiah,
  teksOpsional,
} from './umum';

/*
 * K-125 order pembelian ke pemasok (docs/05 §21, keputusan 2026-10-24-rancangan-order-pembelian.md).
 * Harga = harga beli per satuan dasar (data harga modal: hanya untuk pemegang `master.barang.lihat_hpp`).
 */

const idWajib = (pesan: string) => z.number(pesan).int().positive(pesan);

export const skemaBarisOrderPembelian = z.object({
  idBarang: idWajib('Barang wajib dipilih.'),
  qty: skemaQtyPositif('Qty'),
  harga: z.preprocess((v) => (v === null || v === '' ? 0 : v), skemaRupiah),
});

export const skemaOrderPembelian = z
  .object({
    idPemasok: idWajib('Pemasok wajib dipilih.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    baris: z
      .array(skemaBarisOrderPembelian)
      .min(1, 'Tambahkan minimal satu barang.')
      .max(200, 'Maksimal 200 barang per order pembelian.'),
  })
  .superRefine((d, ctx) => {
    const ada = new Set<number>();
    d.baris.forEach((b, i) => {
      if (ada.has(b.idBarang)) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'idBarang'],
          message: 'Barang ini sudah ada di baris lain.',
        });
      }
      ada.add(b.idBarang);
    });
  });
export type InputOrderPembelian = z.input<typeof skemaOrderPembelian>;
export type DataOrderPembelian = z.output<typeof skemaOrderPembelian>;

/** Jawaban pemasok: tanggal janji kirim; qty/harga per baris hanya bila berubah. */
export const skemaKonfirmasiOrderPembelian = z.object({
  tanggalJanjiKirim: skemaTanggal('Tanggal janji kirim'),
  baris: z
    .array(
      z.object({
        id: idWajib('Baris tidak valid.'),
        qty: z.preprocess(
          (v) => (v === '' ? undefined : v),
          z
            .string()
            .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Qty harus angka ≥ 0, maksimal 3 desimal.')
            .optional(),
        ),
        harga: skemaRupiah.optional(),
      }),
    )
    .max(200)
    .default([]),
});
export type InputKonfirmasiOrderPembelian = z.input<typeof skemaKonfirmasiOrderPembelian>;
export type DataKonfirmasiOrderPembelian = z.output<typeof skemaKonfirmasiOrderPembelian>;

export const skemaUangMukaOrderPembelian = z
  .object({
    nominal: skemaRupiah.refine((v) => v > 0, 'Nominal harus lebih dari 0.'),
    metode: z.enum(METODE_BAYAR_HUTANG, 'Cara bayar tidak valid.'),
    rekening: teksOpsional(60, 'Rekening maksimal 60 karakter.'),
    referensi: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
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
export type InputUangMukaOrderPembelian = z.input<typeof skemaUangMukaOrderPembelian>;
export type DataUangMukaOrderPembelian = z.output<typeof skemaUangMukaOrderPembelian>;

/** Tutup sisa / batal: alasan wajib; sisa uang muka (bila ada) dicatat dikembalikan pemasok. */
export const skemaAkhiriOrderPembelian = z.object({
  alasan: z
    .string('Alasan wajib diisi.')
    .trim()
    .min(3, 'Alasan minimal 3 karakter.')
    .max(255, 'Alasan maksimal 255 karakter.'),
  metodeKembali: z.enum(METODE_BAYAR_HUTANG).optional(),
});
export type InputAkhiriOrderPembelian = z.input<typeof skemaAkhiriOrderPembelian>;
export type DataAkhiriOrderPembelian = z.output<typeof skemaAkhiriOrderPembelian>;

export const skemaCariOrderPembelian = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_ORDER_PEMBELIAN, 'BERJALAN']).optional(),
  idPemasok: z.coerce.number().int().positive().optional(),
});
export type ParamCariOrderPembelian = z.input<typeof skemaCariOrderPembelian>;

export type BarisDaftarOrderPembelian = {
  id: number;
  nomor: string | null;
  tanggal: string;
  idPemasok: number;
  namaPemasok: string;
  status: StatusOrderPembelian;
  tanggalDipesan: string | null;
  tanggalJanjiKirim: string | null;
  /** Lewat tanggal janji kirim dan barang belum lengkap. */
  terlambat: boolean;
  jumlahBarang: number;
  /** Hanya untuk `master.barang.lihat_hpp`. */
  totalPerkiraan?: number;
  namaPembuat: string;
};

export type BarisOrderPembelianDetail = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  qtyPesan: string;
  qtyKonfirmasi: string | null;
  /** qty konfirmasi bila ada, selain itu qty pesan. */
  qtyBerlaku: string;
  qtyDiterima: string;
  qtySisa: string;
  hargaPerkiraan?: number;
  hargaKonfirmasi?: number | null;
  hargaBerlaku?: number;
};

/** K-225: kebutuhan dan keadaan persetujuan order pembelian. */
export type PersetujuanOrderPembelian = {
  /** Alasan order ini wajib disetujui (kosong = boleh langsung dikirim). */
  alasan: string[];
  /** Hanya Owner yang boleh menyetujui (barang khusus atau di atas batas Kepala Toko). */
  perluOwner: boolean;
  idPembuat: number;
  namaPenyetuju: string | null;
  disetujuiPada: string | null;
  /** Catatan penyetuju, atau alasan penolakan bila dikembalikan ke draf. */
  catatan: string | null;
};

export const skemaPutusanPO = z.object({
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export const skemaTolakPO = z.object({
  alasan: z
    .string('Alasan penolakan wajib diisi.')
    .trim()
    .min(3, 'Alasan penolakan wajib diisi.')
    .max(255, 'Alasan maksimal 255 karakter.'),
});

export type DetailOrderPembelian = BarisDaftarOrderPembelian & {
  persetujuan: PersetujuanOrderPembelian;
  catatan: string | null;
  alasanTutup: string | null;
  baris: BarisOrderPembelianDetail[];
  uangMuka: { nomor: string; tanggal: string; nominal: number; metode: string }[];
  /** Σ uang muka − Σ yang sudah dipakai/dikembalikan. */
  sisaUangMuka: number;
  penerimaan: { id: number; nomor: string; tanggal: string; totalFaktur: number }[];
};
