import { z } from 'zod';
import { AKSI_LOG } from '../log';
import { PERAN } from '../enums';
import { KODE_DOKUMEN } from '../penomoran';
import { skemaHalaman } from './umum';

/*
 * Pengaturan toko (roadmap Fase 2; nilai disimpan di tabel `konfigurasi`, docs/03 §6 dan docs/05 §15).
 * Dikelompokkan per bagian; tiap bagian disimpan sendiri lewat `PATCH /api/pengaturan`.
 */

const bulat = (label: string, min: number, maks: number) =>
  z.coerce
    .number(`${label} harus berupa angka.`)
    .int(`${label} harus bilangan bulat.`)
    .min(min, `${label} minimal ${min}.`)
    .max(maks, `${label} maksimal ${maks}.`);

const teks = (label: string, maks: number, wajib = false) => {
  const dasar = z.string().trim().max(maks, `${label} maksimal ${maks} karakter.`);
  return wajib ? dasar.min(1, `${label} wajib diisi.`) : dasar;
};

export const skemaProfilToko = z.object({
  namaToko: teks('Nama toko', 100, true),
  namaBadanUsaha: teks('Nama badan usaha', 100),
  alamatToko: teks('Alamat', 255),
  telpToko: teks('Telepon', 50),
  emailToko: z.union([z.literal(''), z.email('Format email tidak valid.')]),
  footerStruk: teks('Teks footer struk', 255),
  lebarStrukMm: z.coerce
    .number()
    .refine((v) => v === 58 || v === 80, 'Lebar struk hanya 58 atau 80 mm.'),
  /** Kop struk memakai nama toko / logo toko (K-065). */
  strukTampilkanNama: z.boolean(),
  strukTampilkanLogo: z.boolean(),
});

/** Pilihan jumlah baris per halaman tabel (K-065). */
export const PILIHAN_BARIS_PER_HALAMAN = [10, 25, 50, 100] as const;

export const skemaPrefixDokumen = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}$/, 'Prefix 2–5 huruf.');

export const skemaPenomoran = z
  .object({
    prefix: z.object(
      Object.fromEntries(KODE_DOKUMEN.map((k) => [k, skemaPrefixDokumen])) as Record<
        (typeof KODE_DOKUMEN)[number],
        typeof skemaPrefixDokumen
      >,
    ),
    digitNomor: bulat('Digit nomor urut', 3, 6),
  })
  .superRefine((v, ctx) => {
    // Prefix harus unik agar nomor dokumen berbeda jenis tidak tertukar (docs/05 N1–N2).
    const dipakai = new Map<string, string>();
    for (const [kode, prefix] of Object.entries(v.prefix)) {
      const pemilik = dipakai.get(prefix);
      if (pemilik) {
        ctx.addIssue({
          code: 'custom',
          path: ['prefix', kode],
          message: `Prefix ${prefix} sudah dipakai ${pemilik}.`,
        });
      }
      dipakai.set(prefix, kode);
    }
  });

export const skemaOperasional = z.object({
  ambangRestockPersen: bulat('Ambang restock', 0, 100),
  stokMinimumDefault: bulat('Stok minimum bawaan', 0, 1_000_000),
  batasUmurOrderJam: bulat('Batas umur order', 1, 720),
  autoBatalOrderBasi: z.boolean(),
  batasKunciOrderMenit: bulat('Batas kunci order', 5, 1440),
  termHariDefault: bulat('Term piutang bawaan', 0, 365),
  jatuhTempoDefaultHari: bulat('Jatuh tempo bawaan', 0, 365),
  checkoutWajibShift: z.boolean(),
  barisPerHalaman: z.coerce
    .number('Jumlah baris harus berupa angka.')
    .refine(
      (v) => (PILIHAN_BARIS_PER_HALAMAN as readonly number[]).includes(v),
      'Pilih 10, 25, 50, atau 100 baris.',
    ),
});

export const DASAR_MARKUP = ['HARGA_BELI_TERAKHIR', 'HPP_RATA2'] as const;

export const skemaHargaDiskon = z.object({
  dasarMarkup: z.enum(DASAR_MARKUP),
  pembulatanHarga: bulat('Pembulatan harga', 1, 100_000),
  batasDiskonPersen: z.object(
    Object.fromEntries(PERAN.map((p) => [p, bulat('Batas diskon', 0, 100)])) as Record<
      (typeof PERAN)[number],
      ReturnType<typeof bulat>
    >,
  ),
});

export const skemaKeamanan = z.object({
  loginMaksGagal: bulat('Batas gagal login', 3, 20),
  loginKunciMenit: bulat('Lama kunci akun', 1, 1440),
  passwordMin: bulat('Panjang minimal password', 8, 64),
});

export const skemaPengaturan = z.object({
  profil: skemaProfilToko,
  penomoran: skemaPenomoran,
  operasional: skemaOperasional,
  harga: skemaHargaDiskon,
  keamanan: skemaKeamanan,
});
export type Pengaturan = z.output<typeof skemaPengaturan>;
export type BagianPengaturan = keyof Pengaturan;

/** Satu atau beberapa bagian sekaligus. */
export const skemaUbahPengaturan = skemaPengaturan
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada pengaturan yang dikirim.');
export type InputUbahPengaturan = z.input<typeof skemaUbahPengaturan>;

/** Identitas toko dan preferensi tampilan yang boleh dibaca semua pengguna login (K-065). */
export type TampilanToko = {
  namaToko: string;
  namaBadanUsaha: string;
  /** URL logo (dilayani API), `null` bila belum ada. */
  logo: string | null;
  barisPerHalaman: number;
};

// --- Log aktivitas (Pengaturan › tab Log Aktivitas, izin sistem.log.lihat; docs/04 §8) ---

export const skemaCariLog = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  aksi: z.enum(AKSI_LOG).optional(),
});
export type ParamCariLog = z.input<typeof skemaCariLog>;

export type BarisLog = {
  id: number;
  waktu: string;
  idPengguna: number | null;
  namaPengguna: string | null;
  usernamePercobaan: string | null;
  aksi: string;
  entitas: string | null;
  idEntitas: number | null;
  nomorDokumen: string | null;
  ringkasan: string | null;
  dataLama: unknown;
  dataBaru: unknown;
  ip: string | null;
};
