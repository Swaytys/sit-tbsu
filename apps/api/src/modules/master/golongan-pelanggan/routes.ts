import { zValidator } from '@hono/zod-validator';
import { skemaGolonganPelanggan, skemaSaringStatus, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarGolongan, tambahGolongan, ubahGolongan, ubahStatusGolongan } from './service';

const kelola = requirePermission('master.pelanggan.atur_kredit');

/** Golongan pelanggan (K-097): dibaca pemegang lihat pelanggan, dikelola Admin/Owner (atur pelanggan). */
export const golonganPelangganRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.pelanggan.lihat'),
    zValidator('query', skemaSaringStatus, kaitValidasi),
    async (c) => c.json({ data: await daftarGolongan(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaGolonganPelanggan, kaitValidasi), async (c) => {
    const data = await tambahGolongan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch(
    '/:id',
    kelola,
    paramId,
    zValidator('json', skemaGolonganPelanggan, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = await ubahGolongan(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusGolongan(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
