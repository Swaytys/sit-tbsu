import { zValidator } from '@hono/zod-validator';
import { skemaKategori, skemaSaringStatus, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarKategori, tambahKategori, ubahKategori, ubahStatusKategori } from './service';

const kelola = requirePermission('master.kategori.kelola');

/** Kategori: dibaca semua peran (filter barang), dikelola Admin/Owner (docs/04 §3). */
export const kategoriRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.barang.lihat'),
    zValidator('query', skemaSaringStatus, kaitValidasi),
    async (c) => c.json({ data: await daftarKategori(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaKategori, kaitValidasi), async (c) => {
    const data = await tambahKategori(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaKategori, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahKategori(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
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
      const data = await ubahStatusKategori(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
