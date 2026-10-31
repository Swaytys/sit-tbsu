import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import {
  penggunaWajib,
  requireLogin,
  requirePermission,
} from '../../../middleware/require-permission';
import { bacaMatiMendadak, selesaiPeriksa } from './service';

/** K-216: catatan mati mendadak dibaca semua pengguna yang login; ditandai selesai oleh pemegang shift. */
export const pemulihanRoutes = new Hono<EnvApp>()
  .get('/', requireLogin(), async (c) => c.json({ data: await bacaMatiMendadak() }, 200))
  .post('/selesai', requirePermission('kas.shift.kelola_sendiri'), async (c) => {
    await selesaiPeriksa(penggunaWajib(c), c.get('asal'));
    return c.json({ data: { selesai: true } }, 200);
  });
