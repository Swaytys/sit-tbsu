import { DAFTAR_AKSI_PINTASAN, TOMBOL_PINTASAN, type PintasanPengguna } from '@sit/shared';
import { db } from '../../db/client';
import * as repo from './repo';

/*
 * K-145: tombol pintasan per pengguna. Preferensi tampilan (seperti status tur), bukan data bisnis, sehingga tidak
 * dicatat di log aktivitas. Isian lama yang tidak dikenal lagi dibuang saat dibaca.
 */

export async function bacaPintasan(idPengguna: number): Promise<PintasanPengguna> {
  const mentah = await repo.pintasanPengguna(db, idPengguna);
  const hasil: PintasanPengguna = {};
  for (const a of DAFTAR_AKSI_PINTASAN) {
    const k = mentah[a];
    if (k && (TOMBOL_PINTASAN as readonly string[]).includes(k)) {
      hasil[a] = k as (typeof TOMBOL_PINTASAN)[number];
    }
  }
  return hasil;
}

export async function simpanPintasan(
  idPengguna: number,
  pintasan: PintasanPengguna,
): Promise<PintasanPengguna> {
  await repo.simpanPintasan(db, idPengguna, pintasan);
  return bacaPintasan(idPengguna);
}
