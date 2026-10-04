import { zValidator } from '@hono/zod-validator';
import {
  skemaAbaikanTinjau,
  skemaCariTinjauHarga,
  skemaSimpanHarga,
  skemaTerapkanTinjau,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { headerUnduhan } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { eksporHargaJual } from './ekspor';
import {
  abaikanTinjauHarga,
  daftarTinjauHarga,
  simpanHargaMassal,
  terapkanTinjauHarga,
} from './service';

const kelola = requirePermission('master.harga.kelola');
// Tinjau Harga memuat dasar markup, usulan, dan margin: butuh izin melihat harga modal juga (H12).
const tinjau = requirePermission('master.harga.tinjau');
const lihatHpp = requirePermission('master.barang.lihat_hpp');

const skemaSaringEkspor = z.object({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
});

/**
 * Harga jual per tier (docs/06 H13): simpan massal dan ekspor Excel. Daftar lewat GET /api/barang.
 * Tinjau Harga (H6): daftar barang bertanda, terapkan usulan, abaikan.
 */
export const hargaRoutes = new Hono<EnvApp>()
  .put('/', kelola, zValidator('json', skemaSimpanHarga, kaitValidasi), async (c) => {
    const data = await simpanHargaMassal(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .get('/ekspor', kelola, zValidator('query', skemaSaringEkspor, kaitValidasi), async (c) => {
    const { isi, namaBerkas } = await eksporHargaJual(c.req.valid('query'), penggunaWajib(c).izin);
    return c.body(isi, 200, headerUnduhan(namaBerkas));
  })
  .get(
    '/tinjau',
    tinjau,
    lihatHpp,
    zValidator('query', skemaCariTinjauHarga, kaitValidasi),
    async (c) => c.json(await daftarTinjauHarga(c.req.valid('query')), 200),
  )
  .post(
    '/tinjau/terapkan',
    tinjau,
    lihatHpp,
    zValidator('json', skemaTerapkanTinjau, kaitValidasi),
    async (c) => {
      const data = await terapkanTinjauHarga(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .post(
    '/tinjau/abaikan',
    tinjau,
    lihatHpp,
    zValidator('json', skemaAbaikanTinjau, kaitValidasi),
    async (c) => {
      const data = await abaikanTinjauHarga(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
