import { argon2id, hash, verify } from 'argon2';

/** Parameter hash sesuai docs/04 §7: argon2id, memori 64 MB, iterasi 3, paralel 1. */
const OPSI_HASH = { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;

/** Hash password dengan argon2id. Password mentah tidak pernah disimpan atau dilog. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, OPSI_HASH);
}

export function cocokPassword(hashTersimpan: string, password: string): Promise<boolean> {
  return verify(hashTersimpan, password);
}

/**
 * Hash tiruan untuk menyamakan waktu respons saat username tidak dikenal, supaya penyerang tidak bisa
 * menebak username yang ada dari lamanya respons.
 */
let hashTiruan: Promise<string> | undefined;
export async function verifikasiTiruan(password: string): Promise<void> {
  hashTiruan ??= hashPassword('password-tiruan-untuk-penyamaan-waktu');
  await verify(await hashTiruan, password);
}
