import type {
  BarisRetur,
  DaftarHutang,
  DetailPenjualan,
  DetailPenyelesaianKonsinyasi,
  DokumenLaporan,
  PratinjauKonsinyasi,
  RingkasanKonsinyasiPemasok,
} from '@sit/shared';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  hargaBarang,
  kasShift,
  logAktivitas,
  penjualanDetail,
  persediaan,
  penyelesaianKonsinyasi,
  penyelesaianKonsinyasiDetail,
  returPenjualan,
  returPenjualanDetail,
  shiftKasir,
  tingkatHarga,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../db/schema';
import { tanggalOperasional } from '../../lib/waktu';
import { hitungSetoran } from './service';

/*
 * Fase 11 (docs/06 KS5–KS9, K-089): penyelesaian konsinyasi, koreksi retur atas baris yang sudah disetor,
 * pembayaran lewat hutang, void ditolak untuk baris yang sudah disetor, dan Laporan Konsinyasi.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
const hariIni = tanggalOperasional();

async function kirim<T>(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`POST ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function galat(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}
async function ambil<T>(sesi: Sesi, path: string) {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
function jual(qty: string) {
  return kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.titip, qty }] },
    pembayaran: [{ metode: 'TUNAI' }],
  });
}
async function retur(pj: DetailPenjualan, qty: string, kondisi: 'BAIK' | 'RUSAK') {
  const r = await kirim<BarisRetur>(kasir, '/api/retur', {
    idPenjualan: pj.id,
    alasan: 'Uji konsinyasi',
    penyelesaian: 'REFUND',
    persetujuan: { metodeRefund: 'TUNAI' },
    baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: qty, kondisi }],
  });
  await kirim(admin, `/api/retur/${r.id}/setujui`, {});
}
const pratinjau = () =>
  ambil<PratinjauKonsinyasi>(
    admin,
    `/api/konsinyasi/pratinjau?idPemasok=${m.pemasokA}&periodeSelesai=${hariIni}`,
  );
const selesaikan = () =>
  kirim<DetailPenyelesaianKonsinyasi>(admin, '/api/konsinyasi', {
    idPemasok: m.pemasokA,
    periodeSelesai: hariIni,
  });

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(
    penyelesaianKonsinyasiDetail,
    penyelesaianKonsinyasi,
    returPenjualanDetail,
    returPenjualan,
    voidTransaksiDetail,
    voidTransaksi,
    kasShift,
    shiftKasir,
  );
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  await db
    .insert(tingkatHarga)
    .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
    .onConflictDoNothing();
  const [t] = await db.select().from(tingkatHarga).where(eq(tingkatHarga.kode, 'NORMAL'));
  await db.insert(hargaBarang).values({
    idBarang: m.titip,
    idTingkatHarga: t!.id,
    metode: 'TETAP',
    hargaTetap: 40000,
    hargaJual: 40000,
  });
  await kirim(admin, '/api/penerimaan', {
    idPemasok: m.pemasokA,
    jenis: 'KONSINYASI',
    baris: [{ idBarang: m.titip, qtyMasuk: '20', hargaModalMasuk: 0 }],
  });
  await kirim(kasir, '/api/shift/buka', { modalAwal: 500000 });
});

describe('hitungSetoran (KS5, KS6, KS9)', () => {
  it('mengelompokkan per harga titip; koreksi hanya diserap penjualan baru berharga sama', () => {
    const h = hitungSetoran(
      [
        { id: 1, idBarang: 7, qtyDasar: '3.000', hargaTitip: 30000, tanggalOperasional: hariIni },
        { id: 2, idBarang: 7, qtyDasar: '1.000', hargaTitip: 35000, tanggalOperasional: hariIni },
      ],
      [
        // Retur atas baris 1 (ikut disetor sekarang) selalu dihitung.
        {
          id: 10,
          idBarang: 7,
          idPenjualanDetail: 1,
          qtyDasar: '1.000',
          hargaTitip: 30000,
          sudahDisetor: false,
        },
        // Koreksi atas baris lama Rp 30.000: diserap (sisa terjual 2).
        {
          id: 11,
          idBarang: 7,
          idPenjualanDetail: 99,
          qtyDasar: '2.000',
          hargaTitip: 30000,
          sudahDisetor: true,
        },
        // Koreksi berharga Rp 25.000: tidak ada penjualan baru berharga itu → ditunda.
        {
          id: 12,
          idBarang: 7,
          idPenjualanDetail: 98,
          qtyDasar: '1.000',
          hargaTitip: 25000,
          sudahDisetor: true,
        },
      ],
    );
    expect(h.grup).toEqual([
      { idBarang: 7, hargaTitip: 30000, terjual: '3.000', retur: '3.000', gantiRugi: '0' },
      { idBarang: 7, hargaTitip: 35000, terjual: '1.000', retur: '0', gantiRugi: '0' },
    ]);
    expect(h.idRetur).toEqual([10, 11]);
    expect(h.koreksiDitunda).toBe(1);
  });
});

describe('penyelesaian konsinyasi (KS5–KS8)', () => {
  it('setoran = terjual − retur baik; hutang dibayar; koreksi retur berikutnya; void ditolak', async () => {
    const pj1 = await jual('3');
    const pj2 = await jual('2');
    const pj3 = await jual('1');
    await retur(pj1, '1', 'BAIK');
    await retur(pj2, '1', 'RUSAK'); // K-092: rusak juga kembali milik penitip → mengurangi setoran
    // Barang rusak masuk stok rusak, bukan stok jual: 20 − 6 + 1 (baik) = 15 baik, 1 rusak.
    const [st] = await db.select().from(persediaan).where(eq(persediaan.idBarang, m.titip));
    expect(st).toMatchObject({ stokFisik: '15.000', stokRusak: '1.000' });

    const p = await pratinjau();
    expect(p).toMatchObject({ total: 120_000, jumlahBarisJual: 3, koreksiDitunda: 0 });
    expect(p.baris).toEqual([
      expect.objectContaining({
        idBarang: m.titip,
        hargaTitip: 30000,
        qtyTerjual: '6.000',
        qtyRetur: '2.000',
        qtyGantiRugi: '0.000',
        qtyNeto: '4.000',
        subtotal: 120_000,
      }),
    ]);
    expect(
      (
        await minta(`/api/konsinyasi/pratinjau?idPemasok=${m.pemasokA}&periodeSelesai=${hariIni}`, {
          cookie: kasir.cookie,
        })
      ).status,
    ).toBe(403);

    const ksg = await selesaikan();
    expect(ksg.nomor).toMatch(/^KSG-/);
    expect(ksg).toMatchObject({ total: 120_000, statusHutang: 'BELUM_LUNAS', sisaHutang: 120_000 });
    const ditandai = await db
      .select({ id: penjualanDetail.id })
      .from(penjualanDetail)
      .where(eq(penjualanDetail.idPenyelesaianKonsinyasi, ksg.id));
    expect(ditandai).toHaveLength(3);
    const returDitandai = await db
      .select({ kondisi: returPenjualanDetail.kondisi })
      .from(returPenjualanDetail)
      .where(isNotNull(returPenjualanDetail.idPenyelesaianKonsinyasi));
    expect(returDitandai.map((r) => r.kondisi).sort()).toEqual(['BAIK', 'RUSAK']);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'KONSINYASI_SELESAIKAN'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.nomorDokumen).toBe(ksg.nomor);

    // Tidak ada penjualan baru → tidak bisa disetor lagi.
    expect(
      (await galat(admin, '/api/konsinyasi', { idPemasok: m.pemasokA, periodeSelesai: hariIni }))
        .status,
    ).toBe(409);

    // Hutang konsinyasi muncul di Hutang Pemasok dan bisa dibayar sebagian (KS7).
    const daftar = await json<DaftarHutang>(await minta('/api/hutang', { cookie: admin.cookie }));
    expect(daftar.data).toEqual([
      expect.objectContaining({ jenis: 'KONSINYASI', nomor: ksg.nomor, sisa: 120_000 }),
    ]);
    const bayar = await kirim<{ statusHutang: string; sisa: number }>(admin, '/api/hutang/bayar', {
      jenis: 'KONSINYASI',
      id: ksg.id,
      nominal: 50_000,
      metode: 'TRANSFER',
      rekening: 'BRI 001',
      referensi: 'TRF0001',
    });
    expect(bayar).toMatchObject({ statusHutang: 'SEBAGIAN', sisa: 70_000 });
    const detail = await ambil<DetailPenyelesaianKonsinyasi>(admin, `/api/konsinyasi/${ksg.id}`);
    expect(detail.pembayaran).toHaveLength(1);
    expect(detail.sisaHutang).toBe(70_000);

    // Void baris yang sudah disetor ditolak (gunakan retur).
    const tolakVoid = await galat(kasir, '/api/void', {
      idPenjualan: pj3.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah input',
    });
    expect(tolakVoid.status).toBe(409);
    expect(tolakVoid.pesan).toContain('sudah disetor');

    // KS6: retur baik atas baris yang sudah disetor dikoreksi pada setoran berikutnya.
    await retur(pj1, '1', 'BAIK');
    await jual('2');
    const p2 = await pratinjau();
    expect(p2.baris).toEqual([
      expect.objectContaining({ qtyTerjual: '2.000', qtyRetur: '1.000', subtotal: 30_000 }),
    ]);
    const ksg2 = await selesaikan();
    expect(ksg2.total).toBe(30_000);

    const ringkasan = await ambil<RingkasanKonsinyasiPemasok[]>(admin, '/api/konsinyasi/ringkasan');
    expect(ringkasan).toEqual([
      expect.objectContaining({
        idPemasok: m.pemasokA,
        nilaiBelumDisetor: 0,
        sisaHutang: 100_000,
        terakhirDisetor: hariIni,
        // Stok titipan: baik 20 − 6 + 1 + 1 − 2 = 14, ditambah 1 rusak (tetap milik penitip).
        nilaiStokTitipan: 15 * 30_000,
      }),
    ]);

    // K-092: barang titipan rusak dimusnahkan toko → ganti rugi di setoran berikutnya (tanpa penjualan baru).
    const musnah = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'MUSNAH',
      alasan: 'Pecah, tidak bisa dikembalikan',
      baris: [{ idBarang: m.titip, qtySelisih: '1' }],
    });
    await kirim(admin, `/api/penyesuaian/${musnah.id}/selesai`);
    const p3 = await pratinjau();
    expect(p3).toMatchObject({ jumlahBarisJual: 0, jumlahBarisGantiRugi: 1, total: 30_000 });
    expect(p3.baris).toEqual([
      expect.objectContaining({ qtyTerjual: '0.000', qtyGantiRugi: '1.000', qtyNeto: '1.000' }),
    ]);
    const ksg3 = await selesaikan();
    expect(ksg3.baris[0]).toMatchObject({ qtyGantiRugi: '1.000', subtotal: 30_000 });
    expect(
      (await galat(admin, '/api/konsinyasi', { idPemasok: m.pemasokA, periodeSelesai: hariIni }))
        .status,
    ).toBe(409);

    const r = await minta(`/api/laporan/konsinyasi?dari=${hariIni}&sampai=${hariIni}`, {
      cookie: admin.cookie,
    });
    expect(r.status).toBe(200);
    expect((await json<{ data: DokumenLaporan }>(r)).data.judul).toBe('Laporan Konsinyasi');
    expect(
      (
        await minta(`/api/laporan/konsinyasi?dari=${hariIni}&sampai=${hariIni}`, {
          cookie: kasir.cookie,
        })
      ).status,
    ).toBe(403);
  });
});
