import { Hono } from 'hono';
import type { EnvApp } from '../../lib/konteks';
import { requirePermission } from '../../middleware/require-permission';
import { peringatanStok } from '../persediaan/stok/service';

/** Dashboard (docs/05 ST3). Fase 4: kartu peringatan stok; kartu lain dibangun di Fase 7. */
export const dashboardRoutes = new Hono<EnvApp>().get(
  '/peringatan-stok',
  requirePermission('dashboard.dasar'),
  async (c) => c.json({ data: await peringatanStok(5) }, 200),
);
