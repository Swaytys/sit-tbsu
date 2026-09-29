import type { MiddlewareHandler } from 'hono';
import { logger } from '../lib/logger';

/** Mencatat setiap request: metode, path, status, dan durasi. */
export const requestLog: MiddlewareHandler = async (c, next) => {
  const mulai = performance.now();
  await next();
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - mulai),
    },
    'request',
  );
};
