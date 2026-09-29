import { Hono } from 'hono';
import { daftarSatuan } from './service';

// SEMENTARA (K-051): GET /api/satuan belum memakai requirePermission karena login dan izin
// baru dibuat di Fase 2. Fase 2 wajib menambahkan requirePermission pada rute ini.
export const satuanRoutes = new Hono().get('/', async (c) =>
  c.json({ data: await daftarSatuan() }, 200),
);
