import { describe, expect, it } from 'vitest';
import { bisaCode128, checksumCode128, modulCode128, POLA_CODE128, simbolCode128 } from './code128';

describe('Code 128 (label barang, K-090)', () => {
  it('tabel pola: 107 simbol unik, lebar 11 modul (stop 13), selang-seling diawali batang', () => {
    expect(POLA_CODE128).toHaveLength(107);
    expect(new Set(POLA_CODE128).size).toBe(107);
    POLA_CODE128.forEach((p, i) => {
      const lebar = [...p].map(Number);
      expect(
        lebar.reduce((a, b) => a + b, 0),
        `simbol ${i}`,
      ).toBe(i === 106 ? 13 : 11);
      // Jumlah modul batang selalu genap (aturan paritas Code 128).
      const batang = lebar.filter((_, j) => j % 2 === 0).reduce((a, b) => a + b, 0);
      expect(batang % 2, `paritas simbol ${i}`).toBe(0);
    });
  });

  it('set B untuk teks, set C untuk angka genap; checksum modulo 103', () => {
    expect(simbolCode128('BRG-00012')).toEqual({
      start: 104,
      data: [34, 50, 39, 13, 16, 16, 16, 17, 18],
    });
    expect(simbolCode128('8991002101')).toEqual({ start: 105, data: [89, 91, 0, 21, 1] });
    // "PJJ123C" set B: 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55.
    const { start, data } = simbolCode128('PJJ123C');
    expect(checksumCode128(start, data)).toBe(55);
    // Total modul = 11 × (start + data + checksum) + 13 (stop).
    expect(modulCode128('BRG-00012').reduce((a, b) => a + b, 0)).toBe(11 * 11 + 13);
  });

  it('menolak teks kosong, terlalu panjang, atau di luar ASCII cetak', () => {
    expect(bisaCode128('')).toBe(false);
    expect(bisaCode128('x'.repeat(49))).toBe(false);
    expect(bisaCode128('Semen ±')).toBe(false);
    expect(() => modulCode128('')).toThrow();
  });
});
