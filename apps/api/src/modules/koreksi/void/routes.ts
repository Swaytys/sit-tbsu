import { zValidator } from '@hono/zod-validator';
import { skemaCariKoreksi, skemaIdParam, skemaSetujui, skemaTolak, skemaVoid } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ajukanVoid,
  daftarVoid,
  detailVoid,
  kandidatVoid,
  setujuiVoid,
  tolakVoid,
} from './service';

const ajukan = requirePermission('void.ajukan');
const setujui = requirePermission('void.setujui');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Void transaksi (docs/05 §9, docs/04 §6). */
export const voidRoutes = new Hono<EnvApp>()
  .get(
    '/kandidat',
    ajukan,
    zValidator('query', z.object({ cari: z.string().trim().max(100).optional() }), kaitValidasi),
    async (c) => c.json({ data: await kandidatVoid(c.req.valid('query').cari) }, 200),
  )
  .get('/', ajukan, zValidator('query', skemaCariKoreksi, kaitValidasi), async (c) =>
    c.json(await daftarVoid(c.req.valid('query')), 200),
  )
  .get('/:id', ajukan, param, async (c) =>
    c.json({ data: await detailVoid(c.req.valid('param').id) }, 200),
  )
  .post('/', ajukan, zValidator('json', skemaVoid, kaitValidasi), async (c) => {
    const data = await ajukanVoid(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/:id/setujui',
    setujui,
    param,
    zValidator('json', skemaSetujui, kaitValidasi),
    async (c) => {
      const data = await setujuiVoid(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/:id/tolak', setujui, param, zValidator('json', skemaTolak, kaitValidasi), async (c) => {
    const data = await tolakVoid(
      c.req.valid('param').id,
      c.req.valid('json').alasan,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
