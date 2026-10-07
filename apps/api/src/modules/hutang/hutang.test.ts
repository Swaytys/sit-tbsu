import type {
  DaftarHutang,
  DetailPenerimaan,
  DetailPenjualan,
  DetailReturPemasok,
  DokumenLaporan,
} from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  hargaBarang,
  kasShift,
  logAktivitas,
  mutasiPersediaan,
  pelanggan,
  penerimaanBarang,
  persediaan,
  returPemasok,
  returPemasokDetail,
  shiftKasir,
  tingkatHarga,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungUlangCache } from '../persediaan/ledger';
import { hitungLaporanHutang } from '../laporan/hutang';

/*
 * Fase 10 (docs/06 §4–§8, K-088): hutang pemasok & pembayaran, retur ke pemasok, pemusnahan stok rusak,
 * limit kredit pelanggan, dan umur piutang/hutang.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string; detail?: Record<string, unknown> } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
const hariIni = tanggalOperasional();

async function kirim<T>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function galat(r: Response | Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<Galat>(res)).error };
}
async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return p!;
}
async function logTerakhir(aksi: string) {
  const [b] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return b;
}

/** Penerimaan pembelian tempo: hutang `qty × harga`. */
function beliTempo(
  idBarang: number,
  qty: string,
  harga: number,
  jatuhTempo = tambahHari(hariIni, 10),
) {
  return kirim<DetailPenerimaan>(admin, '/api/penerimaan', {
    idPemasok: m.pemasokA,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TEMPO',
    tanggalJatuhTempo: jatuhTempo,
    noFakturPemasok: 'F-TEMPO',
    baris: [{ idBarang, qtyMasuk: qty, hargaModalMasuk: harga }],
  });
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(returPemasokDetail, returPemasok, pelanggan, shiftKasir, kasShift);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
});

describe('hutang pemasok (HT1–HT4)', () => {
  it('daftar, umur, ringkasan; bayar sebagian transfer lalu lunas tunai dari laci; Kasir ditolak', async () => {
    const a = await beliTempo(m.semen, '10', 10_000);
    const b = await beliTempo(m.pasir, '5', 3000, tambahHari(hariIni, 2));
    // Penerimaan lama yang sudah lewat 40 hari dari jatuh tempo.
    const c = await beliTempo(m.semen, '1', 7000);
    await db
      .update(penerimaanBarang)
      .set({ tanggalJatuhTempo: tambahHari(hariIni, -40) })
      .where(eq(penerimaanBarang.id, c.id));

    const r = await minta('/api/hutang', { cookie: admin.cookie });
    const daftar = await json<DaftarHutang>(r);
    expect(daftar.data.map((x) => x.nomor)).toEqual([c.nomor, b.nomor, a.nomor]);
    expect(daftar.ringkasan).toMatchObject({
      totalSisa: 122_000,
      jumlah: 3,
      jumlahTerlambat: 1,
      totalTerlambat: 7000,
      umur: { BELUM: 115_000, H1_30: 0, H31_60: 7000, H61_90: 0, H90: 0 },
    });
    expect(daftar.data[0]).toMatchObject({ hariLewat: 40, kelompokUmur: 'H31_60' });
    expect((await minta('/api/hutang', { cookie: kasir.cookie })).status).toBe(403);

    // Bayar sebagian transfer (rekening wajib), lalu sisa tunai dari laci shift.
    const tanpaRekening = await galat(
      minta('/api/hutang/bayar', {
        method: 'POST',
        cookie: admin.cookie,
        body: { jenis: 'PENERIMAAN', id: a.id, nominal: 1, metode: 'TRANSFER' },
      }),
    );
    expect(tanpaRekening.status).toBe(400);
    const bayar1 = await kirim<{ nomor: string; sisa: number; statusHutang: string }>(
      admin,
      '/api/hutang/bayar',
      { jenis: 'PENERIMAAN', id: a.id, nominal: 40_000, metode: 'TRANSFER', rekening: 'BCA 123' },
    );
    expect(bayar1).toMatchObject({ sisa: 60_000, statusHutang: 'SEBAGIAN' });
    expect(bayar1.nomor).toMatch(/^PBP-/);
    const lebih = await galat(
      minta('/api/hutang/bayar', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          jenis: 'PENERIMAAN',
          id: a.id,
          nominal: 60_001,
          metode: 'TRANSFER',
          rekening: 'BCA',
        },
      }),
    );
    expect(lebih.status).toBe(400);
    const tanpaShift = await galat(
      minta('/api/hutang/bayar', {
        method: 'POST',
        cookie: admin.cookie,
        body: { jenis: 'PENERIMAAN', id: a.id, nominal: 60_000, metode: 'TUNAI' },
      }),
    );
    expect(tanpaShift.status).toBe(409);
    await kirim(admin, '/api/shift/buka', { modalAwal: 100_000 });
    const bayar2 = await kirim<{ statusHutang: string }>(admin, '/api/hutang/bayar', {
      jenis: 'PENERIMAAN',
      id: a.id,
      nominal: 60_000,
      metode: 'TUNAI',
    });
    expect(bayar2.statusHutang).toBe('LUNAS');
    const kas = await db.select().from(kasShift);
    expect(kas).toEqual([
      expect.objectContaining({ jenis: 'BAYAR_PEMASOK', arah: 'KELUAR', nominal: 60_000 }),
    ]);
    expect((await logTerakhir('HUTANG_BAYAR'))?.ringkasan).toContain(`Bayar hutang ${a.nomor}`);
    const pembayaran = await kirim<unknown[]>(
      admin,
      `/api/hutang/PENERIMAAN/${a.id}/pembayaran`,
      undefined,
      'GET',
    );
    expect(pembayaran).toHaveLength(2);

    const sisa = await json<DaftarHutang>(await minta('/api/hutang', { cookie: admin.cookie }));
    expect(sisa.ringkasan.jumlah).toBe(2);
  });

  it('Laporan Hutang Usaha: per pemasok dan umur; izin laporan.hutang', async () => {
    await beliTempo(m.semen, '10', 10_000);
    const lama = await beliTempo(m.pasir, '2', 3000);
    await db
      .update(penerimaanBarang)
      .set({ tanggalJatuhTempo: tambahHari(hariIni, -95) })
      .where(eq(penerimaanBarang.id, lama.id));
    const baris = await hitungLaporanHutang({});
    expect(baris.map((b) => [b.sisa, b.kelompokUmur])).toEqual([
      [6000, 'H90'],
      [100_000, 'BELUM'],
    ]);
    const r = await minta('/api/laporan/hutang?terlambat=true', { cookie: admin.cookie });
    expect(r.status).toBe(200);
    const dok = (await json<{ data: DokumenLaporan }>(r)).data;
    expect(dok.judul).toBe('Laporan Hutang Usaha');
    expect((await minta('/api/laporan/hutang', { cookie: kasir.cookie })).status).toBe(403);
  });
});

