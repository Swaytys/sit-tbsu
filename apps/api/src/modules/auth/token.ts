import { createHash, randomBytes } from 'node:crypto';

/** Nama cookie sesi (K-041). Isinya token mentah; database hanya menyimpan hash-nya. */
export const NAMA_COOKIE_SESI = 'sit_sesi';

/** Token acak 32 byte (256 bit), aman ditaruh di cookie. */
export function buatTokenSesi(): string {
  return randomBytes(32).toString('base64url');
}

/** `sha256(token)` dalam heksadesimal (64 karakter) untuk kolom `sesi_login.token_hash`. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
