import type { Kendaraan } from '@sit/shared';

/** Teks pendek untuk daftar pilihan kendaraan, mis. " · KIR habis". */
export function tandaSurat(k: Kendaraan): string {
  const habis = [
    k.kesehatan.stnk === 'LEWAT' ? 'STNK habis' : null,
    k.kesehatan.kir === 'LEWAT' ? 'KIR habis' : null,
  ].filter(Boolean);
  return habis.length > 0 ? ` · ${habis.join(', ')}` : '';
}