describe('retur ke pemasok (RP1–RP7)', () => {
  it('POTONG_HUTANG: stok keluar dengan HPP rata-rata, hutang penerimaan berkurang (HT6)', async () => {
    const a = await beliTempo(m.semen, '10', 10_000);
    const rtp = await kirim<DetailReturPemasok>(admin, '/api/retur-pemasok', {
      idPemasok: m.pemasokA,
      idPenerimaan: a.id,
      alasan: 'Sak sobek',
      penyelesaian: 'POTONG_HUTANG',
      baris: [{ idBarang: m.semen, qty: '2' }],
    });
    expect(rtp.nomor).toMatch(/^RTP-/);
    expect(rtp).toMatchObject({ totalRetur: 20_000, nomorPenerimaan: a.nomor, peringatan: [] });
    expect(rtp.baris[0]).toMatchObject({
      hppSatuan: 10_000,
      subtotal: 20_000,
      kondisiAsal: 'BAIK',
    });
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '8.000' });
    const [p] = await db.select().from(penerimaanBarang).where(eq(penerimaanBarang.id, a.id));
    expect(p).toMatchObject({
      totalReturPotong: 20_000,
      sisaHutang: 80_000,
      statusHutang: 'SEBAGIAN',
    });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
    expect((await logTerakhir('RETUR_PEMASOK_SIMPAN'))?.nomorDokumen).toBe(rtp.nomor);

    // Nilai retur melebihi sisa hutang ditolak tanpa efek.
    const tolak = await galat(
      minta('/api/retur-pemasok', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          idPemasok: m.pemasokA,
          idPenerimaan: a.id,
          alasan: 'Uji lebih',
          penyelesaian: 'POTONG_HUTANG',
          baris: [{ idBarang: m.semen, qty: '9' }],
        },
      }),
    );
    expect(tolak.status).toBe(409);
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '8.000' });
  });

  it('dari stok rusak, GANTI_BARANG, REFUND tunai, PENGEMBALIAN_TITIPAN; peringatan belum pernah dibeli', async () => {
    await kirim(admin, '/api/penerimaan', {
      idPemasok: m.pemasokA,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
      baris: [{ idBarang: m.semen, qtyMasuk: '10', hargaModalMasuk: 10_000 }],
    });
    // Pindahkan 3 sak ke stok rusak lewat penyesuaian RUSAK.
    const adj = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'RUSAK',
      alasan: 'Basah',
      baris: [{ idBarang: m.semen, qtySelisih: '3' }],
    });
    await kirim(admin, `/api/penyesuaian/${adj.id}/selesai`);
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '7.000', stokRusak: '3.000' });

    // GANTI_BARANG dari stok rusak: 2 rusak keluar, 2 baik masuk sebagai penerimaan pengganti (kompensasi).
    const ganti = await kirim<DetailReturPemasok>(admin, '/api/retur-pemasok', {
      idPemasok: m.pemasokA,
      alasan: 'Tukar sak basah',
      penyelesaian: 'GANTI_BARANG',
      baris: [{ idBarang: m.semen, kondisiAsal: 'RUSAK', qty: '2' }],
    });
    expect(ganti.nomorPenerimaanPengganti).toMatch(/^RCV-/);
    expect(await stok(m.semen)).toMatchObject({
      stokFisik: '9.000',
      stokRusak: '1.000',
      hppRata2: 10_000,
      hargaBeliTerakhir: 10_000,
    });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);

    // REFUND tunai butuh shift; uang masuk laci sebagai MASUK_LAIN.
    const tanpaShift = await galat(
      minta('/api/retur-pemasok', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          idPemasok: m.pemasokB,
          alasan: 'Kelebihan kirim',
          penyelesaian: 'REFUND',
          metodeRefund: 'TUNAI',
          baris: [{ idBarang: m.semen, qty: '1' }],
        },
      }),
    );
    expect(tanpaShift.status).toBe(409);
    await kirim(admin, '/api/shift/buka', { modalAwal: 0 });
    const refund = await kirim<DetailReturPemasok>(admin, '/api/retur-pemasok', {
      idPemasok: m.pemasokB,
      alasan: 'Kelebihan kirim',
      penyelesaian: 'REFUND',
      metodeRefund: 'TUNAI',
      baris: [{ idBarang: m.semen, qty: '1' }],
    });
    // Semen belum pernah dibeli dari pemasok B → peringatan, bukan penolakan (RP1).
    expect(refund.peringatan).toEqual([expect.stringContaining('belum pernah dibeli')]);
    expect(await db.select().from(kasShift)).toEqual([
      expect.objectContaining({ jenis: 'MASUK_LAIN', arah: 'MASUK', nominal: 10_000 }),
    ]);

    // Barang titipan hanya lewat PENGEMBALIAN_TITIPAN dari pemasok penitipnya.
    await kirim(admin, '/api/penerimaan', {
      idPemasok: m.pemasokA,
      jenis: 'KONSINYASI',
      baris: [{ idBarang: m.titip, qtyMasuk: '5', hargaModalMasuk: 0 }],
    });
    const salah = await galat(
      minta('/api/retur-pemasok', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          idPemasok: m.pemasokA,
          alasan: 'Tidak laku',
          penyelesaian: 'REFUND',
          metodeRefund: 'TRANSFER',
          baris: [{ idBarang: m.titip, qty: '1' }],
        },
      }),
    );
    expect(salah.status).toBe(400);
    const kembali = await kirim<DetailReturPemasok>(admin, '/api/retur-pemasok', {
      idPemasok: m.pemasokA,
      alasan: 'Tidak laku',
      penyelesaian: 'PENGEMBALIAN_TITIPAN',
      baris: [{ idBarang: m.titip, qty: '5' }],
    });
    expect(kembali.totalRetur).toBe(150_000); // 5 × harga titip 30.000
    expect(await stok(m.titip)).toMatchObject({ stokFisik: '0.000' });
    expect((await minta('/api/retur-pemasok', { cookie: kasir.cookie })).status).toBe(403);
  });
});

