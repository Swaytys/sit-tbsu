import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalRit,
  skemaBerangkat,
  skemaBerangkatRit,
  skemaCariPerjalanan,
  skemaIsiRit,
  skemaPratinjauMuatan,
  skemaRencanaRit,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  batalkanRit,
  berangkat,
  berangkatkanRit,
  daftarPerjalanan,
  isiRit,
  keluarkanDariRit,
  muatRit,
  pratinjauMuatan,
  rencanakanRit,
} from './service';

const kelola = requirePermission('penjualan.surat_jalan.kelola');
const skemaKeluar = z.object({ idSuratJalan: z.number().int().positive() });

/** Perjalanan (rit) pengantaran: berangkat langsung (S9) dan rit rencana papan Pengiriman (S14, K-160). */
export const perjalananRoutes = new Hono<EnvApp>()
  .get('/', kelola, zValidator('query', skemaCariPerjalanan, kaitValidasi), async (c) =>
    c.json(await daftarPerjalanan(c.req.valid('query')), 200),
  )
  .post(
    '/pratinjau-muatan',
    kelola,
    zValidator('json', skemaPratinjauMuatan, kaitValidasi),
    async (c) => c.json({ data: await pratinjauMuatan(c.req.valid('json')) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaBerangkat, kaitValidasi), async (c) => {
    const data = await berangkat(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post('/rencana', kelola, zValidator('json', skemaRencanaRit, kaitValidasi), async (c) => {
    const data = await rencanakanRit(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post('/keluar', kelola, zValidator('json', skemaKeluar, kaitValidasi), async (c) => {
    await keluarkanDariRit(c.req.valid('json').idSuratJalan, penggunaWajib(c), c.get('asal'));
    return c.json({ data: null }, 200);
  })
  .post('/:id/isi', kelola, paramId, zValidator('json', skemaIsiRit, kaitValidasi), async (c) => {
    const data = await isiRit(
      c.req.valid('param').id,
      c.req.valid('json'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/dimuat', kelola, paramId, async (c) => {
    const data = await muatRit(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:id/berangkat',
    kelola,
    paramId,
    zValidator('json', skemaBerangkatRit, kaitValidasi),
    async (c) => {
      const data = await berangkatkanRit(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/batal',
    kelola,
    paramId,
    zValidator('json', skemaBatalRit, kaitValidasi),
    async (c) => {
      const data = await batalkanRit(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
