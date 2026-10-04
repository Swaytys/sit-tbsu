import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import pino from 'pino';
import { env } from '../env';

const BATAS_UKURAN = 10 * 1024 * 1024;
const SIMPAN = 5;

/** Putar berkas log saat server menyala: log.1 … log.5, yang tertua dibuang. */
function putarLog(berkas: string): void {
  if (!existsSync(berkas) || statSync(berkas).size < BATAS_UKURAN) return;
  rmSync(`${berkas}.${SIMPAN}`, { force: true });
  for (let i = SIMPAN - 1; i >= 1; i--) {
    if (existsSync(`${berkas}.${i}`)) renameSync(`${berkas}.${i}`, `${berkas}.${i + 1}`);
  }
  renameSync(berkas, `${berkas}.1`);
}

function tujuan() {
  if (!env.LOG_FILE) return undefined;
  putarLog(env.LOG_FILE);
  return pino.destination({ dest: env.LOG_FILE, mkdir: true, sync: false });
}

/**
 * Logger aplikasi. Di dev ditampilkan rapi lewat pino-pretty; di produksi JSON per baris ke stdout,
 * atau ke berkas `LOG_FILE` bila diisi (server Windows tanpa konsol, K-082).
 */
export const logger =
  env.NODE_ENV === 'development' && !env.LOG_FILE
    ? pino({
        level: env.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      })
    : pino({ level: env.LOG_LEVEL }, tujuan());
