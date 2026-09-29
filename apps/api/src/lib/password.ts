import { argon2id, hash, verify } from 'argon2';

/** Hash password dengan argon2id. Password mentah tidak pernah disimpan atau dilog. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id });
}

export function cocokPassword(hashTersimpan: string, password: string): Promise<boolean> {
  return verify(hashTersimpan, password);
}
