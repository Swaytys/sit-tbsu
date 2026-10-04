import { Hono } from 'hono';
import type { EnvApp } from '../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { peringatanStok } from '../persediaan/stok/service';
import { aktivitasDashboard, ringkasanDashboard } from './service';

const dasar = requirePermission('dashboard.dasar');

/** Dashboard per peran (docs/05 ST3): kartu ringkasan, grafik 7 hari, peringatan stok, aktivitas. */
export const dashboardRoutes = new Hono<EnvApp>()
  .get('/ringkasan', dasar, async (c) =>
    c.json({ data: await ringkasanDashboard(penggunaWajib(c).izin) }, 200),
  )
  .get('/aktivitas', dasar, async (c) => {
    const p = penggunaWajib(c);
    return c.json({ data: await aktivitasDashboard(p.id, p.izin) }, 200);
  })
  .get('/peringatan-stok', dasar, async (c) => c.json({ data: await peringatanStok(5) }, 200));
