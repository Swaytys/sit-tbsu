import { zValidator } from '@hono/zod-validator';
import { skemaCariKoreksi, skemaIdParam, skemaSetujui, skemaTolak, skemaRetur } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ajukanRetur,
  daftarRetur,
  detailRetur,
  kandidatRetur,
  setujuiRetur,
  tolakRetur,
} from './service';

const ajukan = requirePermission('retur.ajukan');
const setujui = requirePermission('retur.setujui');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Retur penjualan (docs/05 §8, docs/04 §6). */
export const returRoutes = new Hono<EnvApp>()
  .get(
    '/kandidat',
    ajukan,
    zValidator('query', z.object({ cari: z.string().trim().max(100).optional() }), kaitValidasi),
    async (c) => c.json({ data: await kandidatRetur(c.req.valid('query').cari ?? '') }, 200),
  )
  .get('/', ajukan, zValidator('query', skemaCariKoreksi, kaitValidasi), async (c) =>
    c.json(await daftarRetur(c.req.valid('query')), 200),
  )
  .get('/:id', ajukan, param, async (c) =>
    c.json({ data: await detailRetur(c.req.valid('param').id) }, 200),
  )
  .post('/', ajukan, zValidator('json', skemaRetur, kaitValidasi), async (c) => {
    const data = await ajukanRetur(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/:id/setujui',
    setujui,
    param,
    zValidator('json', skemaSetujui, kaitValidasi),
    async (c) => {
      const data = await setujuiRetur(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/:id/tolak', setujui, param, zValidator('json', skemaTolak, kaitValidasi), async (c) => {
    const data = await tolakRetur(
      c.req.valid('param').id,
      c.req.valid('json').alasan,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
