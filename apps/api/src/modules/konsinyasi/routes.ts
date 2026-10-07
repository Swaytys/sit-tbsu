import { zValidator } from '@hono/zod-validator';
import {
  skemaCariPenyelesaianKonsinyasi,
  skemaIdParam,
  skemaPenyelesaianKonsinyasi,
  skemaPratinjauKonsinyasi,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import {
  daftarPenyelesaian,
  detailPenyelesaian,
  pratinjauKonsinyasi,
  ringkasanKonsinyasi,
  selesaikanKonsinyasi,
} from './service';

const kelola = requirePermission('konsinyasi.kelola');

/** Konsinyasi (docs/06 KS5–KS8): ringkasan per pemasok, pratinjau, penyelesaian KSG (append-only). */
export const konsinyasiRoutes = new Hono<EnvApp>()
  .get('/ringkasan', kelola, async (c) => c.json({ data: await ringkasanKonsinyasi() }, 200))
  .get(
    '/pratinjau',
    kelola,
    zValidator('query', skemaPratinjauKonsinyasi, kaitValidasi),
    async (c) => c.json({ data: await pratinjauKonsinyasi(c.req.valid('query')) }, 200),
  )
  .get('/', kelola, zValidator('query', skemaCariPenyelesaianKonsinyasi, kaitValidasi), async (c) =>
    c.json(await daftarPenyelesaian(c.req.valid('query')), 200),
  )
  .get('/:id', kelola, zValidator('param', skemaIdParam, kaitValidasi), async (c) =>
    c.json({ data: await detailPenyelesaian(c.req.valid('param').id) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaPenyelesaianKonsinyasi, kaitValidasi), async (c) => {
    const data = await selesaikanKonsinyasi(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  });
