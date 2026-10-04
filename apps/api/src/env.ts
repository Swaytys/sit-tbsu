import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { muatEnvFile } from './lib/env-file';

muatEnvFile();

// Server selalu berjalan dalam UTC; konversi ke Asia/Jakarta hanya saat tampil (K-042).
process.env.TZ = 'UTC';

const skemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi di .env'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Sesi login (docs/04 §7).
  SESSION_IDLE_MENIT: z.coerce.number().int().positive().default(60),
  SESSION_ABSOLUT_JAM: z.coerce.number().int().positive().default(12),
  // Folder berkas unggahan (gambar barang). Bawaan: storage/ di root repo (tidak di-commit).
  STORAGE_DIR: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL('../../../storage', import.meta.url))),
  // --- Produksi (Fase 8, K-082) ---
  // Hasil build web yang disajikan API di produksi (satu port untuk API + aplikasi).
  WEB_DIST: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL('../../web/dist', import.meta.url))),
  // HTTPS: sertifikat .pfx buatan scripts/server/buat-sertifikat.ps1 (cookie Secure butuh HTTPS).
  HTTPS_PFX: z.string().min(1).optional(),
  HTTPS_PFX_PASSWORD: z.string().optional(),
  // Port HTTP yang hanya mengalihkan ke HTTPS (mis. 80). Kosong = tidak ada.
  PORT_HTTP_ALIH: z.coerce.number().int().positive().optional(),
  // Log ke berkas (diputar saat server menyala bila > 10 MB, simpan 5 berkas lama). Kosong = stdout.
  LOG_FILE: z.string().min(1).optional(),
  // Origin lain yang sah untuk permintaan POST/PATCH/DELETE (CSRF), dipisah koma; mis. alamat Tailscale
  // https://server-toko.tailxxxx.ts.net:8443 saat diakses lewat proxy `tailscale serve`.
  // --- Cadangan data (K-084): restic + pg_dump. Repositori lokal kosong = cadangan belum diatur. ---
  CADANGAN_REPO_LOKAL: z.string().min(1).optional(),
  // Repositori cloud restic, mis. rclone:gdrive:BonsaiUrip-cadangan (butuh rclone terkonfigurasi).
  CADANGAN_REPO_CLOUD: z.string().min(1).optional(),
  // Kata sandi enkripsi repositori restic. HILANG = cadangan tidak bisa dibuka; simpan juga di tempat aman.
  CADANGAN_SANDI: z.string().min(8, 'CADANGAN_SANDI minimal 8 karakter').optional(),
  CADANGAN_RESTIC: z.string().min(1).default('restic'),
  CADANGAN_RCLONE: z.string().min(1).optional(),
  // Folder bin PostgreSQL (pg_dump, pg_restore); kosong = dicari di PATH.
  CADANGAN_PG_BIN: z.string().min(1).optional(),
  // Jam cadangan harian (WIB, 0-23).
  CADANGAN_JAM: z.coerce.number().int().min(0).max(23).default(21),
  ORIGIN_TAMBAHAN: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((x) => x.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
});

const hasil = skemaEnv.safeParse(process.env);
if (!hasil.success) {
  throw new Error(`Konfigurasi .env tidak valid:\n${z.prettifyError(hasil.error)}`);
}

/** Variabel lingkungan yang sudah divalidasi. */
export const env = hasil.data;
