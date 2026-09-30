import { zValidator } from '@hono/zod-validator';
import { skemaSimpanHarga } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { headerUnduhan } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { eksporHargaJual } from './ekspor';
import { simpanHargaMassal } from './service';

const kelola = requirePermission('master.harga.kelola');

const skemaSaringEkspor = z.object({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
});

/** Harga jual per tier (docs/06 H13): simpan massal dan ekspor Excel. Daftar lewat GET /api/barang. */
export const hargaRoutes = new Hono<EnvApp>()
  .put('/', kelola, zValidator('json', skemaSimpanHarga, kaitValidasi), async (c) => {
    const data = await simpanHargaMassal(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .get('/ekspor', kelola, zValidator('query', skemaSaringEkspor, kaitValidasi), async (c) => {
    const { isi, namaBerkas } = await eksporHargaJual(c.req.valid('query'), penggunaWajib(c).izin);
    return c.body(isi, 200, headerUnduhan(namaBerkas));
  });
