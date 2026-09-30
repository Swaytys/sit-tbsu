import { zValidator } from '@hono/zod-validator';
import { skemaCariLog } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { requirePermission } from '../../../middleware/require-permission';
import { daftarLog } from './service';

/** Log aktivitas: hanya-baca, hanya Owner (docs/04 §8). Log tidak bisa diubah atau dihapus. */
export const logRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('sistem.log.lihat'),
  zValidator('query', skemaCariLog, kaitValidasi),
  async (c) => c.json(await daftarLog(c.req.valid('query')), 200),
);
