import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { requirePermission } from '../../../middleware/require-permission';
import { periksaAksesPerangkat, statusAksesPerangkat } from './tailscale';

const izin = requirePermission('sistem.pengaturan.kelola');

/** K-217: Pengaturan › Akses HP/tablet. */
export const aksesRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await statusAksesPerangkat() }, 200))
  .post('/periksa', izin, async (c) => c.json({ data: await periksaAksesPerangkat(false) }, 200))
  .post('/aktifkan', izin, async (c) => c.json({ data: await periksaAksesPerangkat(true) }, 200));
