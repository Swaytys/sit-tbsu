import { zValidator } from '@hono/zod-validator';
import { skemaKendaraan, skemaSaringStatus, skemaSopir, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  daftarKendaraan,
  daftarSopir,
  tambahKendaraan,
  tambahSopir,
  ubahKendaraan,
  ubahSopir,
  ubahStatusKendaraan,
  ubahStatusSopir,
} from './service';

const kelola = requirePermission('master.armada.kelola');
/** Daftar dibaca pemegang izin surat jalan (memilih kendaraan/sopir saat berangkat, S9). */
const lihat = requirePermission('penjualan.surat_jalan.kelola');

/** Kendaraan (S8, K-150). */
export const kendaraanRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaSaringStatus, kaitValidasi), async (c) =>
    c.json({ data: await daftarKendaraan(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaKendaraan, kaitValidasi), async (c) => {
    const data = await tambahKendaraan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaKendaraan, kaitValidasi), async (c) => {
    const data = await ubahKendaraan(
      c.req.valid('param').id,
      c.req.valid('json'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const data = await ubahStatusKendaraan(
        c.req.valid('param').id,
        c.req.valid('json').statusAktif,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );

/** Sopir (S8, K-150). */
export const sopirRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaSaringStatus, kaitValidasi), async (c) =>
    c.json({ data: await daftarSopir(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaSopir, kaitValidasi), async (c) => {
    const data = await tambahSopir(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, paramId, zValidator('json', skemaSopir, kaitValidasi), async (c) => {
    const data = await ubahSopir(
      c.req.valid('param').id,
      c.req.valid('json'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    paramId,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const data = await ubahStatusSopir(
        c.req.valid('param').id,
        c.req.valid('json').statusAktif,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
