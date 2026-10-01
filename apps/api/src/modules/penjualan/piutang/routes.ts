import { zValidator } from '@hono/zod-validator';
import { skemaCariPiutang } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { requirePermission } from '../../../middleware/require-permission';
import { daftarPiutang } from './service';

/** Piutang (docs/06 §4). Pelunasan lewat `POST /api/penjualan/:id/pembayaran`. */
export const piutangRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('penjualan.piutang.lihat'),
  zValidator('query', skemaCariPiutang, kaitValidasi),
  async (c) => c.json(await daftarPiutang(c.req.valid('query')), 200),
);
