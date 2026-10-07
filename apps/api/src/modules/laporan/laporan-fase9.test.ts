import type { DetailPenjualan, DokumenLaporan } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  hargaBarang,
  pelanggan,
  penerimaanBarang,
  promo,
  shiftKasir,
  tingkatHarga,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungLaporanPromo } from './promo';
import { hitungRiwayatHargaBeli } from './riwayat-harga-beli';

/*
 * Laporan Fase 9 (K-087): Laporan Promo (PR7) dan Riwayat Harga Beli (HT7), dicocokkan dengan hitungan
 * manual. Semen: Normal 12.000; pasir: Normal 4.000.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
const hariIni = tanggalOperasional();
const kemarin = tambahHari(hariIni, -1);

async function kirim<T>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(promo, pelanggan, shiftKasir, tingkatHarga);
  const [t] = await db
    .insert(tingkatHarga)
    .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
    .returning();
  await db.insert(hargaBarang).values([
    {
      idBarang: m.semen,
      idTingkatHarga: t!.id,
      metode: 'TETAP',
      hargaTetap: 12_000,
      hargaJual: 12_000,
    },
    {
      idBarang: m.pasir,
      idTingkatHarga: t!.id,
      metode: 'TETAP',
      hargaTetap: 4000,
      hargaJual: 4000,
    },
  ]);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
});

describe('Laporan Promo (PR7)', () => {
  it('pemakaian per promo dan per barang cocok dengan hitungan manual; Staf ditolak', async () => {
    const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'SALDO_AWAL',
      baris: [
        { idBarang: m.semen, qtyFisik: '20', hppSatuan: 9000 },
        { idBarang: m.pasir, qtyFisik: '20', hppSatuan: 3000 },
      ],
    });
    await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
    const semen = await kirim<{ id: number }>(admin, '/api/promo', {
      nama: 'Semen 10%',
      tanggalMulai: hariIni,
      tanggalSelesai: hariIni,
      jenisPotongan: 'PERSEN',
      potonganPersen: '10',
      sasaran: 'BARANG',
      idBarang: m.semen,
    });
    await kirim(admin, '/api/promo', {
      nama: 'Belum terpakai',
      tanggalMulai: hariIni,
      tanggalSelesai: tambahHari(hariIni, 7),
      jenisPotongan: 'NOMINAL',
      potonganNominal: 100,
      sasaran: 'BARANG',
      idBarang: m.titip,
    });
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const jual = (baris: unknown[]) =>
      kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
        order: { jenisPenjualan: 'LANGSUNG', baris },
        pembayaran: [{ metode: 'TUNAI', nominal: null, uangDiterima: 1_000_000 }],
      });
    // T1: semen 2 (24.000, promo 2.400) + pasir 1 (4.000). T2: semen 1 diskon manual 1.000 (bruto 12.000,
    // promo 1.200 → 10.800 − 1.000 = 9.800). T3: pasir 2 tanpa promo (8.000).
    await jual([
      { idBarang: m.semen, qty: '2' },
      { idBarang: m.pasir, qty: '1' },
    ]);
    await kirim(admin, '/api/shift/buka', { modalAwal: 0 });
    await kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
      order: {
        jenisPenjualan: 'LANGSUNG',
        baris: [{ idBarang: m.semen, qty: '1', diskonBaris: 1000 }],
      },
      pembayaran: [{ metode: 'TUNAI', nominal: null, uangDiterima: 1_000_000 }],
    });
    await jual([{ idBarang: m.pasir, qty: '2' }]);

    const h = await hitungLaporanPromo({ dari: hariIni, sampai: hariIni });
    expect(h.penjualanBarang).toBe(21_600 + 4000 + 9800 + 8000);
    expect(h.transaksiBerpromo).toBe(2);
    expect(h.promo.map((x) => x.nama)).toEqual(['Semen 10%', 'Belum terpakai']);
    expect(h.promo[0]).toMatchObject({
      id: semen.id,
      potongan: '10%',
      transaksi: 2,
      baris: 2,
      bruto: 36_000,
      diskonPromo: 3600,
      bersih: 31_400,
    });
    expect(h.promo[1]).toMatchObject({ transaksi: 0, bruto: 0, potongan: 'Rp 100/satuan' });
    expect(h.barang).toEqual([
      expect.objectContaining({
        idPromo: semen.id,
        qty: '3.000',
        diskonPromo: 3600,
        bersih: 31_400,
      }),
    ]);

    const r = await minta(`/api/laporan/promo?dari=${hariIni}&sampai=${hariIni}`, {
      cookie: kasir.cookie,
    });
    expect(r.status).toBe(200);
    const dok = (await json<{ data: DokumenLaporan }>(r)).data;
    expect(dok.judul).toBe('Laporan Promo Penjualan');
    expect(
      (await minta(`/api/laporan/promo?dari=${hariIni}&sampai=${hariIni}`, { cookie: staf.cookie }))
        .status,
    ).toBe(403);
  });
});

describe('Laporan Riwayat Harga Beli (HT7)', () => {
  it('perubahan dibanding pembelian sebelumnya per pemasok, termasuk sebelum periode; konsinyasi tidak ikut', async () => {
    const terima = (idPemasok: number, idBarang: number, harga: number, jenis = 'PEMBELIAN') =>
      kirim<{ id: number; nomor: string }>(admin, '/api/penerimaan', {
        idPemasok,
        jenis,
        ...(jenis === 'PEMBELIAN' ? { syaratBayar: 'TUNAI' } : {}),
        baris: [{ idBarang, qtyMasuk: '10', hargaModalMasuk: harga }],
      });
    const lama = await terima(m.pemasokA, m.semen, 10_000);
    // Pindahkan penerimaan pertama ke kemarin: menjadi pembanding di luar periode.
    await db
      .update(penerimaanBarang)
      .set({ tanggalOperasional: kemarin })
      .where(eq(penerimaanBarang.id, lama.id));
    await terima(m.pemasokA, m.semen, 11_000);
    await terima(m.pemasokA, m.semen, 10_450);
    await terima(m.pemasokB, m.semen, 9500);
    await terima(m.pemasokA, m.titip, 30_000, 'KONSINYASI');

    const h = await hitungRiwayatHargaBeli({ dari: hariIni, sampai: hariIni });
    expect(h.baris.map((b) => [b.namaPemasok, b.harga, b.hargaSebelumnya])).toEqual([
      ['CV. Semen Jaya', 11_000, 10_000],
      ['CV. Semen Jaya', 10_450, 11_000],
      ['UD. Cat Murni', 9500, null],
    ]);
    expect(h.ringkas).toEqual([
      expect.objectContaining({
        namaPemasok: 'CV. Semen Jaya',
        jumlah: 2,
        qty: '20.000',
        terendah: 10_450,
        tertinggi: 11_000,
        rataRata: 10_725,
        terakhir: 10_450,
      }),
      expect.objectContaining({ namaPemasok: 'UD. Cat Murni', jumlah: 1, terakhir: 9500 }),
    ]);

    const url = `/api/laporan/riwayat-harga-beli?dari=${hariIni}&sampai=${hariIni}&idPemasok=${m.pemasokB}`;
    const r = await minta(url, { cookie: admin.cookie });
    expect(r.status).toBe(200);
    const dok = (await json<{ data: DokumenLaporan }>(r)).data;
    expect(dok.subjudul[1]).toContain('Pemasok: UD. Cat Murni');
    expect((await minta(url, { cookie: kasir.cookie })).status).toBe(403);
  });
});
