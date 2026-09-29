import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Memuat `.env` di root repo (dicari naik dari folder kerja, karena skrip pnpm berjalan di
 * apps/api). Variabel yang sudah ada di lingkungan tidak ditimpa, sehingga produksi dan tes
 * bisa mengisi nilai sendiri.
 */
export function muatEnvFile(): void {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const berkas = path.join(dir, '.env');
    if (existsSync(berkas)) {
      process.loadEnvFile(berkas);
      return;
    }
    const induk = path.dirname(dir);
    if (induk === dir) return;
    dir = induk;
  }
}

/** Nama database dari URL koneksi, mis. `tbsu_test`. */
export function namaDatabase(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}
