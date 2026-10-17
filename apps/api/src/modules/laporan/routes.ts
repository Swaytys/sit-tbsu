import { zValidator } from '@hono/zod-validator';
import {
  JENIS_LAPORAN,
  skemaCariInvoiceLaporan,
  skemaCatatCetakLaporan,
  skemaLaporanDaftarHarga,
  skemaLaporanHutang,
  skemaLaporanKartuStok,
  skemaLaporanKonsinyasi,
  skemaLaporanLabaKotor,
  skemaLaporanNilaiPersediaan,
  skemaLaporanPenjualan,
  skemaLaporanPiutang,
  skemaLaporanProdukTerlaris,
  skemaLaporanPromo,
  skemaLaporanRetur,
  skemaLaporanRiwayatHargaBeli,
  skemaLaporanRekomendasiPesan,
  skemaLaporanStokMinimum,
  skemaLaporanStokRekap,
} from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi, paramId } from '../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../middleware/require-permission';
import { catatCetak, eksporLaporan } from './daftar';
import { laporanDaftarHarga } from './daftar-harga';
import { cariInvoice, laporanDetailInvoice } from './detail-invoice';
import { laporanHutang } from './hutang';
import { laporanKartuStok } from './kartu-stok';
import { laporanKonsinyasi } from './konsinyasi';
import { laporanLabaKotor } from './laba-kotor';
import { laporanNilaiPersediaan } from './nilai-persediaan';
import { laporanPenjualanPeriode } from './penjualan-periode';
import { laporanPiutang } from './piutang';
import { laporanProdukTerlaris } from './produk-terlaris';
import { laporanPromo } from './promo';
import { laporanReturPenjualan } from './retur-penjualan';
import { laporanRiwayatHargaBeli } from './riwayat-harga-beli';
import { laporanRekomendasiPesan } from './rekomendasi-pesan';
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
    '/rekomendasi-pesan',
    persediaan,
    zValidator('query', skemaLaporanRekomendasiPesan, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanRekomendasiPesan(c.req.valid('query'), penggunaWajib(c)) }, 200),
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
  .get('/detail-invoice/:id', penjualan, paramId, async (c) =>
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
  .get('/promo', penjualan, zValidator('query', skemaLaporanPromo, kaitValidasi), async (c) =>
    c.json({ data: await laporanPromo(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/riwayat-harga-beli',
    persediaan,
    requirePermission('laporan.laba'),
    zValidator('query', skemaLaporanRiwayatHargaBeli, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanRiwayatHargaBeli(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/daftar-harga',
    requirePermission('laporan.penjualan'),
    zValidator('query', skemaLaporanDaftarHarga, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanDaftarHarga(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/konsinyasi',
    requirePermission('laporan.hutang'),
    zValidator('query', skemaLaporanKonsinyasi, kaitValidasi),
    async (c) =>
      c.json({ data: await laporanKonsinyasi(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get(
    '/hutang',
    requirePermission('laporan.hutang'),
    zValidator('query', skemaLaporanHutang, kaitValidasi),
    async (c) => c.json({ data: await laporanHutang(c.req.valid('query'), penggunaWajib(c)) }, 200),
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
