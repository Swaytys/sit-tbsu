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

/** `a ÷ b` dibulatkan 3 desimal (konversi qty dasar → satuan jual, K-091). */
export function bagiQty(a: Decimal.Value, b: Decimal.Value): string {
  return keQty(new Decimal(a).div(b));
}

/** Faktor satuan jual ke satuan dasar dari faktor ke basis masing-masing (dimensi fisik sama), 4 desimal. */
export function faktorSatuan(faktorJual: Decimal.Value, faktorDasar: Decimal.Value): string {
  return new Decimal(faktorJual)
    .div(faktorDasar)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed();
}

/** Teks desimal tanpa nol di belakang: `"12.0000"` → `"12"`, `"0.2500"` → `"0.25"`. */
export function rapikanDesimal(nilai: Decimal.Value): string {
  return new Decimal(nilai).toFixed();
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

/**
 * Qty (teks numeric) untuk dibaca orang: `"1250.500"` → `"1.250,5"`, `"10.000"` → `"10"`.
 * Diolah sebagai teks, tanpa float.
 */
export function teksQty(nilai: string): string {
  const negatif = nilai.startsWith('-');
  const [bulat = '0', pecahan = ''] = (negatif ? nilai.slice(1) : nilai).split('.');
  const ringkas = pecahan.replace(/0+$/, '');
  const bertitik = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negatif ? '-' : ''}${ringkas ? `${bertitik},${ringkas}` : bertitik}`;
}
