import { describe, expect, it } from 'vitest';
import { akarQty, jumlahPerkiraanHolt, pemulusanHolt, simpanganBakuQty } from './qty';

// K-127: statistik deret penjualan harian untuk saran pesan metode B dan D.
describe('statistik qty (K-127)', () => {
  it('akar dan simpangan baku sampel', () => {
    expect(akarQty('9')).toBe('3.000');
    expect(akarQty('2')).toBe('1.414');
    expect(akarQty('-4')).toBe('0.000');
    // 2,4,4,4,5,5,7,9: rata 5, Σ(x−5)² = 32, ÷7 → √4,571 = 2,138.
    expect(simpanganBakuQty(['2', '4', '4', '4', '5', '5', '7', '9'])).toBe('2.138');
    expect(simpanganBakuQty(['5'])).toBe('0.000');
    expect(simpanganBakuQty(['3', '3', '3'])).toBe('0.000');
  });

  it('Holt: deret datar tanpa tren; deret naik memberi tren positif', () => {
    expect(pemulusanHolt(new Array(20).fill('4'), '0.3', '0.1')).toEqual({
      level: '4.000',
      tren: '0.000',
    });
    const naik = pemulusanHolt(
      Array.from({ length: 30 }, (_, i) => String(i + 1)),
      '0.3',
      '0.1',
    );
    expect(Number(naik.tren)).toBeGreaterThan(0.3);
    expect(Number(naik.level)).toBeGreaterThan(20);
  });

  it('jumlah perkiraan: level + k·tren per hari, tidak pernah negatif', () => {
    // 10 + 11 + 12 = 33.
    expect(jumlahPerkiraanHolt('9', '1', 3)).toBe('33.000');
    // Turun: 2, 0 (−0 dipotong ke 0), 0.
    expect(jumlahPerkiraanHolt('4', '-2', 3)).toBe('2.000');
    expect(jumlahPerkiraanHolt('5', '0', 0)).toBe('0.000');
  });
});
