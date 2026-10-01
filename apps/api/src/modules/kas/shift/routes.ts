import { zValidator } from '@hono/zod-validator';
import { skemaBukaShift } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { bukaShift, shiftSaya } from './service';

const sendiri = requirePermission('kas.shift.kelola_sendiri');

/** Shift kasir milik sendiri (K1). */
export const shiftRoutes = new Hono<EnvApp>()
  .get('/saya', sendiri, async (c) => c.json({ data: await shiftSaya(penggunaWajib(c)) }, 200))
  .post('/buka', sendiri, zValidator('json', skemaBukaShift, kaitValidasi), async (c) => {
    const data = await bukaShift(c.req.valid('json').modalAwal, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  });
