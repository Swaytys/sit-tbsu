import { z } from 'zod';
import type { StatusTutupTahun } from '../enums';

/*
 * K-165: tutup tahun dan arsip tahunan (docs/05 §18). Data tetap di database; tahun yang ditutup dikunci dan
 * diekspor utuh ke berkas arsip.
 */

export const skemaTahunParam = z.object({
  tahun: z.coerce.number().int().min(2000, 'Tahun tidak valid.').max(2999, 'Tahun tidak valid.'),
});

export const skemaBukaTahun = z.object({
  alasan: z.string().trim().min(10, 'Tulis alasan membuka kembali (min. 10 huruf).').max(255),
});

/** Jumlah baris per tabel dan angka utama satu tahun. */
export type RingkasanArsip = {
  tabel: Record<string, number>;
  penjualan: { jumlah: number; totalNeto: number; void: number; retur: number };
  penerimaan: { jumlah: number; total: number };
  /** Nota tahun itu yang belum lunas saat ditutup (pelunasannya dicatat di tahun berjalan). */
  piutangTerbuka: { jumlah: number; sisa: number };
};

export type TahunArsip = {
  tahun: number;
  /** `null` = belum pernah ditutup. */
  status: StatusTutupTahun | null;
  /** Hal yang harus diselesaikan dulu sebelum tahun bisa ditutup. */
  penghalang: string[];
  /** Ringkasan sekarang (belum ditutup) atau saat ditutup. */
  ringkasan: RingkasanArsip;
  berkas: string | null;
  ukuran: number | null;
  sha256: string | null;
  ditutupPada: string | null;
  ditutupOleh: string | null;
  dibukaPada: string | null;
  alasanBuka: string | null;
};

export type HasilPeriksaArsip = {
  tahun: number;
  berkasAda: boolean;
  checksumCocok: boolean;
  /** Tabel yang jumlah barisnya di database berbeda dari berkas. */
  selisih: { tabel: string; berkas: number; database: number }[];
};
