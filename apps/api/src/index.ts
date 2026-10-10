import { readFileSync } from 'node:fs';
import { createServer as createServerHttp } from 'node:http';
import { createServer as createServerHttps } from 'node:https';
import { serve } from '@hono/node-server';
import { app } from './app';
import { pool } from './db/client';
import { env } from './env';
import { logger } from './lib/logger';
import { jalankanJobOrder } from './modules/penjualan/order/service';
import { cekJadwalCadangan } from './modules/sistem/cadangan/service';

const pfx = env.HTTPS_PFX;
const https = pfx !== undefined;
const skema = https ? 'https' : 'http';

const server =
  pfx !== undefined
    ? serve(
        {
          fetch: app.fetch,
          port: env.PORT,
          createServer: createServerHttps,
          serverOptions: {
            pfx: readFileSync(pfx),
            ...(env.HTTPS_PFX_PASSWORD ? { passphrase: env.HTTPS_PFX_PASSWORD } : {}),
          },
        },
        (info) => logger.info(`Server berjalan di ${skema}://localhost:${info.port}`),
      )
    : serve({ fetch: app.fetch, port: env.PORT }, (info) =>
        logger.info(`Server berjalan di ${skema}://localhost:${info.port}`),
      );

if (env.NODE_ENV === 'production' && !https) {
  logger.warn(
    'Produksi tanpa HTTPS: cookie sesi (Secure) hanya berfungsi di localhost. Isi HTTPS_PFX (K-082).',
  );
}

/** Port HTTP yang hanya mengalihkan pengunjung ke alamat HTTPS yang sama. */
const pengalih =
  https && env.PORT_HTTP_ALIH
    ? createServerHttp((req, res) => {
        const host = (req.headers.host ?? 'localhost').replace(/:\d+$/, '');
        const port = env.PORT === 443 ? '' : `:${env.PORT}`;
        res.writeHead(301, { Location: `https://${host}${port}${req.url ?? '/'}` });
        res.end();
      }).listen(env.PORT_HTTP_ALIH)
    : null;

/** Job order basi & kunci kadaluarsa (docs/05 R7, R8) tiap 15 menit. */
const LIMA_BELAS_MENIT = 15 * 60 * 1000;
const job = setInterval(() => {
  jalankanJobOrder()
    .then((h) => {
      if (h.dibatalkan.length + h.dilepas.length > 0) logger.info(h, 'Job order selesai');
    })
    .catch((err: unknown) => logger.error({ err }, 'Job order gagal'));
}, LIMA_BELAS_MENIT);

/** Cadangan harian & uji pulih bulanan (K-084): diperiksa tiap 10 menit dan sesaat setelah menyala. */
const SEPULUH_MENIT = 10 * 60 * 1000;
const cekCadangan = () =>
  cekJadwalCadangan().catch((err: unknown) => logger.error({ err }, 'Jadwal cadangan gagal'));
const jobCadangan = setInterval(() => void cekCadangan(), SEPULUH_MENIT);
const awalCadangan = setTimeout(() => void cekCadangan(), 60 * 1000);

/** Berhenti dengan rapi: tolak koneksi baru, tutup koneksi database, lalu keluar. */
function berhenti(sinyal: string): void {
  logger.info(`${sinyal} diterima, server dihentikan.`);
  clearInterval(job);
  clearInterval(jobCadangan);
  clearTimeout(awalCadangan);
  pengalih?.close();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  // `server.close` menunggu semua koneksi selesai; koneksi siaran (SSE) dan keep-alive bisa menahannya
  // beberapa menit. Permintaan biasa selesai jauh sebelum 10 detik; sisanya diputus.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGINT', () => berhenti('SIGINT'));
process.on('SIGTERM', () => berhenti('SIGTERM'));

/**
 * Galat yang tidak tertangkap di mana pun: keadaan proses tidak lagi bisa dipercaya. Catat ke log (server toko
 * berjalan tanpa konsol, jadi stderr hilang), lalu keluar dengan kode 1 supaya penjaga `jalankan-server.ps1`
 * menyalakan server lagi dalam keadaan bersih (K-082). Transaksi database yang sedang berjalan batal sendiri
 * saat koneksinya putus.
 */
function gagalFatal(jenis: string, err: unknown): void {
  logger.fatal({ err }, `${jenis}: server dihentikan`);
  // Log ke berkas ditulis asinkron: tunggu sampai tertulis, paling lama 2 detik.
  setTimeout(() => process.exit(1), 2000).unref();
  logger.flush(() => process.exit(1));
}

process.on('uncaughtException', (err) => gagalFatal('uncaughtException', err));
process.on('unhandledRejection', (alasan) => gagalFatal('unhandledRejection', alasan));
