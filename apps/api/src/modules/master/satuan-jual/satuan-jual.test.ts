import type {
  BarisBarang,
  BarisRetur,
  DetailBarang,
  DetailPenjualan,
  PratinjauOrder,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import {
  hargaBarang,
  kasShift,
  persediaan,
  promo,
  returPenjualan,
  returPenjualanDetail,
  satuan,
  shiftKasir,
  tingkatHarga,
} from '../../../db/schema';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { sisaKirim } from '../../penjualan/surat-jalan/service';

/*
 * Fase 12 (docs/06 H11, K-091): satuan jual per barang, harga otomatis/tetap per satuan jual, transaksi dengan
 * satuan jual (qty dasar = qty × faktor), promo per satuan dasar, retur dalam satuan jual.
 * Semen: satuan dasar sak, Normal Rp 12.000/sak; satuan jual "dus" = 10 sak.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let idDus: number;
let idTier: number;
const hariIni = tanggalOperasional();

async function kirim<T>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function galat(sesi: Sesi, path: string, body: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}
const simpanSj = (baris: unknown[], sesi: Sesi = admin) =>
  kirim<DetailBarang>(sesi, `/api/barang/${m.semen}/satuan-jual`, { baris }, 'PUT');
async function stok(id: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, id));
  return p!.stokFisik;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(promo, returPenjualanDetail, returPenjualan, kasShift, shiftKasir);
  await db
    .insert(tingkatHarga)
    .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
    .onConflictDoNothing();
  const [t] = await db.select().from(tingkatHarga).where(eq(tingkatHarga.kode, 'NORMAL'));
  idTier = t!.id;
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: idTier,
    metode: 'TETAP',
    hargaTetap: 12_000,
    hargaJual: 12_000,
  });
  const [dus] = await db
    .insert(satuan)
    .values({ kode: 'dus', nama: 'Dus', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true })
    .returning();
  idDus = dus!.id;
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: m.semen, qtyFisik: '100', hppSatuan: 9000 }],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

describe('master satuan jual (K-091)', () => {
  it('harga otomatis = harga dasar × faktor, bisa ditetapkan; barcode dus; Kasir ditolak', async () => {
    const d = await simpanSj([
      { idSatuan: idDus, faktor: '10', barcode: 'DUS-SEMEN', isDefaultJual: true },
    ]);
    expect(d.satuanJual).toEqual([
      expect.objectContaining({
        kodeSatuan: 'dus',
        faktor: '10',
        isDefaultJual: true,
        harga: [{ idTingkatHarga: idTier, hargaJual: 120_000, tetap: false }],
      }),
    ]);
    const idSj = d.satuanJual[0]!.id;

    // Harga tetap dus lebih murah; satuan dasar naik tidak menimpanya.
    const d2 = await simpanSj([
      {
        idSatuan: idDus,
        faktor: '10',
        barcode: 'DUS-SEMEN',
        isDefaultJual: true,
        hargaTetap: [{ idTingkatHarga: idTier, harga: 115_000 }],
      },
    ]);
    expect(d2.satuanJual[0]!.harga).toEqual([
      { idTingkatHarga: idTier, hargaJual: 115_000, tetap: true },
    ]);

    // Pindai barcode dus: barang ditemukan dengan satuan jual yang cocok.
    const cari = await json<{ data: BarisBarang[] }>(
      await minta('/api/barang?cari=DUS-SEMEN', { cookie: kasir.cookie }),
    );
    expect(cari.data).toEqual([expect.objectContaining({ id: m.semen, idSatuanJualCocok: idSj })]);

    expect(
      (await galat(kasir, `/api/barang/${m.semen}/satuan-jual`, { baris: [] }, 'PUT')).status,
    ).toBe(403);
    // Satuan jual = satuan dasar ditolak.
    const [sak] = await db.select().from(satuan).where(eq(satuan.kode, 'sak'));
    const sama = await galat(
      admin,
      `/api/barang/${m.semen}/satuan-jual`,
      { baris: [{ idSatuan: sak!.id, faktor: '1' }] },
      'PUT',
    );
    expect(sama.status).toBe(400);

    // Tidak dikirim lagi → nonaktif (tidak dihapus).
    const d3 = await simpanSj([]);
    expect(d3.satuanJual).toEqual([expect.objectContaining({ statusAktif: 'NONAKTIF' })]);
  });
});

describe('transaksi dengan satuan jual (K-091)', () => {
  it('checkout 2 dus = 20 sak; promo nominal per sak; retur 1 dus; satuan nonaktif ditolak', async () => {
    const d = await simpanSj([
      {
        idSatuan: idDus,
        faktor: '10',
        hargaTetap: [{ idTingkatHarga: idTier, harga: 115_000 }],
      },
    ]);
    const idSj = d.satuanJual[0]!.id;
    await kirim(admin, '/api/promo', {
      nama: 'Potong 500 per sak',
      tanggalMulai: hariIni,
      tanggalSelesai: tambahHari(hariIni, 5),
      jenisPotongan: 'NOMINAL',
      potonganNominal: 500,
      sasaran: 'SEMUA',
    });
    const baris = [{ idBarang: m.semen, idSatuanJual: idSj, qty: '2' }];
    const p = await kirim<PratinjauOrder>(kasir, '/api/order/pratinjau', {
      idOrder: null,
      order: { jenisPenjualan: 'LANGSUNG', baris },
    });
    expect(p.baris[0]).toMatchObject({
      idSatuanJual: idSj,
      hargaSatuan: 115_000,
      bruto: 230_000,
      diskonPromo: 10_000, // 20 sak × Rp 500
      subtotal: 220_000,
    });

    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 300_000 }],
    });
    expect(pj.baris[0]).toMatchObject({
      kodeSatuan: 'dus',
      kodeSatuanDasar: 'sak',
      faktor: '10',
      qty: '2.000',
      qtyDasar: '20.000',
      hargaSatuan: 115_000,
      subtotal: 220_000,
    });
    expect(await stok(m.semen)).toBe('80.000');

    // Retur 1 dus (kondisi baik): 10 sak kembali; batas retur dalam dus.
    const lebih = await galat(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Kelebihan',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '3', kondisi: 'BAIK' }],
    });
    expect(lebih.pesan).toContain('melebihi yang bisa diretur (2 dus)');
    await kirim(admin, '/api/shift/buka', { modalAwal: 500_000 });
    const r = await kirim<BarisRetur>(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Kelebihan',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '1', kondisi: 'BAIK' }],
    });
    expect(r.status).toBe('DISETUJUI');
    expect(r.totalRetur).toBe(110_000); // harga efektif 220.000 ÷ 2 dus
    expect(await stok(m.semen)).toBe('90.000');
    const [rd] = await db.select().from(returPenjualanDetail);
    expect(rd).toMatchObject({ qtyRetur: '1.000', qtyReturDasar: '10.000' });

    // Satuan jual dinonaktifkan: tidak bisa dipakai di transaksi baru.
    await simpanSj([{ idSatuan: idDus, faktor: '10', statusAktif: 'NONAKTIF' }]);
    const tolak = await galat(kasir, '/api/order/pratinjau', {
      idOrder: null,
      order: { jenisPenjualan: 'LANGSUNG', baris },
    });
    expect(tolak.status).toBe(400);
    expect(tolak.pesan).toContain('nonaktif');
  });

  it('K-094: kemasan berisi lebih dari 1 satuan dasar; qty kemasan wajib bulat', async () => {
    // Isi 1 (atau kurang) ditolak: satuan terkecil seharusnya menjadi satuan dasar.
    const kecil = await galat(
      admin,
      `/api/barang/${m.semen}/satuan-jual`,
      { baris: [{ idSatuan: idDus, faktor: '0,5' }] },
      'PUT',
    );
    expect(kecil.status).toBe(400);
    expect(kecil.pesan).toContain('lebih dari 1 sak');

    const d = await simpanSj([{ idSatuan: idDus, faktor: '10' }]);
    const idSj = d.satuanJual[0]!.id;
    const pecahan = await galat(kasir, '/api/order/pratinjau', {
      idOrder: null,
      order: {
        jenisPenjualan: 'LANGSUNG',
        baris: [{ idBarang: m.semen, idSatuanJual: idSj, qty: '1.5' }],
      },
    });
    expect(pecahan.status).toBe(400);
    expect(pecahan.pesan).toContain('harus bilangan bulat');

    // Setengah dus dijual dalam satuan dasar: 5 sak.
    const p = await kirim<PratinjauOrder>(kasir, '/api/order/pratinjau', {
      idOrder: null,
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '5' }] },
    });
    expect(p.baris[0]).toMatchObject({ idSatuanJual: null, bruto: 60_000 });
  });

  it('K-095: barang sama boleh dua baris beda satuan (dus + sak), satuan sama ditolak; stok dihitung total', async () => {
    const d = await simpanSj([{ idSatuan: idDus, faktor: '10' }]);
    const idSj = d.satuanJual[0]!.id;
    const baris = [
      { idBarang: m.semen, idSatuanJual: idSj, qty: '9' },
      { idBarang: m.semen, qty: '5' },
    ];
    const p = await kirim<PratinjauOrder>(kasir, '/api/order/pratinjau', {
      idOrder: null,
      order: { jenisPenjualan: 'LANGSUNG', baris },
    });
    expect(p.baris.map((b) => [b.idSatuanJual, b.bruto])).toEqual([
      [idSj, 1_080_000],
      [null, 60_000],
    ]);

    const kembar = await galat(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [...baris, { idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 2_000_000 }],
    });
    expect(kembar.status).toBe(400);

    // 90 + 5 = 95 sak dari stok 100: lolos; ditambah 1 dus lagi (105 sak) ditolak.
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 2_000_000 }],
    });
    expect(pj.baris).toHaveLength(2);
    expect(await stok(m.semen)).toBe('5.000');
    const lebih = await galat(kasir, '/api/penjualan/checkout', {
      order: {
        jenisPenjualan: 'LANGSUNG',
        baris: [
          { idBarang: m.semen, idSatuanJual: idSj, qty: '1' },
          { idBarang: m.semen, qty: '1' },
        ],
      },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 200_000 }],
    });
    expect(lebih.status).toBe(409);
    expect(lebih.pesan).toContain('tersedia');
  });

  it('sisa kirim surat jalan dihitung dalam satuan baris', () => {
    expect(
      sisaKirim({
        qty: '2.000',
        qtyReturDasar: '10.000',
        faktor: '10.0000',
        statusItem: 'RETUR_SEBAGIAN',
        qtyDikirim: '0.500',
      }),
    ).toBe('0.500');
  });
});
