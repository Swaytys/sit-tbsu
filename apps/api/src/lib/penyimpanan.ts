import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';
import { AppError } from './errors';
import { logger } from './logger';

/*
 * Berkas unggahan di folder `STORAGE_DIR` (tidak di-commit). Nama berkas selalu dibuat server (acak),
 * tidak pernah dari nama kiriman pengguna, sehingga tidak ada path traversal.
 */

export const UKURAN_GAMBAR_MAKS = 2 * 1024 * 1024;

const TIPE_GAMBAR = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;
type EkstensiGambar = keyof typeof TIPE_GAMBAR;

/** Jenis gambar dari tanda tangan byte awal berkas (bukan dari nama/tipe kiriman browser). */
export function deteksiGambar(isi: Uint8Array): EkstensiGambar | null {
  const cocok = (awal: number, byte: number[]) => byte.every((b, i) => isi[awal + i] === b);
  if (cocok(0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (cocok(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (cocok(0, [0x52, 0x49, 0x46, 0x46]) && cocok(8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
  return null;
}

const POLA_NAMA = /^[a-z0-9-]+\.(jpg|png|webp)$/;

function jalur(folder: string, nama: string): string {
  if (!POLA_NAMA.test(nama)) throw new Error(`Nama berkas tidak valid: ${nama}`);
  return path.join(env.STORAGE_DIR, folder, nama);
}

/** Memeriksa lalu menyimpan gambar; mengembalikan nama berkas baru, mis. `12-a1b2c3d4e5f6.webp`. */
export async function simpanGambar(
  folder: string,
  awalan: string,
  isi: Uint8Array,
): Promise<string> {
  if (isi.byteLength > UKURAN_GAMBAR_MAKS) {
    throw new AppError('VALIDASI', 'Ukuran gambar maksimal 2 MB.', 400);
  }
  const ekstensi = deteksiGambar(isi);
  if (!ekstensi) throw new AppError('VALIDASI', 'Gambar harus berformat JPG, PNG, atau WebP.', 400);
  const nama = `${awalan}-${randomBytes(6).toString('hex')}.${ekstensi}`;
  await mkdir(path.join(env.STORAGE_DIR, folder), { recursive: true });
  await writeFile(jalur(folder, nama), isi);
  return nama;
}

export async function bacaGambar(
  folder: string,
  nama: string,
): Promise<{ isi: Buffer; tipe: string } | null> {
  try {
    const ekstensi = path.extname(nama).slice(1) as EkstensiGambar;
    return { isi: await readFile(jalur(folder, nama)), tipe: TIPE_GAMBAR[ekstensi] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Menghapus berkas lama setelah diganti; kegagalan hanya dicatat (data di DB sudah benar). */
export async function hapusBerkas(folder: string, nama: string | null): Promise<void> {
  if (!nama) return;
  try {
    await rm(jalur(folder, nama), { force: true });
  } catch (err) {
    logger.warn({ err, folder, nama }, 'gagal menghapus berkas lama');
  }
}
