import { zValidator } from '@hono/zod-validator';
import {
  skemaAkhiriOrderPembelian,
  skemaCariOrderPembelian,
  skemaKonfirmasiOrderPembelian,
  skemaOrderPembelian,
  skemaPutusanPO,
  skemaTolakPO,
  skemaUangMukaOrderPembelian,
} from '@sit/shared';
import { z } from 'zod';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  akhiriPO,
  buatPO,
  daftarPO,
  detailPO,
  kirimPO,
  konfirmasiPO,
  ubahPO,
  uangMukaPO,
} from './service';
import { aturBarangKhusus, ajukanPO, setujuiPO, tolakPO } from './persetujuan';

/** K-125 order pembelian: Admin dan Owner (izin sama dengan penerimaan barang). Harga disaring di service. */
const izin = requirePermission('persediaan.penerimaan.kelola');

/** K-225: menyetujui order pembelian (Kepala Toko sampai batas; Owner semua). */
const izinSetuju = requirePermission('pembelian.setujui');
const izinOwner = requirePermission('pembelian.setujui_semua');

export const orderPembelianRoutes = new Hono<EnvApp>()
  .post('/:id/ajukan', izin, paramId, async (c) => {
    const id = c.req.valid('param').id;
    await ajukanPO(id, penggunaWajib(c), c.get('asal'));
    return c.json({ data: await detailPO(id, penggunaWajib(c).izin) }, 200);
  })
  .post(
    '/:id/setujui',
    izinSetuju,
    paramId,
    zValidator('json', skemaPutusanPO, kaitValidasi),
    async (c) => {
      const id = c.req.valid('param').id;
      await setujuiPO(id, c.req.valid('json').catatan ?? null, penggunaWajib(c), c.get('asal'));
      return c.json({ data: await detailPO(id, penggunaWajib(c).izin) }, 200);
    },
  )
  .post(
    '/:id/tolak',
    izinSetuju,
    paramId,
    zValidator('json', skemaTolakPO, kaitValidasi),
    async (c) => {
      const id = c.req.valid('param').id;
      await tolakPO(id, c.req.valid('json').alasan, penggunaWajib(c), c.get('asal'));
      return c.json({ data: await detailPO(id, penggunaWajib(c).izin) }, 200);
    },
  )
  .post(
    '/barang/:id/khusus',
    izinOwner,
    paramId,
    zValidator('json', z.object({ perlu: z.boolean() }), kaitValidasi),
    async (c) => {
      await aturBarangKhusus(
        c.req.valid('param').id,
        c.req.valid('json').perlu,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: { ok: true } }, 200);
    },
  )
  .get('/', izin, zValidator('query', skemaCariOrderPembelian, kaitValidasi), async (c) =>
    c.json(await daftarPO(c.req.valid('query'), penggunaWajib(c).izin), 200),
  )
  .get('/:id', izin, paramId, async (c) =>
    c.json({ data: await detailPO(c.req.valid('param').id, penggunaWajib(c).izin) }, 200),
  )
  .post('/', izin, zValidator('json', skemaOrderPembelian, kaitValidasi), async (c) =>
    c.json({ data: await buatPO(c.req.valid('json'), penggunaWajib(c), c.get('asal')) }, 201),
  )
  .patch('/:id', izin, paramId, zValidator('json', skemaOrderPembelian, kaitValidasi), async (c) =>
    c.json(
      {
        data: await ubahPO(
          c.req.valid('param').id,
          c.req.valid('json'),
          penggunaWajib(c),
          c.get('asal'),
        ),
      },
      200,
    ),
  )
  .post('/:id/kirim', izin, paramId, async (c) =>
    c.json({ data: await kirimPO(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) }, 200),
  )
  .post(
    '/:id/konfirmasi',
    izin,
    paramId,
    zValidator('json', skemaKonfirmasiOrderPembelian, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await konfirmasiPO(
            c.req.valid('param').id,
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post(
    '/:id/uang-muka',
    izin,
    paramId,
    zValidator('json', skemaUangMukaOrderPembelian, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await uangMukaPO(
            c.req.valid('param').id,
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post(
    '/:id/tutup',
    izin,
    paramId,
    zValidator('json', skemaAkhiriOrderPembelian, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await akhiriPO(
            c.req.valid('param').id,
            'TUTUP',
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post(
    '/:id/batal',
    izin,
    paramId,
    zValidator('json', skemaAkhiriOrderPembelian, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await akhiriPO(
            c.req.valid('param').id,
            'BATAL',
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  );
