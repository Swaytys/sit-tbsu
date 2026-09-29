import { eq } from 'drizzle-orm';
import { db, type Executor, type Tx } from '../../../db/client';
import { konfigurasi } from '../../../db/schema';

export function semuaKonfigurasi(ex: Executor = db) {
  return ex
    .select({ kode: konfigurasi.kode, nilai: konfigurasi.nilai, tipe: konfigurasi.tipe })
    .from(konfigurasi);
}

export async function ubahNilai(tx: Tx, kode: string, nilai: string, waktu: Date): Promise<void> {
  await tx.update(konfigurasi).set({ nilai, diubahPada: waktu }).where(eq(konfigurasi.kode, kode));
}
