import type { Satuan } from '@sit/shared';
import * as repo from './repo';

/** Daftar satuan untuk halaman master dan pilihan satuan di form. */
export async function daftarSatuan(): Promise<Satuan[]> {
  return repo.semuaSatuan();
}
