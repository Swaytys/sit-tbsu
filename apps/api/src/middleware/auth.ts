import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { env } from '../env';
import type { EnvApp } from '../lib/konteks';
import { sesiDariToken } from '../modules/auth/service';
import { NAMA_COOKIE_SESI } from '../modules/auth/token';

function ambilIp(c: Context): string | null {
  try {
    const ip = getConnInfo(c).remote.address ?? null;
    // K-217: permintaan dari proxy lokal (`tailscale serve`) membawa alamat perangkat asli; dipercaya hanya bila
    // koneksi datang dari komputer ini sendiri, agar batas percobaan login dihitung per perangkat.
    const terusan = c.req.header('x-forwarded-for');
    if (
      env.AKSES_TAILSCALE &&
      terusan &&
      (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')
    ) {
      return terusan.split(',')[0]?.trim().slice(0, 45) || ip;
    }
    return ip;
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
