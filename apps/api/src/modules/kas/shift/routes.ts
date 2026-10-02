import { zValidator } from '@hono/zod-validator';
import {
  skemaBukaShift,
  skemaCariShift,
  skemaIdParam,
  skemaKasShift,
  skemaTutupShift,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  bukaShift,
  catatKasManual,
  daftarShift,
  detailShift,
  shiftSaya,
  tutupShift,
} from './service';

const sendiri = requirePermission('kas.shift.kelola_sendiri');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Shift kasir & clerical check (docs/05 §10). Akses per shift diperiksa service. */
export const shiftRoutes = new Hono<EnvApp>()
  .get('/saya', sendiri, async (c) => c.json({ data: await shiftSaya(penggunaWajib(c)) }, 200))
  .post('/buka', sendiri, zValidator('json', skemaBukaShift, kaitValidasi), async (c) => {
    const data = await bukaShift(c.req.valid('json').modalAwal, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post('/kas', sendiri, zValidator('json', skemaKasShift, kaitValidasi), async (c) => {
    const data = await catatKasManual(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .get('/', sendiri, zValidator('query', skemaCariShift, kaitValidasi), async (c) =>
    c.json(await daftarShift(c.req.valid('query'), penggunaWajib(c)), 200),
  )
  .get('/:id', sendiri, param, async (c) =>
    c.json({ data: await detailShift(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post(
    '/:id/tutup',
    sendiri,
    param,
    zValidator('json', skemaTutupShift, kaitValidasi),
    async (c) => {
      const data = await tutupShift(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
