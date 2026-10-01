import { zValidator } from '@hono/zod-validator';
import { skemaBatalOrder, skemaCariOrder, skemaIdParam, skemaOrder } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  batalOrder,
  buatOrder,
  daftarOrder,
  detailOrder,
  kirimOrder,
  lepasOrder,
  prosesOrder,
  ubahOrder,
} from './service';

const buat = requirePermission('penjualan.order.buat');
const checkout = requirePermission('penjualan.checkout');
const param = zValidator('param', skemaIdParam, kaitValidasi);
const opsiKirim = zValidator(
  'query',
  z.object({ kirim: z.enum(['true', 'false']).optional() }),
  kaitValidasi,
);

/** Order penjualan & antrean (docs/05 §3). Pemeriksaan pemilik/kunci ada di service. */
export const orderRoutes = new Hono<EnvApp>()
  .get('/', buat, zValidator('query', skemaCariOrder, kaitValidasi), async (c) =>
    c.json(await daftarOrder(c.req.valid('query'), penggunaWajib(c)), 200),
  )
  .get('/:id', buat, param, async (c) =>
    c.json({ data: await detailOrder(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post('/', buat, opsiKirim, zValidator('json', skemaOrder, kaitValidasi), async (c) => {
    const data = await buatOrder(
      c.req.valid('json'),
      { kirim: c.req.valid('query').kirim === 'true' },
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 201);
  })
  .put('/:id', buat, param, zValidator('json', skemaOrder, kaitValidasi), async (c) => {
    const data = await ubahOrder(
      c.req.valid('param').id,
      c.req.valid('json'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/kirim', buat, param, async (c) =>
    c.json(
      { data: await kirimOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/:id/proses', checkout, param, async (c) =>
    c.json(
      { data: await prosesOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/:id/lepas', checkout, param, async (c) =>
    c.json(
      { data: await lepasOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post(
    '/:id/batal',
    requirePermission('penjualan.order.batal_sendiri'),
    param,
    zValidator('json', skemaBatalOrder, kaitValidasi),
    async (c) => {
      const data = await batalOrder(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
