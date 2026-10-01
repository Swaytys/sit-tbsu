import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalSuratJalan,
  skemaCariSuratJalan,
  skemaIdParam,
  skemaStatusSuratJalan,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  batalSuratJalan,
  daftarSuratJalan,
  detailSuratJalan,
  ubahStatusSuratJalan,
} from './service';

const kelola = requirePermission('penjualan.surat_jalan.kelola');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Surat jalan (docs/05 §7). Pembuatan lewat `POST /api/penjualan/:id/surat-jalan`. */
export const suratJalanRoutes = new Hono<EnvApp>()
  .get('/', kelola, zValidator('query', skemaCariSuratJalan, kaitValidasi), async (c) =>
    c.json(await daftarSuratJalan(c.req.valid('query')), 200),
  )
  .get('/:id', kelola, param, async (c) =>
    c.json({ data: await detailSuratJalan(c.req.valid('param').id) }, 200),
  )
  .post(
    '/:id/status',
    kelola,
    param,
    zValidator('json', skemaStatusSuratJalan, kaitValidasi),
    async (c) => {
      const data = await ubahStatusSuratJalan(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/batal',
    kelola,
    param,
    zValidator('json', skemaBatalSuratJalan, kaitValidasi),
    async (c) => {
      const data = await batalSuratJalan(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
