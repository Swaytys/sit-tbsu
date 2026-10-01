import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  JENIS_PENJUALAN,
  PRIORITAS_ORDER,
  STATUS_ORDER,
  type JenisPenjualan,
  type Kepemilikan,
  type PrioritasOrder,
  type StatusOrder,
} from '../enums';
import { skemaQtyPositif } from './persediaan';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Penjualan (Fase 5): order & antrean (docs/05 §3, §6), harga dan diskon baris (docs/06 §1–2).
 * Harga, subtotal, dan total final dihitung API; web hanya menampilkan perkiraan.
 */

const kosongJadiNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/** Persen diskon 0–100, maksimal 2 desimal (teks). */
const skemaPersen = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : kosongJadiNull(v)),
  z
    .string()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Persen diskon tidak valid.')
    .transform((v) => v.replace(',', '.'))
    .refine((v) => Number(v) <= 100, 'Persen diskon maksimal 100.')
    .nullable(),
);

export const skemaBarisOrder = z
  .object({
    idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
    qty: skemaQtyPositif('Qty'),
    /** null = tier bawaan (tier pelanggan, atau tier default) (P3). */
    idTingkatHarga: z.number().int().positive().nullable().default(null),
    /** Harga manual (H9): butuh izin `penjualan.harga_manual`. */
    hargaManual: z.boolean().default(false),
    hargaSatuan: z.preprocess(kosongJadiNull, skemaRupiah.nullable()).default(null),
    /** Diskon baris dalam rupiah, atau persen (diubah ke rupiah oleh API, U4). */
    diskonBaris: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
    diskonBarisPersen: skemaPersen.default(null),
    catatanItem: teksOpsional(150, 'Catatan item maksimal 150 karakter.'),
  })
  .superRefine((b, ctx) => {
    if (b.hargaManual && b.hargaSatuan === null) {
      ctx.addIssue({ code: 'custom', path: ['hargaSatuan'], message: 'Harga manual wajib diisi.' });
    }
  });
export type InputBarisOrder = z.input<typeof skemaBarisOrder>;

export const skemaOrder = z
  .object({
    jenisPenjualan: z.enum(JENIS_PENJUALAN, 'Jenis penjualan tidak valid.'),
    idPelanggan: z.number().int().positive().nullable().default(null),
    namaPembeli: teksOpsional(100, 'Nama pembeli maksimal 100 karakter.'),
    prioritas: z.enum(PRIORITAS_ORDER).default('NORMAL'),
    alamatKirim: teksOpsional(255, 'Alamat kirim maksimal 255 karakter.'),
    catatanKirim: teksOpsional(255, 'Catatan kirim maksimal 255 karakter.'),
    ongkir: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
    diskonTransaksi: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
    diskonTransaksiPersen: skemaPersen.default(null),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    /** H9: Admin/Owner menyetujui harga manual di bawah modal. */
    setujuDiBawahModal: z.boolean().default(false),
    baris: z
      .array(skemaBarisOrder)
      .min(1, 'Tambahkan minimal satu barang.')
      .max(200, 'Maksimal 200 barang per order.'),
  })
  .superRefine((d, ctx) => {
    if (d.jenisPenjualan === 'PENGANTARAN') {
      if (d.idPelanggan === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['idPelanggan'],
          message: 'Pengantaran wajib memilih pelanggan.',
        });
      }
      if (!d.alamatKirim) {
        ctx.addIssue({
          code: 'custom',
          path: ['alamatKirim'],
          message: 'Alamat kirim wajib diisi untuk pengantaran.',
        });
      }
    }
    const terlihat = new Map<number, number>();
    d.baris.forEach((b, i) => {
      const lain = terlihat.get(b.idBarang);
      if (lain !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'idBarang'],
          message: `Barang sama dengan baris ${lain + 1}; ubah qty-nya saja.`,
        });
      }
      terlihat.set(b.idBarang, i);
    });
  });
export type InputOrder = z.input<typeof skemaOrder>;
export type DataOrder = z.output<typeof skemaOrder>;

export const skemaCariOrder = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  /** AKTIF = MENUNGGU + DIPROSES. */
  status: z.enum([...STATUS_ORDER, 'AKTIF'] as const).optional(),
  jenis: z.enum(JENIS_PENJUALAN).optional(),
  /** Hanya order buatan sendiri. */
  milikSaya: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariOrder = z.input<typeof skemaCariOrder>;

export const skemaBatalOrder = z.object({
  alasan: z
    .string('Alasan batal wajib diisi.')
    .trim()
    .min(3, 'Alasan batal wajib diisi (min. 3 huruf).')
    .max(255, 'Alasan maksimal 255 karakter.'),
});

export type BarisDaftarOrder = {
  id: number;
  nomor: string;
  tanggal: string;
  jenisPenjualan: JenisPenjualan;
  status: StatusOrder;
  prioritas: PrioritasOrder;
  idPelanggan: number | null;
  namaPelanggan: string | null;
  namaPembeli: string | null;
  idPengguna: number;
  namaPengguna: string;
  idKasirProses: number | null;
  namaKasirProses: string | null;
  jumlahItem: number;
  total: number;
  waktuMasukAntrean: string | null;
  /** R7: MENUNGGU lebih lama dari batas umur order. */
  basi: boolean;
};

export type BarisDetailOrder = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  qty: string;
  qtyDasar: string;
  idTingkatHarga: number | null;
  namaTier: string | null;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  subtotal: number;
  catatanItem: string | null;
  /** Stok tersedia untuk order ini (stok tersedia + yang sudah ditahan order ini). */
  stokTersedia: string;
  /** Harga jual barang per tier saat ini (pilihan tier di form). */
  hargaTier: { idTingkatHarga: number; hargaJual: number }[];
};

export type DetailOrder = BarisDaftarOrder & {
  alamatKirim: string | null;
  catatanKirim: string | null;
  catatan: string | null;
  alasanBatal: string | null;
  idPenjualan: number | null;
  idTingkatHargaPelanggan: number | null;
  subtotal: number;
  diskonTransaksi: number;
  ongkir: number;
  baris: BarisDetailOrder[];
};

export type DaftarOrder = { data: BarisDaftarOrder[]; meta: MetaHalaman };

/** Stok tertahan (R7): per barang, order yang menahan stok. */
export type BarisStokTertahan = {
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  stokFisik: string;
  stokDipesan: string;
  order: {
    id: number;
    nomor: string;
    status: StatusOrder;
    qtyDasar: string;
    namaPengguna: string;
    namaPelanggan: string | null;
    waktuMasukAntrean: string | null;
    basi: boolean;
  }[];
};
