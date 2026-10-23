import Decimal from 'decimal.js';

/*
 * K-161: satuan isian data muatan. Disimpan dalam kg, cm, dan m³ (docs/13 §2.1); form boleh memakai satuan lain
 * yang sejenis. Faktor = berapa satuan simpan dalam satu satuan isian.
 */

export const SATUAN_BERAT = { kg: '1', g: '0.001', ton: '1000' } as const;
export const SATUAN_PANJANG = { cm: '1', mm: '0.1', dm: '10', m: '100' } as const;
export const SATUAN_VOLUME = { m3: '1', L: '0.001' } as const;

/**
 * Angka isian (boleh koma) dalam satuan berfaktor `faktor` → teks dalam satuan simpan, tanpa nol berlebih.
 * Isian kosong → `null`; isian bukan angka dikembalikan apa adanya agar validasi skema menampilkan pesannya.
 */
export function keSatuanSimpan(isian: string, faktor: string): string | null {
  const t = isian.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return isian;
  return new Decimal(t).times(faktor).toDecimalPlaces(4).toString();
}

/** Kebalikan `keSatuanSimpan` untuk menampilkan nilai simpan dalam satuan isian. */
export function dariSatuanSimpan(nilai: string | null, faktor: string): string {
  if (nilai === null || nilai === '') return '';
  return new Decimal(nilai).dividedBy(faktor).toDecimalPlaces(4).toString().replace('.', ',');
}
