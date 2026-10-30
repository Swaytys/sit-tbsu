import { totalPecahan, type DataHitungKas } from '@sit/shared';

/** Isian hitung uang laci: per pecahan (sistem menjumlah) atau total langsung (K-121). */
export type NilaiHitung = {
  mode: 'PECAHAN' | 'TOTAL';
  total: number | null;
  rincian: Record<string, number>;
};

export const HITUNG_KOSONG: NilaiHitung = { mode: 'PECAHAN', total: null, rincian: {} };

/** Total rupiah isian; `null` bila belum diisi sama sekali. */
export function totalHitung(n: NilaiHitung): number | null {
  if (n.mode === 'TOTAL') return n.total;
  const isi = Object.values(n.rincian).some((x) => x > 0);
  return isi ? totalPecahan(n.rincian) : null;
}

/** Bentuk yang dikirim ke API. */
export function keJsonHitung(n: NilaiHitung, akuiMenggantung = false): DataHitungKas {
  if (n.mode === 'TOTAL') return { uangFisik: n.total ?? 0, akuiMenggantung };
  return {
    rincian: Object.fromEntries(Object.entries(n.rincian).filter(([, x]) => x > 0)),
    akuiMenggantung,
  };
}
