/*
 * K-232: pemulihan akses Owner yang terakhir (password, email, dan kode pemulihan hilang semua) hanya bisa
 * dikerjakan bersama pengembang. Komputer server membuat *kode tantangan* sekali pakai (berlaku 60 menit); pengembang
 * menandatanganinya dengan kunci rahasia Ed25519 yang hanya ada di komputer pengembang; kode jawaban diperiksa dengan
 * kunci publik yang tertanam di aplikasi. Memegang komputer toko saja tidak cukup untuk memulihkan akses Owner.
 */
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { KUNCI_PUBLIK_PEMULIHAN } from '../kunci-pemulihan-publik';

/** Teks yang ditandatangani pengembang untuk sebuah kode tantangan. */
export function teksTertanda(kodeTantangan: string): string {
  return `bonsaiurip-pulih-owner:v1:${kodeTantangan}`;
}

const POLA_TANTANGAN = /^BU-([0-9A-F]{8})-([0-9A-F]{10})-(\d{12})$/;
const POLA_JAWABAN = /^[A-Za-z0-9_-]{80,100}$/;

/** `yyyyMMddHHmm` (UTC) dari waktu. */
function cap(waktu: Date): string {
  return waktu.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}

/** Kode tantangan untuk pemasangan ini, berlaku `menit` menit. */
export function buatTantangan(
  idPemasangan: string,
  waktu: Date,
  menit = 60,
): { kode: string; kedaluwarsa: string } {
  const sampai = new Date(waktu.getTime() + menit * 60_000);
  const nonce = randomBytes(5).toString('hex').toUpperCase();
  return { kode: `BU-${idPemasangan}-${nonce}-${cap(sampai)}`, kedaluwarsa: sampai.toISOString() };
}

export type HasilPeriksa =
  'COCOK' | 'FORMAT' | 'KEDALUWARSA' | 'BUKAN_PEMASANGAN_INI' | 'TIDAK_COCOK';

/**
 * Memeriksa kode jawaban pengembang untuk kode tantangan. `kunciPublik` hanya diganti dalam tes.
 */
export function periksaJawaban(
  kodeTantangan: string,
  jawaban: string,
  idPemasangan: string,
  waktu: Date,
  kunciPublik: string = KUNCI_PUBLIK_PEMULIHAN,
): HasilPeriksa {
  const m = POLA_TANTANGAN.exec(kodeTantangan);
  const bersih = jawaban.trim();
  if (!m || !POLA_JAWABAN.test(bersih)) return 'FORMAT';
  if (m[1] !== idPemasangan) return 'BUKAN_PEMASANGAN_INI';
  if (cap(waktu) > m[3]!) return 'KEDALUWARSA';
  const sah = verify(
    null,
    Buffer.from(teksTertanda(kodeTantangan)),
    createPublicKey(kunciPublik),
    Buffer.from(bersih, 'base64url'),
  );
  return sah ? 'COCOK' : 'TIDAK_COCOK';
}

/** ID pemasangan baru: 8 angka/huruf heksadesimal. */
export function idPemasanganBaru(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

export const PESAN_PERIKSA: Record<Exclude<HasilPeriksa, 'COCOK'>, string> = {
  FORMAT:
    'Kode jawaban tidak lengkap. Salin ulang seluruh kode dari pengembang (± 86 huruf/angka).',
  KEDALUWARSA:
    'Kode tantangan sudah lewat 60 menit. Mulai lagi untuk mendapat kode tantangan baru.',
  BUKAN_PEMASANGAN_INI: 'Kode tantangan bukan milik komputer ini.',
  TIDAK_COCOK:
    'Kode jawaban tidak cocok dengan kode tantangan. Pastikan pengembang menandatangani kode tantangan yang sama.',
};
