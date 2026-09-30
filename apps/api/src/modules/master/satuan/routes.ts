import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { requirePermission } from '../../../middleware/require-permission';
import { daftarSatuan } from './service';

// Membaca satuan butuh `master.barang.lihat` (semua peran): nama satuan tampil di barang, order, dan
// struk (K-054, menutup K-051). Mengubah satuan nanti memakai `master.satuan.kelola` (Fase 3).
export const satuanRoutes = new Hono<EnvApp>().get(
  '/',
  requirePermission('master.barang.lihat'),
  async (c) => c.json({ data: await daftarSatuan() }, 200),
);
