import { Hono } from 'hono';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLog } from './middleware/request-log';
import { satuanRoutes } from './modules/master/satuan/routes';
import { healthRoutes } from './modules/sistem/health/routes';

/** Semua rute di bawah /api. Tipenya dipakai klien RPC web: `hc<AppType>('/api')`. */
const rute = new Hono().route('/health', healthRoutes).route('/satuan', satuanRoutes);

export const app = new Hono();
app.use(requestLog);
app.route('/api', rute);
app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof rute;
