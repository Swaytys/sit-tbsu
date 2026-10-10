import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalKoreksi,
  skemaCariKoreksi,
  skemaRetur,
  skemaSetujui,
  skemaSetujuiDiTempat,
  skemaTolak,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ajukanRetur,
  batalRetur,
  daftarRetur,
  detailRetur,
  kandidatRetur,
  setujuiRetur,
  setujuiReturDiTempat,
  tolakRetur,
} from './service';

const ajukan = requirePermission('retur.ajukan');
const setujui = requirePermission('retur.setujui');

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
  .get('/:id', ajukan, paramId, async (c) =>
    c.json({ data: await detailRetur(c.req.valid('param').id) }, 200),
  )
  .post('/', ajukan, zValidator('json', skemaRetur, kaitValidasi), async (c) => {
    const data = await ajukanRetur(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/:id/setujui',
    setujui,
    paramId,
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
  // K-099: pengaju (izin ajukan) memanggil, akun atasan di badan permintaan yang membawa wewenangnya.
  .post(
    '/:id/setujui-di-tempat',
    ajukan,
    paramId,
    zValidator('json', skemaSetujuiDiTempat, kaitValidasi),
    async (c) => {
      const { atasan, ...persetujuan } = c.req.valid('json');
      const data = await setujuiReturDiTempat(
        c.req.valid('param').id,
        persetujuan,
        atasan,
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
      const data = await batalRetur(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/:id/tolak', setujui, paramId, zValidator('json', skemaTolak, kaitValidasi), async (c) => {
    const data = await tolakRetur(
      c.req.valid('param').id,
      c.req.valid('json').alasan,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
