import { eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Executor } from '../db/client';
import { AppError } from './errors';

/*
 * K-164: cek versi data master. Versi = waktu perubahan terakhir (atau waktu dibuat). Form mengirim versi yang
 * ia muat; bila baris sudah berubah sejak itu, simpanan ditolak agar perubahan orang lain tidak tertimpa diam-diam.
 */

type KolomVersi = { id: PgColumn; diubahPada: PgColumn; dibuatPada: PgColumn };

/** Versi baris dalam teks ISO; `null` bila baris tidak ada. Dipanggil sesudah baris dikunci. */
export async function ambilVersi(
  ex: Executor,
  tabel: PgTable & KolomVersi,
  id: number,
): Promise<string | null> {
  const [b] = await ex
    .select({ diubah: tabel.diubahPada, dibuat: tabel.dibuatPada })
    .from(tabel)
    .where(eq(tabel.id, id))
    .limit(1);
  if (!b) return null;
  const w = (b.diubah ?? b.dibuat) as Date;
  return w.toISOString();
}

/** Tolak bila versi yang dikirim form berbeda dari versi baris sekarang. Tanpa versi (klien lama): tidak dicek. */
export function pastikanVersi(
  dikirim: string | null | undefined,
  kini: string | null,
  nama: string,
) {
  if (!dikirim || kini === null || dikirim === kini) return;
  throw new AppError(
    'KONFLIK',
    `${nama} sudah diubah orang lain sejak Anda membukanya. Muat ulang halaman agar data terbaru tampil, lalu ` +
      'ulangi perubahan Anda.',
    409,
    { versiBaru: kini },
  );
}
