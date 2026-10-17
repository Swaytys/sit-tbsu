import { zValidator } from '@hono/zod-validator';
import { skemaCariSaranPesan } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarSaranPesan } from './service';

/**
 * Rekomendasi pemesanan ulang (K-113): tab Saran Pesan di Stok Persediaan (Admin, Owner). Perkiraan biaya hanya
 * untuk pemegang `master.barang.lihat_hpp` (disaring di service).
 */
export const saranPesanRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('persediaan.stok.lihat'),
  zValidator('query', skemaCariSaranPesan, kaitValidasi),
  async (c) =>
    c.json({ data: await daftarSaranPesan(c.req.valid('query'), penggunaWajib(c).izin) }, 200),
);
