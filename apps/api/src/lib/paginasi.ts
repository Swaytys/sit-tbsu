import type { MetaHalaman } from '@sit/shared';

/** LIMIT/OFFSET dari parameter halaman (halaman mulai 1). */
export function batasHalaman(p: { halaman: number; perHalaman: number }) {
  return { limit: p.perHalaman, offset: (p.halaman - 1) * p.perHalaman };
}

export function metaHalaman(
  total: number,
  p: { halaman: number; perHalaman: number },
): MetaHalaman {
  return { total, halaman: p.halaman, perHalaman: p.perHalaman };
}

/**
 * Pola ILIKE `%teks%` dengan karakter khusus (`%`, `_`, `\`) diloloskan, sehingga input pengguna selalu
 * dicari apa adanya. Nilainya tetap dikirim sebagai parameter terikat, bukan dirakit ke SQL.
 */
export function polaCari(teks: string): string {
  return `%${teks.replace(/[\\%_]/g, (k) => `\\${k}`)}%`;
}
