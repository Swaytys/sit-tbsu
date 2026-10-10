import { AppError } from './errors';

/*
 * Pembatas laju sederhana di memori (satu server; cukup untuk skala toko). Dipakai untuk percobaan yang
 * memeriksa password: login per IP (docs/04 §7) dan persetujuan di tempat per pengaju (docs/04 §6).
 * Pemeriksaan password argon2id sengaja mahal, jadi tanpa batas laju satu klien bisa menghabiskan CPU server
 * dan menebak password tanpa henti. Catatan hilang saat server dinyalakan ulang; penguncian akun
 * (tersimpan di database) tetap berlaku.
 */

export type OpsiBatas = { maks: number; jendelaDetik: number };

const catatan = new Map<string, number[]>();
const BATAS_ENTRI = 10_000;

/** Mencatat satu percobaan untuk `kunci`; melempar 429 bila jendela waktunya sudah penuh. */
export function catatPercobaan(kunci: string, opsi: OpsiBatas): void {
  const kini = Date.now();
  const jendelaMs = opsi.jendelaDetik * 1000;
  const baru = (catatan.get(kunci) ?? []).filter((t) => kini - t < jendelaMs);
  if (baru.length >= opsi.maks) {
    throw new AppError(
      'TERLALU_BANYAK_PERCOBAAN',
      'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
      429,
    );
  }
  baru.push(kini);
  if (catatan.size >= BATAS_ENTRI) catatan.clear();
  catatan.set(kunci, baru);
}

/** Untuk tes: kosongkan catatan percobaan. */
export function resetBatasPercobaan(): void {
  catatan.clear();
}
