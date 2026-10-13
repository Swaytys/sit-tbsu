import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  JENIS_REKENING,
  STATUS_VERIFIKASI,
  type JenisRekening,
  type MetodePembayaran,
  type StatusAktif,
  type StatusVerifikasi,
} from '../enums';
import { skemaTanggal } from './persediaan';
import { skemaHalaman, teksOpsional } from './umum';

/*
 * Rekening toko dan pengecekan uang masuk non-tunai (K-111).
 *
 * Rekening toko = tujuan pembayaran non-tunai yang diterima toko: rekening bank (TRANSFER), mesin EDC, dan
 * QRIS. Didaftarkan sekali di Pengaturan › Pembayaran; kasir memilih dari daftar, tidak mengetik nomor.
 *
 * Tiap pembayaran non-tunai berstatus BELUM_DICEK sampai pemegang `kas.nontunai.verifikasi` mencocokkannya
 * dengan mutasi rekening/rekap EDC/riwayat QRIS lalu menandai SUDAH_MASUK atau TIDAK_MASUK. Pengecekan ini
 * manual: sistem tidak tersambung ke bank.
 */

export const skemaRekening = z.object({
  jenis: z.enum(JENIS_REKENING, 'Jenis rekening tidak valid.'),
  /** Nama bank atau penyedia, mis. "BCA", "EDC BRI", "QRIS Mandiri". */
  bank: z
    .string('Nama bank/penyedia wajib diisi.')
    .trim()
    .min(1, 'Nama bank/penyedia wajib diisi.')
    .max(30, 'Nama bank/penyedia maksimal 30 karakter.'),
  /** Nomor rekening; untuk EDC/QRIS boleh kosong (mis. nomor terminal atau ID merchant). */
  nomor: teksOpsional(30, 'Nomor maksimal 30 karakter.'),
  atasNama: teksOpsional(40, 'Atas nama maksimal 40 karakter.'),
  /** Terpilih otomatis saat kasir memilih metode ini. Satu bawaan per jenis. */
  isDefault: z.boolean().default(false),
});
export type InputRekening = z.input<typeof skemaRekening>;
export type DataRekening = z.output<typeof skemaRekening>;

export const skemaCariRekening = z.object({
  status: z.enum(['AKTIF', 'NONAKTIF', 'SEMUA']).default('AKTIF'),
});

export type RekeningToko = {
  id: number;
  jenis: JenisRekening;
  bank: string;
  nomor: string | null;
  atasNama: string | null;
  /** Label lengkap yang tampil di layar dan tersimpan di pembayaran, mis. "BCA 1234567890 a.n. Sumber Urip". */
  nama: string;
  isDefault: boolean;
  statusAktif: StatusAktif;
};

/** Label rekening dari bagian-bagiannya; paling panjang 60 karakter (kolom `pembayaran_penjualan.rekening`). */
export function labelRekening(r: {
  bank: string;
  nomor?: string | null | undefined;
  atasNama?: string | null | undefined;
}): string {
  const dasar = [r.bank, r.nomor].filter(Boolean).join(' ');
  const lengkap = r.atasNama ? `${dasar} a.n. ${r.atasNama}` : dasar;
  return lengkap.length <= 60 ? lengkap : dasar.slice(0, 60);
}

// --- Pengecekan uang masuk non-tunai ---

export const skemaVerifikasiPembayaran = z
  .object({
    status: z.enum(STATUS_VERIFIKASI, 'Status pengecekan tidak valid.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
  })
  .refine((d) => d.status !== 'TIDAK_MASUK' || !!d.catatan, {
    path: ['catatan'],
    message: 'Tulis apa yang ditemukan (mis. "tidak ada di mutasi BCA 12/10").',
  });
export type DataVerifikasiPembayaran = z.output<typeof skemaVerifikasiPembayaran>;

export const skemaCariNonTunai = skemaHalaman.extend({
  status: z.enum(STATUS_VERIFIKASI).optional(),
  idRekening: z.coerce.number().int().positive().optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
  /** Nomor pembayaran, nomor transaksi, nama pembeli, atau nomor referensi. */
  cari: z.string().trim().max(100).optional(),
});
export type ParamCariNonTunai = z.input<typeof skemaCariNonTunai>;

export type BarisNonTunai = {
  id: number;
  /** Nomor pembayaran (BYR-…). */
  nomor: string;
  tanggal: string;
  tanggalOperasional: string;
  idPenjualan: number;
  nomorPenjualan: string;
  namaPembeli: string | null;
  metode: MetodePembayaran;
  rekening: string | null;
  referensi: string | null;
  nominal: number;
  namaKasir: string;
  statusVerifikasi: StatusVerifikasi;
  catatanVerifikasi: string | null;
  namaPemeriksa: string | null;
  diverifikasiPada: string | null;
};

export type DaftarNonTunai = {
  data: BarisNonTunai[];
  meta: MetaHalaman;
  /** Jumlah dan total per rekening untuk saringan yang sama: angka yang dicocokkan dengan mutasi. */
  ringkasan: { rekening: string; jumlah: number; total: number }[];
};
