import { describe, expect, it } from 'vitest';
import { bacaIsianMuatan, dariSatuanSimpan, keSatuanSimpan } from './satuan-muatan';

describe('satuan isian data muatan (K-161)', () => {
  it('form: isian dikonversi ke satuan simpan dan kembali', () => {
    expect(keSatuanSimpan('50000', '0.001')).toBe('50');
    expect(keSatuanSimpan('', '1')).toBeNull();
    expect(dariSatuanSimpan('12.5', '1')).toBe('12,5');
  });

  it('sel Excel: angka saja = satuan simpan; angka + satuan dikonversi dan dibulatkan', () => {
    expect(bacaIsianMuatan('50', 'BERAT')).toEqual({ nilai: '50', galat: null });
    expect(bacaIsianMuatan('12,5', 'PANJANG')).toEqual({ nilai: '12.5', galat: null });
    expect(bacaIsianMuatan('50000 g', 'BERAT').nilai).toBe('50');
    expect(bacaIsianMuatan('1,2 ton', 'BERAT').nilai).toBe('1200');
    expect(bacaIsianMuatan('700mm', 'PANJANG').nilai).toBe('70');
    expect(bacaIsianMuatan('0,7 M', 'PANJANG').nilai).toBe('70');
    expect(bacaIsianMuatan('73,45 mm', 'PANJANG').nilai).toBe('7.3');
    expect(bacaIsianMuatan('500 L', 'VOLUME').nilai).toBe('0.5');
    expect(bacaIsianMuatan('1 m³', 'VOLUME').nilai).toBe('1');
    expect(bacaIsianMuatan('  ', 'BERAT')).toEqual({ nilai: null, galat: null });
  });

  it('sel Excel: satuan salah jenis atau bukan angka ditolak dengan petunjuk', () => {
    expect(bacaIsianMuatan('5 liter', 'BERAT').galat).toContain('bukan angka kg');
    expect(bacaIsianMuatan('5 kg', 'PANJANG').galat).toContain('mm');
    expect(bacaIsianMuatan('lima', 'BERAT').galat).not.toBeNull();
  });
});
