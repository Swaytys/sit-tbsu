import { zValidator } from '@hono/zod-validator';
import { skemaSimpanHarga } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { simpanHargaMassal } from './service';

/** Harga jual per tier: simpan massal dari halaman Harga Jual (docs/06 H13). Daftar lewat GET /api/barang. */
export const hargaRoutes = new Hono<EnvApp>().put(
  '/',
  requirePermission('master.harga.kelola'),
  zValidator('json', skemaSimpanHarga, kaitValidasi),
  async (c) => {
    const data = await simpanHargaMassal(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  },
);
