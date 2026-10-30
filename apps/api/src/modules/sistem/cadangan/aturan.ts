import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../../env';
import { AppError } from '../../../lib/errors';
import { jalankan } from './alat';

/*
 * K-198: folder dan sandi cadangan diatur Owner dari Pengaturan › Cadangan (bukan berkas .env). Disimpan di berkas
 * `STORAGE_DIR/sistem/cadangan.json` di komputer server: bukan di database (sandi tidak ikut dump), dan tidak bisa
 * dibaca lewat web (folder unggahan hanya melayani gambar bernama acak). Berkas ini ikut cadangan, yang terenkripsi
 * dengan sandi yang sama. Bila berkas ada, isinya dipakai; bila tidak, nilai .env (pemasangan lama) tetap berlaku.
 */

export type AturanBerkas = { repoLokal: string; sandi: string; repoCloud: string | null };

export function berkasAturan(): string {
  return path.join(env.STORAGE_DIR, 'sistem', 'cadangan.json');
}

export function bacaAturan(): AturanBerkas | null {
  const f = berkasAturan();
  if (!existsSync(f)) return null;
  try {
    const isi = JSON.parse(readFileSync(f, 'utf8')) as Partial<AturanBerkas>;
    if (typeof isi.repoLokal !== 'string' || typeof isi.sandi !== 'string') return null;
    return {
      repoLokal: isi.repoLokal,
      sandi: isi.sandi,
      repoCloud: typeof isi.repoCloud === 'string' ? isi.repoCloud : null,
    };
  } catch {
    return null;
  }
}

/** Huruf drive (Windows) atau akar jalur, untuk memperingatkan cadangan di disk yang sama dengan data. */
export function akarDisk(p: string): string {
  return path.parse(path.resolve(p)).root.toLowerCase();
}

/** Program restic bisa dijalankan? */
export async function programAda(restic: string): Promise<boolean> {
  try {
    const h = await jalankan(restic, ['version'], { batasMs: 15_000 });
    return h.kode === 0;
  } catch {
    return false;
  }
}

/**
 * Periksa lalu simpan aturan: folder harus jalur lengkap dan bisa ditulisi; bila folder sudah berisi repositori
 * cadangan, sandinya harus bisa membukanya (supaya cadangan lama tidak "hilang" karena sandi berbeda).
 */
export async function simpanAturan(a: AturanBerkas, restic: string): Promise<void> {
  if (!path.isAbsolute(a.repoLokal)) {
    throw new AppError(
      'VALIDASI',
      'Tulis lokasi folder lengkap, mis. E:\\BonsaiUrip-cadangan.',
      400,
      {
        kolom: { repoLokal: ['Jalur folder lengkap, diawali huruf drive.'] },
      },
    );
  }
  try {
    await mkdir(a.repoLokal, { recursive: true });
    const uji = path.join(a.repoLokal, `.uji-tulis-${Date.now()}`);
    await writeFile(uji, 'ok');
    await rm(uji);
  } catch {
    throw new AppError(
      'VALIDASI',
      `Folder ${a.repoLokal} tidak bisa dibuat atau ditulisi. Periksa disk/flashdisk sudah terpasang.`,
      400,
      { kolom: { repoLokal: ['Tidak bisa ditulisi.'] } },
    );
  }
  if (existsSync(path.join(a.repoLokal, 'config')) && (await programAda(restic))) {
    const h = await jalankan(restic, ['-r', a.repoLokal, 'cat', 'config'], {
      env: { RESTIC_PASSWORD: a.sandi },
      batasMs: 60_000,
    });
    if (h.kode !== 0) {
      throw new AppError(
        'VALIDASI',
        'Folder ini sudah berisi cadangan dengan sandi lain. Pakai sandi lama, atau pilih folder kosong.',
        400,
        { kolom: { sandi: ['Tidak cocok dengan cadangan yang ada.'] } },
      );
    }
  }
  await mkdir(path.dirname(berkasAturan()), { recursive: true });
  await writeFile(berkasAturan(), JSON.stringify(a, null, 2), { encoding: 'utf8', mode: 0o600 });
}
