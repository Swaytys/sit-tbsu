import Decimal from 'decimal.js';

/*
 * Uang = integer rupiah (CLAUDE.md aturan 7, docs/05 §1). Semua hitungan yang melibatkan pecahan
 * (persen, qty desimal) memakai Decimal lalu dibulatkan ke rupiah utuh. Tidak ada float.
 */

/** Batas aman nilai rupiah di JavaScript (≈ 9 kuadriliun). */
export const RUPIAH_MAKS = Number.MAX_SAFE_INTEGER;

export type NilaiDesimal = Decimal.Value;

function keRupiah(d: Decimal): number {
  const n = d.toNumber();
  if (!Number.isSafeInteger(n))
    throw new RangeError(`Nilai rupiah di luar batas aman: ${d.toString()}`);
  return n === 0 ? 0 : n; // hindari -0
}

/** U1: pembulatan ke rupiah terdekat, setengah ke atas (ROUND_HALF_UP). */
export function bulatkanRupiah(nilai: NilaiDesimal): number {
  return keRupiah(new Decimal(nilai).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
}

/** U4: persen → rupiah = bulatkanRupiah(dasar × persen ÷ 100). */
export function persenKeRupiah(dasar: number, persen: NilaiDesimal): number {
  return bulatkanRupiah(new Decimal(dasar).times(persen).div(100));
}

/**
 * H4: harga dibulatkan KE ATAS ke kelipatan `kelipatan` (konfigurasi.pembulatan_harga, default 100).
 * Contoh: 12.340 dengan kelipatan 100 → 12.400.
 */
export function bulatkanHarga(nilai: NilaiDesimal, kelipatan: number): number {
  if (!Number.isSafeInteger(kelipatan) || kelipatan < 1) {
    throw new RangeError(`Kelipatan pembulatan tidak valid: ${kelipatan}`);
  }
  return keRupiah(new Decimal(nilai).div(kelipatan).ceil().times(kelipatan));
}

/** H4: harga hasil markup = bulatkanHarga(dasar × (1 + persen/100)). */
export function hargaMarkup(dasar: number, persen: NilaiDesimal, kelipatan: number): number {
  return bulatkanHarga(new Decimal(dasar).times(new Decimal(persen).div(100).plus(1)), kelipatan);
}

/** `1234567` → `Rp 1.234.567`; negatif → `-Rp 1.234`. */
export function formatRupiah(nilai: number): string {
  const teks = Math.abs(nilai)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${nilai < 0 ? '-' : ''}Rp ${teks}`;
}

/** Persen numeric(6,2) sebagai teks 2 desimal, mis. `"12.5"` → `"12.50"`. */
export function keTeksPersen(nilai: NilaiDesimal): string {
  return new Decimal(nilai).toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * L4: HPP rata-rata tertimbang = bulatkanRupiah((qtyLama × hppLama + qtyMasuk × hppMasuk) ÷ (qtyLama + qtyMasuk)).
 * Qty dalam teks desimal (numeric), HPP rupiah per satuan dasar.
 */
export function hppRataRata(
  qtyLama: NilaiDesimal,
  hppLama: number,
  qtyMasuk: NilaiDesimal,
  hppMasuk: number,
): number {
  const total = new Decimal(qtyLama).plus(qtyMasuk);
  if (total.lessThanOrEqualTo(0)) throw new RangeError('Jumlah qty untuk HPP harus > 0');
  const nilai = new Decimal(qtyLama).times(hppLama).plus(new Decimal(qtyMasuk).times(hppMasuk));
  return bulatkanRupiah(nilai.div(total));
}

/** U1/E1: subtotal = bulatkanRupiah(qty × harga satuan); qty teks desimal, harga rupiah. */
export function subtotalRupiah(qty: NilaiDesimal, hargaSatuan: number): number {
  return bulatkanRupiah(new Decimal(qty).times(hargaSatuan));
}

/** T2: harga satuan efektif = bulatkanRupiah(subtotal baris ÷ qty) (sudah bersih diskon baris). */
export function hargaSatuanEfektif(subtotal: number, qty: NilaiDesimal): number {
  const q = new Decimal(qty);
  if (q.lessThanOrEqualTo(0)) throw new RangeError('Qty untuk harga efektif harus > 0');
  return bulatkanRupiah(new Decimal(subtotal).div(q));
}

/** Persentase `bagian ÷ total × 100`, dua desimal (tampilan laporan); `null` bila total 0. */
export function persenDari(bagian: number, total: number): number | null {
  if (total === 0) return null;
  return new Decimal(bagian)
    .times(100)
    .div(total)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}
