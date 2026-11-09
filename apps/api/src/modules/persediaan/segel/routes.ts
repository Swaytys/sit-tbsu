import { zValidator } from '@hono/zod-validator';
import { skemaBukaSegel, skemaKemasanSegel } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { aturKemasanSegel, bukaSegel, detailSegel } from './service';

/** K-227: kemasan tersegel (stok dua lapis: box segel + ecer). */
export const segelRoutes = new Hono<EnvApp>()
  .get('/:id', requirePermission('persediaan.stok.lihat'), paramId, async (c) =>
    c.json({ data: await detailSegel(c.req.valid('param').id) }, 200),
  )
  .put(
    '/:id/kemasan',
    requirePermission('master.barang.kelola'),
    paramId,
    zValidator('json', skemaKemasanSegel, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await aturKemasanSegel(
            c.req.valid('param').id,
            c.req.valid('json').idSatuanJual,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post(
    '/:id/buka',
    requirePermission('persediaan.segel.buka'),
    paramId,
    zValidator('json', skemaBukaSegel, kaitValidasi),
    async (c) => {
      const { jumlah, alasan } = c.req.valid('json');
      return c.json(
        {
          data: await bukaSegel(
            c.req.valid('param').id,
            jumlah,
            alasan,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      );
    },
  );
