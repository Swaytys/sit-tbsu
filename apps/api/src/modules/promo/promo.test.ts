import type { DetailOrder, DetailPenjualan, PratinjauOrder, Promo } from '@sit/shared';
import { and, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  hargaBarang,
  kategori,
  logAktivitas,
  orderPenjualan,
  orderPenjualanDetail,
  pelanggan,
  penjualanDetail,
  promo,
  shiftKasir,
  tingkatHarga,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';

/*
 * Promo (docs/06 §3 PR1–PR7) dan perubahan diskon/tier Fase 9 (D3, H8; K-087). Barang uji dari fixtur
 * persediaan: semen (modal 9.000, Normal 12.000, Grosir 11.000), pasir (modal 3.000, Normal 4.000).
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let tier: { normal: number; grosir: number };
let katPasir: number;
const hariIni = tanggalOperasional();
const kemarin = tambahHari(hariIni, -1);
const besok = tambahHari(hariIni, 1);

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(promo, pelanggan, shiftKasir, tingkatHarga);
  const t = await db
    .insert(tingkatHarga)
    .values([
      { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2, saranMinQty: '10' },
    ])
    .returning();
  tier = { normal: t[0]!.id, grosir: t[1]!.id };
  const tetap = (idBarang: number, idTingkatHarga: number, harga: number) => ({
    idBarang,
    idTingkatHarga,
    metode: 'TETAP' as const,
    hargaTetap: harga,
    hargaJual: harga,
  });
  await db
    .insert(hargaBarang)
    .values([
      tetap(m.semen, tier.normal, 12_000),
      tetap(m.semen, tier.grosir, 11_000),
      tetap(m.pasir, tier.normal, 4_000),
      tetap(m.pasir, tier.grosir, 4_500),
    ]);
  const [k] = await db.insert(kategori).values({ nama: 'Pasir' }).returning();
  katPasir = k!.id;
  await db.update(barang).set({ idKategori: katPasir }).where(eq(barang.id, m.pasir));
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
  const sa = await kirimData<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '20', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '20', hppSatuan: 3000 },
    ],
  });
  await kirimData(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

async function kirimData<T = unknown>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await kirim(sesi, path, body, method);
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function galat(r: Response | Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<Galat>(res)).error };
}

function promoBaru(ubah: Record<string, unknown> = {}) {
  return {
    nama: 'Promo uji',
    tanggalMulai: hariIni,
    tanggalSelesai: tambahHari(hariIni, 30),
    jenisPotongan: 'PERSEN',
    potonganPersen: '10',
    sasaran: 'SEMUA',
    ...ubah,
  };
}

const buatPromo = (ubah: Record<string, unknown> = {}) =>
  kirimData<Promo>(admin, '/api/promo', promoBaru(ubah));

const keranjang = (baris: unknown[], ubah: Record<string, unknown> = {}) => ({
  jenisPenjualan: 'LANGSUNG',
  baris,
  ...ubah,
});

const pratinjau = (sesi: Sesi, baris: unknown[], idOrder: number | null = null) =>
  kirimData<PratinjauOrder>(sesi, '/api/order/pratinjau', { idOrder, order: keranjang(baris) });

const lunas = { metode: 'TUNAI', nominal: null, uangDiterima: 1_000_000 };

async function logTerakhir(aksi: string) {
  const [b] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return b;
}

describe('master promo (K-087)', () => {
  it('Admin membuat promo berkode PRM; validasi; Kasir dan Staf ditolak; log', async () => {
    const a = await buatPromo({ maksPotongan: 5000 });
    expect(a).toMatchObject({
      kode: 'PRM-00001',
      potonganPersen: '10.00',
      maksPotongan: 5000,
      statusAktif: 'AKTIF',
      statusBerlaku: 'BERJALAN',
      jumlahPemakaian: 0,
    });
    const b = await buatPromo({
      jenisPotongan: 'NOMINAL',
      potonganNominal: 500,
      maksPotongan: 9999, // hanya untuk persen: dikosongkan
      sasaran: 'KATEGORI',
      idKategori: katPasir,
      tanggalMulai: besok,
    });
    expect(b).toMatchObject({
      kode: 'PRM-00002',
      potonganPersen: null,
      maksPotongan: null,
      namaKategori: 'Pasir',
      statusBerlaku: 'TERJADWAL',
    });
    expect((await logTerakhir('PROMO_BUAT'))?.ringkasan).toContain('PRM-00002');

    for (const salah of [
      { potonganPersen: '0' },
      { potonganPersen: '100.5' },
      { tanggalSelesai: kemarin, tanggalMulai: kemarin },
      { tanggalMulai: besok, tanggalSelesai: hariIni },
      { sasaran: 'KATEGORI' },
      { jenisPotongan: 'NOMINAL', potonganPersen: null },
    ]) {
      expect((await kirim(admin, '/api/promo', promoBaru(salah))).status).toBe(400);
    }

    const res = await minta('/api/promo?berlaku=TERJADWAL', { cookie: admin.cookie });
    expect((await json<{ data: Promo[] }>(res)).data.map((p) => p.kode)).toEqual(['PRM-00002']);

    expect((await kirim(kasir, '/api/promo', undefined, 'GET')).status).toBe(403);
    expect((await kirim(staf, '/api/promo', promoBaru())).status).toBe(403);
    expect(
      (await kirim(kasir, `/api/promo/${a.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH'))
        .status,
    ).toBe(403);
  });

  it('aturan dikunci setelah promo dipakai; nama dan tanggal selesai tetap bisa diubah; nonaktif/aktifkan', async () => {
    const p = await buatPromo();
    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '1' }]),
      pembayaran: [lunas],
    });
    expect(
      (await kirimData<Promo>(admin, `/api/promo/${p.id}`, undefined, 'GET')).jumlahPemakaian,
    ).toBe(1);

    const kunci = await galat(
      kirim(admin, `/api/promo/${p.id}`, promoBaru({ potonganPersen: '15' }), 'PATCH'),
    );
    expect(kunci).toMatchObject({ status: 409, kode: 'KONFLIK' });
    expect(kunci.pesan).toContain('sudah dipakai');

    const ubah = await kirimData<Promo>(
      admin,
      `/api/promo/${p.id}`,
      promoBaru({ nama: 'Promo akhir tahun', tanggalSelesai: tambahHari(hariIni, 60) }),
      'PATCH',
    );
    expect(ubah).toMatchObject({ nama: 'Promo akhir tahun', potonganPersen: '10.00' });
    expect((await logTerakhir('PROMO_UBAH'))?.ringkasan).toContain('nama, tanggalSelesai');

    await kirimData(admin, `/api/promo/${p.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    expect(await logTerakhir('PROMO_NONAKTIF')).toBeDefined();
    await kirimData(admin, `/api/promo/${p.id}/status`, { statusAktif: 'AKTIF' }, 'PATCH');
    expect(await logTerakhir('PROMO_AKTIFKAN')).toBeDefined();
  });
});

describe('promo di order dan pratinjau (PR1–PR4, PR6)', () => {
  it('PR1/PR2: tanggal dan status berlaku, sasaran, min qty, min belanja', async () => {
    await buatPromo({ nama: 'Semua 5%', potonganPersen: '5' });
    await buatPromo({ nama: 'Pasir 10%', sasaran: 'KATEGORI', idKategori: katPasir, minQty: '3' });
    await buatPromo({
      nama: 'Semen Rp700',
      jenisPotongan: 'NOMINAL',
      potonganNominal: 700,
      sasaran: 'BARANG',
      idBarang: m.semen,
      minBelanja: 50_000,
    });
    // Lebih besar tetapi tidak berlaku: nonaktif, sudah berakhir, belum mulai.
    const mati = await buatPromo({ nama: 'Nonaktif 50%', potonganPersen: '50' });
    await kirimData(admin, `/api/promo/${mati.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    const lewat = await buatPromo({ nama: 'Berakhir 50%', potonganPersen: '50' });
    await db
      .update(promo)
      .set({ tanggalMulai: tambahHari(hariIni, -5), tanggalSelesai: kemarin })
      .where(eq(promo.id, lewat.id));
    await buatPromo({ nama: 'Besok 50%', potonganPersen: '50', tanggalMulai: besok });

    let p = await pratinjau(admin, [
      { idBarang: m.semen, qty: '2' },
      { idBarang: m.pasir, qty: '2' },
    ]);
    expect(p.totalBruto).toBe(32_000);
    expect(p.baris.map((b) => [b.namaPromo, b.diskonPromo])).toEqual([
      ['Semua 5%', 1200],
      ['Semua 5%', 400],
    ]);

    // Total bruto 132.000 ≥ min belanja; pasir qty 3 ≥ min qty. Tier Normal dipilih (tanpa tier qty).
    p = await pratinjau(admin, [
      { idBarang: m.semen, qty: '10', idTingkatHarga: tier.normal },
      { idBarang: m.pasir, qty: '3' },
    ]);
    expect(p.baris.map((b) => [b.namaPromo, b.diskonPromo, b.subtotal])).toEqual([
      ['Semen Rp700', 7000, 113_000], // 700 × 10 > 5% (6.000)
      ['Pasir 10%', 1200, 10_800],
    ]);
    expect(p).toMatchObject({ totalDiskonPromo: 8200, subtotal: 123_800, total: 123_800 });
  });

  it('PR3: persen dibulatkan sekali, batas maks potongan, nominal dibatasi bruto', async () => {
    await db
      .update(hargaBarang)
      .set({ hargaTetap: 201, hargaJual: 201 })
      .where(and(eq(hargaBarang.idBarang, m.pasir), eq(hargaBarang.idTingkatHarga, tier.normal)));
    await buatPromo({ sasaran: 'BARANG', idBarang: m.pasir, potonganPersen: '50' });
    await buatPromo({
      sasaran: 'BARANG',
      idBarang: m.semen,
      potonganPersen: '10',
      maksPotongan: 5000,
    });
    const p = await pratinjau(admin, [
      { idBarang: m.semen, qty: '10', idTingkatHarga: tier.normal },
      { idBarang: m.pasir, qty: '0.5' },
    ]);
    // 0,5 × 201 = 100,5 → bruto 101; potongan bulat(0,5 × 201 × 50%) = bulat(50,25) = 50.
    expect(p.baris[1]).toMatchObject({ bruto: 101, diskonPromo: 50, subtotal: 51 });
    expect(p.baris[0]).toMatchObject({ bruto: 120_000, diskonPromo: 5000 }); // 12.000 dibatasi 5.000

    const nominal = await buatPromo({
      sasaran: 'BARANG',
      idBarang: m.pasir,
      jenisPotongan: 'NOMINAL',
      potonganNominal: 500,
    });
    const q = await pratinjau(admin, [{ idBarang: m.pasir, qty: '1' }]);
    expect(q.baris[0]).toMatchObject({
      idPromo: nominal.id,
      bruto: 201,
      diskonPromo: 201,
      subtotal: 0,
    });
  });

  it('PR4: potongan terbesar; seri → tanggal mulai terbaru, lalu id terbesar', async () => {
    const lama = await buatPromo({ nama: 'Lama 5%', potonganPersen: '5', tanggalMulai: kemarin });
    const p = await pratinjau(admin, [{ idBarang: m.semen, qty: '1' }]);
    expect(p.baris[0]?.idPromo).toBe(lama.id);
    const baru = await buatPromo({
      nama: 'Baru Rp600',
      jenisPotongan: 'NOMINAL',
      potonganNominal: 600,
    });
    expect((await pratinjau(admin, [{ idBarang: m.semen, qty: '1' }])).baris[0]?.idPromo).toBe(
      baru.id,
    );
    const kembar = await buatPromo({
      nama: 'Kembar Rp600',
      jenisPotongan: 'NOMINAL',
      potonganNominal: 600,
    });
    expect((await pratinjau(admin, [{ idBarang: m.semen, qty: '1' }])).baris[0]?.idPromo).toBe(
      kembar.id,
    );
  });

  it('PR6: Kasir mendapat promo aman berikutnya; tanpa promo aman ditandai; Admin tetap boleh', async () => {
    const besar = await buatPromo({ nama: 'Cuci 30%', potonganPersen: '30' });
    const aman = await buatPromo({ nama: 'Hemat 10%', potonganPersen: '10' });
    // D semen = 9.000: 12.000 − 30% = 8.400 < 9.000 (di bawah modal); 12.000 − 10% = 10.800.
    const k = await pratinjau(kasir, [{ idBarang: m.semen, qty: '1' }]);
    expect(k.baris[0]).toMatchObject({ idPromo: aman.id, diskonPromo: 1200, promoDitolak: true });
    expect(JSON.stringify(k)).not.toMatch(/dasar|modal|hpp/i);
    const a = await pratinjau(admin, [{ idBarang: m.semen, qty: '1' }]);
    expect(a.baris[0]).toMatchObject({ idPromo: besar.id, diskonPromo: 3600, promoDitolak: false });

    await kirimData(admin, `/api/promo/${aman.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    const k2 = await pratinjau(kasir, [{ idBarang: m.semen, qty: '1' }]);
    expect(k2.baris[0]).toMatchObject({ idPromo: null, diskonPromo: 0, promoDitolak: true });
  });

  it('harga manual tanpa promo; D3: diskon manual dihitung dari subtotal setelah promo', async () => {
    await buatPromo({ potonganPersen: '10' });
    const p = await pratinjau(admin, [
      { idBarang: m.semen, qty: '1', hargaManual: true, hargaSatuan: 11_000 },
      { idBarang: m.pasir, qty: '2', diskonBarisPersen: '10' },
    ]);
    expect(p.baris[0]).toMatchObject({ idPromo: null, diskonPromo: 0, subtotal: 11_000 });
    // Bruto 8.000 − promo 800 = 7.200; diskon 10% = 720.
    expect(p.baris[1]).toMatchObject({ diskonPromo: 800, diskonBaris: 720, subtotal: 6480 });
    expect(p).toMatchObject({ totalBruto: 19_000, totalDiskonPromo: 800, totalDiskonBaris: 720 });
  });
});

describe('PR5: lepas promo dan evaluasi ulang saat checkout', () => {
  it('Staf tidak boleh melepas promo; Kasir boleh (log); penjualan tanpa promo', async () => {
    const p = await buatPromo({ nama: 'Hemat 10%' });
    const o = await kirimData<DetailOrder>(
      staf,
      '/api/order?kirim=true',
      keranjang([{ idBarang: m.semen, qty: '1' }]),
    );
    expect(o.baris[0]).toMatchObject({ idPromo: p.id, namaPromo: 'Hemat 10%', diskonPromo: 1200 });
    expect(o.total).toBe(10_800);

    const lepas = keranjang([{ idBarang: m.semen, qty: '1', tanpaPromo: true }]);
    expect((await galat(kirim(staf, `/api/order/${o.id}`, lepas, 'PUT'))).status).toBe(403);

    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      order: lepas,
      pembayaran: [lunas],
    });
    expect(pj.baris[0]).toMatchObject({ idPromo: null, diskonPromo: 0, subtotal: 12_000 });
    expect(pj.totalNeto).toBe(12_000);
    expect((await logTerakhir('PENJUALAN_PROMO_LEPAS'))?.ringkasan).toContain(
      'Promo Hemat 10% dilepas',
    );
  });

  it('promo berakhir sebelum checkout gugur; promo yang mulai berlaku diterapkan; total header dan order selaras', async () => {
    const lama = await buatPromo({ nama: 'Lama 10%' });
    const o = await kirimData<DetailOrder>(
      staf,
      '/api/order?kirim=true',
      keranjang([{ idBarang: m.semen, qty: '2' }]),
    );
    expect(o.total).toBe(21_600);
    // Waktu berlalu: promo lama berakhir, promo baru berlaku.
    await db
      .update(promo)
      .set({ tanggalMulai: tambahHari(hariIni, -3), tanggalSelesai: kemarin })
      .where(eq(promo.id, lama.id));
    const baru = await buatPromo({ nama: 'Baru 5%', potonganPersen: '5' });

    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      pembayaran: [lunas],
    });
    expect(pj.baris[0]).toMatchObject({
      idPromo: baru.id,
      namaPromo: 'Baru 5%',
      diskonPromo: 1200,
      subtotal: 22_800,
    });
    expect(pj).toMatchObject({ totalBruto: 24_000, totalDiskon: 1200, totalNeto: 22_800 });
    const [d] = await db
      .select()
      .from(penjualanDetail)
      .where(eq(penjualanDetail.idBarang, m.semen));
    expect(d).toMatchObject({ idPromo: baru.id, diskonPromo: 1200, subtotal: 22_800 });
    const [od] = await db
      .select()
      .from(orderPenjualanDetail)
      .where(eq(orderPenjualanDetail.idOrder, o.id));
    expect(od).toMatchObject({ idPromo: baru.id, diskonPromo: 1200, subtotal: 22_800 });
    const [oh] = await db.select().from(orderPenjualan).where(eq(orderPenjualan.id, o.id));
    expect(oh).toMatchObject({ status: 'SELESAI', subtotal: 22_800, total: 22_800 });
    expect((await logTerakhir('PENJUALAN_CHECKOUT'))?.ringkasan).toContain('promo Rp 1.200');
  });

  it('diskon dari Admin tetap sah saat Kasir mengubah order; diskon baru Kasir diuji batasnya (D2)', async () => {
    const o = await kirimData<DetailOrder>(
      admin,
      '/api/order?kirim=true',
      keranjang([{ idBarang: m.semen, qty: '1', diskonBaris: 2000 }]),
    );
    const ubah = await kirimData<DetailOrder>(
      kasir,
      `/api/order/${o.id}`,
      keranjang([
        { idBarang: m.semen, qty: '1', diskonBaris: 2000 },
        { idBarang: m.pasir, qty: '1' },
      ]),
      'PUT',
    );
    expect(ubah.total).toBe(14_000);
    const tolak = await galat(
      kirim(
        kasir,
        `/api/order/${o.id}`,
        keranjang([{ idBarang: m.semen, qty: '1', diskonBaris: 1000 }]),
        'PUT',
      ),
    );
    expect(tolak).toMatchObject({ status: 400 });
    expect(tolak.pesan).toContain('batas peran Anda (0%)');
  });
});

describe('H8 tier otomatis (K-094)', () => {
  it('qty ≥ syarat tier: tier lebih murah dipakai otomatis, juga untuk Staf; tier mahal tidak', async () => {
    const baris = async (b: Record<string, unknown>, sesi = staf) =>
      (await pratinjau(sesi, [b])).baris[0]!;
    expect(await baris({ idBarang: m.semen, qty: '9' })).toMatchObject({
      idTingkatHarga: tier.normal,
      tierDipilih: false,
      hargaSatuan: 12_000,
    });
    expect(await baris({ idBarang: m.semen, qty: '10' })).toMatchObject({
      idTingkatHarga: tier.grosir,
      tierDipilih: false,
      hargaSatuan: 11_000,
      idTingkatHargaSaran: null,
    });
    // Grosir 4.500 > Normal 4.000: tetap Normal.
    expect(await baris({ idBarang: m.pasir, qty: '10' })).toMatchObject({
      idTingkatHarga: tier.normal,
      hargaSatuan: 4000,
    });
    // Normal dipilih kasir: tidak diganti otomatis, tetapi Grosir disarankan. Harga manual tanpa saran.
    const dipilih = await pratinjau(admin, [
      { idBarang: m.semen, qty: '10', idTingkatHarga: tier.normal },
      { idBarang: m.pasir, qty: '10', hargaManual: true, hargaSatuan: 4000 },
    ]);
    expect(dipilih.baris[0]).toMatchObject({
      idTingkatHarga: tier.normal,
      tierDipilih: true,
      hargaSatuan: 12_000,
      idTingkatHargaSaran: tier.grosir,
    });
    expect(dipilih.baris[1]?.idTingkatHargaSaran).toBeNull();
  });

  it('order menyimpan tier otomatis; qty diubah di bawah syarat kembali ke tier pelanggan', async () => {
    const o = await kirimData<{ id: number }>(
      staf,
      '/api/order',
      keranjang([{ idBarang: m.semen, qty: '10' }]),
    );
    const detail = await kirimData<DetailOrder>(staf, `/api/order/${o.id}`, undefined, 'GET');
    expect(detail.baris[0]).toMatchObject({
      idTingkatHarga: tier.grosir,
      tierDipilih: false,
      hargaSatuan: 11_000,
    });
    const p = await pratinjau(staf, [{ idBarang: m.semen, qty: '5' }], o.id);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 12_000 });
  });
});
