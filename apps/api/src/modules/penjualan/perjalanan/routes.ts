import { zValidator } from '@hono/zod-validator';
import { skemaBerangkat, skemaCariPerjalanan } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { berangkat, daftarPerjalanan } from './service';

const kelola = requirePermission('penjualan.surat_jalan.kelola');

/** Perjalanan pengantaran (docs/05 S9, S12). */
export const perjalananRoutes = new Hono<EnvApp>()
  .get('/', kelola, zValidator('query', skemaCariPerjalanan, kaitValidasi), async (c) =>
    c.json(await daftarPerjalanan(c.req.valid('query')), 200),
  )
  .post('/', kelola, zValidator('json', skemaBerangkat, kaitValidasi), async (c) => {
    const data = await berangkat(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  });
