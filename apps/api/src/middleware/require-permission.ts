import type { Izin } from '@sit/shared';
import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import type { EnvApp, PenggunaAktif } from '../lib/konteks';

/*
 * Penjaga izin (CLAUDE.md aturan 5, docs/04). Setiap rute wajib memasang `requirePermission('kode.izin')`
 * atau — untuk rute milik pengguna sendiri (profil, logout, ganti password) — `requireLogin()`.
 * Middleware ini diberi penanda, sehingga `periksaDeklarasiIzin()` bisa menolak menyalakan server bila ada
 * rute yang lupa mendeklarasikan izin (guard default, K-054).
 */

const PENANDA_DEKLARASI = Symbol('deklarasiIzinRute');

type Deklarasi = { izin: Izin | null; bolehWajibGantiPassword: boolean };

function buatPenjaga(deklarasi: Deklarasi): MiddlewareHandler<EnvApp> {
  const penjaga: MiddlewareHandler<EnvApp> = async (c, next) => {
    const pengguna = c.get('pengguna');
    if (!pengguna) {
      throw new AppError('BELUM_LOGIN', 'Sesi Anda sudah berakhir. Silakan login kembali.', 401);
    }
    if (pengguna.wajibGantiPassword && !deklarasi.bolehWajibGantiPassword) {
      throw new AppError(
        'WAJIB_GANTI_PASSWORD',
        'Anda wajib mengganti password terlebih dahulu.',
        403,
      );
    }
    if (deklarasi.izin && !pengguna.izin.has(deklarasi.izin)) {
      throw new AppError('TIDAK_BERIZIN', 'Anda tidak memiliki izin untuk aksi ini.', 403);
    }
    await next();
  };
  return Object.assign(penjaga, { [PENANDA_DEKLARASI]: deklarasi });
}

/** Rute hanya untuk pengguna yang login DAN memiliki `izin`. */
export function requirePermission(izin: Izin): MiddlewareHandler<EnvApp> {
  return buatPenjaga({ izin, bolehWajibGantiPassword: false });
}

/**
 * Rute untuk semua pengguna yang login, tanpa izin khusus (data milik sendiri).
 * `bolehWajibGantiPassword`: rute tetap bisa dipakai saat pengguna wajib mengganti password.
 */
export function requireLogin(
  opsi: { bolehWajibGantiPassword?: boolean } = {},
): MiddlewareHandler<EnvApp> {
  return buatPenjaga({
    izin: null,
    bolehWajibGantiPassword: opsi.bolehWajibGantiPassword ?? false,
  });
}

/** Pengguna yang login; dipakai handler SETELAH requirePermission/requireLogin. */
export function penggunaWajib(c: Context<EnvApp>): PenggunaAktif {
  const pengguna = c.get('pengguna');
  if (!pengguna) {
    throw new AppError('BELUM_LOGIN', 'Sesi Anda sudah berakhir. Silakan login kembali.', 401);
  }
  return pengguna;
}

/**
 * Daftar rute (`METODE /path`) yang tidak memasang penjaga dan tidak ada di `publik`. Middleware global
 * (`app.use`, metode ALL) diabaikan. Hasil kosong = semua rute aman.
 */
export function periksaDeklarasiIzin(
  rute: readonly { method: string; path: string; handler: unknown }[],
  publik: readonly string[],
): string[] {
  const terlindungi = new Map<string, boolean>();
  for (const r of rute) {
    if (r.method === 'ALL') continue;
    const kunci = `${r.method} ${r.path}`;
    const bertanda = typeof r.handler === 'function' && PENANDA_DEKLARASI in r.handler;
    terlindungi.set(kunci, (terlindungi.get(kunci) ?? false) || bertanda);
  }
  return [...terlindungi]
    .filter(([kunci, aman]) => !aman && !publik.includes(kunci))
    .map(([kunci]) => kunci);
}
