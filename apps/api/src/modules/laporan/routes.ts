import { zValidator } from '@hono/zod-validator';
import {
  JENIS_LAPORAN,
  skemaCariInvoiceLaporan,
  skemaCatatCetakLaporan,
  skemaIdParam,
  skemaLaporanKartuStok,
  skemaLaporanLabaKotor,
  skemaLaporanNilaiPersediaan,
  skemaLaporanPenjualan,
  skemaLaporanPiutang,
  skemaLaporanProdukTerlaris,
  skemaLaporanRetur,
  skemaLaporanStokMinimum,
  skemaLaporanStokRekap,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { catatCetak, eksporLaporan } from './daftar';
import { cariInvoice, laporanDetailInvoice } from './detail-invoice';
import { laporanKartuStok } from './kartu-stok';
import { laporanLabaKotor } from './laba-kotor';
import { laporanNilaiPersediaan } from './nilai-persediaan';
import { laporanPenjualanPeriode } from './penjualan-periode';
import { laporanPiutang } from './piutang';
import { laporanProdukTerlaris } from './produk-terlaris';
import { laporanReturPenjualan } from './retur-penjualan';
import { laporanStokMinimum } from './stok-minimum';
import { laporanStokRekap } from './stok-rekap';

const persediaan = requirePermission('laporan.persediaan');
const penjualan = requirePermission('laporan.penjualan');

/**
 * Laporan (docs/01 §5.9, docs/04 §2): setiap laporan dikirim sebagai `DokumenLaporan` (K-078).
 * Ekspor Excel dan catatan cetak memerlukan `laporan.ekspor` di samping izin laporannya.
 */
export const laporanRoutes = new Hono<EnvApp>()
  .get(
    '/stok-rekap',
    persediaan,
    zValidator('query', skemaLaporanStokRekap, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanStokRekap(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/kartu-stok',
    persediaan,
    zValidator('query', skemaLaporanKartuStok, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanKartuStok(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/stok-minimum',
    persediaan,
    zValidator('query', skemaLaporanStokMinimum, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanStokMinimum(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/nilai-persediaan',
    persediaan,
    requirePermission('laporan.laba'),
    zValidator('query', skemaLaporanNilaiPersediaan, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanNilaiPersediaan(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/penjualan',
    penjualan,
    zValidator('query', skemaLaporanPenjualan, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanPenjualanPeriode(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/produk-terlaris',
    penjualan,
    zValidator('query', skemaLaporanProdukTerlaris, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanProdukTerlaris(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/detail-invoice',
    penjualan,
    zValidator('query', skemaCariInvoiceLaporan, kaitValidasi),
    async (c) => c.json({ data: await cariInvoice(c.req.valid('query')) }, 200),
  )
  .get(
    '/detail-invoice/:id',
    penjualan,
    zValidator('param', skemaIdParam, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanDetailInvoice(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .get(
    '/retur-penjualan',
    penjualan,
    zValidator('query', skemaLaporanRetur, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanReturPenjualan(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/laba-kotor',
    requirePermission('laporan.laba'),
    zValidator('query', skemaLaporanLabaKotor, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanLabaKotor(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/piutang',
    requirePermission('laporan.piutang'),
    zValidator('query', skemaLaporanPiutang, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanPiutang(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/ekspor/:kode',
    requirePermission('laporan.ekspor'),
    zValidator('param', z.object({ kode: z.enum(JENIS_LAPORAN) }), kaitValidasi),
    async (c) => {
      const { isi, header } = await eksporLaporan(
        c.req.valid('param').kode,
        c.req.query(),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.body(isi, 200, header);
    },
  )
  .post(
    '/cetak',
    requirePermission('laporan.ekspor'),
    zValidator('json', skemaCatatCetakLaporan, kaitValidasi),
    async (c) => {
      const { kode, keterangan } = c.req.valid('json');
      await catatCetak(kode, keterangan, penggunaWajib(c), c.get('asal'));
      return c.json({ data: { tercatat: true } }, 200);
    },
  );
