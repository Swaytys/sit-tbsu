import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catatPercobaan, resetBatasPercobaan } from './batas-percobaan';
import { AppError } from './errors';

const opsi = { maks: 3, jendelaDetik: 60 };

beforeEach(() => {
  resetBatasPercobaan();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('catatPercobaan', () => {
  it('percobaan di atas batas dalam satu jendela → 429', () => {
    for (let i = 0; i < 3; i++) catatPercobaan('a', opsi);
    expect(() => catatPercobaan('a', opsi)).toThrow(AppError);
    try {
      catatPercobaan('a', opsi);
    } catch (e) {
      expect(e).toMatchObject({ kode: 'TERLALU_BANYAK_PERCOBAAN', status: 429 });
    }
  });

  it('kunci berbeda dihitung terpisah', () => {
    for (let i = 0; i < 3; i++) catatPercobaan('a', opsi);
    expect(() => catatPercobaan('b', opsi)).not.toThrow();
  });

  it('boleh lagi setelah jendela waktu lewat', () => {
    for (let i = 0; i < 3; i++) catatPercobaan('a', opsi);
    vi.advanceTimersByTime(61_000);
    expect(() => catatPercobaan('a', opsi)).not.toThrow();
  });
});
