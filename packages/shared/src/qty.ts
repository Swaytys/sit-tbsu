import Decimal from 'decimal.js';
import { GalatAngka } from './angka';
import { JENIS_DIMENSI_FISIK, type JenisDimensi } from './enums';

/*
 * Kuantitas = numeric(14,3) di DB, string di TS (CLAUDE.md aturan 8, docs/05 U2). Semua aritmatika qty
 * lewat berkas ini (decimal.js). Nilai kembali selalu string 3 desimal, siap disimpan.
 */

export const DESIMAL_QTY = 3;
/** numeric(14,3): paling banyak 11 digit di depan koma. */
const QTY_MAKS = new Decimal('99999999999.999');

function qtyValid(d: Decimal): Decimal {
  if (!d.isFinite()) throw new GalatAngka('Kuantitas tidak valid');
  if (d.abs().greaterThan(QTY_MAKS))
    throw new GalatAngka(`Kuantitas terlalu besar: ${d.toString()}`);
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

/** Dibulatkan ke atas ke bilangan bulat, mis. `"55.2"` → `"56.000"` (saran pesan, K-113 RO5). */
export function bulatAtasQty(a: Decimal.Value): string {
  return keQty(new Decimal(a).ceil());
}

/**
 * K-227: jumlah dari hasil timbang (timbangan hitung): berat bersih × jumlah sampel ÷ berat sampel. Satuan yang
 * dihitung per buah (`bulat`) dibulatkan ke bilangan bulat terdekat; satuan lain 3 desimal.
 */
export function qtyDariTimbang(
  beratGram: Decimal.Value,
  jumlahSampel: Decimal.Value,
  beratSampelGram: Decimal.Value,
  bulat: boolean,
): string {
  const q = new Decimal(beratGram).times(jumlahSampel).div(beratSampelGram);
  return keQty(bulat ? q.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : q);
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

/**
 * K-163 beli X gratis Y: qty gratis dalam `qty` = ⌊qty ÷ (beli + gratis)⌋ × gratis. Contoh beli 10 gratis 1:
 * qty 22 → 2 gratis (dua paket 11), qty 10 → 0 (paket belum penuh).
 */
export function qtyGratis(qty: Decimal.Value, beli: Decimal.Value, gratis: Decimal.Value): string {
  const paket = new Decimal(qty).div(new Decimal(beli).plus(gratis)).floor();
  return keQty(paket.times(gratis));
}

/**
 * K-185 beli N potong Rp X: berapa kali kelipatan N penuh di dalam `qty` = ⌊qty ÷ N⌋. Contoh beli 2: qty 5 → 2,
 * qty 1 → 0. Hasil bilangan bulat (dipakai untuk mengalikan rupiah).
 */
export function kelipatanQty(qty: Decimal.Value, n: Decimal.Value): number {
  const d = new Decimal(n);
  if (d.lessThanOrEqualTo(0)) return 0;
  return Decimal.max(0, new Decimal(qty).div(d).floor()).toNumber();
}

/*
 * K-127: statistik deret penjualan harian untuk metode saran pesan B (statistik) dan D (tren). Hitungan antara
 * memakai presisi penuh decimal.js; hasil dibulatkan 3 desimal seperti qty lain.
 */

/** Akar kuadrat, 3 desimal. */
export function akarQty(a: Decimal.Value): string {
  return keQty(Decimal.max(0, a).sqrt());
}

/** Simpangan baku sampel (pembagi n − 1); "0.000" bila kurang dari 2 data. */
export function simpanganBakuQty(seri: readonly Decimal.Value[]): string {
  if (seri.length < 2) return keQty(0);
  const angka = seri.map((x) => new Decimal(x));
  const rata = Decimal.sum(...angka).div(angka.length);
  const kuadrat = Decimal.sum(...angka.map((x) => x.minus(rata).pow(2)));
  return keQty(kuadrat.div(angka.length - 1).sqrt());
}

/**
 * Pemulusan eksponensial ganda (Holt). Level awal = rata-rata `awal` data pertama, tren awal 0; lalu tiap data
 * x: level' = α·x + (1−α)(level + tren), tren' = β(level' − level) + (1−β)·tren.
 */
export function pemulusanHolt(
  seri: readonly Decimal.Value[],
  alfa: Decimal.Value,
  beta: Decimal.Value,
  awal = 7,
): { level: string; tren: string } {
  if (seri.length === 0) return { level: keQty(0), tren: keQty(0) };
  const a = new Decimal(alfa);
  const b = new Decimal(beta);
  const n = Math.min(awal, seri.length);
  let level = Decimal.sum(...seri.slice(0, n).map((x) => new Decimal(x))).div(n);
  let tren = new Decimal(0);
  for (const x of seri.slice(n)) {
    const baru = a.times(x).plus(new Decimal(1).minus(a).times(level.plus(tren)));
    tren = b.times(baru.minus(level)).plus(new Decimal(1).minus(b).times(tren));
    level = baru;
  }
  return { level: keQty(level), tren: keQty(tren) };
}

/** Σ perkiraan hari 1..`hari` dengan perkiraan hari ke-k = maks(0, level + k·tren). */
export function jumlahPerkiraanHolt(
  level: Decimal.Value,
  tren: Decimal.Value,
  hari: number,
): string {
  let total = new Decimal(0);
  for (let k = 1; k <= hari; k++)
    total = total.plus(Decimal.max(0, new Decimal(tren).times(k).plus(level)));
  return keQty(total);
}
