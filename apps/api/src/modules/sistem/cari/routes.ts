import { zValidator } from '@hono/zod-validator';
import { skemaCari } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { cariUniversal } from './service';

/** K-167: pencarian universal. Semua peran punya `dashboard.dasar`; hasil disaring per izin di service. */
export const cariRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('dashboard.dasar'),
  zValidator('query', skemaCari, kaitValidasi),
  async (c) => c.json({ data: await cariUniversal(c.req.valid('query').q, penggunaWajib(c)) }, 200),
);
