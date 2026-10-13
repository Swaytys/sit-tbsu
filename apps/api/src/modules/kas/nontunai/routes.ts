import { zValidator } from '@hono/zod-validator';
import { skemaCariNonTunai, skemaVerifikasiPembayaran } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarNonTunai, verifikasiPembayaran } from './service';

const verifikasi = requirePermission('kas.nontunai.verifikasi');

/** Pengecekan uang masuk pembayaran non-tunai (K-111): daftar dan penandaan hasil. */
export const nonTunaiRoutes = new Hono<EnvApp>()
  .get('/', verifikasi, zValidator('query', skemaCariNonTunai, kaitValidasi), async (c) =>
    c.json(await daftarNonTunai(c.req.valid('query')), 200),
  )
  .post(
    '/:id/verifikasi',
    verifikasi,
    paramId,
    zValidator('json', skemaVerifikasiPembayaran, kaitValidasi),
    async (c) => {
      const data = await verifikasiPembayaran(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
