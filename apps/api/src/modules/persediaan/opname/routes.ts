import { zValidator } from '@hono/zod-validator';
import { skemaDaftarHarian } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { ringkasanOpname, susunDaftarHarian } from './service';

/** K-240: Stok Opname bertahap (ringkasan ABC, daftar hitung harian acak). */
export const opnameRoutes = new Hono<EnvApp>()
  .get('/ringkasan', requirePermission('persediaan.stok.lihat'), async (c) =>
    c.json({ data: await ringkasanOpname() }, 200),
  )
  .post(
    '/daftar-harian',
    requirePermission('persediaan.opname.atur'),
    zValidator('json', skemaDaftarHarian, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await susunDaftarHarian(
            c.req.valid('json').jumlah,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        201,
      ),
  );
