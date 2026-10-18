import type { DetailOrder, DetailPenjualan, PratinjauOrder, Promo } from '@sit/shared';
import { and, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  golonganPelanggan,
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
 * Promo (docs/06 §3 PR1–PR9) dan tier harga transaksi (H8; K-087, K-098). Barang uji dari fixtur persediaan:
 * semen (modal 9.000, Normal 12.000, Grosir 11.000), pasir (modal 3.000, Normal 4.000, Grosir 4.500 karena
 * harga Normal-nya diisi Rp tetap di bawah markup Grosir). Grosir berlaku mulai belanja Rp 120.000.
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
  await kosongkanTabel(promo, pelanggan, golonganPelanggan, shiftKasir, tingkatHarga);
  const t = await db
    .insert(tingkatHarga)
    .values([
      { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2, minBelanja: 120_000 },
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
  // Tier selain tier dasar selalu mengikuti markup tier (K-098); harga jualnya ditulis langsung di sini.
  const ikutTier = (idBarang: number, idTingkatHarga: number, harga: number) => ({
    idBarang,
    idTingkatHarga,
    metode: 'IKUT_TIER' as const,
    hargaJual: harga,
  });
  await db
    .insert(hargaBarang)
    .values([
      tetap(m.semen, tier.normal, 12_000),
      ikutTier(m.semen, tier.grosir, 11_000),
      tetap(m.pasir, tier.normal, 4_000),
      ikutTier(m.pasir, tier.grosir, 4_500),
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

/** Untuk tes yang menghitung dengan harga Normal: syarat belanja Grosir dibuat tak terjangkau. */
const tanpaGrosir = () =>
  db.update(tingkatHarga).set({ minBelanja: 900_000_000 }).where(eq(tingkatHarga.id, tier.grosir));

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
    await tanpaGrosir();
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

    // Total bruto 132.000 ≥ min belanja promo; pasir qty 3 ≥ min qty.
    p = await pratinjau(admin, [
      { idBarang: m.semen, qty: '10' },
      { idBarang: m.pasir, qty: '3' },
    ]);
    expect(p.baris.map((b) => [b.namaPromo, b.diskonPromo, b.subtotal])).toEqual([
      ['Semen Rp700', 7000, 113_000], // 700 × 10 > 5% (6.000)
      ['Pasir 10%', 1200, 10_800],
    ]);
    expect(p).toMatchObject({ totalDiskonPromo: 8200, subtotal: 123_800, total: 123_800 });
  });

  it('PR3: persen dibulatkan sekali, batas maks potongan, nominal dibatasi bruto', async () => {
    await tanpaGrosir();
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
      { idBarang: m.semen, qty: '10' },
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

describe('H8 tier harga transaksi menurut nilai belanja (K-098)', () => {
  it('nilai belanja ≥ syarat tier: tier dipakai otomatis untuk semua baris, juga untuk Staf', async () => {
    // Rp 108.000 < Rp 120.000: harga Normal, dan pratinjau memberi tahu kekurangannya.
    let p = await pratinjau(staf, [{ idBarang: m.semen, qty: '9' }]);
    expect(p.baris[0]).toMatchObject({
      idTingkatHarga: tier.normal,
      hargaSatuan: 12_000,
    });
    expect(p.tierBelanja).toEqual({
      nilaiBelanja: 108_000,
      idTingkatHarga: tier.normal,
      berikut: { idTingkatHarga: tier.grosir, kurang: 12_000 },
    });

    // Tepat Rp 120.000 (dihitung dengan harga Normal): Grosir.
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.baris[0]).toMatchObject({
      idTingkatHarga: tier.grosir,
      hargaSatuan: 11_000,
    });
    expect(p.tierBelanja).toEqual({
      nilaiBelanja: 120_000,
      idTingkatHarga: tier.grosir,
      berikut: null,
    });
    expect(p.totalBruto).toBe(110_000);

    // Nilai belanja dihitung dari seluruh keranjang: semen hanya 5 sak pun mendapat harga Grosir.
    // Pasir: harga Grosir 4.500 lebih mahal dari Normal 4.000, jadi tetap Normal.
    p = await pratinjau(staf, [
      { idBarang: m.semen, qty: '5' },
      { idBarang: m.pasir, qty: '15' },
    ]);
    expect(p.tierBelanja).toMatchObject({ nilaiBelanja: 120_000, idTingkatHarga: tier.grosir });
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: tier.grosir, hargaSatuan: 11_000 });
    expect(p.baris[1]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 4000 });
  });

  it('K-099: tier tidak bisa dipilih; tier yang dikirim diabaikan untuk semua peran', async () => {
    // Harga manual dinilai dengan harga Normal-nya (4.000) untuk nilai belanja.
    const campur = await pratinjau(admin, [
      { idBarang: m.semen, qty: '10' },
      { idBarang: m.pasir, qty: '10', hargaManual: true, hargaSatuan: 3900 },
    ]);
    expect(campur.tierBelanja.nilaiBelanja).toBe(160_000);
    expect(campur.baris[0]).toMatchObject({ idTingkatHarga: tier.grosir, hargaSatuan: 11_000 });
    expect(campur.baris[1]).toMatchObject({ idTingkatHarga: null, hargaSatuan: 3900 });

    // Belanja kecil dengan "idTingkatHarga" Grosir di badan permintaan: tetap harga Normal, siapa pun
    // pelakunya (kolom itu sudah tidak dikenal API).
    const kecil = [{ idBarang: m.semen, qty: '1', idTingkatHarga: tier.grosir }];
    for (const sesi of [staf, kasir, admin]) {
      expect((await pratinjau(sesi, kecil)).baris[0]).toMatchObject({
        idTingkatHarga: tier.normal,
        hargaSatuan: 12_000,
      });
    }
    // Belanja besar dengan "idTingkatHarga" Normal: tetap Grosir.
    const besar = await kirimData<DetailOrder>(
      kasir,
      '/api/order?kirim=true',
      keranjang([{ idBarang: m.semen, qty: '10', idTingkatHarga: tier.normal }]),
    );
    expect(besar.baris[0]).toMatchObject({ idTingkatHarga: tier.grosir, hargaSatuan: 11_000 });
    // Nilai belanja turun: harga Grosir tidak bisa ditahan.
    const turun = await kirimData<DetailOrder>(
      kasir,
      `/api/order/${besar.id}`,
      keranjang(kecil),
      'PUT',
    );
    expect(turun.baris[0]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 12_000 });
  });

  it('tier aktif wajib bersyarat belanja (K-099); syarat sama → markup terkecil; tier dasar tanpa syarat', async () => {
    const ubahTier = (id: number, isi: Record<string, unknown>) =>
      kirim(admin, `/api/tingkat-harga/${id}`, isi, 'PATCH');
    const grosir = { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2 };

    // Tier dasar berlaku untuk semua transaksi: tidak boleh punya syarat belanja.
    const tolak = await galat(
      ubahTier(tier.normal, {
        kode: 'NORMAL',
        nama: 'Normal',
        markupDefaultPersen: '25',
        minBelanja: 50_000,
        urutan: 1,
      }),
    );
    expect(tolak.status).toBe(400);
    expect(tolak.pesan).toContain('Tier dasar');
    expect((await ubahTier(tier.grosir, { ...grosir, minBelanja: 0 })).status).toBe(400);

    // K-099: tier aktif selain tier dasar wajib punya syarat belanja; tier baru juga.
    const kosong = await galat(ubahTier(tier.grosir, { ...grosir, minBelanja: null }));
    expect(kosong.status).toBe(400);
    expect(kosong.pesan).toContain('Isi "Mulai belanja" tier Grosir');
    const baru = { kode: 'MEMBER', nama: 'Member', markupDefaultPersen: '18', urutan: 4 };
    expect((await kirim(admin, '/api/tingkat-harga', baru)).status).toBe(400);
    // Tier nonaktif boleh tanpa syarat, tetapi tidak bisa diaktifkan sebelum syaratnya diisi.
    const status = (statusAktif: string) =>
      kirim(admin, `/api/tingkat-harga/${tier.grosir}/status`, { statusAktif }, 'PATCH');
    expect((await status('NONAKTIF')).status).toBe(200);
    expect((await ubahTier(tier.grosir, { ...grosir, minBelanja: null })).status).toBe(200);
    let p = await pratinjau(staf, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 12_000 });
    expect(p.tierBelanja).toMatchObject({ idTingkatHarga: tier.normal, berikut: null });
    const aktif = await galat(status('AKTIF'));
    expect(aktif.status).toBe(400);
    expect(aktif.pesan).toContain('Mulai belanja');
    expect((await ubahTier(tier.grosir, { ...grosir, minBelanja: 120_000 })).status).toBe(200);
    expect((await status('AKTIF')).status).toBe(200);

    // Syarat diubah pemilik: langsung berlaku untuk transaksi berikutnya.
    expect((await ubahTier(tier.grosir, { ...grosir, minBelanja: 50_000 })).status).toBe(200);
    // (Mengaktifkan kembali menghitung ulang harga tier dari modal: 9.000 × 1,2 = 10.800.)
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '5' }]);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: tier.grosir, hargaSatuan: 10_800 });

    // Tangga tier: Distributor mulai Rp 200.000. Rp 120.000 → Grosir, kurang Rp 80.000 ke Distributor.
    const [dist] = await db
      .insert(tingkatHarga)
      .values({
        kode: 'DISTRIBUTOR',
        nama: 'Distributor',
        markupDefaultPersen: '15',
        urutan: 3,
        minBelanja: 200_000,
      })
      .returning();
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: dist!.id,
      metode: 'IKUT_TIER',
      hargaJual: 10_400,
    });
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.tierBelanja).toEqual({
      nilaiBelanja: 120_000,
      idTingkatHarga: tier.grosir,
      berikut: { idTingkatHarga: dist!.id, kurang: 80_000 },
    });
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '17' }]);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: dist!.id, hargaSatuan: 10_400 });
    // Dua tier bersyarat sama: yang markup-nya lebih kecil (lebih murah) yang dipakai.
    await db.update(tingkatHarga).set({ minBelanja: 50_000 }).where(eq(tingkatHarga.id, dist!.id));
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '5' }]);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: dist!.id, hargaSatuan: 10_400 });
  });

  it('order menyimpan tier transaksi; nilai belanja turun di bawah syarat kembali ke tier dasar', async () => {
    const o = await kirimData<{ id: number }>(
      staf,
      '/api/order',
      keranjang([{ idBarang: m.semen, qty: '10' }]),
    );
    const detail = await kirimData<DetailOrder>(staf, `/api/order/${o.id}`, undefined, 'GET');
    expect(detail.baris[0]).toMatchObject({
      idTingkatHarga: tier.grosir,
      hargaSatuan: 11_000,
    });
    const p = await pratinjau(staf, [{ idBarang: m.semen, qty: '5' }], o.id);
    expect(p.baris[0]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 12_000 });
  });
});

