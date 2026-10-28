import { zValidator } from '@hono/zod-validator';
import { skemaInfoCepat } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requireLogin } from '../../../middleware/require-permission';
import { infoCepat } from './service';

/** K-181: info cepat dokumen dari nomornya; izin dicek per jenis dokumen di service. */
export const infoCepatRoutes = new Hono<EnvApp>().get(
  '/',
  requireLogin(),
  zValidator('query', skemaInfoCepat, kaitValidasi),
  async (c) => c.json({ data: await infoCepat(c.req.valid('query').nomor, penggunaWajib(c)) }, 200),
);