describe('stok rusak: pemusnahan (A5, SR3)', () => {
  it('MUSNAH mengeluarkan stok dari bucket rusak dengan alasan wajib', async () => {
    const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 }],
    });
    await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
    const rusak = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'RUSAK',
      alasan: 'Pecah',
      baris: [{ idBarang: m.semen, qtySelisih: '4' }],
    });
    await kirim(admin, `/api/penyesuaian/${rusak.id}/selesai`);
    expect(
      (
        await minta('/api/penyesuaian', {
          method: 'POST',
          cookie: admin.cookie,
          body: { jenis: 'MUSNAH', baris: [{ idBarang: m.semen, qtySelisih: '1' }] },
        })
      ).status,
    ).toBe(400);
    const musnah = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'MUSNAH',
      alasan: 'Dibuang, tidak bisa diklaim',
      baris: [{ idBarang: m.semen, qtySelisih: '3' }],
    });
    await kirim(admin, `/api/penyesuaian/${musnah.id}/selesai`);
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '6.000', stokRusak: '1.000' });
    const [mutasi] = await db
      .select()
      .from(mutasiPersediaan)
      .where(eq(mutasiPersediaan.jenisMutasi, 'MUSNAH'));
    expect(mutasi).toMatchObject({ kondisi: 'RUSAK', qtyKeluar: '3.000', hppSatuan: 9000 });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);

    // Tab Stok rusak: daftar barang hanya yang punya stok rusak, lengkap dengan qty-nya.
    const r = await json<{ data: { id: number; stokRusak: string }[]; meta: { total: number } }>(
      await minta('/api/barang?adaRusak=true', { cookie: admin.cookie }),
    );
    expect(r.data).toEqual([expect.objectContaining({ id: m.semen, stokRusak: '1.000' })]);
    expect(r.meta.total).toBe(1);
  });
});

