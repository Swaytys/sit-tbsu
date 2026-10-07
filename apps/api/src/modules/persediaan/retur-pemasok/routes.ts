import { zValidator } from '@hono/zod-validator';
import { skemaCariReturPemasok, skemaIdParam, skemaReturPemasok } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarReturPemasok, detailReturPemasok, simpanReturPemasok } from './service';

const kelola = requirePermission('persediaan.retur_pemasok.kelola');

/** Retur ke pemasok (docs/06 §6): Admin/Owner. Tidak ada ubah atau hapus (append-only). */
export const returPemasokRoutes = new Hono<EnvApp>()
  .get('/', kelola, zValidator('query', skemaCariReturPemasok, kaitValidasi), async (c) =>
    c.json(await daftarReturPemasok(c.req.valid('query')), 200),
  )
  .get('/:id', kelola, zValidator('param', skemaIdParam, kaitValidasi), async (c) =>
    c.json({ data: await detailReturPemasok(c.req.valid('param').id) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaReturPemasok, kaitValidasi), async (c) => {
    const data = await simpanReturPemasok(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  });
