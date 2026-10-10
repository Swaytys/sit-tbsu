import { POLA_QTY } from '@sit/shared';

/*
 * Isian qty di form. Qty tetap teks desimal dari ketikan sampai ke API (CLAUDE.md aturan 8); di sini hanya
 * diperiksa bentuknya, tanpa aritmatika `number`. Aturan sahnya sama dengan skema Zod (`POLA_QTY`).
 */

/** Teks qty bertitik yang sah dan lebih dari nol, mis. `"2"`, `"0.5"`; `"0"` dan `"2,5"` tidak. */
export function qtySah(q: string): boolean {
  return POLA_QTY.test(q) && /[1-9]/.test(q);
}

/**
 * Isian qty dari kolom form (koma desimal boleh) → teks qty bertitik, atau `null` bila bukan angka qty.
 * Nol tetap sah: dipakai stok opname, tempat "0" berarti barangnya habis.
 */
export function qtyDariIsian(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim().replace(',', '.') : '';
  return POLA_QTY.test(t) ? t : null;
}
