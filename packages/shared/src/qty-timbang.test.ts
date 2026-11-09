import { describe, expect, it } from 'vitest';
import { qtyDariTimbang } from './qty';

// K-227: hitung dengan timbangan (counting scale) saat opname.
describe('qtyDariTimbang', () => {
  it('berat bersih × jumlah sampel ÷ berat sampel; satuan per buah dibulatkan ke terdekat', () => {
    expect(qtyDariTimbang('1001', '50', '125', true)).toBe('400.000'); // 400,4 → 400
    expect(qtyDariTimbang('1003', '50', '125', true)).toBe('401.000'); // 401,2 → 401
    expect(qtyDariTimbang('22.5', '50', '125', true)).toBe('9.000');
    expect(qtyDariTimbang('1001.25', '50', '125', true)).toBe('401.000'); // 400,5 → 401 (setengah ke atas)
  });

  it('satuan bukan per buah (mis. kg) memakai 3 desimal', () => {
    expect(qtyDariTimbang('2500', '1', '1000', false)).toBe('2.500');
    expect(qtyDariTimbang('1234.5678', '1', '1000', false)).toBe('1.235');
  });
});
