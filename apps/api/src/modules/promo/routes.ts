import { zValidator } from '@hono/zod-validator';
import { skemaCariPromo, skemaPromo, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi, paramId } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { daftarPromo, detailPromo, tambahPromo, ubahPromo, ubahStatusPromo } from './service';

const kelola = requirePermission('promo.kelola');

/** Master promo (docs/06 §3, docs/04 §2): Admin/Owner. Tidak ada DELETE; dinonaktifkan. */
export const promoRoutes = new Hono<EnvApp>()
  .get('/', kelola, zValidator('query', skemaCariPromo, kaitValidasi), async (c) =>
    c.json(await daftarPromo(c.req.valid('query')), 200),
  )
  .get('/:id', kelola, paramId, async (c) =>
    c.json({ data: await detailPromo(c.req.valid('param').id) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaPromo, kaitValidasi), async (c) => {
    const data = await tambahPromo(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaPromo, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPromo(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusPromo(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
