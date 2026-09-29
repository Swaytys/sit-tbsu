import pino from 'pino';
import { env } from '../env';

/** Logger aplikasi. Di dev ditampilkan rapi lewat pino-pretty; di produksi JSON per baris. */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
