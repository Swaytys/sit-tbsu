import { z } from 'zod';
import { RUPIAH_MAKS } from '../money';
import { galatNoHp, rapikanNoHp } from '../nohp';

/** Parameter daftar berhalaman (docs/02 §4): `?halaman=1&perHalaman=25`. */
export const skemaHalaman = z.object({
  halaman: z.coerce.number().int().min(1).default(1),
  perHalaman: z.coerce.number().int().min(1).max(100).default(25),
});

/** Parameter rute `/:id`. */
export const skemaIdParam = z.object({
  id: z.coerce.number().int().positive('ID tidak valid.'),
});

/** Teks opsional: spasi di tepi dibuang; kosong menjadi `null`. */
export const teksOpsional = (maks: number, pesanMaks: string) =>
  z
    .string()
    .trim()
    .max(maks, pesanMaks)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/**
 * No. HP wajib (pelanggan, pemasok, order disimpan; K-056, K-137): dirapikan ke format internasional (`0812…` →
 * `+62812…`), 8–15 angka.
 */
export const skemaNoHpWajib = z
  .string('No. HP wajib diisi.')
  .trim()
  .min(1, 'No. HP wajib diisi.')
  .transform((v) => rapikanNoHp(v) ?? '')
  .superRefine((v, ctx) => {
    const g = v === '' ? 'No. HP wajib diisi.' : galatNoHp(v);
    if (g) ctx.addIssue({ code: 'custom', message: g });
  });

/** No. HP opsional (sopir, pengguna; K-137): kosong = null, selain itu sama dengan `skemaNoHpWajib`. */
export const skemaNoHpOpsional = z
  .string()
  .trim()
  .transform((v) => rapikanNoHp(v))
  .superRefine((v, ctx) => {
    const g = v === null ? null : galatNoHp(v);
    if (g) ctx.addIssue({ code: 'custom', message: g });
  })
  .nullable()
  .optional();

/** Nilai uang: rupiah utuh, tidak negatif (CLAUDE.md aturan 7). */
export const skemaRupiah = z
  .number('Nilai rupiah harus berupa angka.')
  .int('Nilai rupiah harus bilangan bulat.')
  .min(0, 'Nilai rupiah tidak boleh negatif.')
  .max(RUPIAH_MAKS, 'Nilai rupiah terlalu besar.');

/** K-167: pencarian universal di topbar. */
export const skemaCari = z.object({ q: z.string().trim().max(100).default('') });

export type JenisHasilCari =
  | 'BARANG'
  | 'PELANGGAN'
  | 'PEMASOK'
  | 'PENJUALAN'
  | 'ORDER'
  | 'SURAT_JALAN'
  | 'RETUR'
  | 'VOID'
  | 'PENERIMAAN';

export type HasilCari = {
  jenis: JenisHasilCari;
  judul: string;
  keterangan: string;
  /** Halaman tujuan; `null` = hanya informasi (mis. Staf melihat stok barang). */
  tautan: string | null;
};

/**
 * U12 + K-196: No. referensi untuk SETIAP uang non-tunai, masuk maupun keluar (penjualan, pelunasan, bayar
 * pemasok, uang muka PO, pengembalian uang), di semua peran: 4–40 karakter huruf/angka (boleh spasi . / -).
 * Panjang aslinya berbeda per bank/penyedia (approval EDC 6, RRN QRIS 12, referensi transfer 8–20).
 */
export const POLA_REFERENSI = /^[A-Za-z0-9][A-Za-z0-9 ./-]{3,39}$/;
export const PESAN_REFERENSI =
  'No. referensi wajib, 4–40 huruf/angka: lihat bukti transfer, struk EDC, atau notifikasi QRIS.';
export const PESAN_REFERENSI_KELUAR =
  'No. referensi wajib, 4–40 huruf/angka: lihat bukti transfer dari bank (m-banking/struk).';

/** Benar bila `nilai` memenuhi pola No. referensi (K-196). */
export const referensiSah = (nilai: string | null | undefined) =>
  POLA_REFERENSI.test((nilai ?? '').trim());
