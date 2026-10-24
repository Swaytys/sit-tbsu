import { zValidator } from '@hono/zod-validator';
import { skemaCariLog, skemaEksporLog } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarLog, eksporLog } from './service';

/** Log aktivitas: hanya-baca, hanya Owner (docs/04 §8). Log tidak bisa diubah atau dihapus. */
export const logRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('sistem.log.lihat'),
    zValidator('query', skemaCariLog, kaitValidasi),
    async (c) => c.json(await daftarLog(c.req.valid('query')), 200),
  )
  .get(
    '/ekspor',
    requirePermission('sistem.log.lihat'),
    zValidator('query', skemaEksporLog, kaitValidasi),
    async (c) => {
      const { isi, header } = await eksporLog(
        c.req.valid('query'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.body(isi, 200, header);
    },
  );
