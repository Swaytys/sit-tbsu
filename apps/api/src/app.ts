import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { env } from './env';
import type { EnvApp } from './lib/konteks';
import { muatSesi } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLog } from './middleware/request-log';
import { periksaDeklarasiIzin } from './middleware/require-permission';
import { authDevRoutes, authRoutes } from './modules/auth/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { barangRoutes } from './modules/master/barang/routes';
import { hargaRoutes } from './modules/master/harga/routes';
import { importRoutes } from './modules/master/import/routes';
import { jenisAtributRoutes } from './modules/master/jenis-atribut/routes';
import { kategoriRoutes } from './modules/master/kategori/routes';
import { merkRoutes } from './modules/master/merk/routes';
import { pelangganRoutes } from './modules/master/pelanggan/routes';
import { pemasokRoutes } from './modules/master/pemasok/routes';
import { penggunaRoutes } from './modules/master/pengguna/routes';
import { satuanRoutes } from './modules/master/satuan/routes';
import { tingkatHargaRoutes } from './modules/master/tingkat-harga/routes';
import { shiftRoutes } from './modules/kas/shift/routes';
import { returRoutes } from './modules/koreksi/retur/routes';
import { laporanRoutes } from './modules/laporan/routes';
import { voidRoutes } from './modules/koreksi/void/routes';
import { orderRoutes } from './modules/penjualan/order/routes';
import { penjualanRoutes } from './modules/penjualan/penjualan/routes';
import { piutangRoutes } from './modules/penjualan/piutang/routes';
import { suratJalanRoutes } from './modules/penjualan/surat-jalan/routes';
import { penerimaanRoutes } from './modules/persediaan/penerimaan/routes';
import { penyesuaianRoutes } from './modules/persediaan/penyesuaian/routes';
import { stokRoutes } from './modules/persediaan/stok/routes';
import { healthRoutes } from './modules/sistem/health/routes';
import { logRoutes } from './modules/sistem/log/routes';
import { notifikasiRoutes } from './modules/sistem/notifikasi/routes';
import { pengaturanRoutes } from './modules/sistem/pengaturan/routes';

/** Semua rute di bawah /api. Tipenya dipakai klien RPC web: `hc<AppType>('/api')`. */
const rute = new Hono<EnvApp>()
  .route('/health', healthRoutes)
  .route('/auth', authRoutes)
  .route('/satuan', satuanRoutes)
  .route('/kategori', kategoriRoutes)
  .route('/merk', merkRoutes)
  .route('/jenis-atribut', jenisAtributRoutes)
  .route('/tingkat-harga', tingkatHargaRoutes)
  .route('/barang', barangRoutes)
  .route('/harga-barang', hargaRoutes)
  .route('/import', importRoutes)
  .route('/penerimaan', penerimaanRoutes)
  .route('/penyesuaian', penyesuaianRoutes)
  .route('/stok', stokRoutes)
  .route('/order', orderRoutes)
  .route('/penjualan', penjualanRoutes)
  .route('/surat-jalan', suratJalanRoutes)
  .route('/piutang', piutangRoutes)
  .route('/shift', shiftRoutes)
  .route('/void', voidRoutes)
  .route('/retur', returRoutes)
  .route('/pelanggan', pelangganRoutes)
  .route('/pemasok', pemasokRoutes)
  .route('/pengguna', penggunaRoutes)
  .route('/pengaturan', pengaturanRoutes)
  .route('/log-aktivitas', logRoutes)
  .route('/notifikasi', notifikasiRoutes)
  .route('/dashboard', dashboardRoutes)
  .route('/laporan', laporanRoutes);

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
