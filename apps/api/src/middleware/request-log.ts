import type { MiddlewareHandler } from 'hono';
import type { EnvApp } from '../lib/konteks';
import { logger } from '../lib/logger';

/** Mencatat setiap request: metode, path, status, durasi, dan pengguna (bila login). */
export const requestLog: MiddlewareHandler<EnvApp> = async (c, next) => {
  const mulai = performance.now();
  await next();
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - mulai),
      pengguna: c.var.pengguna?.username,
    },
    'request',
  );
};
