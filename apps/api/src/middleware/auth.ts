import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import type { EnvApp } from '../lib/konteks';
import { sesiDariToken } from '../modules/auth/service';
import { NAMA_COOKIE_SESI } from '../modules/auth/token';

function ambilIp(c: Context): string | null {
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    // Tidak ada socket (mis. app.request di tes).
    return null;
  }
}

/**
 * Middleware global: mencatat asal request (IP, user agent) dan memuat pengguna dari cookie sesi ke
 * `c.var.pengguna` (null bila belum login atau sesi berakhir). Izin diperiksa oleh requirePermission.
 */
export const muatSesi: MiddlewareHandler<EnvApp> = async (c, next) => {
  c.set('asal', {
    ip: ambilIp(c),
    userAgent: c.req.header('user-agent')?.slice(0, 255) ?? null,
  });

  const token = getCookie(c, NAMA_COOKIE_SESI);
  const pengguna = token ? await sesiDariToken(token) : null;
  if (token && !pengguna) deleteCookie(c, NAMA_COOKIE_SESI, { path: '/' });
  c.set('pengguna', pengguna);

  await next();
};
