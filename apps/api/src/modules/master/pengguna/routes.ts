import { zValidator } from '@hono/zod-validator';
import {
  skemaCariPengguna,
  skemaIzinAkun,
  skemaPeranKustom,
  skemaResetPassword,
  skemaTambahPengguna,
  skemaUbahPengguna,
  STATUS_AKTIF,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
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
import { aturIzinAkun, daftarPeranKustom, simpanPeranKustom, ubahStatusPeranKustom } from './izin';

const izin = requirePermission('master.pengguna.kelola');

/** Kelola pengguna — Owner saja (docs/04 §3). */
const aturIzin = requirePermission('sistem.izin.atur');

export const penggunaRoutes = new Hono<EnvApp>()
  /** K-243: peran khusus (daftar untuk pengelola akun; ubah hanya Owner) dan izin per akun. */
  .get('/peran-kustom', izin, async (c) => c.json({ data: await daftarPeranKustom() }, 200))
  .post('/peran-kustom', aturIzin, zValidator('json', skemaPeranKustom, kaitValidasi), async (c) =>
    c.json(
      { data: await simpanPeranKustom(null, c.req.valid('json'), penggunaWajib(c), c.get('asal')) },
      201,
    ),
  )
  .patch(
    '/peran-kustom/:id',
    aturIzin,
    paramId,
    zValidator('json', skemaPeranKustom, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await simpanPeranKustom(
            c.req.valid('param').id,
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .patch(
    '/peran-kustom/:id/status',
    aturIzin,
    paramId,
    zValidator('json', z.object({ statusAktif: z.enum(STATUS_AKTIF) }), kaitValidasi),
    async (c) => {
      await ubahStatusPeranKustom(
        c.req.valid('param').id,
        c.req.valid('json').statusAktif,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: { ok: true } }, 200);
    },
  )
  .put(
    '/:id/izin',
    aturIzin,
    paramId,
    zValidator('json', skemaIzinAkun, kaitValidasi),
    async (c) => {
      await aturIzinAkun(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: { ok: true } }, 200);
    },
  )
  .get('/', izin, zValidator('query', skemaCariPengguna, kaitValidasi), async (c) => {
    return c.json(await daftarPengguna(c.req.valid('query')), 200);
  })
  .post('/', izin, zValidator('json', skemaTambahPengguna, kaitValidasi), async (c) => {
    const data = await tambahPengguna(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', izin, paramId, zValidator('json', skemaUbahPengguna, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPengguna(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/:id/nonaktifkan', izin, paramId, async (c) => {
    const data = await nonaktifkanPengguna(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/aktifkan', izin, paramId, async (c) => {
    const data = await aktifkanPengguna(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:id/reset-password',
    izin,
    paramId,
    zValidator('json', skemaResetPassword, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = await resetPassword(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .post('/:id/cabut-sesi', izin, paramId, async (c) => {
    const data = await cabutSesiPengguna(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
