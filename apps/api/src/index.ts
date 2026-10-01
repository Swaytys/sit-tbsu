import { serve } from '@hono/node-server';
import { app } from './app';
import { pool } from './db/client';
import { env } from './env';
import { logger } from './lib/logger';
import { jalankanJobOrder } from './modules/penjualan/order/service';

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`API berjalan di http://localhost:${info.port}`);
});

/** Job order basi & kunci kadaluarsa (docs/05 R7, R8) tiap 15 menit. */
const LIMA_BELAS_MENIT = 15 * 60 * 1000;
const job = setInterval(() => {
  jalankanJobOrder()
    .then((h) => {
      if (h.dibatalkan.length + h.dilepas.length > 0) logger.info(h, 'Job order selesai');
    })
    .catch((err: unknown) => logger.error({ err }, 'Job order gagal'));
}, LIMA_BELAS_MENIT);

/** Berhenti dengan rapi: tolak koneksi baru, tutup koneksi database, lalu keluar. */
function berhenti(sinyal: string): void {
  logger.info(`${sinyal} diterima, server dihentikan.`);
  clearInterval(job);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => berhenti('SIGINT'));
process.on('SIGTERM', () => berhenti('SIGTERM'));
