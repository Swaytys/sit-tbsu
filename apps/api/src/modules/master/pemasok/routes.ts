import { zValidator } from '@hono/zod-validator';
import { skemaCariMitra, skemaPemasok, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarPemasok, tambahPemasok, ubahPemasok, ubahStatusPemasok } from './service';
import { hapusMaster } from '../hapus';

const kelola = requirePermission('master.pemasok.kelola');

/** Pemasok: Admin/Owner saja (docs/04 §3, K-019). */
export const pemasokRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.pemasok.lihat'),
    zValidator('query', skemaCariMitra, kaitValidasi),
    async (c) => c.json(await daftarPemasok(c.req.valid('query')), 200),
  )
  .post('/', kelola, zValidator('json', skemaPemasok, kaitValidasi), async (c) => {
    const data = await tambahPemasok(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaPemasok, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPemasok(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  // K-199: hapus permanen data ganda yang belum pernah dipakai.
  .delete('/:id', kelola, paramId, async (c) => {
    await hapusMaster('pemasok', c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
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
      const data = await ubahStatusPemasok(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
