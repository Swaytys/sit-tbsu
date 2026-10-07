import { zValidator } from '@hono/zod-validator';
import { JENIS_DOKUMEN_HUTANG, skemaBayarHutang, skemaCariHutang } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { bayarHutang, daftarHutang, pembayaranHutang, penerimaanBerhutang } from './service';

const lihat = requirePermission('hutang.lihat');

/** Hutang pemasok (docs/06 §5): daftar & umur (`hutang.lihat`), pembayaran (`hutang.kelola`). */
export const hutangRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariHutang, kaitValidasi), async (c) =>
    c.json(await daftarHutang(c.req.valid('query')), 200),
  )
  .get(
    '/penerimaan-pemasok/:idPemasok',
    lihat,
    zValidator('param', z.object({ idPemasok: z.coerce.number().int().positive() }), kaitValidasi),
    async (c) => c.json({ data: await penerimaanBerhutang(c.req.valid('param').idPemasok) }, 200),
  )
  .get(
    '/:jenis/:id/pembayaran',
    lihat,
    zValidator(
      'param',
      z.object({ jenis: z.enum(JENIS_DOKUMEN_HUTANG), id: z.coerce.number().int().positive() }),
      kaitValidasi,
    ),
    async (c) => {
      const { jenis, id } = c.req.valid('param');
      return c.json({ data: await pembayaranHutang(jenis, id) }, 200);
    },
  )
  .post(
    '/bayar',
    requirePermission('hutang.kelola'),
    zValidator('json', skemaBayarHutang, kaitValidasi),
    async (c) => {
      const data = await bayarHutang(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
