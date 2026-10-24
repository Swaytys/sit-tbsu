import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalCatatan,
  skemaCariCatatanArmada,
  skemaCatatBbm,
  skemaCatatServis,
  skemaKendaraan,
  skemaPeriodeStatistik,
  skemaSaringStatus,
  skemaSopir,
  skemaUbahStatus,
} from '@sit/shared';
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
import { batalCatatan, catatBbm, catatServis, daftarBbm, daftarServis } from './catatan';
import { statistikArmada } from './statistik';

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

/** Catatan BBM dan servis, statistik armada (K-162, docs/13 §5). */
export const armadaRoutes = new Hono<EnvApp>()
  .get('/bbm', lihat, zValidator('query', skemaCariCatatanArmada, kaitValidasi), async (c) =>
    c.json(await daftarBbm(c.req.valid('query')), 200),
  )
  // Kasir mencatat struk BBM saat sopir kembali.
  .post('/bbm', lihat, zValidator('json', skemaCatatBbm, kaitValidasi), async (c) => {
    const data = await catatBbm(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/bbm/:id/batal',
    kelola,
    paramId,
    zValidator('json', skemaBatalCatatan, kaitValidasi),
    async (c) => {
      const p = c.req.valid('param');
      await batalCatatan('bbm', p.id, c.req.valid('json').alasan, penggunaWajib(c), c.get('asal'));
      return c.json({ data: null }, 200);
    },
  )
  .get('/servis', lihat, zValidator('query', skemaCariCatatanArmada, kaitValidasi), async (c) =>
    c.json(await daftarServis(c.req.valid('query')), 200),
  )
  .post('/servis', kelola, zValidator('json', skemaCatatServis, kaitValidasi), async (c) => {
    const data = await catatServis(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/servis/:id/batal',
    kelola,
    paramId,
    zValidator('json', skemaBatalCatatan, kaitValidasi),
    async (c) => {
      const p = c.req.valid('param');
      await batalCatatan(
        'servis',
        p.id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: null }, 200);
    },
  )
  .get(
    '/statistik',
    kelola,
    zValidator('query', skemaPeriodeStatistik, kaitValidasi),
    async (c) => {
      const { dari, sampai } = c.req.valid('query');
      return c.json({ data: await statistikArmada(dari, sampai) }, 200);
    },
  );
