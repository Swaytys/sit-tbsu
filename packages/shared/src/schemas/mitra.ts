import { z } from 'zod';
import { STATUS_AKTIF, type StatusAktif } from '../enums';
import { skemaHalaman, skemaNoHpWajib, skemaRupiah, teksOpsional } from './umum';

/*
 * Mitra: pelanggan dan pemasok (docs/03 §3.2). Kode `PLG-00001` / `PMS-00001` dari penomoran, tidak bisa
 * diubah (N5). Tidak ada hapus; dinonaktifkan (K-021).
 */

/** Daftar mitra: cari (nama, kode, No. HP), saring status, berhalaman. */
export const skemaCariMitra = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
});
export type ParamCariMitra = z.input<typeof skemaCariMitra>;

const email = teksOpsional(100, 'Email maksimal 100 karakter.').refine(
  (v) => v === null || v === undefined || z.email().safeParse(v).success,
  'Format email tidak valid.',
);

// --- Pelanggan ---

/** Isian kosong pada form berarti "tidak diisi". */
const kosongJadiUndefined = (v: unknown) => (v === '' ? undefined : v);
const kosongJadiNull = (v: unknown) => (v === '' ? null : v);

/**
 * Tier default, term hari, dan limit kredit hanya boleh diatur pemegang `master.pelanggan.atur_kredit`
 * (K-059). Kolom yang tidak dikirim (`undefined`) berarti: pelanggan baru memakai bawaan toko; ubah data
 * mempertahankan nilai lama.
 */
export const skemaPelanggan = z.object({
  namaPelanggan: z
    .string('Nama pelanggan wajib diisi.')
    .trim()
    .min(1, 'Nama pelanggan wajib diisi.')
    .max(100, 'Nama pelanggan maksimal 100 karakter.'),
  noHp: skemaNoHpWajib,
  email,
  alamat: teksOpsional(255, 'Alamat maksimal 255 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
  /** `null` = mengikuti tier default toko. */
  idTingkatHarga: z.number().int().positive().nullable().optional(),
  termHari: z.preprocess(
    kosongJadiUndefined,
    z.coerce
      .number('Term harus berupa angka.')
      .int('Term harus bilangan bulat.')
      .min(0, 'Term minimal 0 hari.')
      .max(365, 'Term maksimal 365 hari.')
      .optional(),
  ),
  /** `null` = tanpa limit. Disimpan saja; ditegakkan di M2 (docs/06 PT6). */
  limitKredit: z.preprocess(kosongJadiNull, skemaRupiah.nullable().optional()),
});
export type InputPelanggan = z.input<typeof skemaPelanggan>;
export type DataPelanggan = z.output<typeof skemaPelanggan>;

export type Pelanggan = {
  id: number;
  kode: string;
  namaPelanggan: string;
  noHp: string | null;
  email: string | null;
  alamat: string | null;
  keterangan: string | null;
  idTingkatHarga: number | null;
  /** Nama tier default pelanggan; `null` bila mengikuti tier default toko. */
  namaTingkatHarga: string | null;
  termHari: number;
  limitKredit: number | null;
  statusAktif: StatusAktif;
  dibuatPada: string;
};

// --- Pemasok ---

export const skemaPemasok = z.object({
  namaPemasok: z
    .string('Nama pemasok wajib diisi.')
    .trim()
    .min(1, 'Nama pemasok wajib diisi.')
    .max(100, 'Nama pemasok maksimal 100 karakter.'),
  noHp: skemaNoHpWajib,
  kontakPerson: teksOpsional(100, 'Kontak person maksimal 100 karakter.'),
  alamat: teksOpsional(255, 'Alamat maksimal 255 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});
export type InputPemasok = z.input<typeof skemaPemasok>;
export type DataPemasok = z.output<typeof skemaPemasok>;

export type Pemasok = {
  id: number;
  kode: string;
  namaPemasok: string;
  noHp: string | null;
  kontakPerson: string | null;
  alamat: string | null;
  keterangan: string | null;
  statusAktif: StatusAktif;
  dibuatPada: string;
};

// --- Tingkat harga (tier) ---

export type TingkatHarga = {
  id: number;
  kode: string;
  nama: string;
  /** Hanya untuk pemegang `master.barang.lihat_hpp` (markup membuka margin; docs/06 H12). */
  markupDefaultPersen?: string;
  urutan: number;
  isDefault: boolean;
  statusAktif: StatusAktif;
};
