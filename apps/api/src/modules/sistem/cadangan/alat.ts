import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import path from 'node:path';

/*
 * Menjalankan program luar (pg_dump, pg_restore, restic) untuk cadangan (K-084). Kata sandi hanya lewat
 * variabel lingkungan anak proses (PGPASSWORD, RESTIC_PASSWORD), tidak lewat argumen baris perintah.
 */

export type HasilProses = { kode: number; keluaran: string; galat: string };

export class GalatProses extends Error {
  constructor(
    readonly program: string,
    readonly hasil: HasilProses,
  ) {
    super(
      `${path.basename(program)} gagal (kode ${hasil.kode}): ${ringkas(hasil.galat || hasil.keluaran)}`,
    );
  }
}

/** Teks galat program dipendekkan untuk disimpan di riwayat. */
export function ringkas(teks: string, maks = 400): string {
  const t = teks.replace(/\s+/g, ' ').trim();
  return t.length > maks ? `${t.slice(0, maks)}…` : t;
}

const BATAS_TAMPUNG = 2 * 1024 * 1024;

export function jalankan(
  program: string,
  argumen: string[],
  opsi: { env?: Record<string, string>; batasMs?: number; keBerkas?: string } = {},
): Promise<HasilProses> {
  return new Promise((selesai, gagal) => {
    const anak = spawn(program, argumen, {
      env: { ...process.env, ...opsi.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let keluaran = '';
    let galat = '';
    const berkas = opsi.keBerkas ? createWriteStream(opsi.keBerkas) : null;
    if (berkas) anak.stdout.pipe(berkas);
    else {
      anak.stdout.on('data', (d: Buffer) => {
        if (keluaran.length < BATAS_TAMPUNG) keluaran += d.toString('utf8');
      });
    }
    anak.stderr.on('data', (d: Buffer) => {
      galat = (galat + d.toString('utf8')).slice(-8000);
    });
    const waktu = opsi.batasMs
      ? setTimeout(() => {
          galat += `\nDihentikan: melebihi batas waktu ${Math.round(opsi.batasMs! / 60000)} menit.`;
          anak.kill();
        }, opsi.batasMs)
      : null;
    anak.on('error', (err: NodeJS.ErrnoException) => {
      if (waktu) clearTimeout(waktu);
      gagal(
        err.code === 'ENOENT'
          ? new Error(`Program ${program} tidak ditemukan. Periksa pemasangan dan isian .env.`)
          : err,
      );
    });
    anak.on('close', (kode) => {
      if (waktu) clearTimeout(waktu);
      const akhiri = () => selesai({ kode: kode ?? -1, keluaran, galat });
      if (berkas) berkas.end(akhiri);
      else akhiri();
    });
  });
}

/** Seperti `jalankan`, tetapi melempar GalatProses bila kode keluar bukan 0. */
export async function wajib(
  program: string,
  argumen: string[],
  opsi: Parameters<typeof jalankan>[2] = {},
): Promise<HasilProses> {
  const h = await jalankan(program, argumen, opsi);
  if (h.kode !== 0) throw new GalatProses(program, h);
  return h;
}
