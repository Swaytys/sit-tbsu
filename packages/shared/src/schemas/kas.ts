import { z } from 'zod';
import type { MetaHalaman } from '../api';
import { STATUS_SHIFT, type ArahKas, type JenisKasShift, type StatusShift } from '../enums';
import { skemaTanggal } from './persediaan';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Kas: shift kasir, kas masuk/keluar shift, tutup shift = clerical check blind count (docs/05 §10, K1–K8).
 */

/** Jenis kas shift yang dicatat manual oleh kasir (K3); refund & bayar pemasok tercatat otomatis. */
export const JENIS_KAS_MANUAL = [
  'KASBON',
  'SETOR_OWNER',
  'TARIK_OWNER',
  'MASUK_LAIN',
  'KELUAR_LAIN',
] as const satisfies readonly JenisKasShift[];
export type JenisKasManual = (typeof JENIS_KAS_MANUAL)[number];

/** Arah uang tiap jenis kas shift (K3). */
export const ARAH_JENIS_KAS: Record<JenisKasShift, ArahKas> = {
  KASBON: 'KELUAR',
  SETOR_OWNER: 'KELUAR',
  TARIK_OWNER: 'MASUK',
  REFUND_RETUR: 'KELUAR',
  REFUND_VOID: 'KELUAR',
  BAYAR_PEMASOK: 'KELUAR',
  MASUK_LAIN: 'MASUK',
  KELUAR_LAIN: 'KELUAR',
};

export const skemaKasShift = z
  .object({
    jenis: z.enum(JENIS_KAS_MANUAL, 'Jenis kas tidak valid.'),
    nominal: skemaRupiah.refine((v) => v > 0, 'Nominal harus lebih dari 0.'),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
  })
  .superRefine((d, ctx) => {
    if (d.jenis !== 'SETOR_OWNER' && d.jenis !== 'TARIK_OWNER' && !d.keterangan) {
      ctx.addIssue({
        code: 'custom',
        path: ['keterangan'],
        message:
          d.jenis === 'KASBON'
            ? 'Tulis siapa yang kasbon dan untuk apa.'
            : 'Keterangan wajib diisi.',
      });
    }
  });
export type InputKasShift = z.input<typeof skemaKasShift>;
export type DataKasShift = z.output<typeof skemaKasShift>;

/** K4: tutup shift = input uang fisik (blind count). Selisih ≠ 0 wajib keterangan (dicek server). */
export const skemaTutupShift = z.object({
  uangFisik: skemaRupiah,
  keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
});
export type DataTutupShift = z.output<typeof skemaTutupShift>;

export const skemaCariShift = skemaHalaman.extend({
  status: z.enum(STATUS_SHIFT).optional(),
  idKasir: z.coerce.number().int().positive().optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
  /** Hanya shift dengan selisih clerical ≠ 0. */
  adaSelisih: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariShift = z.input<typeof skemaCariShift>;

export type BarisKasShift = {
  id: number;
  waktu: string;
  jenis: JenisKasShift;
  arah: ArahKas;
  nominal: number;
  keterangan: string | null;
  namaPengguna: string;
  /** Nomor dokumen sumber (retur/void/pembayaran pemasok) bila otomatis. */
  nomorDokumen: string | null;
};

export type HasilClerical = {
  nomor: string;
  tanggal: string;
  modalAwal: number;
  tunaiPenjualan: number;
  kasMasukLain: number;
  kasKeluar: number;
  saldoSistem: number;
  uangFisik: number;
  selisih: number;
  keterangan: string | null;
  namaPemeriksa: string;
};

/** Ringkasan kas shift yang dihitung server (K5). */
export type RingkasanKasShift = {
  modalAwal: number;
  tunaiPenjualan: number;
  kasMasukLain: number;
  kasKeluar: number;
  saldoSistem: number;
  jumlahTransaksi: number;
};

export type BarisShift = {
  id: number;
  nomor: string;
  idKasir: number;
  namaKasir: string;
  tanggalOperasional: string;
  waktuBuka: string;
  waktuTutup: string | null;
  modalAwal: number;
  status: StatusShift;
  /** Hanya untuk shift TUTUP. */
  clerical: HasilClerical | null;
};

export type DaftarShift = { data: BarisShift[]; meta: MetaHalaman };

/**
 * Detail shift. `ringkasan` hanya dikirim bila shift TUTUP atau pembaca memegang `kas.shift.lihat_semua`
 * (blind count, K4); kasir melihat daftar kas manualnya sendiri.
 */
export type DetailShift = BarisShift & {
  kas: BarisKasShift[];
  ringkasan: RingkasanKasShift | null;
};
