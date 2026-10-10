import { zValidator } from '@hono/zod-validator';
import { skemaTingkatHargaInput, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  daftarTingkatHarga,
  tambahTingkatHarga,
  ubahStatusTingkatHarga,
  ubahTingkatHarga,
} from './service';

const kelola = requirePermission('master.harga.kelola');

/** Tingkat harga: dibaca semua peran, dikelola pemegang `master.harga.kelola` (docs/04 §3). */
export const tingkatHargaRoutes = new Hono<EnvApp>()
  .get('/', requirePermission('master.barang.lihat'), async (c) =>
    c.json({ data: await daftarTingkatHarga(penggunaWajib(c).izin) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaTingkatHargaInput, kaitValidasi), async (c) => {
    const data = await tambahTingkatHarga(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch(
    '/:id',
    kelola,
    paramId,
    zValidator('json', skemaTingkatHargaInput, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = await ubahTingkatHarga(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
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
      const data = await ubahStatusTingkatHarga(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
