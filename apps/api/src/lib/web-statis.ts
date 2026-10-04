import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';
import type { EnvApp } from './konteks';

/**
 * Menyajikan hasil build web di produksi (docs/02 §12): berkas statis dari `folder`, aset ber-hash di
 * `/assets/` di-cache lama, dan rute aplikasi (mis. `/laporan`) dijawab `index.html` agar React Router
 * yang menangani. Jalur `/api` tidak disentuh.
 */
export function webStatis(folder: string): MiddlewareHandler<EnvApp>[] {
  const berkasIndex = path.join(folder, 'index.html');
  if (!existsSync(berkasIndex)) {
    throw new Error(`Hasil build web tidak ditemukan di ${folder}. Jalankan "pnpm build" dulu.`);
  }
  const index = readFileSync(berkasIndex, 'utf8');
  const bukanApi = (p: string) => p !== '/api' && !p.startsWith('/api/');
  const aset = serveStatic<EnvApp>({ root: folder });
  const folderAset = path.resolve(folder, 'assets');
  /** Aset ber-hash yang benar-benar ada (nama berubah tiap build, aman di-cache selamanya). */
  const asetAda = (p: string) => {
    if (!p.startsWith('/assets/')) return false;
    try {
      const berkas = path.resolve(folder, `.${decodeURIComponent(p)}`);
      return berkas.startsWith(folderAset + path.sep) && existsSync(berkas);
    } catch {
      return false; // URL rusak (%E0%A4%A): biar serveStatic yang menolak
    }
  };
  return [
    async (c, next) => {
      if (!bukanApi(c.req.path)) return next();
      // Header disiapkan sebelum serveStatic membuat respons (onFound terlambat untuk mengubahnya).
      c.header(
        'Cache-Control',
        asetAda(c.req.path) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      return aset(c, next);
    },
    async (c, next) => {
      // Berkas yang tidak ada (berekstensi, mis. /favicon.ico) tetap 404, bukan halaman aplikasi.
      const berkas = /\.[a-z0-9]+$/i.test(c.req.path);
      if (berkas || !bukanApi(c.req.path) || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) {
        return next();
      }
      c.header('Cache-Control', 'no-cache');
      return c.html(index);
    },
  ];
}
