import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalKoreksi,
  skemaCariKoreksi,
  skemaSetujui,
  skemaSetujuiKode,
  skemaTolak,
  skemaVoid,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ajukanVoid,
  batalVoid,
  daftarVoid,
  detailVoid,
  kandidatVoid,
  setujuiVoid,
  mintaKodeVoid,
  setujuiVoidDenganKode,
  tolakVoid,
} from './service';

const ajukan = requirePermission('void.ajukan');
const setujui = requirePermission('void.setujui');

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
  .get('/:id', ajukan, paramId, async (c) =>
    c.json({ data: await detailVoid(c.req.valid('param').id) }, 200),
  )
  .post('/', ajukan, zValidator('json', skemaVoid, kaitValidasi), async (c) => {
    const data = await ajukanVoid(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/:id/setujui',
    setujui,
    paramId,
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
  // K-102: pengaju (izin ajukan) meminta kode untuk atasan, lalu mengetik kode yang disebutkan atasan.
  .post('/:id/minta-kode', ajukan, paramId, async (c) => {
    const data = await mintaKodeVoid(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:id/setujui-kode',
    ajukan,
    paramId,
    zValidator('json', skemaSetujuiKode, kaitValidasi),
    async (c) => {
      const { kode, ...persetujuan } = c.req.valid('json');
      const data = await setujuiVoidDenganKode(
        c.req.valid('param').id,
        persetujuan,
        kode,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/batal',
    ajukan,
    paramId,
    zValidator('json', skemaBatalKoreksi, kaitValidasi),
    async (c) => {
      const data = await batalVoid(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/:id/tolak', setujui, paramId, zValidator('json', skemaTolak, kaitValidasi), async (c) => {
    const data = await tolakVoid(
      c.req.valid('param').id,
      c.req.valid('json').alasan,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
