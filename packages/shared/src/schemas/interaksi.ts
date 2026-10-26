import { z } from 'zod';
import { JENIS_INTERAKSI, TINGKAT_LOG_INTERAKSI, type JenisInteraksi } from '../enums';
import { skemaHalaman } from './umum';

/*
 * K-190: log interaksi untuk penelitian (DeLone & McLean: penggunaan sistem, kepuasan pengguna). Terpisah dari log
 * audit `log_aktivitas`. Yang dicatat hanya NAMA elemen (label tombol, judul dialog, kunci pintasan), halaman, dan
 * angka (lama di halaman, jumlah hasil cari); isi ketikan, password, nominal, dan data pribadi tidak pernah dikirim.
 */

/** Paling banyak kejadian per kiriman dari peramban. */
export const BATAS_KIRIM_INTERAKSI = 100;
/** Paling banyak baris per ekspor (persempit tanggal bila lebih). */
export const BATAS_EKSPOR_INTERAKSI = 100_000;

export const skemaKirimInteraksi = z.object({
  /** Acak per tab peramban: mengelompokkan kejadian satu sesi pemakaian. */
  idSesiKlien: z.string().regex(/^[a-z0-9-]{8,40}$/, 'Sesi klien tidak valid.'),
  kejadian: z
    .array(
      z.object({
        waktu: z.iso.datetime({ offset: true }),
        jenis: z.enum(JENIS_INTERAKSI),
        halaman: z.string().trim().min(1).max(120),
        elemen: z.string().trim().max(150).nullable(),
        keterangan: z.string().trim().max(255).nullable(),
        angka: z.number().int().min(0).max(2_000_000_000).nullable(),
      }),
    )
    .min(1)
    .max(BATAS_KIRIM_INTERAKSI),
});
export type DataKirimInteraksi = z.output<typeof skemaKirimInteraksi>;
export type KejadianInteraksi = DataKirimInteraksi['kejadian'][number];

export const skemaSetelanInteraksi = z.object({
  aktif: z.boolean(),
  tingkat: z.enum(TINGKAT_LOG_INTERAKSI, 'Pilih tingkat rincian.'),
});
export type SetelanInteraksi = z.output<typeof skemaSetelanInteraksi>;

const tanggal = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat tanggal.`)
    .optional();

const saringInteraksi = {
  idPengguna: z.coerce.number().int().positive().optional(),
  jenis: z.enum(JENIS_INTERAKSI).optional(),
  /** Alamat halaman (sebagian), mis. `/order`. */
  lokasi: z.string().trim().max(120).optional(),
  dari: tanggal('Tanggal awal'),
  sampai: tanggal('Tanggal akhir'),
};

export const skemaCariInteraksi = skemaHalaman.extend(saringInteraksi);
export type ParamCariInteraksi = z.input<typeof skemaCariInteraksi>;

export const skemaEksporInteraksi = z
  .object({ ...saringInteraksi, format: z.enum(['XLSX', 'CSV']).default('XLSX') })
  .refine((v) => !v.dari || !v.sampai || v.dari <= v.sampai, {
    message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
    path: ['sampai'],
  });
export type ParamEksporInteraksi = z.output<typeof skemaEksporInteraksi>;

export type BarisInteraksi = {
  id: number;
  waktu: string;
  idPengguna: number;
  namaPengguna: string;
  peran: string;
  idSesiKlien: string;
  jenis: JenisInteraksi;
  halaman: string;
  elemen: string | null;
  keterangan: string | null;
  angka: number | null;
};

/** Ringkasan untuk kartu di Pengaturan: jumlah kejadian, pengguna, dan rentang waktu yang sudah terkumpul. */
export type RingkasanInteraksi = SetelanInteraksi & {
  jumlah: number;
  jumlahPengguna: number;
  pertama: string | null;
  terakhir: string | null;
};
