import { zValidator } from '@hono/zod-validator';
import { skemaCariMitra, skemaPelanggan, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarPelanggan, tambahPelanggan, ubahPelanggan, ubahStatusPelanggan } from './service';

const kelola = requirePermission('master.pelanggan.kelola');

/**
 * Pelanggan: dilihat dan dikelola semua peran (docs/04 §3). Tier default, term, dan limit kredit hanya
 * pemegang `master.pelanggan.atur_kredit`; diperiksa di service karena bergantung pada isi data (K-059).
 */
export const pelangganRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.pelanggan.lihat'),
    zValidator('query', skemaCariMitra, kaitValidasi),
    async (c) => c.json(await daftarPelanggan(c.req.valid('query')), 200),
  )
  .post('/', kelola, zValidator('json', skemaPelanggan, kaitValidasi), async (c) => {
    const data = await tambahPelanggan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaPelanggan, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPelanggan(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusPelanggan(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
