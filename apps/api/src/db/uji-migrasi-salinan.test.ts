import { describe, expect, it } from 'vitest';
import { bandingkanJumlah } from './uji-migrasi-salinan';

describe('uji migrasi pada salinan (K-166)', () => {
  it('tabel baru dan baris bertambah aman; tabel berisi data hilang atau baris berkurang ditolak', () => {
    expect(bandingkanJumlah({ a: 5, b: 0 }, { a: 5, b: 0, c: 3 })).toEqual([]);
    expect(bandingkanJumlah({ a: 5, b: 0 }, { a: 6 })).toEqual([]);
    expect(bandingkanJumlah({ a: 5, b: 2 }, { a: 4 })).toEqual([
      'Tabel a: 5 → 4 baris (berkurang 1).',
      'Tabel b (2 baris) hilang setelah migrasi.',
    ]);
  });
});
