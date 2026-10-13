import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requireLogin } from '../../../middleware/require-permission';
import { notifikasiPengguna } from './service';

/** Semua pengguna login; isi disaring per izin di service (docs/05 ST2). */
export const notifikasiRoutes = new Hono<EnvApp>().get('/', requireLogin(), async (c) =>
  c.json({ data: await notifikasiPengguna(penggunaWajib(c)) }, 200),
);
