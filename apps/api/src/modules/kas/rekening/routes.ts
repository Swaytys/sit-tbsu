import { zValidator } from '@hono/zod-validator';
import { skemaCariRekening, skemaRekening, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { daftarRekening, tambahRekening, ubahRekening, ubahStatusRekening } from './service';

const kelola = requirePermission('sistem.pengaturan.kelola');

/**
 * Rekening toko (K-111). Daftar dibaca siapa pun yang mencatat pembayaran (`kas.rekening.lihat`); menambah,
 * mengubah, dan menonaktifkan hanya pengelola pengaturan (Admin/Owner).
 */
export const rekeningRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('kas.rekening.lihat'),
    zValidator('query', skemaCariRekening, kaitValidasi),
    async (c) => {
      const { status } = c.req.valid('query');
      // Yang nonaktif hanya untuk pengelola; pemilih di layar kasir selalu memakai yang aktif.
      const boleh = penggunaWajib(c).izin.has('sistem.pengaturan.kelola');
      return c.json({ data: await daftarRekening(boleh ? status : 'AKTIF') }, 200);
    },
  )
  .post('/', kelola, zValidator('json', skemaRekening, kaitValidasi), async (c) => {
    const data = await tambahRekening(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaRekening, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahRekening(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
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
      const data = await ubahStatusRekening(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
