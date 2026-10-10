import { zValidator } from '@hono/zod-validator';
import { skemaSaringStatus, skemaSatuanInput, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarSatuan, tambahSatuan, ubahSatuan, ubahStatusSatuan } from './service';

const kelola = requirePermission('master.satuan.kelola');

// Membaca satuan butuh `master.barang.lihat` (semua peran): nama satuan tampil di barang, order, dan
// struk (K-054). Mengubah satuan memakai `master.satuan.kelola` (Admin/Owner).
export const satuanRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.barang.lihat'),
    zValidator('query', skemaSaringStatus, kaitValidasi),
    async (c) => c.json({ data: await daftarSatuan(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaSatuanInput, kaitValidasi), async (c) => {
    const data = await tambahSatuan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaSatuanInput, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahSatuan(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
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
      const data = await ubahStatusSatuan(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
