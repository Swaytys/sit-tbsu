import { Hono } from 'hono';
import { cekKesehatan } from './service';

// GET /api/health — rute publik (CLAUDE.md aturan 5, daftar pengecualian).
export const healthRoutes = new Hono().get('/', async (c) =>
  c.json({ data: await cekKesehatan() }, 200),
);
