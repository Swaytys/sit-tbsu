import Decimal from 'decimal.js';
import { z } from 'zod';
import { JENIS_DIMENSI, JENIS_DIMENSI_FISIK, STATUS_AKTIF, TIPE_NILAI } from '../enums';
import { teksOpsional } from './umum';

/*
 * Data referensi master (Fase 3): kategori, satuan, jenis atribut (docs/03 §3.2, K-014, K-036).
 * Tidak ada hapus; yang tidak dipakai lagi dinonaktifkan (K-021).
 */

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

/** Ubah status aktif/nonaktif data master. */
export const skemaUbahStatus = z.object({ statusAktif: z.enum(STATUS_AKTIF) });
export type InputUbahStatus = z.infer<typeof skemaUbahStatus>;

/** Saring daftar menurut status (dropdown memakai AKTIF). */
export const skemaSaringStatus = z.object({
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
});

const urutan = z.coerce
  .number('Urutan harus berupa angka.')
  .int('Urutan harus bilangan bulat.')
  .min(0, 'Urutan minimal 0.')
  .max(9999, 'Urutan maksimal 9999.')
  .default(0);

// --- Kategori ---

export const skemaKategori = z.object({
  nama: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi.')
    .max(60, 'Nama kategori maksimal 60 karakter.'),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
  urutan,
});
export type InputKategori = z.input<typeof skemaKategori>;
export type DataKategori = z.output<typeof skemaKategori>;

export type Kategori = {
  id: number;
  nama: string;
  keterangan: string | null;
  urutan: number;
  statusAktif: (typeof STATUS_AKTIF)[number];
  jumlahBarang: number;
};

// --- Satuan ---

/** Faktor desimal > 0, paling banyak 6 desimal; koma diterima sebagai pemisah desimal. */
export const skemaFaktor = z
  .string()
  .trim()
  .transform((v) => v.replace(',', '.'))
  .pipe(
    z
      .string()
      .regex(/^\d{1,12}(\.\d{1,6})?$/, 'Faktor berupa angka dengan paling banyak 6 desimal.')
      .refine((v) => new Decimal(v).greaterThan(0), 'Faktor harus lebih dari 0.'),
  );

export const skemaSatuanInput = z
  .object({
    kode: z
      .string()
      .trim()
      .min(1, 'Kode satuan wajib diisi.')
      .max(10, 'Kode satuan maksimal 10 karakter.')
      .regex(/^[A-Za-z0-9./-]+$/, 'Kode satuan tanpa spasi (huruf, angka, titik, garis miring).'),
    nama: z
      .string()
      .trim()
      .min(1, 'Nama satuan wajib diisi.')
      .max(50, 'Nama satuan maksimal 50 karakter.'),
    jenisDimensi: z.enum(JENIS_DIMENSI, 'Jenis dimensi wajib dipilih.'),
    faktorKeBasis: skemaFaktor,
    isBasis: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const fisik = DIMENSI_FISIK.includes(v.jenisDimensi);
    const faktorSatu = new Decimal(v.faktorKeBasis).equals(1);
    if (!fisik && !faktorSatu) {
      ctx.addIssue({
        code: 'custom',
        path: ['faktorKeBasis'],
        message: 'Satuan hitung/lainnya selalu berfaktor 1; konversinya diatur per barang.',
      });
    }
    if (fisik && v.isBasis && !faktorSatu) {
      ctx.addIssue({
        code: 'custom',
        path: ['faktorKeBasis'],
        message: 'Satuan basis harus berfaktor 1.',
      });
    }
  });
export type InputSatuan = z.input<typeof skemaSatuanInput>;
export type DataSatuan = z.output<typeof skemaSatuanInput>;

// --- Jenis atribut ---

export const skemaJenisAtribut = z
  .object({
    kode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z][A-Z0-9_]{0,29}$/,
        'Kode 1–30 huruf besar, angka, atau garis bawah; diawali huruf.',
      ),
    nama: z
      .string()
      .trim()
      .min(1, 'Nama atribut wajib diisi.')
      .max(60, 'Nama atribut maksimal 60 karakter.'),
    tipeNilai: z.enum(TIPE_NILAI, 'Tipe nilai wajib dipilih.'),
    jenisDimensi: z.enum(JENIS_DIMENSI).nullable(),
    urutan,
  })
  .refine((v) => v.tipeNilai === 'ANGKA' || v.jenisDimensi === null, {
    path: ['jenisDimensi'],
    error: 'Atribut bertipe teks tidak punya dimensi.',
  });
export type InputJenisAtribut = z.input<typeof skemaJenisAtribut>;
export type DataJenisAtribut = z.output<typeof skemaJenisAtribut>;

export type JenisAtribut = {
  id: number;
  kode: string;
  nama: string;
  tipeNilai: (typeof TIPE_NILAI)[number];
  jenisDimensi: (typeof JENIS_DIMENSI)[number] | null;
  urutan: number;
  statusAktif: (typeof STATUS_AKTIF)[number];
  jumlahBarang: number;
};
