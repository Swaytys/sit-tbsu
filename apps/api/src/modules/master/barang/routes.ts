import { zValidator } from '@hono/zod-validator';
import { skemaBarang, skemaCariBarang, skemaSimpanSatuanJual, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { batasUnggahGambar, berkasKiriman } from '../../../lib/unggah';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ambilGambar,
  daftarBarang,
  detailBarang,
  hapusGambar,
  tambahBarang,
  ubahBarang,
  ubahStatusBarang,
  unggahGambar,
} from './service';
import { simpanSatuanJual } from '../satuan-jual/service';
import { hapusMaster } from '../hapus';

const lihat = requirePermission('master.barang.lihat');
const kelola = requirePermission('master.barang.kelola');

/**
 * Barang: dibaca semua peran (harga modal/HPP disaring di service), dikelola Admin/Owner (docs/04 §3).
 * Harga jual di form barang juga butuh `master.harga.kelola` (diperiksa di service).
 */
export const barangRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariBarang, kaitValidasi), async (c) =>
    c.json(await daftarBarang(c.req.valid('query'), penggunaWajib(c).izin), 200),
  )
  .get('/:id', lihat, paramId, async (c) =>
    c.json({ data: await detailBarang(c.req.valid('param').id, penggunaWajib(c).izin) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaBarang, kaitValidasi), async (c) => {
    const data = await tambahBarang(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaBarang, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahBarang(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .put(
    '/:id/satuan-jual',
    kelola,
    paramId,
    zValidator('json', skemaSimpanSatuanJual, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const pelaku = penggunaWajib(c);
      const data = await simpanSatuanJual(id, c.req.valid('json'), pelaku, c.get('asal'), (x) =>
        detailBarang(x, pelaku.izin),
      );
      return c.json({ data }, 200);
    },
  )
  // K-199: hapus permanen data ganda yang belum pernah dipakai.
  .delete('/:id', kelola, paramId, async (c) => {
    await hapusMaster('barang', c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data: { dihapus: true } }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusBarang(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .get('/:id/gambar', lihat, paramId, async (c) => {
    const { isi, tipe } = await ambilGambar(c.req.valid('param').id);
    return c.body(new Uint8Array(isi), 200, {
      'Content-Type': tipe,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  })
  .post('/:id/gambar', kelola, paramId, batasUnggahGambar, async (c) => {
    const { isi } = await berkasKiriman(c, 'gambar');
    const data = await unggahGambar(c.req.valid('param').id, isi, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .delete('/:id/gambar', kelola, paramId, async (c) => {
    const data = await hapusGambar(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
