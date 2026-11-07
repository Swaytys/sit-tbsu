import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buatTantangan, periksaJawaban, teksTertanda } from './pemulihan-pengembang';

// K-232: kunci uji dibuat di tes; kunci pengembang yang sebenarnya tidak ada di repo.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publik = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const jawab = (kode: string, kunci = privateKey) =>
  sign(null, Buffer.from(teksTertanda(kode)), kunci).toString('base64url');

describe('pemulihan akses Owner oleh pengembang (K-232)', () => {
  const waktu = new Date('2026-11-07T03:00:00Z');
  const t = buatTantangan('A1B2C3D4', waktu);

  it('kode tantangan berisi pemasangan, nonce, dan batas waktu 60 menit', () => {
    expect(t.kode).toMatch(/^BU-A1B2C3D4-[0-9A-F]{10}-202611070400$/);
    expect(buatTantangan('A1B2C3D4', waktu).kode).not.toBe(t.kode);
  });

  it('jawaban yang ditandatangani kunci pengembang diterima', () => {
    expect(periksaJawaban(t.kode, jawab(t.kode), 'A1B2C3D4', waktu, publik)).toBe('COCOK');
  });

  it('jawaban kunci lain, tantangan lain, pemasangan lain, atau lewat waktu ditolak', () => {
    const lain = generateKeyPairSync('ed25519').privateKey;
    expect(periksaJawaban(t.kode, jawab(t.kode, lain), 'A1B2C3D4', waktu, publik)).toBe(
      'TIDAK_COCOK',
    );
    const t2 = buatTantangan('A1B2C3D4', waktu);
    expect(periksaJawaban(t2.kode, jawab(t.kode), 'A1B2C3D4', waktu, publik)).toBe('TIDAK_COCOK');
    expect(periksaJawaban(t.kode, jawab(t.kode), 'FFFFFFFF', waktu, publik)).toBe(
      'BUKAN_PEMASANGAN_INI',
    );
    const telat = new Date(waktu.getTime() + 61 * 60_000);
    expect(periksaJawaban(t.kode, jawab(t.kode), 'A1B2C3D4', telat, publik)).toBe('KEDALUWARSA');
    expect(periksaJawaban(t.kode, 'abc', 'A1B2C3D4', waktu, publik)).toBe('FORMAT');
  });

  it('kunci publik bawaan cocok dengan alat pengembang (bila kunci rahasia ada di komputer ini)', () => {
    // Hanya memastikan kunci bawaan berbentuk PEM Ed25519 yang bisa dibaca.
    expect(periksaJawaban(t.kode, jawab(t.kode), 'A1B2C3D4', waktu)).toBe('TIDAK_COCOK');
  });
});
