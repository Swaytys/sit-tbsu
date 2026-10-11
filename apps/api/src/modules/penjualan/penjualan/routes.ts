import { zValidator } from '@hono/zod-validator';
import {
  skemaBayarPenjualan,
  skemaCariPenjualan,
  skemaCheckout,
  skemaMintaKodeLimit,
  skemaSuratJalan,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { buatSuratJalan } from '../surat-jalan/service';
import {
  bayarPenjualan,
  catatCetakUlang,
  checkout,
  daftarPenjualan,
  detailPenjualan,
  mintaKodeLimit,
  tandaiDiambil,
} from './service';

const lihat = requirePermission('penjualan.riwayat.lihat');
const kasir = requirePermission('penjualan.checkout');

/** Penjualan langsung & pengantaran (docs/05 §6). */
export const penjualanRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariPenjualan, kaitValidasi), async (c) =>
    c.json(await daftarPenjualan(c.req.valid('query')), 200),
  )
  .get('/:id', lihat, paramId, async (c) =>
    c.json({ data: await detailPenjualan(c.req.valid('param').id, penggunaWajib(c).izin) }, 200),
  )
  .post('/checkout', kasir, zValidator('json', skemaCheckout, kaitValidasi), async (c) => {
    const data = await checkout(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  // PT6 (K-102): kode sekali pakai untuk melampaui limit kredit, dikirim ke Admin/Owner.
  .post(
    '/limit-kredit/minta-kode',
    kasir,
    zValidator('json', skemaMintaKodeLimit, kaitValidasi),
    async (c) => {
      const data = await mintaKodeLimit(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/pembayaran',
    requirePermission('penjualan.pembayaran.catat'),
    paramId,
    zValidator('json', skemaBayarPenjualan, kaitValidasi),
    async (c) => {
      const data = await bayarPenjualan(
        c.req.valid('param').id,
        c.req.valid('json').pembayaran,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post(
    '/:id/surat-jalan',
    requirePermission('penjualan.surat_jalan.kelola'),
    paramId,
    zValidator('json', skemaSuratJalan, kaitValidasi),
    async (c) => {
      const data = await buatSuratJalan(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 201);
    },
  )
  .post('/:id/diambil', kasir, paramId, async (c) =>
    c.json(
      { data: await tandaiDiambil(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/:id/cetak-ulang', lihat, paramId, async (c) => {
    await catatCetakUlang(c.req.valid('param').id, penggunaWajib(c), c.get('asal'));
    return c.json({ data: { ok: true } }, 200);
  });
