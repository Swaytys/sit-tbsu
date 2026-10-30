import type {
  DetailPenjualan,
  DokumenLaporan,
  KandidatInvoiceLaporan,
  RingkasanDashboard,
} from '@sit/shared';
import { and, eq, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, rekeningUji, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  clericalCheck,
  hargaBarang,
  kasShift,
  logAktivitas,
  mutasiPersediaan,
  pelanggan,
  penjualan,
  penjualanDetail,
  returPenjualan,
  returPenjualanDetail,
  shiftKasir,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungKartuStok } from './kartu-stok';
import { hitungLabaKotor } from './laba-kotor';
import { hitungNilaiPersediaan } from './nilai-persediaan';
import { hitungPenjualanPeriode } from './penjualan-periode';
import { hitungPiutang } from './piutang';
import { hitungProdukTerlaris } from './produk-terlaris';
import { hitungReturPenjualan } from './retur-penjualan';
import { hitungStokMinimum } from './stok-minimum';
import { hitungStokRekap } from './stok-rekap';

/*
 * "Selesai bila" Fase 7: 10 laporan cocok dengan data uji yang dihitung manual.
 *
 * Data uji (kemarin = H-1, hari ini = H):
 *  H-1  Saldo awal: semen 20 @8.000, pasir 20 @2.000, cat titipan 5 @30.000 (harga titip).
 *  H    Penerimaan semen 10 @11.000 → HPP semen (20×8.000 + 10×11.000) ÷ 30 = 9.000.
 *       A  Kasir, langsung tunai: semen 5 @10.000 + pasir 4 @3.000 = 62.000.
 *       B  Admin, pengantaran: semen 10 @10.000 diskon 5.000 (= 95.000) + pasir 5 @3.000 (= 15.000),
 *          diskon transaksi 10.000, ongkir 20.000 → bruto 115.000, diskon 15.000, neto 120.000; DP 50.000.
 *       C  Kasir: cat titipan 1 @40.000 (HPP = harga titip 30.000).
 *       D  Kasir: semen 2 (20.000) + pasir 1 (3.000) = 23.000; pasir di-void → void sebagian 3.000.
 *       E  Kasir: pasir 2 = 6.000; void seluruh transaksi.
 *       R1 Retur A semen 1 BAIK, refund 10.000.  R2 Retur B pasir 1 RUSAK, potong tagihan 3.000.
 *       R3 Retur A pasir 1 BAIK, tukar barang (netral 3.000).
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let hariIni: string;
let kemarin: string;
let pjB: DetailPenjualan;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`POST ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function ambil<T>(sesi: Sesi, path: string) {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
function jualLangsung(baris: unknown[]) {
  return kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', baris },
    pembayaran: [{ metode: 'TUNAI' }],
  });
}
const idBaris = (pj: DetailPenjualan, idBarang: number) =>
  pj.baris.find((b) => b.idBarang === idBarang)!.id;

beforeAll(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(
    returPenjualanDetail,
    returPenjualan,
    voidTransaksiDetail,
    voidTransaksi,
    kasShift,
    clericalCheck,
    shiftKasir,
    pelanggan,
    logAktivitas,
  );
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
  hariIni = tanggalOperasional();
  kemarin = tambahHari(hariIni, -1);

  const idTier = await siapkanTierNormal();
  const harga = (idBarang: number, h: number) => ({
    idBarang,
    idTingkatHarga: idTier,
    metode: 'TETAP' as const,
    hargaTetap: h,
    hargaJual: h,
  });
  await db
    .insert(hargaBarang)
    .values([harga(m.semen, 10000), harga(m.pasir, 3000), harga(m.titip, 40000)]);
  const [plg] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90001', namaPelanggan: 'CV Uji', noHp: '0811', alamat: 'Jl. A' })
    .returning();

  // H-1: saldo awal, lalu tanggal mutasinya dimundurkan sehari (data uji).
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '20', hppSatuan: 8000 },
      { idBarang: m.pasir, qtyFisik: '20', hppSatuan: 2000 },
      { idBarang: m.titip, qtyFisik: '5', hppSatuan: 30000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  await db.update(mutasiPersediaan).set({ tanggalOperasional: kemarin });

  // H
  await kirim(admin, '/api/penerimaan', {
    idPemasok: m.pemasokB,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TUNAI',
    referensi: 'TRF0001',
    metodeBayar: 'TRANSFER',
    baris: [{ idBarang: m.semen, qtyMasuk: '10', hargaModalMasuk: 11000 }],
  });
  await kirim(kasir, '/api/shift/buka', { modalAwal: 100000 });

  const pjA = await jualLangsung([
    { idBarang: m.semen, qty: '5' },
    { idBarang: m.pasir, qty: '4' },
  ]);
  pjB = await kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
    order: {
      jenisPenjualan: 'PENGANTARAN',
      idPelanggan: plg!.id,
      alamatKirim: 'Jl. A',
      ongkir: 20000,
      baris: [
        { idBarang: m.semen, qty: '10' },
        { idBarang: m.pasir, qty: '5' },
      ],
    },
    pembayaran: [
      {
        metode: 'TRANSFER',
        nominal: 50000,
        idRekening: await rekeningUji('TRANSFER'),
        referensi: 'REF-0001',
      },
    ],
  });
  // K-146: diskon manual tidak bisa dibuat lagi, tetapi penjualan lama bisa memuatnya; laporan harus tetap
  // menghitungnya. Diskon baris 5.000 (semen) dan diskon transaksi 10.000 ditulis langsung sebagai data lama.
  await db
    .update(penjualanDetail)
    .set({ diskonBaris: 5000, subtotal: 95000 })
    .where(and(eq(penjualanDetail.idPenjualan, pjB.id), eq(penjualanDetail.idBarang, m.semen)));
  await db
    .update(penjualan)
    .set({ diskonTransaksi: 10000, totalDiskon: 15000, totalNeto: 120000 })
    .where(eq(penjualan.id, pjB.id));
  await jualLangsung([{ idBarang: m.titip, qty: '1' }]);
  const pjD = await jualLangsung([
    { idBarang: m.semen, qty: '2' },
    { idBarang: m.pasir, qty: '1' },
  ]);
  const pjE = await jualLangsung([{ idBarang: m.pasir, qty: '2' }]);

  await kirim(admin, '/api/void', {
    idPenjualan: pjD.id,
    lingkup: 'ITEM',
    idDetail: [idBaris(pjD, m.pasir)],
    alasan: 'Salah ambil barang',
    persetujuan: { metodeRefund: 'TUNAI' },
  });
  await kirim(admin, '/api/void', {
    idPenjualan: pjE.id,
    lingkup: 'TRANSAKSI',
    alasan: 'Pembeli batal',
    persetujuan: { metodeRefund: 'TUNAI' },
  });
  await kirim(admin, '/api/retur', {
    idPenjualan: pjA.id,
    alasan: 'Kelebihan beli',
    penyelesaian: 'REFUND',
    baris: [{ idPenjualanDetail: idBaris(pjA, m.semen), qtyRetur: '1', kondisi: 'BAIK' }],
    persetujuan: { metodeRefund: 'TUNAI' },
  });
  await kirim(admin, '/api/retur', {
    idPenjualan: pjB.id,
    alasan: 'Sak sobek',
    penyelesaian: 'POTONG_TAGIHAN',
    baris: [{ idPenjualanDetail: idBaris(pjB, m.pasir), qtyRetur: '1', kondisi: 'RUSAK' }],
  });
  await kirim(admin, '/api/retur', {
    idPenjualan: pjA.id,
    alasan: 'Tukar sak basah',
    penyelesaian: 'TUKAR_BARANG',
    baris: [{ idPenjualanDetail: idBaris(pjA, m.pasir), qtyRetur: '1', kondisi: 'BAIK' }],
  });
  // Stok minimum uji: semen 14 < 15 (KRITIS); pasir 11 ≤ 10 × 1,2 (PERLU_RESTOCK).
  await db.update(barang).set({ stokMinimum: '15' }).where(eq(barang.id, m.semen));
  await db.update(barang).set({ stokMinimum: '10' }).where(eq(barang.id, m.pasir));
});

describe('laporan persediaan', () => {
  it('Stok rekap = ledger: saldo awal, masuk per jenis, keluar per jenis, saldo akhir', async () => {
    const hari = await hitungStokRekap({ dari: hariIni, sampai: hariIni, cakupan: 'SEMUA' });
    const namaBarang = (id: number) =>
      ({ [m.semen]: 'Semen Gresik 40 kg', [m.pasir]: 'Pasir', [m.titip]: 'Cat titipan' })[id];
    const per = (id: number) => hari.find((b) => b.namaBarang === namaBarang(id));
    expect(per(m.semen)).toMatchObject({
      saldoAwal: '20.000',
      masukPenerimaan: '10.000',
      masukReturVoid: '1.000',
      masukLain: '0.000',
      keluarPenjualan: '17.000',
      keluarLain: '0.000',
      saldoAkhir: '14.000',
    });
    // Pasir: void D +1, void E +2, retur tukar R3 +1; jual 4+5+1+2 + pengganti tukar 1; retur RUSAK R2
    // masuk bucket rusak (tidak dihitung).
    expect(per(m.pasir)).toMatchObject({
      saldoAwal: '20.000',
      masukReturVoid: '4.000',
      keluarPenjualan: '13.000',
      saldoAkhir: '11.000',
    });
    expect(per(m.titip)).toMatchObject({
      saldoAwal: '5.000',
      keluarPenjualan: '1.000',
      saldoAkhir: '4.000',
      kepemilikan: 'KONSINYASI',
    });
    expect(hari.some((b) => b.namaBarang === 'Barang lama')).toBe(false); // nonaktif tanpa mutasi

    const dua = await hitungStokRekap({ dari: kemarin, sampai: hariIni, cakupan: 'BERMUTASI' });
    expect(dua.find((b) => b.namaBarang === 'Semen Gresik 40 kg')).toMatchObject({
      saldoAwal: '0.000',
      masukLain: '20.000',
      saldoAkhir: '14.000',
    });
  });

  it('Kartu stok perpetual: nilai masuk/keluar/saldo dengan HPP rata-rata', async () => {
    const k = await hitungKartuStok({ idBarang: m.semen, dari: hariIni, sampai: hariIni });
    expect(k).toMatchObject({
      saldoAwal: '20.000',
      hppAwal: 8000,
      totalMasuk: '11.000',
      totalKeluar: '17.000',
      saldoAkhir: '14.000',
      hppAkhir: 9000,
    });
    expect(k.baris.map((b) => [b.jenis, b.qtyMasuk, b.qtyKeluar, b.saldo, b.hppSetelah])).toEqual([
      ['PENERIMAAN', '10.000', '0.000', '30.000', 9000],
      ['PENJUALAN', '0.000', '5.000', '25.000', 9000],
      ['PENJUALAN', '0.000', '10.000', '15.000', 9000],
      ['PENJUALAN', '0.000', '2.000', '13.000', 9000],
      ['RETUR_JUAL', '1.000', '0.000', '14.000', 9000],
    ]);
    expect(k.baris[0]!.keterangan).toBe('Terima dari UD. Cat Murni');
    expect(k.baris[2]!.keterangan).toBe('Jual ke CV Uji');
    expect(k.baris[4]!.keterangan).toMatch(/^Retur dari pembeli umum \(STR-/);

    // Dokumen (Admin): saldo awal 20 × 8.000 = 160.000; masuk 110.000 + 9.000; keluar 17 × 9.000;
    // saldo akhir 14 × 9.000 = 126.000.
    const d = await ambil<DokumenLaporan>(
      admin,
      `/api/laporan/kartu-stok?idBarang=${m.semen}&dari=${hariIni}&sampai=${hariIni}`,
    );
    const tabel = d.bagian.find((b) => b.jenis === 'tabel');
    const total = tabel?.jenis === 'tabel' ? tabel.tabel.baris.at(-1) : undefined;
    expect(total?.sel.map((s) => ('v' in s ? s.v : null))).toEqual([
      null,
      null,
      null,
      '11.000',
      null,
      119000,
      '17.000',
      null,
      153000,
      '14.000',
      9000,
      126000,
    ]);
  });

  it('Stok minimum: hanya barang aktif selain AMAN, kritis lebih dulu', async () => {
    const h = await hitungStokMinimum({});
    expect(h.jumlah).toEqual({ HABIS: 0, KRITIS: 1, PERLU_RESTOCK: 1, AMAN: 1 });
    expect(h.baris.map((b) => [b.namaBarang, b.status, b.selisih])).toEqual([
      ['Semen Gresik 40 kg', 'KRITIS', '-1.000'],
      ['Pasir', 'PERLU_RESTOCK', '1.000'],
    ]);
  });

  it('Nilai persediaan per tanggal: milik sendiri vs titipan, hari ini (cache) dan kemarin (ledger)', async () => {
    const kini = await hitungNilaiPersediaan({ tanggal: hariIni });
    // 14 × 9.000 + 11 × 2.000 = 148.000; titipan 4 × 30.000 = 120.000.
    expect([kini.totalMilikSendiri, kini.totalTitipan]).toEqual([148000, 120000]);
    const lalu = await hitungNilaiPersediaan({ tanggal: kemarin });
    // 20 × 8.000 + 20 × 2.000 = 200.000; titipan 5 × 30.000 = 150.000.
    expect([lalu.totalMilikSendiri, lalu.totalTitipan]).toEqual([200000, 150000]);
    const r = await minta(`/api/laporan/nilai-persediaan?tanggal=${tambahHari(hariIni, 1)}`, {
      cookie: admin.cookie,
    });
    expect(r.status).toBe(400);
  });
});

describe('laporan penjualan', () => {
  it('Penjualan per periode: bruto → omzet → penjualan bersih, void penuh tidak dihitung', async () => {
    const h = await hitungPenjualanPeriode({ dari: hariIni, sampai: hariIni });
    expect(h.ikhtisar).toMatchObject({
      penjualanBruto: 240000,
      diskon: 15000,
      ongkir: 20000,
      jumlahPenjualan: 245000,
      voidSebagian: 3000,
      omzet: 242000,
      retur: 13000,
      penjualanBersih: 229000,
      jumlahTransaksi: 4,
      perJenis: {
        LANGSUNG: { jumlah: 3, omzet: 122000 },
        PENGANTARAN: { jumlah: 1, omzet: 120000 },
      },
      voidPenuh: { jumlah: 1, nilai: 6000 },
      perStatusBayar: { LUNAS: 3, DP: 1, BELUM_BAYAR: 0 },
    });
    expect(h.transaksi).toHaveLength(5);
    const kemarinSaja = await hitungPenjualanPeriode({ dari: kemarin, sampai: kemarin });
    expect(kemarinSaja.ikhtisar.omzet).toBe(0);
  });

  it('Produk terlaris: peringkat nilai, kontribusi & kumulatif', async () => {
    const h = await hitungProdukTerlaris({ dari: hariIni, sampai: hariIni, batas: 10 });
    expect(h.totalNilai).toBe(232000);
    expect(h.baris.map((b) => [b.namaBarang, b.qty, b.nilai, b.kontribusi, b.kumulatif])).toEqual([
      ['Semen Gresik 40 kg', '17.000', 165000, 71.12, 71.12],
      ['Cat titipan', '1.000', 40000, 17.24, 88.36],
      ['Pasir', '9.000', 27000, 11.64, 100],
    ]);
  });

  it('Retur penjualan: hanya disetujui; tukar barang netral', async () => {
    const h = await hitungReturPenjualan({ dari: hariIni, sampai: hariIni });
    expect(h.totalMengurangi).toBe(13000);
    expect(h.perPenyelesaian).toEqual({
      REFUND: { jumlah: 1, nilai: 10000 },
      POTONG_TAGIHAN: { jumlah: 1, nilai: 3000 },
      TUKAR_BARANG: { jumlah: 1, nilai: 3000 },
    });
    expect(h.perKondisi).toEqual({ BAIK: 2, RUSAK: 1, CACAT: 0 });
  });

  it('Detail invoice: rincian tagihan sampai sisa; pencarian per nomor', async () => {
    const cari = await ambil<KandidatInvoiceLaporan[]>(
      kasir,
      `/api/laporan/detail-invoice?cari=${pjB.nomor}`,
    );
    expect(cari.map((c) => c.nomor)).toEqual([pjB.nomor]);
    const d = await ambil<DokumenLaporan>(kasir, `/api/laporan/detail-invoice/${pjB.id}`);
    const ik = d.bagian.find((b) => b.jenis === 'ikhtisar');
    expect(
      ik?.jenis === 'ikhtisar'
        ? ik.baris.map((b) => [b.label, b.nilai && 'v' in b.nilai ? b.nilai.v : null])
        : [],
    ).toEqual([
      ['Jumlah harga barang', 110000],
      ['Diskon transaksi', 10000],
      ['Ongkos kirim', 20000],
      ['Total invoice', 120000],
      ['Void', 0],
      ['Retur', 3000],
      ['Total setelah koreksi', 117000],
      ['Pembayaran diterima', 50000],
      ['SISA TAGIHAN', 67000],
    ]);
    expect(JSON.stringify(d)).not.toMatch(/hpp/i);
  });
});

describe('laporan keuangan', () => {
  it('Gross profit = Σ (harga jual − HPP snapshot) × qty − retur (retur rusak tidak mengurangi HPP)', async () => {
    const h = await hitungLabaKotor({ dari: hariIni, sampai: hariIni, tampilan: 'BARANG' });
    // HPP terjual: A 45.000 + 8.000, B 90.000 + 10.000, C 30.000, D 18.000 = 201.000;
    // HPP retur BAIK (R1 semen) 9.000 → HPP 192.000. Laba kotor 229.000 − 192.000 = 37.000.
    expect(h.ikhtisar).toMatchObject({
      omzet: 242000,
      retur: 13000,
      penjualanBersih: 229000,
      hppTerjual: 201000,
      hppRetur: 9000,
      hpp: 192000,
      labaKotor: 37000,
      margin: 16.16,
    });
    for (const tampilan of ['BARANG', 'TRANSAKSI', 'BARIS'] as const) {
      const d = await ambil<DokumenLaporan>(
        admin,
        `/api/laporan/laba-kotor?dari=${hariIni}&sampai=${hariIni}&tampilan=${tampilan}`,
      );
      const tabel = d.bagian.find((b) => b.jenis === 'tabel');
      const akhir = tabel?.jenis === 'tabel' ? tabel.tabel.baris.at(-1) : undefined;
      const nilai = akhir?.sel.filter((s) => s.j === 'uang').map((s) => s.v);
      expect(nilai, tampilan).toEqual([229000, 192000, 37000]);
    }
  });

  it('Piutang: sisa per pelanggan, jatuh tempo, umur', async () => {
    const h = await hitungPiutang({});
    expect(h.total).toBe(67000);
    expect(h.baris).toHaveLength(1);
    expect(h.baris[0]).toMatchObject({
      nomor: pjB.nomor,
      namaPelanggan: 'CV Uji',
      tagihan: 117000,
      dibayar: 50000,
      sisa: 67000,
      umurHari: -7,
    });
    expect((await hitungPiutang({ terlambat: true })).total).toBe(0);
  });
});

describe('hak akses, ekspor, dan dashboard', () => {
  it('Kasir: laporan penjualan tanpa HPP; persediaan & laba ditolak 403; Staf tidak punya laporan', async () => {
    const r = await minta(`/api/laporan/penjualan?dari=${hariIni}&sampai=${hariIni}`, {
      cookie: kasir.cookie,
    });
    expect(r.status).toBe(200);
    expect(await r.text()).not.toMatch(/hpp/i);
    for (const path of [
      `/api/laporan/stok-rekap?dari=${hariIni}&sampai=${hariIni}`,
      `/api/laporan/nilai-persediaan?tanggal=${hariIni}`,
      `/api/laporan/laba-kotor?dari=${hariIni}&sampai=${hariIni}`,
      `/api/laporan/ekspor/laba-kotor?dari=${hariIni}&sampai=${hariIni}`,
    ]) {
      expect((await minta(path, { cookie: kasir.cookie })).status, path).toBe(403);
    }
    expect(
      (
        await minta(`/api/laporan/penjualan?dari=${hariIni}&sampai=${hariIni}`, {
          cookie: staf.cookie,
        })
      ).status,
    ).toBe(403);
    const cetak = await minta('/api/laporan/cetak', {
      method: 'POST',
      cookie: staf.cookie,
      body: { kode: 'penjualan' },
    });
    expect(cetak.status).toBe(403);
  });

  it('Validasi periode: tanggal terbalik dan rentang > 1 tahun ditolak', async () => {
    const terbalik = await minta(`/api/laporan/penjualan?dari=${hariIni}&sampai=${kemarin}`, {
      cookie: admin.cookie,
    });
    expect(terbalik.status).toBe(400);
    const panjang = await minta(
      `/api/laporan/penjualan?dari=${tambahHari(hariIni, -400)}&sampai=${hariIni}`,
      { cookie: admin.cookie },
    );
    expect(panjang.status).toBe(400);
  });

  it('Ekspor Excel memuat angka yang sama dan tercatat di log', async () => {
    const r = await minta(`/api/laporan/ekspor/penjualan?dari=${hariIni}&sampai=${hariIni}`, {
      cookie: kasir.cookie,
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toMatch(/laporan-penjualan-/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    const ws = wb.worksheets[0]!;
    const isi: unknown[] = [];
    ws.eachRow((row) => row.eachCell((c) => isi.push(c.value)));
    expect(isi).toContain('LAPORAN PENJUALAN PER PERIODE');
    expect(isi).toContain(229000);
    const [log] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(logAktivitas)
      .where(
        and(
          eq(logAktivitas.aksi, 'LAPORAN_EKSPOR'),
          eq(logAktivitas.idPengguna, kasir.pengguna.id),
        ),
      );
    expect(log?.n).toBe(1);
  });

  it('Dashboard: kartu omzet hanya untuk pemegang dashboard.omzet', async () => {
    const a = await ambil<RingkasanDashboard>(admin, '/api/dashboard/ringkasan');
    expect(a.omzet?.hariIni).toBe(229000);
    expect(a.omzet?.tujuhHari.at(-1)).toEqual({ tanggal: hariIni, nilai: 229000 });
    expect(a.persetujuan).toEqual({ retur: 0, void: 0 });
    const s = await ambil<RingkasanDashboard>(staf, '/api/dashboard/ringkasan');
    expect(s.omzet).toBeUndefined();
    expect(s.persetujuan).toBeUndefined();
  });
});
