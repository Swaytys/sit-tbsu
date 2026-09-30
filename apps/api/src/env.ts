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
});

const hasil = skemaEnv.safeParse(process.env);
if (!hasil.success) {
  throw new Error(`Konfigurasi .env tidak valid:\n${z.prettifyError(hasil.error)}`);
}

/** Variabel lingkungan yang sudah divalidasi. */
export const env = hasil.data;
