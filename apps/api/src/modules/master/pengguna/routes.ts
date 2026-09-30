import { zValidator } from '@hono/zod-validator';
import {
  skemaCariPengguna,
  skemaIdParam,
  skemaResetPassword,
  skemaTambahPengguna,
  skemaUbahPengguna,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  aktifkanPengguna,
  cabutSesiPengguna,
  daftarPengguna,
  nonaktifkanPengguna,
  resetPassword,
  tambahPengguna,
  ubahPengguna,
} from './service';

const izin = requirePermission('master.pengguna.kelola');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Kelola pengguna — Owner saja (docs/04 §3). */
export const penggunaRoutes = new Hono<EnvApp>()
  .get('/', izin, zValidator('query', skemaCariPengguna, kaitValidasi), async (c) => {
    return c.json(await daftarPengguna(c.req.valid('query')), 200);
  })
  .post('/', izin, zValidator('json', skemaTambahPengguna, kaitValidasi), async (c) => {
    const data = await tambahPengguna(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', izin, param, zValidator('json', skemaUbahPengguna, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPengguna(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/:id/nonaktifkan', izin, param, async (c) => {
    const data = await nonaktifkanPengguna(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/aktifkan', izin, param, async (c) => {
    const data = await aktifkanPengguna(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:id/reset-password',
    izin,
    param,
    zValidator('json', skemaResetPassword, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = await resetPassword(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .post('/:id/cabut-sesi', izin, param, async (c) => {
    const data = await cabutSesiPengguna(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
