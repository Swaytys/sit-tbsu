import type {
  BarisMutasi,
  DaftarPosisiStok,
  KartuStok,
  Notifikasi,
  PeringatanStok,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import {
  aturKonfigurasi,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { db } from '../../db/client';
import { barang, penyesuaianStok, penyesuaianStokDetail } from '../../db/schema';
import { dalamTransaksi } from '../../lib/transaksi';
import { tanggalOperasional } from '../../lib/waktu';
import { catatMutasi } from './ledger';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  admin = await sesiUji('ADMIN');
});

async function ambil<T>(path: string, sesi = admin): Promise<T> {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`gagal (${r.status}): ${await r.text()}`);
  return json<T>(r);
}

async function kirim(path: string, body: unknown) {
  const r = await minta(path, { method: 'POST', cookie: admin.cookie, body });
  if (r.status >= 300) throw new Error(`gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: { id: number; nomor: string } }>(r)).data;
}

async function penyesuaian(jenis: string, baris: unknown[], alasan?: string) {
  const d = await kirim('/api/penyesuaian', { jenis, baris, alasan });
  await kirim(`/api/penyesuaian/${d.id}/selesai`, undefined);
  return d;
}

async function terima(idBarang: number, qtyMasuk: string, hargaModalMasuk: number) {
  return kirim('/api/penerimaan', {
    idPemasok: m.pemasokA,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TUNAI',
    baris: [{ idBarang, qtyMasuk, hargaModalMasuk }],
  });
}

async function aturStok(idBarang: number, qty: string) {
  await penyesuaian('SALDO_AWAL', [{ idBarang, qtyFisik: qty, hppSatuan: 1000 }]);
}

const hariIni = () => tanggalOperasional();

describe('stok persediaan (docs/05 ST1–ST3)', () => {
  it('kartu stok: saldo awal + 2 penerimaan + 1 opname sama dengan hitungan manual (roadmap Fase 4)', async () => {
    const sa = await penyesuaian('SALDO_AWAL', [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 10000 },
    ]);
    const r1 = await terima(m.semen, '5', 12000);
    const r2 = await terima(m.semen, '10', 11000);
    const op = await penyesuaian('OPNAME', [{ idBarang: m.semen, qtyFisik: '22' }]);

    const t = hariIni();
    const { data: k } = await ambil<{ data: KartuStok }>(
      `/api/stok/kartu/${m.semen}?dari=${t}&sampai=${t}`,
    );
    // Hitungan manual (L4, U1 setengah ke atas):
    // SA 10 @10.000 → HPP 10.000
    // RCV 5 @12.000 → (10×10.000 + 5×12.000) / 15 = 10.666,67 → 10.667
    // RCV 10 @11.000 → (15×10.667 + 10×11.000) / 25 = 10.800,2 → 10.800
    // Opname fisik 22 → keluar 3 @10.800, HPP tetap 10.800
    expect(k.saldoAwal).toBe('0.000');
    expect(k.totalMasuk).toBe('25.000');
    expect(k.totalKeluar).toBe('3.000');
    expect(k.saldoAkhir).toBe('22.000');
    expect(k.hppAwal).toBeNull();
    expect(k.hppAkhir).toBe(10800);
    expect(
      k.baris.map((b) => [
        b.jenis,
        b.nomorDokumen,
        b.qtyMasuk,
        b.qtyKeluar,
        b.saldoSetelah,
        b.hppSetelah,
      ]),
    ).toEqual([
      ['SALDO_AWAL', sa.nomor, '10.000', '0.000', '10.000', 10000],
      ['PENERIMAAN', r1.nomor, '5.000', '0.000', '15.000', 10667],
      ['PENERIMAAN', r2.nomor, '10.000', '0.000', '25.000', 10800],
      ['PENYESUAIAN', op.nomor, '0.000', '3.000', '22.000', 10800],
    ]);
    expect(k.baris[1]).toMatchObject({ jenisDokumen: 'PENERIMAAN', hppSatuan: 12000 });
    expect(k.baris[3]).toMatchObject({
      jenisDokumen: 'PENYESUAIAN',
      namaPengguna: admin.pengguna.namaPengguna,
    });

    // Posisi stok: nilai persediaan = 22 × 10.800.
    const posisi = await ambil<DaftarPosisiStok>('/api/stok?cari=Semen');
    expect(posisi.data[0]).toMatchObject({
      stokFisik: '22.000',
      hppRata2: 10800,
      nilaiPersediaan: 237600,
    });
  });

  it('kartu stok periode: saldo awal dari mutasi sebelum tanggal awal; tanggal terbalik ditolak', async () => {
    const idPengguna = admin.pengguna.id;
    // Dokumen bertanggal lampau dibuat langsung (layar selalu memakai tanggal hari ini, U6).
    const mutasiLampau = async (
      jenis: 'SALDO_AWAL' | 'KOREKSI',
      tanggal: string,
      qty: { qtyMasuk: string } | { qtyKeluar: string },
      keterangan: string,
    ) => {
      const [adj] = await db
        .insert(penyesuaianStok)
        .values({ nomor: `ADJ-LAMA-${tanggal}`, tanggalOperasional: tanggal, jenis, idPengguna })
        .returning();
      const [d] = await db
        .insert(penyesuaianStokDetail)
        .values({ idPenyesuaian: adj!.id, idBarang: m.pasir, kondisi: 'BAIK' })
        .returning();
      await dalamTransaksi((tx) =>
        catatMutasi(tx, {
          idBarang: m.pasir,
          jenis: jenis === 'KOREKSI' ? 'PENYESUAIAN' : 'SALDO_AWAL',
          ...qty,
          hppSatuan: 3000,
          sumber: { idPenyesuaianDetail: d!.id },
          idPengguna,
          tanggalOperasional: tanggal,
          keterangan,
        }),
      );
    };
    await mutasiLampau('SALDO_AWAL', '2026-01-05', { qtyMasuk: '8' }, 'saldo awal');
    await mutasiLampau('KOREKSI', '2026-02-10', { qtyKeluar: '1.5' }, 'tumpah');
    const { data: k } = await ambil<{ data: KartuStok }>(
      `/api/stok/kartu/${m.pasir}?dari=2026-02-01&sampai=2026-02-28`,
    );
    expect(k).toMatchObject({
      saldoAwal: '8.000',
      totalKeluar: '1.500',
      saldoAkhir: '6.500',
      hppAwal: 3000,
      hppAkhir: 3000,
    });
    expect(k.baris).toHaveLength(1);
    expect(k.baris[0]).toMatchObject({ nomorDokumen: 'ADJ-LAMA-2026-02-10', keterangan: 'tumpah' });

    const terbalik = await minta(`/api/stok/kartu/${m.pasir}?dari=2026-03-01&sampai=2026-02-01`, {
      cookie: admin.cookie,
    });
    expect(terbalik.status).toBe(400);
    const tidakAda = await minta(`/api/stok/kartu/999999?dari=2026-01-01&sampai=2026-01-02`, {
      cookie: admin.cookie,
    });
    expect(tidakAda.status).toBe(404);
  });

  it('ST1 status stok: HABIS / KRITIS / PERLU_RESTOCK / AMAN dengan ambang restock', async () => {
    // semen: minimum 5, ambang 20% → restock sampai 6.
    await aturKonfigurasi({ ambang_restock_persen: '20' });
    const status = async (id: number) => {
      const d = await ambil<DaftarPosisiStok>('/api/stok?perHalaman=100');
      return d.data.find((b) => b.idBarang === id)?.statusStok;
    };
    expect(await status(m.semen)).toBe('HABIS');
    await aturStok(m.semen, '4.999');
    expect(await status(m.semen)).toBe('KRITIS');
    await penyesuaian('KOREKSI', [{ idBarang: m.semen, qtySelisih: '0.001' }], 'uji');
    expect(await status(m.semen)).toBe('PERLU_RESTOCK'); // 5 = minimum
    await penyesuaian('KOREKSI', [{ idBarang: m.semen, qtySelisih: '1' }], 'uji');
    expect(await status(m.semen)).toBe('PERLU_RESTOCK'); // 6 = 5 × 1,2
    await penyesuaian('KOREKSI', [{ idBarang: m.semen, qtySelisih: '0.001' }], 'uji');
    expect(await status(m.semen)).toBe('AMAN');

    // Minimum 0: hanya HABIS atau AMAN.
    expect(await status(m.pasir)).toBe('HABIS');
    await aturStok(m.pasir, '0.5');
    expect(await status(m.pasir)).toBe('AMAN');

    // Ambang mengikuti pengaturan.
    await aturKonfigurasi({ ambang_restock_persen: '50' });
    expect(await status(m.semen)).toBe('PERLU_RESTOCK'); // 6,001 ≤ 7,5

    const d = await ambil<DaftarPosisiStok>('/api/stok?statusStok=PERLU_RESTOCK');
    expect(d.data.map((b) => b.idBarang)).toEqual([m.semen]);
    // Barang nonaktif tidak dihitung; titip (konsinyasi, stok 0) HABIS.
    expect(d.ringkasan.perStatus).toEqual({ HABIS: 1, KRITIS: 0, PERLU_RESTOCK: 1, AMAN: 1 });
    expect(d.ringkasan.jumlahBarang).toBe(3);

    // Daftar barang (master) ikut menampilkan status stok yang sama.
    const daftarBarang = await ambil<{ data: { id: number; statusStok: string }[] }>(
      '/api/barang?perHalaman=100',
    );
    expect(daftarBarang.data.find((b) => b.id === m.semen)?.statusStok).toBe('PERLU_RESTOCK');
  });

  it('konsinyasi tidak masuk nilai persediaan milik toko (L7)', async () => {
    await penyesuaian('SALDO_AWAL', [
      { idBarang: m.semen, qtyFisik: '2', hppSatuan: 9000 },
      { idBarang: m.titip, qtyFisik: '3', hppSatuan: 30000 },
    ]);
    const d = await ambil<DaftarPosisiStok>('/api/stok');
    expect(d.ringkasan.nilaiPersediaan).toBe(18000);
    expect(d.data.find((b) => b.idBarang === m.titip)).toMatchObject({
      hppRata2: 30000,
      nilaiPersediaan: 0,
    });
  });

  it('mutasi: riwayat terbaru dulu, saring jenis/barang, nomor dokumen sumber', async () => {
    const sa = await penyesuaian('SALDO_AWAL', [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '4', hppSatuan: 3000 },
    ]);
    const r = await terima(m.semen, '2', 9500);
    const semua = await ambil<{ data: BarisMutasi[]; meta: { total: number } }>('/api/stok/mutasi');
    expect(semua.meta.total).toBe(3);
    expect(semua.data[0]).toMatchObject({ jenis: 'PENERIMAAN', nomorDokumen: r.nomor });

    const pasir = await ambil<{ data: BarisMutasi[] }>(`/api/stok/mutasi?idBarang=${m.pasir}`);
    expect(pasir.data.map((x) => x.nomorDokumen)).toEqual([sa.nomor]);
    const jenis = await ambil<{ data: BarisMutasi[] }>(
      '/api/stok/mutasi?jenis=SALDO_AWAL&cari=semen',
    );
    expect(jenis.data).toHaveLength(1);
    const besok = await ambil<{ data: BarisMutasi[] }>('/api/stok/mutasi?dari=2099-01-01');
    expect(besok.data).toHaveLength(0);
  });

  it('izin: hanya pemegang persediaan.stok.lihat; HPP disaring tanpa lihat_hpp', async () => {
    for (const peran of ['KASIR', 'STAF_PENJUALAN'] as const) {
      const s = await sesiUji(peran);
      for (const path of [
        '/api/stok',
        '/api/stok/ekspor',
        '/api/stok/mutasi',
        `/api/stok/kartu/${m.semen}?dari=2026-01-01&sampai=2026-01-31`,
      ]) {
        expect((await minta(path, { cookie: s.cookie })).status, `${peran} ${path}`).toBe(403);
      }
    }
    // Peran dengan stok.lihat tetapi tanpa lihat_hpp tidak menerima field sensitif.
    const { daftarStok, daftarMutasi } = await import('./stok/service');
    await aturStok(m.semen, '3');
    const izin = new Set(['persediaan.stok.lihat'] as const);
    const d = await daftarStok({ halaman: 1, perHalaman: 25 }, izin);
    expect(d.data[0]).not.toHaveProperty('hppRata2');
    expect(d.data[0]).not.toHaveProperty('nilaiPersediaan');
    expect(d.ringkasan).not.toHaveProperty('nilaiPersediaan');
    const mt = await daftarMutasi({ halaman: 1, perHalaman: 25 }, izin);
    expect(mt.data[0]).not.toHaveProperty('hppSatuan');
    expect(mt.data[0]).not.toHaveProperty('hppSetelah');
  });

  it('ekspor posisi stok berisi kolom HPP hanya untuk pemegang lihat_hpp', async () => {
    await aturStok(m.semen, '7');
    const r = await minta('/api/stok/ekspor', { cookie: admin.cookie });
    expect(r.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    const ws = wb.getWorksheet('Posisi Stok')!;
    const header = (ws.getRow(1).values as unknown[]).filter(Boolean);
    expect(header).toContain('Nilai persediaan');
    expect(ws.rowCount).toBe(4); // header + 3 barang aktif
  });

  it('ST2/ST3 notifikasi topbar per izin dan kartu peringatan dashboard', async () => {
    await aturStok(m.semen, '2'); // KRITIS
    // pasir & titip: HABIS (stok 0)
    const { data: notif } = await ambil<{ data: Notifikasi[] }>('/api/notifikasi');
    expect(notif.map((n) => [n.jenis, n.jumlah])).toEqual([
      ['STOK_HABIS', 2],
      ['STOK_KRITIS', 1],
    ]);

    const kasir = await sesiUji('KASIR');
    const { data: notifKasir } = await ambil<{ data: Notifikasi[] }>('/api/notifikasi', kasir);
    expect(notifKasir).toEqual([]);

    const { data: dash } = await ambil<{ data: PeringatanStok }>(
      '/api/dashboard/peringatan-stok',
      kasir,
    );
    expect(dash).toMatchObject({ habis: 2, kritis: 1, perluRestock: 0 });
    expect(dash.barang.map((b) => b.statusStok)).toEqual(['HABIS', 'HABIS', 'KRITIS']);

    // Barang nonaktif tidak memicu peringatan.
    await db.update(barang).set({ statusAktif: 'NONAKTIF' }).where(eq(barang.id, m.pasir));
    const { data: dash2 } = await ambil<{ data: PeringatanStok }>('/api/dashboard/peringatan-stok');
    expect(dash2.habis).toBe(1);
  });
});
