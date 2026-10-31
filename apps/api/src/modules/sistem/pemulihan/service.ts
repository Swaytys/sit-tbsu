import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import type { MatiMendadak } from '@sit/shared';
import { db } from '../../../db/client';
import { env } from '../../../env';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { catatLog } from '../log-aktivitas';

/*
 * K-216: peluncur desktop mencatat bila aplikasi sebelumnya mati mendadak (listrik/komputer mati) saat shift
 * terbuka. Layar pemulihan membaca catatan ini sampai pengguna menyatakan sudah memeriksa.
 */

export async function bacaMatiMendadak(): Promise<MatiMendadak | null> {
  const berkas = env.MATI_MENDADAK_FILE;
  if (!berkas || !existsSync(berkas)) return null;
  try {
    const o = JSON.parse(await readFile(berkas, 'utf8')) as Partial<MatiMendadak>;
    return {
      terdeteksi: o.terdeteksi ?? new Date().toISOString(),
      terakhirHidup: o.terakhirHidup ?? null,
      shift: o.shift ?? null,
    };
  } catch {
    return null;
  }
}

export async function selesaiPeriksa(pelaku: PenggunaAktif, asal: AsalRequest): Promise<void> {
  const m = await bacaMatiMendadak();
  if (!m || !env.MATI_MENDADAK_FILE) return;
  await rm(env.MATI_MENDADAK_FILE, { force: true });
  await catatLog(db, {
    aksi: 'SISTEM_PEMULIHAN',
    idPengguna: pelaku.id,
    entitas: 'shift_kasir',
    ringkasan: `Pemeriksaan setelah aplikasi mati mendadak${m.shift ? ` (shift ${m.shift})` : ''} dinyatakan selesai`,
    ip: asal.ip,
  });
}
