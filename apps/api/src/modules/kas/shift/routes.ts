import { zValidator } from '@hono/zod-validator';
import {
  skemaBukaShift,
  skemaCariShift,
  skemaHitungKas,
  skemaKasShift,
  skemaKoreksiModal,
  skemaPenjelasanSelisih,
  skemaTutupShift,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  bukaShift,
  catatKasManual,
  daftarShift,
  detailShift,
  hasilHitung,
  hitungBukaSusulan,
  hitungTutup,
  jelaskanSelisih,
  koreksiModal,
  mintaKodeKoreksi,
  shiftSaya,
  tutupShift,
  usulanBukaShift,
} from './service';

const sendiri = requirePermission('kas.shift.kelola_sendiri');

/** Shift kasir & clerical check (docs/05 §10). Akses per shift diperiksa service. */
export const shiftRoutes = new Hono<EnvApp>()
  .get('/saya', sendiri, async (c) => c.json({ data: await shiftSaya(penggunaWajib(c)) }, 200))
  .get('/usulan-buka', sendiri, async (c) => c.json({ data: await usulanBukaShift() }, 200))
  .post('/buka', sendiri, zValidator('json', skemaBukaShift, kaitValidasi), async (c) => {
    const data = await bukaShift(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post('/kas', sendiri, zValidator('json', skemaKasShift, kaitValidasi), async (c) => {
    const data = await catatKasManual(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .get('/', sendiri, zValidator('query', skemaCariShift, kaitValidasi), async (c) =>
    c.json(await daftarShift(c.req.valid('query'), penggunaWajib(c)), 200),
  )
  .get('/:id', sendiri, paramId, async (c) =>
    c.json({ data: await detailShift(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post(
    '/:id/hitung-buka',
    sendiri,
    paramId,
    zValidator('json', skemaHitungKas, kaitValidasi),
    async (c) => {
      const data = await hitungBukaSusulan(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/koreksi-modal/minta-kode',
    sendiri,
    paramId,
    zValidator('json', skemaKoreksiModal.omit({ kode: true }), kaitValidasi),
    async (c) => {
      const data = await mintaKodeKoreksi(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/koreksi-modal',
    sendiri,
    paramId,
    zValidator('json', skemaKoreksiModal, kaitValidasi),
    async (c) => {
      const data = await koreksiModal(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/hitung',
    sendiri,
    paramId,
    zValidator('json', skemaHitungKas, kaitValidasi),
    async (c) => {
      const data = await hitungTutup(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .get('/:id/hasil', sendiri, paramId, async (c) =>
    c.json({ data: await hasilHitung(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post(
    '/:id/tutup',
    sendiri,
    paramId,
    zValidator('json', skemaTutupShift, kaitValidasi),
    async (c) => {
      const data = await tutupShift(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/penjelasan',
    requirePermission('kas.shift.lihat_semua'),
    paramId,
    zValidator('json', skemaPenjelasanSelisih, kaitValidasi),
    async (c) => {
      const data = await jelaskanSelisih(
        c.req.valid('param').id,
        c.req.valid('json').penjelasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
