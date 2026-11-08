import { zValidator } from '@hono/zod-validator';
import {
  JENIS_DOKUMEN_HUTANG,
  skemaBayarHutang,
  skemaCariHutang,
  skemaHutangAwal,
  skemaPerpanjangJatuhTempo,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import {
  bayarHutang,
  catatHutangAwal,
  daftarHutang,
  pembayaranHutang,
  penerimaanBerhutang,
  perpanjangJatuhTempo,
} from './service';
import { saldoDepositPemasok } from './deposit';

const lihat = requirePermission('hutang.lihat');

/** Hutang pemasok (docs/06 §5): daftar & umur (`hutang.lihat`), pembayaran (`hutang.kelola`). */
export const hutangRoutes = new Hono<EnvApp>()
  .get('/', lihat, zValidator('query', skemaCariHutang, kaitValidasi), async (c) =>
    c.json(await daftarHutang(c.req.valid('query')), 200),
  )
  .get(
    '/penerimaan-pemasok/:idPemasok',
    lihat,
    zValidator('param', z.object({ idPemasok: z.coerce.number().int().positive() }), kaitValidasi),
    async (c) => c.json({ data: await penerimaanBerhutang(c.req.valid('param').idPemasok) }, 200),
  )
  .get(
    '/:jenis/:id/pembayaran',
    lihat,
    zValidator(
      'param',
      z.object({ jenis: z.enum(JENIS_DOKUMEN_HUTANG), id: z.coerce.number().int().positive() }),
      kaitValidasi,
    ),
    async (c) => {
      const { jenis, id } = c.req.valid('param');
      return c.json({ data: await pembayaranHutang(jenis, id) }, 200);
    },
  )
  .post(
    '/bayar',
    requirePermission('hutang.kelola'),
    zValidator('json', skemaBayarHutang, kaitValidasi),
    async (c) => {
      const data = await bayarHutang(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  /** K-237: saldo deposit pemasok (kelebihan uang muka yang disimpan). */
  .get(
    '/deposit/:idPemasok',
    lihat,
    zValidator('param', z.object({ idPemasok: z.coerce.number().int().positive() }), kaitValidasi),
    async (c) =>
      c.json({ data: { saldo: await saldoDepositPemasok(c.req.valid('param').idPemasok) } }, 200),
  )
  /** K-241: hutang awal pemasok (bagian Persediaan Awal). */
  .post(
    '/awal',
    requirePermission('hutang.kelola'),
    zValidator('json', skemaHutangAwal, kaitValidasi),
    async (c) =>
      c.json(
        { data: await catatHutangAwal(c.req.valid('json'), penggunaWajib(c), c.get('asal')) },
        201,
      ),
  )
  /** K-237: perpanjang jatuh tempo hutang penerimaan (hanya Owner). */
  .post(
    '/penerimaan/:id/perpanjang',
    requirePermission('pembelian.setujui_semua'),
    zValidator('param', z.object({ id: z.coerce.number().int().positive() }), kaitValidasi),
    zValidator('json', skemaPerpanjangJatuhTempo, kaitValidasi),
    async (c) => {
      await perpanjangJatuhTempo(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: { ok: true } }, 200);
    },
  );