describe('PR9 promo di atas harga tier (K-098); promo menurut pembeli (K-097)', () => {
  it('promo dipotong dari harga tier transaksi; batas modal PR6 tetap berlaku', async () => {
    const p10 = await buatPromo({ nama: 'Diskon 10%', potonganPersen: '10' });
    // Belanja Rp 120.000 → Grosir 11.000; promo 10% dari harga Grosir = 1.100 per sak.
    let p = await pratinjau(staf, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.baris[0]).toMatchObject({
      idTingkatHarga: tier.grosir,
      hargaSatuan: 11_000,
      bruto: 110_000,
      idPromo: p10.id,
      diskonPromo: 11_000,
      subtotal: 99_000,
    });
    // Nilai belanja tidak berkurang oleh promo: tier tetap Grosir.
    expect(p.tierBelanja).toMatchObject({ nilaiBelanja: 120_000, idTingkatHarga: tier.grosir });

    // Promo 20% dari Grosir = 8.800 < modal 9.000: untuk Staf/Kasir dilewati, promo aman berikutnya dipakai.
    const p20 = await buatPromo({ nama: 'Diskon 20%', potonganPersen: '20' });
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.baris[0]).toMatchObject({ idPromo: p10.id, diskonPromo: 11_000, promoDitolak: true });
    // Di harga Normal promo yang sama masih aman (12.000 − 20% = 9.600).
    p = await pratinjau(staf, [{ idBarang: m.semen, qty: '9' }]);
    expect(p.baris[0]).toMatchObject({
      idTingkatHarga: tier.normal,
      idPromo: p20.id,
      diskonPromo: 21_600,
      promoDitolak: false,
    });
    // Admin (berizin menjual di bawah modal) tidak dibatasi.
    p = await pratinjau(admin, [{ idBarang: m.semen, qty: '10' }]);
    expect(p.baris[0]).toMatchObject({ idPromo: p20.id, diskonPromo: 22_000, subtotal: 88_000 });
  });

  it('checkout: promo dievaluasi ulang dari harga tier yang tersimpan di order', async () => {
    const o = await kirimData<DetailOrder>(
      staf,
      '/api/order?kirim=true',
      keranjang([{ idBarang: m.semen, qty: '10' }]),
    );
    expect(o.baris[0]).toMatchObject({ idTingkatHarga: tier.grosir, hargaSatuan: 11_000 });
    expect(o.total).toBe(110_000);
    const p5 = await buatPromo({ nama: 'Baru 5%', potonganPersen: '5' });
    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      pembayaran: [lunas],
    });
    expect(pj.baris[0]).toMatchObject({
      hargaSatuan: 11_000,
      idPromo: p5.id,
      diskonPromo: 5500,
      subtotal: 104_500,
    });
    expect(pj).toMatchObject({ totalBruto: 110_000, totalDiskon: 5500, totalNeto: 104_500 });
  });

  it('promo untuk golongan, pelanggan tertentu, dan syarat belanja N hari terakhir', async () => {
    const [g] = await db.insert(golonganPelanggan).values({ nama: 'Kontraktor' }).returning();
    const [kontraktor, langganan, lain] = await db
      .insert(pelanggan)
      .values([
        { kode: 'PLG-80001', namaPelanggan: 'CV Bangun', noHp: '0811', idGolongan: g!.id },
        { kode: 'PLG-80002', namaPelanggan: 'Pak Budi', noHp: '0812' },
        { kode: 'PLG-80003', namaPelanggan: 'Bu Sari', noHp: '0813' },
      ])
      .returning();
    await buatPromo({
      nama: 'Kontraktor 10%',
      potonganPersen: '10',
      sasaranPembeli: 'GOLONGAN',
      idGolongan: g!.id,
    });
    await buatPromo({
      nama: 'Langganan 20%',
      potonganPersen: '20',
      sasaranPembeli: 'PELANGGAN',
      idPelanggan: [langganan!.id],
    });
    const harga = async (idPelanggan: number | null) =>
      (
        await kirimData<PratinjauOrder>(staf, '/api/order/pratinjau', {
          idOrder: null,
          order: keranjang([{ idBarang: m.semen, qty: '1' }], { idPelanggan }),
        })
      ).baris[0]!;
    expect((await harga(null)).idPromo).toBeNull();
    expect((await harga(kontraktor!.id)).namaPromo).toBe('Kontraktor 10%');
    expect((await harga(langganan!.id)).namaPromo).toBe('Langganan 20%');
    expect((await harga(lain!.id)).idPromo).toBeNull();

    // Belanja ≥ Rp 20.000 dalam 30 hari terakhir → 5%.
    await buatPromo({
      nama: 'Setia 5%',
      potonganPersen: '5',
      minBelanjaPelanggan: 20_000,
      hariBelanja: 30,
    });
    expect((await harga(lain!.id)).idPromo).toBeNull();
    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    await kirimData(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '2' }], { idPelanggan: lain!.id }),
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 30_000 }],
    });
    expect((await harga(lain!.id)).namaPromo).toBe('Setia 5%');
    // Pembeli umum tidak pernah memenuhi syarat belanja pelanggan.
    expect((await harga(null)).idPromo).toBeNull();

    // Golongan/pelanggan wajib dipilih sesuai sasaran.
    const kosong = await kirim(admin, '/api/promo', promoBaru({ sasaranPembeli: 'PELANGGAN' }));
    expect(kosong.status).toBe(400);
  });

  it('PR10 anggaran promo: potongan dibatasi sisa anggaran, dibagi per baris, gugur saat habis; void mengembalikannya', async () => {
    await tanpaGrosir();
    // 10% dengan anggaran Rp 3.000. Semen 12.000/sak → potongan penuh 1.200 per sak.
    const p = await buatPromo({ nama: 'Hemat 10%', anggaran: 3000 });
    expect(p).toMatchObject({ anggaran: 3000, totalDiskon: 0, sisaAnggaran: 3000 });
    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });

    // Dua baris dalam satu transaksi berbagi sisa: semen 2 sak (2.400) lalu pasir 5 (2.000 → tinggal 600).
    const pra = await pratinjau(kasir, [
      { idBarang: m.semen, qty: '2' },
      { idBarang: m.pasir, qty: '5' },
    ]);
    expect(pra.baris.map((b) => b.diskonPromo)).toEqual([2400, 600]);
    const pj = await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '2' }]),
      pembayaran: [lunas],
    });
    expect(pj.baris[0]).toMatchObject({ idPromo: p.id, diskonPromo: 2400 });

    // Sisa Rp 600: potongan berikutnya dipotong menjadi sebesar sisanya.
    const sisa = await pratinjau(kasir, [{ idBarang: m.semen, qty: '1' }]);
    expect(sisa.baris[0]).toMatchObject({ idPromo: p.id, diskonPromo: 600 });
    const pj2 = await kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '1' }]),
      pembayaran: [lunas],
    });
    expect(pj2.baris[0]?.diskonPromo).toBe(600);

    // Anggaran habis: promo gugur, daftar promo menunjukkan realisasinya.
    const habis = await pratinjau(kasir, [{ idBarang: m.semen, qty: '1' }]);
    expect(habis.baris[0]).toMatchObject({ idPromo: null, diskonPromo: 0 });
    const d = await kirimData<Promo>(admin, `/api/promo/${p.id}`, undefined, 'GET');
    expect(d).toMatchObject({ totalDiskon: 3000, sisaAnggaran: 0 });

    // Anggaran boleh dinaikkan walau promo sudah dipakai, tetapi tidak di bawah yang sudah terpakai.
    const turun = await galat(
      kirim(admin, `/api/promo/${p.id}`, promoBaru({ nama: 'Hemat 10%', anggaran: 2000 }), 'PATCH'),
    );
    expect(turun.status).toBe(400);
    expect(turun.pesan).toContain('Rp 3.000');
    await kirimData(
      admin,
      `/api/promo/${p.id}`,
      promoBaru({ nama: 'Hemat 10%', anggaran: 5000 }),
      'PATCH',
    );
    expect((await pratinjau(kasir, [{ idBarang: m.semen, qty: '1' }])).baris[0]?.diskonPromo).toBe(
      1200,
    );

    // Void seluruh penjualan pertama mengembalikan Rp 2.400 ke anggaran.
    await kirimData(admin, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Uji anggaran promo',
      persetujuan: { metodeRefund: 'TUNAI' },
    });
    expect(await kirimData<Promo>(admin, `/api/promo/${p.id}`, undefined, 'GET')).toMatchObject({
      totalDiskon: 600,
      sisaAnggaran: 4400,
    });
  });

  it('PR11 batas per pembeli: pelanggan terdata dijumlah lintas transaksi, pembeli umum per transaksi; harus di bawah anggaran', async () => {
    await tanpaGrosir();
    const tolak = await galat(
      kirim(admin, '/api/promo', promoBaru({ anggaran: 5000, maksPerPembeli: 5000 })),
    );
    expect(tolak.status).toBe(400);
    const p = await buatPromo({ nama: 'Hemat 10%', anggaran: 100_000, maksPerPembeli: 2000 });
    const [budi] = await db
      .insert(pelanggan)
      .values({ kode: 'PLG-81001', namaPelanggan: 'Pak Budi', noHp: '0812' })
      .returning();
    await kirimData(kasir, '/api/shift/buka', { modalAwal: 0 });
    const jual = (idPelanggan: number | null, qty: string) =>
      kirimData<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
        order: keranjang([{ idBarang: m.semen, qty }], { idPelanggan }),
        pembayaran: [lunas],
      });

    // Pak Budi: 1 sak → 1.200; berikutnya tinggal 800; lalu habis untuk dia.
    expect((await jual(budi!.id, '1')).baris[0]?.diskonPromo).toBe(1200);
    expect((await jual(budi!.id, '1')).baris[0]).toMatchObject({ idPromo: p.id, diskonPromo: 800 });
    expect((await jual(budi!.id, '1')).baris[0]).toMatchObject({ idPromo: null, diskonPromo: 0 });
    // Pembeli umum tidak punya riwayat: batasnya per transaksi (3 sak = 3.600 → 2.000), tiap transaksi.
    expect((await jual(null, '3')).baris[0]?.diskonPromo).toBe(2000);
    expect((await jual(null, '3')).baris[0]?.diskonPromo).toBe(2000);
    expect(await kirimData<Promo>(admin, `/api/promo/${p.id}`, undefined, 'GET')).toMatchObject({
      totalDiskon: 6000,
      sisaAnggaran: 94_000,
      maksPerPembeli: 2000,
    });
  });
});
