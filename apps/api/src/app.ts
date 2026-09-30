import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { env } from './env';
import type { EnvApp } from './lib/konteks';
import { muatSesi } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLog } from './middleware/request-log';
import { periksaDeklarasiIzin } from './middleware/require-permission';
import { authDevRoutes, authRoutes } from './modules/auth/routes';
import { jenisAtributRoutes } from './modules/master/jenis-atribut/routes';
import { kategoriRoutes } from './modules/master/kategori/routes';
import { penggunaRoutes } from './modules/master/pengguna/routes';
import { satuanRoutes } from './modules/master/satuan/routes';
import { healthRoutes } from './modules/sistem/health/routes';
import { logRoutes } from './modules/sistem/log/routes';
import { pengaturanRoutes } from './modules/sistem/pengaturan/routes';

/** Semua rute di bawah /api. Tipenya dipakai klien RPC web: `hc<AppType>('/api')`. */
const rute = new Hono<EnvApp>()
  .route('/health', healthRoutes)
  .route('/auth', authRoutes)
  .route('/satuan', satuanRoutes)
  .route('/kategori', kategoriRoutes)
  .route('/jenis-atribut', jenisAtributRoutes)
  .route('/pengguna', penggunaRoutes)
  .route('/pengaturan', pengaturanRoutes)
  .route('/log-aktivitas', logRoutes);

export const app = new Hono<EnvApp>();
app.use(requestLog);
// CSRF: tolak POST/PUT/PATCH/DELETE bergaya form dari origin lain (CLAUDE.md § Keamanan).
app.use('/api/*', csrf());
app.use('/api/*', muatSesi);
app.route('/api', rute);
if (env.NODE_ENV === 'development') {
  app.route('/api/auth', authDevRoutes);
}
app.notFound(notFoundHandler);
app.onError(errorHandler);

/** Rute tanpa login (CLAUDE.md aturan 5). Masuk cepat hanya ada di mode pengembangan. */
export const RUTE_PUBLIK: readonly string[] = [
  'GET /api/health',
  'POST /api/auth/login',
  ...(env.NODE_ENV === 'development' ? ['POST /api/auth/masuk-cepat'] : []),
];

// Guard default: server menolak menyala bila ada rute tanpa deklarasi izin (K-054).
const tanpaIzin = periksaDeklarasiIzin(app.routes, RUTE_PUBLIK);
if (tanpaIzin.length > 0) {
  throw new Error(
    `Rute tanpa requirePermission/requireLogin (CLAUDE.md aturan 5): ${tanpaIzin.join(', ')}`,
  );
}

export type AppType = typeof rute;
