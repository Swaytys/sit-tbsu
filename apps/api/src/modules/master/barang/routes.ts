import { zValidator } from '@hono/zod-validator';
import {
  skemaBarang,
  skemaCariBarang,
  skemaIdParam,
  skemaSimpanSatuanJual,
  skemaUbahStatus,
} from '@sit/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../../../lib/errors';
import type { EnvApp } from '../../../lib/konteks';
import { UKURAN_GAMBAR_MAKS } from '../../../lib/penyimpanan';
import { kaitValidasi } from '../../../lib/validasi';
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

const lihat = requirePermission('master.barang.lihat');
const kelola = requirePermission('master.barang.kelola');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Batas badan permintaan unggah: gambar 2 MB + sedikit ruang untuk pembungkus multipart. */
const batasUnggah = bodyLimit({
  maxSize: UKURAN_GAMBAR_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Ukuran gambar maksimal 2 MB.', 413);
  },
});

/**
 * Barang: dibaca semua peran (harga modal/HPP disaring di service), dikelola Admin/Owner (docs/04 §3).
 * Harga jual di form barang juga butuh `master.harga.kelola` (diperiksa di service).
 */
export const barangRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariBarang, kaitValidasi), async (c) =>
    c.json(await daftarBarang(c.req.valid('query'), penggunaWajib(c).izin), 200),
  )
  .get('/:id', lihat, param, async (c) =>
    c.json({ data: await detailBarang(c.req.valid('param').id, penggunaWajib(c).izin) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaBarang, kaitValidasi), async (c) => {
    const data = await tambahBarang(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, param, zValidator('json', skemaBarang, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahBarang(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .put(
    '/:id/satuan-jual',
    kelola,
    param,
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
  .patch(
    '/:id/status',
    kelola,
    param,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusBarang(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .get('/:id/gambar', lihat, param, async (c) => {
    const { isi, tipe } = await ambilGambar(c.req.valid('param').id);
    return c.body(new Uint8Array(isi), 200, {
      'Content-Type': tipe,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  })
  .post('/:id/gambar', kelola, param, batasUnggah, async (c) => {
    const body = await c.req.parseBody();
    const berkas = body.berkas;
    if (!(berkas instanceof File)) {
      throw new AppError('VALIDASI', 'Pilih berkas gambar untuk diunggah.', 400);
    }
    const isi = new Uint8Array(await berkas.arrayBuffer());
    const data = await unggahGambar(c.req.valid('param').id, isi, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .delete('/:id/gambar', kelola, param, async (c) => {
    const data = await hapusGambar(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
