import { zValidator } from '@hono/zod-validator';
import { skemaMerk, skemaSaringStatus, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarMerk, tambahMerk, ubahMerk, ubahStatusMerk } from './service';

const kelola = requirePermission('master.kategori.kelola');

/** Merk: dibaca semua peran (filter barang), dikelola pemegang izin kelola kategori (K-063). */
export const merkRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.barang.lihat'),
    zValidator('query', skemaSaringStatus, kaitValidasi),
    async (c) => c.json({ data: await daftarMerk(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaMerk, kaitValidasi), async (c) => {
    const data = await tambahMerk(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaMerk, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahMerk(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusMerk(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
