import { zValidator } from '@hono/zod-validator';
import { skemaHasilPenjualan } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { hasilPenjualan } from './service';

/** K-126: Hasil Penjualan (menu Transaksi), izin sama dengan laporan penjualan; laba disaring di service. */
export const hasilPenjualanRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('laporan.penjualan'),
  zValidator('query', skemaHasilPenjualan, kaitValidasi),
  async (c) =>
    c.json({ data: await hasilPenjualan(c.req.valid('query'), penggunaWajib(c).izin) }, 200),
);
