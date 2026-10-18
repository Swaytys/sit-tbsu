import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { paramId } from '../../../lib/validasi';
import { penggunaWajib, requireLogin } from '../../../middleware/require-permission';
import { permintaanBerlaku } from './service';

/**
 * K-136: status permintaan kode milik pengguna yang login (melanjutkan dialog kode yang sempat ditutup). Hanya
 * permintaan buatan sendiri yang bisa dibaca; isinya tidak memuat kode.
 */
export const persetujuanRoutes = new Hono<EnvApp>().get(
  '/:id',
  requireLogin(),
  paramId,
  async (c) =>
    c.json({ data: await permintaanBerlaku(c.req.valid('param').id, penggunaWajib(c)) }, 200),
);
