import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { cekKesehatan } from './service';

// GET /api/health — rute publik (CLAUDE.md aturan 5, daftar pengecualian).
export const healthRoutes = new Hono<EnvApp>().get('/', async (c) =>
  c.json({ data: await cekKesehatan() }, 200),
);
