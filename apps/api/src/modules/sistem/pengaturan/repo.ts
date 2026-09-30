import { sql } from 'drizzle-orm';
import type { TipeKonfigurasi } from '@sit/shared';
import type { Tx } from '../../../db/client';
import { konfigurasi } from '../../../db/schema';

/** Menyimpan satu nilai konfigurasi; baris yang belum ada dibuat (mis. kunci baru setelah seed lama). */
export async function simpanKonfigurasi(
  tx: Tx,
  nilai: { kode: string; nilai: string; tipe: TipeKonfigurasi },
  waktu: Date,
): Promise<void> {
  await tx
    .insert(konfigurasi)
    .values(nilai)
    .onConflictDoUpdate({
      target: konfigurasi.kode,
      set: { nilai: sql`excluded.nilai`, diubahPada: waktu },
    });
}
