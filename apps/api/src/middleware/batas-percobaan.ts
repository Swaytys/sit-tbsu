import type { MiddlewareHandler } from 'hono';
import { catatPercobaan, type OpsiBatas } from '../lib/batas-percobaan';
import type { EnvApp } from '../lib/konteks';

/*
 * Batas laju per IP untuk rute publik. Catatan Fase 8: bila server di belakang reverse proxy, IP asli harus
 * dibaca dari header X-Forwarded-For milik proxy tepercaya.
 */
function batasPercobaan(opsi: OpsiBatas): MiddlewareHandler<EnvApp> {
  return async (c, next) => {
    catatPercobaan(`ip:${c.get('asal').ip ?? 'tidak-diketahui'}`, opsi);
    await next();
  };
}

/** Percobaan login: 20 per menit per IP (docs/04 §7). */
export const batasPercobaanLogin = batasPercobaan({ maks: 20, jendelaDetik: 60 });
