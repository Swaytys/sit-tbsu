import { zValidator } from '@hono/zod-validator';
import { skemaCariPenerimaan, skemaPenerimaan } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarPenerimaan, detailPenerimaan, simpanPenerimaan } from './service';

const izin = requirePermission('persediaan.penerimaan.kelola');

/** Penerimaan barang (docs/05 §11): Admin dan Owner. Tidak ada ubah/hapus (E5). */
export const penerimaanRoutes = new Hono<EnvApp>()
  .get('/', izin, zValidator('query', skemaCariPenerimaan, kaitValidasi), async (c) =>
    c.json(await daftarPenerimaan(c.req.valid('query')), 200),
  )
  .get('/:id', izin, paramId, async (c) =>
    c.json({ data: await detailPenerimaan(c.req.valid('param').id) }, 200),
  )
  .post('/', izin, zValidator('json', skemaPenerimaan, kaitValidasi), async (c) => {
    const data = await simpanPenerimaan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  });
