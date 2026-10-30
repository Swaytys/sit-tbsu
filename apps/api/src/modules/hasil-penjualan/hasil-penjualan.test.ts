import type { DetailPenjualan, HasilPenjualanHalaman } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, penjualan, shiftKasir } from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { periodeSebelum } from './service';

/* K-126: Hasil Penjualan (angka sama dengan laporan, laba hanya untuk laporan.laba). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}

describe('periode sebanding', () => {
  it('jumlah hari sama, tepat sebelum tanggal awal', () => {
    expect(periodeSebelum({ dari: '2026-10-01', sampai: '2026-10-31' })).toEqual({
      dari: '2026-08-31',
      sampai: '2026-09-30',
    });
    expect(periodeSebelum({ dari: '2026-03-01', sampai: '2026-03-01' })).toEqual({
      dari: '2026-02-28',
      sampai: '2026-02-28',
    });
  });
});

describe('hasil penjualan (K-126)', () => {
  beforeEach(async () => {
    await siapkanDatabaseSistem();
    m = await siapkanMasterPersediaan();
    await kosongkanTabel(shiftKasir);
    admin = await sesiUji('ADMIN');
    kasir = await sesiUji('KASIR');
    const idTier = await siapkanTierNormal();
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    });
    await data(
      minta('/api/penerimaan', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          idPemasok: m.pemasokA,
          jenis: 'PEMBELIAN',
          syaratBayar: 'TUNAI',
          referensi: 'TRF0001',
          baris: [{ idBarang: m.semen, qtyMasuk: '100', hargaModalMasuk: 10000 }],
        },
      }),
    );
    await data(
      minta('/api/shift/buka', { method: 'POST', cookie: kasir.cookie, body: { modalAwal: 0 } }),
    );
  });

  const jual = (qty: string) =>
    data<DetailPenjualan>(
      minta('/api/penjualan/checkout', {
        method: 'POST',
        cookie: kasir.cookie,
        body: {
          order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
          pembayaran: [{ metode: 'TUNAI', uangDiterima: 10_000_000 }],
        },
      }),
    );

  it('ringkasan, harian, barang ABC, kasir, jam/hari, metode bayar; periode lalu; laba hanya Owner/Admin berizin', async () => {
    await jual('3'); // 36.000
    await jual('2'); // 24.000
    // Satu penjualan dipindah ke kemarin: masuk periode lalu untuk periode "hari ini".
    const lama = await jual('1');
    const kemarin = tambahHari(tanggalOperasional(), -1);
    await db
      .update(penjualan)
      .set({ tanggalOperasional: kemarin })
      .where(eq(penjualan.id, lama.id));

    const hariIni = tanggalOperasional();
    const q = `/api/hasil-penjualan?dari=${hariIni}&sampai=${hariIni}`;
    const h = await data<HasilPenjualanHalaman>(minta(q, { cookie: admin.cookie }));
    expect(h.ringkasan).toMatchObject({ omzet: 60000, jumlahTransaksi: 2, rataTransaksi: 30000 });
    expect(h.ringkasanLalu).toMatchObject({ omzet: 12000, jumlahTransaksi: 1 });
    expect(h.periodeLalu).toEqual({ dari: kemarin, sampai: kemarin });
    // Laba: (12.000 − 10.000) × 5.
    expect(h.ringkasan.labaKotor).toBe(10000);
    expect(h.harian).toEqual([{ tanggal: hariIni, jumlah: 2, omzet: 60000 }]);
    expect(h.barang[0]).toMatchObject({
      namaBarang: 'Semen Gresik 40 kg',
      qty: '5.000',
      kelas: 'A',
    });
    expect(h.abc.A.jumlahBarang).toBe(1);
    expect(h.perKasir).toHaveLength(1);
    expect(h.perKasir[0]).toMatchObject({ jumlah: 2, nilai: 60000 });
    expect(h.perJam.reduce((t, x) => t + x.jumlah, 0)).toBe(2);
    expect(h.perHari).toHaveLength(7);
    expect(h.perHari.reduce((t, x) => t + x.nilai, 0)).toBe(60000);
    // Uang masuk per tanggal pembayaran: ketiga pembayaran dibayar hari ini.
    expect(h.perMetode).toEqual([
      expect.objectContaining({ kunci: 'TUNAI', jumlah: 3, nilai: 72000 }),
    ]);
    expect(h.perPelanggan[0]?.label).toBe('Umum (tanpa nama)');

    // Kasir: boleh melihat, tanpa laba.
    const k = await data<HasilPenjualanHalaman>(minta(q, { cookie: kasir.cookie }));
    expect(k.ringkasan.omzet).toBe(60000);
    expect(k.ringkasan.labaKotor).toBeUndefined();
    expect(k.ringkasanLalu.labaKotor).toBeUndefined();

    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await minta(q, { cookie: staf.cookie })).status).toBe(403);
    expect(
      (
        await minta(`/api/hasil-penjualan?dari=${hariIni}&sampai=2020-01-01`, {
          cookie: admin.cookie,
        })
      ).status,
    ).toBe(400);
  });
});
