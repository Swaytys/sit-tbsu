import { describe, expect, it } from 'vitest';
import { pintasanLengkap, skemaPintasan } from './pintasan';

describe('pintasan per pengguna (K-145)', () => {
  it('kosong = semua bawaan; ubahan dipakai', () => {
    expect(skemaPintasan.safeParse({}).success).toBe(true);
    expect(pintasanLengkap({}).KASIR_BAYAR).toBe('F8');
    expect(pintasanLengkap({ ORDER_DAFTAR: 'F6' }).ORDER_DAFTAR).toBe('F6');
  });

  it('tombol dobel dalam satu layar ditolak, beda layar boleh', () => {
    const dobel = skemaPintasan.safeParse({ KASIR_CARI: 'F8' });
    expect(dobel.success).toBe(false);
    expect(dobel.error?.issues[0]?.message).toContain('F8 sudah dipakai');
    // Bertukar tombol dalam satu layar sah.
    expect(skemaPintasan.safeParse({ KASIR_CARI: 'F8', KASIR_BAYAR: 'F2' }).success).toBe(true);
    // F6 untuk kasir dan order sekaligus sah (layar berbeda).
    expect(skemaPintasan.safeParse({ KASIR_CARI: 'F6', ORDER_CARI: 'F6' }).success).toBe(true);
  });

  it('tombol peramban (F5, F11, F12) dan aksi tak dikenal ditolak', () => {
    expect(skemaPintasan.safeParse({ KASIR_CARI: 'F5' }).success).toBe(false);
    expect(skemaPintasan.safeParse({ KASIR_CARI: 'F12' }).success).toBe(false);
    expect(skemaPintasan.safeParse({ ASAL: 'F2' }).success).toBe(false);
  });
});
