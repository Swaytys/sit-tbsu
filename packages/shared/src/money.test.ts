import { describe, expect, it } from 'vitest';
import {
  bulatkanHarga,
  bulatkanRupiah,
  formatRupiah,
  hargaMarkup,
  marginPersen,
  persenKeRupiah,
  potonganPersenRupiah,
} from './money';
import { bandingQty, keQty, konversiQty, tambahQty } from './qty';

describe('uang (docs/05 §1)', () => {
  it('U1 bulatkanRupiah: setengah ke atas, tanpa float', () => {
    expect(bulatkanRupiah('1234.5')).toBe(1235);
    expect(bulatkanRupiah('1234.49')).toBe(1234);
    expect(bulatkanRupiah('-0.4')).toBe(0);
    expect(bulatkanRupiah(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => bulatkanRupiah('9007199254740993')).toThrow(RangeError);
  });

  it('U4 persen ke rupiah dibulatkan setengah ke atas', () => {
    expect(persenKeRupiah(55_000, '2.5')).toBe(1375);
    expect(persenKeRupiah(333, '10')).toBe(33);
  });

  it('H4 bulatkanHarga: ke atas ke kelipatan', () => {
    expect(bulatkanHarga(12_340, 100)).toBe(12_400);
    expect(bulatkanHarga(12_400, 100)).toBe(12_400);
    expect(bulatkanHarga('12300.01', 100)).toBe(12_400);
    expect(bulatkanHarga(12_340, 1)).toBe(12_340);
  });

  it('H4 harga markup = bulatkanHarga(dasar × (1 + persen/100))', () => {
    expect(hargaMarkup(50_000, '25.00', 100)).toBe(62_500);
    expect(hargaMarkup(43_210, '20', 100)).toBe(51_900); // 51.852 → 51.900
    expect(hargaMarkup(43_210, '0', 500)).toBe(43_500);
  });

  it('PR3 potongan promo persen dibulatkan sekali dari qty × harga × persen', () => {
    // 0,5 × 201 × 50% = 50,25 → 50 (bukan 50% dari bruto 101 = 51).
    expect(potonganPersenRupiah('0.5', 201, '50')).toBe(50);
    expect(persenKeRupiah(bulatkanRupiah('100.5'), '50')).toBe(51);
    expect(potonganPersenRupiah('3', 12_345, '12.5')).toBe(4629); // 4.629,375
  });

  it('H12 margin = (harga jual − D) ÷ harga jual, dua desimal; null bila harga 0', () => {
    expect(marginPersen(48_900, 41_234)).toBe(15.68);
    expect(marginPersen(52_600, 56_000)).toBe(-6.46);
    expect(marginPersen(0, 1000)).toBeNull();
  });

  it('format Rp dengan titik ribuan', () => {
    expect(formatRupiah(1_234_567)).toBe('Rp 1.234.567');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-1500)).toBe('-Rp 1.500');
  });
});

describe('kuantitas dan konversi satuan (K-014)', () => {
  const m = { kode: 'm', jenisDimensi: 'PANJANG' as const, faktorKeBasis: '1.000000' };
  const cm = { kode: 'cm', jenisDimensi: 'PANJANG' as const, faktorKeBasis: '0.010000' };
  const kg = { kode: 'kg', jenisDimensi: 'BERAT' as const, faktorKeBasis: '1.000000' };
  const sak = { kode: 'sak', jenisDimensi: 'JUMLAH' as const, faktorKeBasis: '1.000000' };
  const dus = { kode: 'dus', jenisDimensi: 'JUMLAH' as const, faktorKeBasis: '1.000000' };

  it('qty selalu 3 desimal dan tanpa galat float', () => {
    expect(keQty('2.5')).toBe('2.500');
    expect(tambahQty('0.1', '0.2')).toBe('0.300');
    expect(bandingQty('1.000', '1')).toBe(0);
  });

  it('konversi sesama dimensi fisik', () => {
    expect(konversiQty('250', cm, m)).toBe('2.500');
    expect(konversiQty('1.5', m, cm)).toBe('150.000');
  });

  it('konversi beda dimensi ditolak', () => {
    expect(() => konversiQty('1', m, kg)).toThrow(/berbeda dimensi/);
  });

  it('satuan hitung tidak dikonversi lewat master satuan', () => {
    expect(() => konversiQty('1', sak, dus)).toThrow(/Satuan hitung/);
    expect(konversiQty('3', sak, sak)).toBe('3.000');
  });
});
