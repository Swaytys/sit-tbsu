import { zValidator } from '@hono/zod-validator';
import { skemaCariMutasi, skemaCariStok, skemaKartuStok } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { stokTertahan } from '../../penjualan/order/service';
import { daftarMutasi, daftarStok, eksporStok, kartuStok } from './service';

const lihat = requirePermission('persediaan.stok.lihat');

/** Stok Persediaan (docs/04 §4): posisi, mutasi, kartu stok. Admin dan Owner. */
export const stokRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariStok, kaitValidasi), async (c) =>
    c.json(await daftarStok(c.req.valid('query'), penggunaWajib(c).izin), 200),
  )
  .get('/ekspor', lihat, zValidator('query', skemaCariStok, kaitValidasi), async (c) => {
    const { isi, header } = await eksporStok(c.req.valid('query'), penggunaWajib(c).izin);
    return c.body(isi, 200, header);
  })
  .get('/tertahan', lihat, async (c) => c.json({ data: await stokTertahan() }, 200))
  .get('/mutasi', lihat, zValidator('query', skemaCariMutasi, kaitValidasi), async (c) =>
    c.json(await daftarMutasi(c.req.valid('query'), penggunaWajib(c).izin), 200),
  )
  .get(
    '/kartu/:id',
    lihat,
    paramId,
    zValidator('query', skemaKartuStok, kaitValidasi),
    async (c) => {
      const data = await kartuStok(
        c.req.valid('param').id,
        c.req.valid('query'),
        penggunaWajib(c).izin,
      );
      return c.json({ data }, 200);
    },
  );
