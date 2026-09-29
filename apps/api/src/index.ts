import { serve } from '@hono/node-server';
import { app } from './app';
import { pool } from './db/client';
import { env } from './env';
import { logger } from './lib/logger';

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`API berjalan di http://localhost:${info.port}`);
});

/** Berhenti dengan rapi: tolak koneksi baru, tutup koneksi database, lalu keluar. */
function berhenti(sinyal: string): void {
  logger.info(`${sinyal} diterima, server dihentikan.`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => berhenti('SIGINT'));
process.on('SIGTERM', () => berhenti('SIGTERM'));
