import type { DaftarPiutang, DetailPenjualan, Notifikasi } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, pelanggan, penjualan, shiftKasir } from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let plgA: number;
let plgB: number;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`POST ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function ambil<T>(sesi: Sesi, path: string) {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return json<T>(r);
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan, shiftKasir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: idTier,
    metode: 'TETAP',
    hargaTetap: 10000,
    hargaJual: 10000,
  });
  const [a, b] = await db
    .insert(pelanggan)
    .values([
      { kode: 'PLG-90001', namaPelanggan: 'Toko Andalan', noHp: '0811', termHari: 14 },
      { kode: 'PLG-90002', namaPelanggan: 'CV. Bina', noHp: '0812' },
    ])
    .returning();
  plgA = a!.id;
  plgB = b!.id;
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: m.semen, qtyFisik: '20', hppSatuan: 8000 }],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
});

function jual(idPelanggan: number, qty: string, bayar: number) {
  return kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', idPelanggan, baris: [{ idBarang: m.semen, qty }] },
    pembayaran: bayar > 0 ? [{ metode: 'TUNAI', nominal: bayar }] : [],
  });
}

describe('piutang (docs/06 PT1–PT4)', () => {
  it('PT1/PT3 daftar penjualan belum lunas, ringkasan per pelanggan; lunas keluar dari daftar', async () => {
    const a1 = await jual(plgA, '3', 10000); // sisa 20.000, jatuh tempo +14 (term pelanggan)
    const b1 = await jual(plgB, '2', 0); // sisa 20.000, jatuh tempo +7 (bawaan)
    await jual(plgA, '1', 10000); // lunas: bukan piutang
    expect(a1.tanggalJatuhTempo).toBe(tambahHari(tanggalOperasional(), 14));
    expect(b1.tanggalJatuhTempo).toBe(tambahHari(tanggalOperasional(), 7));

    let d = await ambil<DaftarPiutang>(kasir, '/api/piutang');
    expect(d.data.map((p) => p.nomor)).toEqual([b1.nomor, a1.nomor]); // jatuh tempo terdekat dulu
    expect(d.ringkasan).toMatchObject({ totalSisa: 40000, jumlah: 2, jumlahTerlambat: 0 });
    expect(d.ringkasan.perPelanggan.map((p) => [p.namaPelanggan, p.totalSisa])).toEqual(
      expect.arrayContaining([
        ['Toko Andalan', 20000],
        ['CV. Bina', 20000],
      ]),
    );

    await kirim(kasir, `/api/penjualan/${a1.id}/pembayaran`, {
      pembayaran: { metode: 'TUNAI', nominal: 20000 },
    });
    d = await ambil<DaftarPiutang>(kasir, `/api/piutang?idPelanggan=${plgA}`);
    expect(d.data).toHaveLength(0);

    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await minta('/api/piutang', { cookie: staf.cookie })).status).toBe(403);
  });

  it('PT4/ST2 terlambat ditandai & disaring; notifikasi H-3 dan terlambat sesuai izin', async () => {
    const lama = await jual(plgA, '2', 5000);
    const dekat = await jual(plgB, '1', 0);
    await db
      .update(penjualan)
      .set({ tanggalJatuhTempo: tambahHari(tanggalOperasional(), -5) })
      .where(eq(penjualan.id, lama.id));
    await db
      .update(penjualan)
      .set({ tanggalJatuhTempo: tambahHari(tanggalOperasional(), 2) })
      .where(eq(penjualan.id, dekat.id));

    const d = await ambil<DaftarPiutang>(kasir, '/api/piutang?terlambat=true');
    expect(d.data).toHaveLength(1);
    expect(d.data[0]).toMatchObject({ nomor: lama.nomor, terlambat: true, hariTerlambat: 5 });
    expect(d.ringkasan).toMatchObject({ jumlahTerlambat: 1, totalTerlambat: 15000 });

    const notif = (await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi')).data;
    expect(notif.find((n) => n.jenis === 'PIUTANG_TERLAMBAT')?.jumlah).toBe(1);
    expect(notif.find((n) => n.jenis === 'PIUTANG_JATUH_TEMPO')?.jumlah).toBe(1);
    const staf = await sesiUji('STAF_PENJUALAN');
    const notifStaf = (await ambil<{ data: Notifikasi[] }>(staf, '/api/notifikasi')).data;
    expect(notifStaf.some((n) => n.jenis.startsWith('PIUTANG'))).toBe(false);
  });
});
