import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarTingkatHarga } from './service';

/** Tingkat harga: dibaca semua peran. Kelola tier (master.harga.kelola) menyusul bersama harga barang. */
export const tingkatHargaRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('master.barang.lihat'),
  async (c) => c.json({ data: await daftarTingkatHarga(penggunaWajib(c).izin) }, 200),
);
