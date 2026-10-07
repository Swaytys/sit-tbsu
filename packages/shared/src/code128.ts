/*
 * Barcode Code 128 untuk label barang (Fase 12, K-090). Ditulis sendiri agar tidak menambah dependency:
 * tabel lebar standar 107 simbol, set B untuk teks umum dan set C untuk angka genap (lebih rapat).
 * Hasil berupa lebar modul bergantian batang/spasi, dimulai dengan batang; komponen web menggambarnya sebagai SVG.
 */

/** Lebar 6 elemen (batang, spasi, …) tiap simbol 0–105; 106 = stop (7 elemen). */
const POLA = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
] as const;

const START_B = 104;
const START_C = 105;
const STOP = 106;

export const POLA_CODE128: readonly string[] = POLA;

/** Teks yang bisa dikodekan: ASCII cetak (spasi s/d ~), maksimal 48 karakter. */
export function bisaCode128(teks: string): boolean {
  return teks.length > 0 && teks.length <= 48 && /^[\x20-\x7e]+$/.test(teks);
}

/** Nilai simbol (tanpa start/checksum/stop): set C bila seluruhnya angka dan panjang genap ≥ 4. */
export function simbolCode128(teks: string): { start: number; data: number[] } {
  if (!bisaCode128(teks)) throw new Error('Teks barcode tidak valid untuk Code 128.');
  if (/^\d+$/.test(teks) && teks.length % 2 === 0 && teks.length >= 4) {
    const data: number[] = [];
    for (let i = 0; i < teks.length; i += 2) data.push(Number(teks.slice(i, i + 2)));
    return { start: START_C, data };
  }
  return { start: START_B, data: [...teks].map((c) => c.charCodeAt(0) - 32) };
}

/** Checksum modulo 103: start + Σ (posisi × nilai). */
export function checksumCode128(start: number, data: number[]): number {
  return data.reduce((t, v, i) => t + (i + 1) * v, start) % 103;
}

/** Lebar modul berurutan (batang dulu), termasuk start, checksum, dan stop; tanpa quiet zone. */
export function modulCode128(teks: string): number[] {
  const { start, data } = simbolCode128(teks);
  const simbol = [start, ...data, checksumCode128(start, data), STOP];
  return simbol.flatMap((s) => [...POLA[s]!].map(Number));
}
