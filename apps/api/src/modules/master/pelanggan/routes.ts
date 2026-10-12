import { zValidator } from '@hono/zod-validator';
import {
  skemaCariMitra,
  skemaMintaKodePelanggan,
  skemaPelanggan,
  skemaStatusPelanggan,
  skemaUbahPelanggan,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  bawaanPelanggan,
  daftarPelanggan,
  mintaKodePelanggan,
  tambahPelanggan,
  ubahPelanggan,
  ubahStatusPelanggan,
} from './service';

const kelola = requirePermission('master.pelanggan.kelola');

/**
 * Pelanggan: dilihat dan ditambah semua peran (docs/04 §3). Tier default, term, dan limit kredit hanya
 * pemegang `master.pelanggan.atur_kredit`; diperiksa di service karena bergantung pada isi data (K-059).
 * Mengubah data pelanggan yang sudah ada atau status aktifnya oleh pengguna tanpa izin itu butuh kode sekali
 * pakai dari Admin/Owner (K-107); juga diperiksa di service.
 */
export const pelangganRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.pelanggan.lihat'),
    zValidator('query', skemaCariMitra, kaitValidasi),
    async (c) => c.json(await daftarPelanggan(c.req.valid('query')), 200),
  )
  // Term dan limit kredit yang diisikan untuk pelanggan baru (form tambah pelanggan, K-104).
  .get('/bawaan', kelola, async (c) => c.json({ data: await bawaanPelanggan() }, 200))
  .post('/', kelola, zValidator('json', skemaPelanggan, kaitValidasi), async (c) => {
    const data = await tambahPelanggan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  // K-107: kode sekali pakai ke Admin/Owner untuk satu perubahan data atau status pelanggan ini.
  .post(
    '/:id/minta-kode',
    kelola,
    paramId,
    zValidator('json', skemaMintaKodePelanggan, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = await mintaKodePelanggan(
        id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .patch(
    '/:id',
    kelola,
    paramId,
    zValidator('json', skemaUbahPelanggan, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { kodeAtasan, ...input } = c.req.valid('json');
      const data = await ubahPelanggan(
        id,
        input,
        penggunaWajib(c),
        c.get('asal'),
        kodeAtasan ?? null,
      );
      return c.json({ data }, 200);
    },
  )
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaStatusPelanggan, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif, kodeAtasan } = c.req.valid('json');
      const data = await ubahStatusPelanggan(
        id,
        statusAktif,
        penggunaWajib(c),
        c.get('asal'),
        kodeAtasan ?? null,
      );
      return c.json({ data }, 200);
    },
  );