describe('limit kredit pelanggan (PT6) dan umur piutang (PT5)', () => {
  it('checkout tidak lunas melebihi limit ditolak Kasir; Admin boleh melanjutkan dengan log', async () => {
    const [t] = await db
      .insert(tingkatHarga)
      .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
      .onConflictDoNothing()
      .returning();
    const idTier =
      t?.id ?? (await db.select().from(tingkatHarga).where(eq(tingkatHarga.kode, 'NORMAL')))[0]!.id;
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 12_000,
      hargaJual: 12_000,
    });
    const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang: m.semen, qtyFisik: '20', hppSatuan: 9000 }],
    });
    await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
    const [p] = await db
      .insert(pelanggan)
      .values({
        kode: 'PLG-90001',
        namaPelanggan: 'CV. Kredit',
        noHp: '0811',
        alamat: 'Jl. A',
        termHari: 14,
        limitKredit: 30_000,
      })
      .returning();
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const jual = (sesi: Sesi, qty: string, ubah: Record<string, unknown> = {}) =>
      minta('/api/penjualan/checkout', {
        method: 'POST',
        cookie: sesi.cookie,
        body: {
          order: {
            jenisPenjualan: 'LANGSUNG',
            idPelanggan: p!.id,
            baris: [{ idBarang: m.semen, qty }],
          },
          pembayaran: [],
          ...ubah,
        },
      });
    // 2 sak = 24.000 belum dibayar ≤ limit 30.000.
    expect((await jual(kasir, '2')).status).toBe(201);
    // 1 sak lagi: 24.000 + 12.000 = 36.000 > 30.000.
    const tolak = await galat(jual(kasir, '1', { setujuLimit: true }));
    expect(tolak).toMatchObject({ status: 409, kode: 'LIMIT_TERLAMPAUI' });
    expect(tolak.pesan).toContain('piutang berjalan Rp 24.000');
    expect(tolak.detail).toMatchObject({ bolehLanjut: false });
    await kirim(admin, '/api/shift/buka', { modalAwal: 0 });
    expect((await galat(jual(admin, '1'))).detail).toMatchObject({ bolehLanjut: true });
    const lanjut = await jual(admin, '1', { setujuLimit: true });
    expect(lanjut.status).toBe(201);
    const pj = (await json<{ data: DetailPenjualan }>(lanjut)).data;
    expect((await logTerakhir('PENJUALAN_LIMIT_OVERRIDE'))?.nomorDokumen).toBe(pj.nomor);

    const r = await minta('/api/laporan/piutang', { cookie: admin.cookie });
    const dok = (await json<{ data: DokumenLaporan }>(r)).data;
    expect(dok.bagian.map((b) => b.judul)).toContain('Umur Piutang per Pelanggan');
  });
});
