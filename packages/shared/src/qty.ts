import Decimal from 'decimal.js';
import { JENIS_DIMENSI_FISIK, type JenisDimensi } from './enums';

/*
 * Kuantitas = numeric(14,3) di DB, string di TS (CLAUDE.md aturan 8, docs/05 U2). Semua aritmatika qty
 * lewat berkas ini (decimal.js). Nilai kembali selalu string 3 desimal, siap disimpan.
 */

export const DESIMAL_QTY = 3;
/** numeric(14,3): paling banyak 11 digit di depan koma. */
const QTY_MAKS = new Decimal('99999999999.999');

function qtyValid(d: Decimal): Decimal {
  if (!d.isFinite()) throw new RangeError('Kuantitas tidak valid');
  if (d.abs().greaterThan(QTY_MAKS))
    throw new RangeError(`Kuantitas terlalu besar: ${d.toString()}`);
  return d;
}

/** Mengubah nilai ke string qty 3 desimal (ROUND_HALF_UP), mis. `"2.5"` → `"2.500"`. */
export function keQty(nilai: Decimal.Value): string {
  return qtyValid(new Decimal(nilai)).toFixed(DESIMAL_QTY, Decimal.ROUND_HALF_UP);
}

export function tambahQty(a: Decimal.Value, b: Decimal.Value): string {
  return keQty(new Decimal(a).plus(b));
}

export function kurangQty(a: Decimal.Value, b: Decimal.Value): string {
  return keQty(new Decimal(a).minus(b));
}

export function kaliQty(a: Decimal.Value, b: Decimal.Value): string {
  return keQty(new Decimal(a).times(b));
}

/** -1, 0, 1 seperti `a < b`, `a = b`, `a > b`. */
export function bandingQty(a: Decimal.Value, b: Decimal.Value): number {
  return new Decimal(a).comparedTo(b);
}

/** Pola teks qty dari input pengguna: angka ≥ 0 dengan paling banyak 3 desimal (titik sebagai pemisah). */
export const POLA_QTY = /^\d{1,11}(\.\d{1,3})?$/;

type SatuanKonversi = { kode: string; jenisDimensi: JenisDimensi; faktorKeBasis: string };

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

/**
 * Konversi qty antar-satuan (K-014): hanya sesama dimensi fisik (PANJANG, LUAS, VOLUME, BERAT, DAYA).
 * Satuan hitung (JUMLAH/LAINNYA) tidak dikonversi lewat master satuan; konversinya per barang.
 * `qty × faktor_asal ÷ faktor_tujuan`, dibulatkan ke 3 desimal.
 */
export function konversiQty(qty: Decimal.Value, dari: SatuanKonversi, ke: SatuanKonversi): string {
  if (dari.kode === ke.kode) return keQty(qty);
  if (dari.jenisDimensi !== ke.jenisDimensi) {
    throw new RangeError(
      `Satuan ${dari.kode} dan ${ke.kode} berbeda dimensi; tidak bisa dikonversi.`,
    );
  }
  if (!DIMENSI_FISIK.includes(dari.jenisDimensi)) {
    throw new RangeError(
      `Satuan hitung (${dari.kode}, ${ke.kode}) tidak dikonversi lewat master satuan; atur per barang.`,
    );
  }
  return keQty(new Decimal(qty).times(dari.faktorKeBasis).div(ke.faktorKeBasis));
}
