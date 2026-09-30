import { zValidator } from '@hono/zod-validator';
import { skemaUbahPengaturan } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { bacaPengaturan, ubahPengaturan } from './service';

const izin = requirePermission('sistem.pengaturan.kelola');

/** Pengaturan toko — Admin dan Owner (docs/04 §3). */
export const pengaturanRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await bacaPengaturan() }, 200))
  .patch('/', izin, zValidator('json', skemaUbahPengaturan, kaitValidasi), async (c) => {
    const data = await ubahPengaturan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
