import { zValidator } from '@hono/zod-validator';
import {
  skemaCariInteraksi,
  skemaEksporInteraksi,
  skemaKirimInteraksi,
  skemaSetelanInteraksi,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import {
  penggunaWajib,
  requireLogin,
  requirePermission,
} from '../../../middleware/require-permission';
import {
  bacaSetelan,
  daftarInteraksi,
  eksporInteraksi,
  ringkasanInteraksi,
  terimaInteraksi,
  ubahSetelan,
} from './service';

const owner = requirePermission('sistem.log.lihat');

/**
 * K-190: log interaksi penelitian. Setelan dibaca dan kejadian dikirim oleh semua pengguna login (hanya data
 * pemakaian dirinya sendiri); melihat, mengekspor, dan menyalakan/mematikan hanya Owner (`sistem.log.lihat`).
 */
export const interaksiRoutes = new Hono<EnvApp>()
  .get('/setelan', requireLogin(), async (c) => c.json({ data: await bacaSetelan() }, 200))
  .post('/', requireLogin(), zValidator('json', skemaKirimInteraksi, kaitValidasi), async (c) => {
    const diterima = await terimaInteraksi(c.req.valid('json'), penggunaWajib(c));
    return c.json({ data: { diterima } }, 200);
  })
  .get('/ringkasan', owner, async (c) => c.json({ data: await ringkasanInteraksi() }, 200))
  .put('/setelan', owner, zValidator('json', skemaSetelanInteraksi, kaitValidasi), async (c) =>
    c.json({ data: await ubahSetelan(c.req.valid('json'), penggunaWajib(c), c.get('asal')) }, 200),
  )
  .get('/', owner, zValidator('query', skemaCariInteraksi, kaitValidasi), async (c) =>
    c.json(await daftarInteraksi(c.req.valid('query')), 200),
  )
  .get('/ekspor', owner, zValidator('query', skemaEksporInteraksi, kaitValidasi), async (c) => {
    const { isi, header } = await eksporInteraksi(
      c.req.valid('query'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.body(isi, 200, header);
  });
