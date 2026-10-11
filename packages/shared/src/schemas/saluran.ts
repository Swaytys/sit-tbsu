import { z } from 'zod';
import { SALURAN_PESAN, type SaluranPesan } from '../enums';

/*
 * Saluran pesan ke atasan dan kode persetujuan sekali pakai (docs/04 §6, K-102). Toko mengisi token bot
 * Telegram dan/atau akun SMTP sekali di Pengaturan › Persetujuan; tiap Admin/Owner menghubungkan Telegram
 * dan mengisi email-nya sendiri di Akun saya. Token dan sandi tidak pernah dikembalikan API.
 */

const kosongJadiNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Kolom rahasia: kosong = tidak diubah. */
export const skemaPengaturanSaluran = z.object({
  telegramToken: z.string().trim().max(100, 'Token bot terlalu panjang.').optional(),
  /** Menghapus token bot (Telegram dimatikan). */
  hapusTelegram: z.boolean().default(false),
  smtpHost: z.string().trim().max(100, 'Alamat server maksimal 100 karakter.'),
  smtpPort: z.coerce
    .number('Port harus berupa angka.')
    .int('Port harus bilangan bulat.')
    .min(1, 'Port minimal 1.')
    .max(65535, 'Port maksimal 65535.'),
  smtpPengguna: z.string().trim().max(120, 'Nama pengguna maksimal 120 karakter.'),
  smtpSandi: z.string().max(200, 'Sandi terlalu panjang.').optional(),
  emailPengirim: z.string().trim().max(150, 'Pengirim maksimal 150 karakter.'),
});
export type InputPengaturanSaluran = z.input<typeof skemaPengaturanSaluran>;
export type DataPengaturanSaluran = z.output<typeof skemaPengaturanSaluran>;

export type PengaturanSaluran = {
  telegram: {
    terpasang: boolean;
    /** `@nama_bot`, bila token dikenal Telegram. */
    bot: string | null;
  };
  email: {
    terpasang: boolean;
    host: string;
    port: number;
    pengguna: string;
    pengirim: string;
    sandiTerisi: boolean;
    /** Isian yang masih kosong sehingga email belum bisa dipakai, mis. `['sandi aplikasi']`. */
    kurang: string[];
  };
  /** Admin/Owner aktif yang sudah bisa menerima kode, untuk memeriksa kesiapan. */
  penerima: { nama: string; saluran: SaluranPesan[] }[];
};

/** Kontak pengguna sendiri untuk menerima kode persetujuan. */
export const skemaKontakSaya = z.object({
  email: z.preprocess(
    kosongJadiNull,
    z.email('Format email tidak valid.').max(120, 'Email maksimal 120 karakter.').nullable(),
  ),
});
export type InputKontakSaya = z.input<typeof skemaKontakSaya>;
export type DataKontakSaya = z.output<typeof skemaKontakSaya>;

export type KontakSaya = {
  email: string | null;
  telegramTerhubung: boolean;
  /** Toko sudah mengisi token bot / akun SMTP? Menentukan apakah kontak di atas benar-benar terpakai. */
  telegramTersedia: boolean;
  emailTersedia: boolean;
};

/** Cara menghubungkan akun dengan bot Telegram toko: buka tautan, tekan Start, lalu "Periksa". */
export type TautanTelegram = { bot: string; tautan: string; perintah: string };

/** Uji satu saluran ke kontak pengguna yang login (K-105). Selalu pengiriman sungguhan, tidak pernah tiruan. */
export const skemaUjiSaluran = z.object({ saluran: z.enum(SALURAN_PESAN) });

export type HasilUjiSaluran = {
  saluran: SaluranPesan;
  berhasil: boolean;
  /** Apa yang terjadi dan, bila gagal, langkah berikutnya. */
  pesan: string;
};

/** Kode 6 angka yang diketik pengaju setelah diberi tahu atasan. */
export const skemaKodePersetujuan = z.object({
  idPermintaan: z.number().int().positive(),
  kode: z
    .string('Kode persetujuan wajib diisi.')
    .trim()
    .regex(/^\d{6}$/, 'Kode persetujuan terdiri atas 6 angka.'),
});
export type DataKodePersetujuan = z.output<typeof skemaKodePersetujuan>;

/** Jawaban setelah kode dikirim: kepada siapa dan sampai kapan berlaku (tanpa kodenya). */
export type InfoKodePersetujuan = {
  idPermintaan: number;
  kadaluarsa: string;
  penerima: { nama: string; saluran: SaluranPesan[] }[];
  /**
   * Hanya di mode pengembangan: ada saluran yang belum diatur sehingga kodenya tidak benar-benar dikirim
   * (tercatat di log server saja). Di produksi selalu `false`.
   */
  simulasi: boolean;
};

/** Melampaui limit kredit (PT6): pelanggan dan tagihan baru yang dimintakan persetujuan. */
export const skemaMintaKodeLimit = z.object({
  idPelanggan: z.number().int().positive(),
  tagihanBaru: z
    .number('Tagihan baru harus berupa angka.')
    .int()
    .positive('Tagihan baru harus lebih dari 0.')
    .max(Number.MAX_SAFE_INTEGER),
});
export type DataMintaKodeLimit = z.output<typeof skemaMintaKodeLimit>;
