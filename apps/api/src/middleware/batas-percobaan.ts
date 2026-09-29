import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import type { EnvApp } from '../lib/konteks';

/*
 * Rate limit sederhana di memori per IP (satu server; cukup untuk skala toko). docs/04 §7: 20 percobaan
 * login per menit per IP. Catatan Fase 8: bila server di belakang reverse proxy, IP asli harus dibaca
 * dari header X-Forwarded-For milik proxy tepercaya.
 */

const catatan = new Map<string, number[]>();
const BATAS_ENTRI = 10_000;

export function batasPercobaan(opsi: {
  maks: number;
  jendelaDetik: number;
}): MiddlewareHandler<EnvApp> {
  const jendelaMs = opsi.jendelaDetik * 1000;
  return async (c, next) => {
    const kunci = c.get('asal').ip ?? 'tidak-diketahui';
    const kini = Date.now();
    const baru = (catatan.get(kunci) ?? []).filter((t) => kini - t < jendelaMs);
    if (baru.length >= opsi.maks) {
      throw new AppError(
        'TERLALU_BANYAK_PERCOBAAN',
        'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
        429,
      );
    }
    baru.push(kini);
    if (catatan.size >= BATAS_ENTRI) catatan.clear();
    catatan.set(kunci, baru);
    await next();
  };
}

/** Percobaan login: 20 per menit per IP (docs/04 §7). */
export const batasPercobaanLogin = batasPercobaan({ maks: 20, jendelaDetik: 60 });

/** Untuk tes: kosongkan catatan percobaan. */
export function resetBatasPercobaan(): void {
  catatan.clear();
}
