import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalKoreksi,
  skemaCariKoreksi,
  skemaCariRefundTransfer,
  skemaKonfirmasiTransfer,
  skemaRetur,
  skemaSetujui,
  skemaSetujuiKode,
  skemaTolak,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  ajukanRetur,
  batalRetur,
  daftarRefundTransfer,
  daftarRetur,
  detailRetur,
  kandidatRetur,
  konfirmasiTransfer,
  mintaKodeRetur,
  setujuiRetur,
  setujuiReturDenganKode,
  tolakRetur,
} from './service';

const ajukan = requirePermission('retur.ajukan');
const setujui = requirePermission('retur.setujui');

/** Retur penjualan (docs/05 §8, docs/04 §6). */
export const returRoutes = new Hono<EnvApp>()
  .get(
    '/kandidat',
    ajukan,
    zValidator('query', z.object({ cari: z.string().trim().max(100).optional() }), kaitValidasi),
    async (c) => c.json({ data: await kandidatRetur(c.req.valid('query').cari ?? '') }, 200),
  )
  .get('/', ajukan, zValidator('query', skemaCariKoreksi, kaitValidasi), async (c) =>
    c.json(await daftarRetur(c.req.valid('query')), 200),
  )
  // K-176: tugas refund transfer (Admin/Owner yang memegang rekening toko).
  .get(
    '/refund-transfer',
    setujui,
    zValidator('query', skemaCariRefundTransfer, kaitValidasi),
    async (c) => c.json({ data: await daftarRefundTransfer(c.req.valid('query').status) }, 200),
  )
  .post(
    '/:id/transfer',
    setujui,
    paramId,
    zValidator('json', skemaKonfirmasiTransfer, kaitValidasi),
    async (c) => {
      const data = await konfirmasiTransfer(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .get('/:id', ajukan, paramId, async (c) =>
    c.json({ data: await detailRetur(c.req.valid('param').id) }, 200),
  )
  .post('/', ajukan, zValidator('json', skemaRetur, kaitValidasi), async (c) => {
    const data = await ajukanRetur(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/:id/setujui',
    setujui,
    paramId,
    zValidator('json', skemaSetujui, kaitValidasi),
    async (c) => {
      const data = await setujuiRetur(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  // K-102: pengaju (izin ajukan) meminta kode untuk atasan, lalu mengetik kode yang disebutkan atasan.
  // Wewenangnya dibawa kode itu, bukan sesi pengaju.
  .post('/:id/minta-kode', ajukan, paramId, async (c) => {
    const data = await mintaKodeRetur(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:id/setujui-kode',
    ajukan,
    paramId,
    zValidator('json', skemaSetujuiKode, kaitValidasi),
    async (c) => {
      const { kode, ...persetujuan } = c.req.valid('json');
      const data = await setujuiReturDenganKode(
        c.req.valid('param').id,
        persetujuan,
        kode,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/batal',
    ajukan,
    paramId,
    zValidator('json', skemaBatalKoreksi, kaitValidasi),
    async (c) => {
      const data = await batalRetur(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/:id/tolak', setujui, paramId, zValidator('json', skemaTolak, kaitValidasi), async (c) => {
    const data = await tolakRetur(
      c.req.valid('param').id,
      c.req.valid('json').alasan,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
