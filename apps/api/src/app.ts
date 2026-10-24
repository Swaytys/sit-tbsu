import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './env';
import type { EnvApp } from './lib/konteks';
import { webStatis } from './lib/web-statis';
import { muatSesi } from './middleware/auth';
import { idempoten } from './middleware/idempoten';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLog } from './middleware/request-log';
import { periksaDeklarasiIzin } from './middleware/require-permission';
import { authDevRoutes, authRoutes } from './modules/auth/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { barangRoutes } from './modules/master/barang/routes';
import { hargaRoutes } from './modules/master/harga/routes';
import { promoRoutes } from './modules/promo/routes';
import { hutangRoutes } from './modules/hutang/routes';
import { konsinyasiRoutes } from './modules/konsinyasi/routes';
import { returPemasokRoutes } from './modules/persediaan/retur-pemasok/routes';
import { importRoutes } from './modules/master/import/routes';
import { jenisAtributRoutes } from './modules/master/jenis-atribut/routes';
import { kategoriRoutes } from './modules/master/kategori/routes';
import { golonganPelangganRoutes } from './modules/master/golongan-pelanggan/routes';
import { armadaRoutes, kendaraanRoutes, sopirRoutes } from './modules/master/armada/routes';
import { merkRoutes } from './modules/master/merk/routes';
import { pelangganRoutes } from './modules/master/pelanggan/routes';
import { pemasokRoutes } from './modules/master/pemasok/routes';
import { penggunaRoutes } from './modules/master/pengguna/routes';
import { satuanRoutes } from './modules/master/satuan/routes';
import { tingkatHargaRoutes } from './modules/master/tingkat-harga/routes';
import { shiftRoutes } from './modules/kas/shift/routes';
import { nonTunaiRoutes } from './modules/kas/nontunai/routes';
import { rekeningRoutes } from './modules/kas/rekening/routes';
import { returRoutes } from './modules/koreksi/retur/routes';
import { laporanRoutes } from './modules/laporan/routes';
import { voidRoutes } from './modules/koreksi/void/routes';
import { orderRoutes } from './modules/penjualan/order/routes';
import { penjualanRoutes } from './modules/penjualan/penjualan/routes';
import { piutangRoutes } from './modules/penjualan/piutang/routes';
import { suratJalanRoutes } from './modules/penjualan/surat-jalan/routes';
import { perjalananRoutes } from './modules/penjualan/perjalanan/routes';
import { penerimaanRoutes } from './modules/persediaan/penerimaan/routes';
import { penyesuaianRoutes } from './modules/persediaan/penyesuaian/routes';
import { saranPesanRoutes } from './modules/persediaan/saran-pesan/routes';
import { stokRoutes } from './modules/persediaan/stok/routes';
import { arsipRoutes } from './modules/sistem/arsip/routes';
import { pemeriksaanDataRoutes } from './modules/sistem/pemeriksaan-data/routes';
import { cadanganRoutes } from './modules/sistem/cadangan/routes';
import { cariRoutes } from './modules/sistem/cari/routes';
import { hasilPenjualanRoutes } from './modules/hasil-penjualan/routes';
import { healthRoutes } from './modules/sistem/health/routes';
import { logRoutes } from './modules/sistem/log/routes';
import { persetujuanRoutes } from './modules/sistem/kode-persetujuan/routes';
import { notifikasiRoutes } from './modules/sistem/notifikasi/routes';
import { pengaturanRoutes } from './modules/sistem/pengaturan/routes';
import { saluranRoutes } from './modules/sistem/saluran/routes';

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
  .route('/promo', promoRoutes)
  .route('/import', importRoutes)
  .route('/penerimaan', penerimaanRoutes)
  .route('/retur-pemasok', returPemasokRoutes)
  .route('/hutang', hutangRoutes)
  .route('/konsinyasi', konsinyasiRoutes)
  .route('/penyesuaian', penyesuaianRoutes)
  .route('/stok', stokRoutes)
  .route('/saran-pesan', saranPesanRoutes)
  .route('/order', orderRoutes)
  .route('/penjualan', penjualanRoutes)
  .route('/surat-jalan', suratJalanRoutes)
  .route('/perjalanan', perjalananRoutes)
  .route('/kendaraan', kendaraanRoutes)
  .route('/sopir', sopirRoutes)
  .route('/armada', armadaRoutes)
  .route('/piutang', piutangRoutes)
  .route('/shift', shiftRoutes)
  .route('/rekening', rekeningRoutes)
  .route('/pembayaran-nontunai', nonTunaiRoutes)
  .route('/void', voidRoutes)
  .route('/retur', returRoutes)
  .route('/pelanggan', pelangganRoutes)
  .route('/golongan-pelanggan', golonganPelangganRoutes)
  .route('/pemasok', pemasokRoutes)
  .route('/pengguna', penggunaRoutes)
  .route('/pengaturan', pengaturanRoutes)
  .route('/saluran', saluranRoutes)
  .route('/log-aktivitas', logRoutes)
  .route('/notifikasi', notifikasiRoutes)
  .route('/persetujuan', persetujuanRoutes)
  .route('/dashboard', dashboardRoutes)
  .route('/laporan', laporanRoutes)
  .route('/cadangan', cadanganRoutes)
  .route('/arsip', arsipRoutes)
  .route('/pemeriksaan-data', pemeriksaanDataRoutes)
  .route('/cari', cariRoutes)
  .route('/hasil-penjualan', hasilPenjualanRoutes);

export const app = new Hono<EnvApp>();
app.use(requestLog);
// Header keamanan (OWASP, K-083): CSP hanya sumber sendiri, larang dibingkai situs lain, HSTS bila HTTPS.
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // React memakai atribut style dan dokumen cetak menyisipkan <style>.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: env.HTTPS_PFX ? 'max-age=15552000' : false,
    xFrameOptions: 'DENY',
    referrerPolicy: 'same-origin',
  }),
);
// CSRF: tolak POST/PUT/PATCH/DELETE bergaya form dari origin lain (CLAUDE.md § Keamanan).
app.use(
  '/api/*',
  csrf({
    origin: (origin, c) =>
      origin === new URL(c.req.url).origin || env.ORIGIN_TAMBAHAN.includes(origin),
  }),
);
// Batas ukuran body JSON 1 MB (K-083); unggahan berkas punya batas sendiri di rutenya.
const batasJson = bodyLimit({
  maxSize: 1024 * 1024,
  onError: (c) =>
    c.json({ error: { kode: 'VALIDASI', pesan: 'Data yang dikirim terlalu besar.' } }, 413),
});
const batasJsonSaja: MiddlewareHandler<EnvApp> = async (c, next) =>
  (c.req.header('content-type') ?? '').includes('json') ? batasJson(c, next) : next();
app.use('/api/*', batasJsonSaja);
app.use('/api/*', muatSesi);
// K-164: kiriman ulang dengan kunci idempoten yang sama dijawab dari hasil pertama.
app.use('/api/*', idempoten);
app.route('/api', rute);
if (env.NODE_ENV === 'development') {
  app.route('/api/auth', authDevRoutes);
}
// Produksi: API dan aplikasi web disajikan dari satu port (docs/02 §12).
if (env.NODE_ENV === 'production') {
  for (const m of webStatis(env.WEB_DIST)) app.use('*', m);
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
