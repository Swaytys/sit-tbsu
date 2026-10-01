import type { BarisSuratJalan, DetailPenjualan } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, pelanggan, shiftKasir, tingkatHarga } from '../../db/schema';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let plg: number;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function galat(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}

async function detail(id: number) {
  return (
    await json<{ data: DetailPenjualan }>(
      await minta(`/api/penjualan/${id}`, { cookie: kasir.cookie }),
    )
  ).data;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan, shiftKasir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const [t] = await db.select().from(tingkatHarga).where(eq(tingkatHarga.kode, 'NORMAL'));
  await db.insert(hargaBarang).values([
    {
      idBarang: m.semen,
      idTingkatHarga: t!.id,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    },
    {
      idBarang: m.pasir,
      idTingkatHarga: t!.id,
      metode: 'TETAP',
      hargaTetap: 4000,
      hargaJual: 4000,
    },
  ]);
  const [p] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90001', namaPelanggan: 'PT. Proyek', noHp: '0811', alamat: 'Jl. B 2' })
    .returning();
  plg = p!.id;
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '5', hppSatuan: 3000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

async function invoice() {
  return kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
    order: {
      jenisPenjualan: 'PENGANTARAN',
      idPelanggan: plg,
      alamatKirim: 'Proyek Jl. C 3',
      baris: [
        { idBarang: m.semen, qty: '5' },
        { idBarang: m.pasir, qty: '2' },
      ],
    },
  });
}

describe('surat jalan (docs/05 §7)', () => {
  it('S2/S4 kirim sebagian: qty tidak melebihi sisa; status pengiriman agregat', async () => {
    const inv = await invoice();
    const [semen, pasir] = inv.baris;
    const sj1 = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(sj1).toMatchObject({ status: 'DIPROSES', alamatKirim: 'Proyek Jl. C 3' });
    expect(sj1.nomor).toMatch(/^SJ-\d{6}-001$/);
    let d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SEBAGIAN');
    expect(d.baris.map((b) => b.qtyBelumDikirim)).toEqual(['2.000', '2.000']);

    const lebih = await galat(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(lebih.status).toBe(409);
    expect(lebih.pesan).toContain('melebihi sisa yang belum dikirim (2.000)');

    const sj2 = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      sopir: 'Pak Slamet',
      baris: [
        { idPenjualanDetail: semen!.id, qtyKirim: '2' },
        { idPenjualanDetail: pasir!.id, qtyKirim: '2' },
      ],
    });
    for (const sj of [sj1, sj2]) {
      await kirim(kasir, `/api/surat-jalan/${sj.id}/status`, { status: 'DIMUAT' });
      await kirim(kasir, `/api/surat-jalan/${sj.id}/status`, {
        status: 'DIKIRIM',
        sopir: 'Pak Slamet',
      });
    }
    await kirim(kasir, `/api/surat-jalan/${sj1.id}/status`, { status: 'SELESAI' });
    expect((await detail(inv.id)).statusPengiriman).toBe('SEBAGIAN');
    await kirim(kasir, `/api/surat-jalan/${sj2.id}/status`, { status: 'SELESAI' });
    d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SELESAI');
    expect(d.suratJalan).toHaveLength(2);
  });

  it('S3/S5 status maju satu langkah, DIKIRIM wajib sopir; batal hanya sebelum berangkat', async () => {
    const inv = await invoice();
    const sj = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }],
    });
    expect(
      (await galat(kasir, `/api/surat-jalan/${sj.id}/status`, { status: 'DIKIRIM' })).kode,
    ).toBe('STATUS_TIDAK_VALID');
    const muat = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}/status`, {
      status: 'DIMUAT',
    });
    expect(muat.waktuDimuat).not.toBeNull();
    const tanpaSopir = await galat(kasir, `/api/surat-jalan/${sj.id}/status`, {
      status: 'DIKIRIM',
    });
    expect(tanpaSopir.status).toBe(400);
    expect(tanpaSopir.pesan).toContain('sopir');

    // Batal dari DIMUAT boleh; qty kembali tersedia untuk surat jalan baru.
    const batal = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}/batal`, {
      alasan: 'Truk rusak',
    });
    expect(batal).toMatchObject({ status: 'BATAL', alasanBatal: 'Truk rusak' });
    expect((await detail(inv.id)).statusPengiriman).toBe('BELUM');
    const baru = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }],
    });
    await kirim(kasir, `/api/surat-jalan/${baru.id}/status`, { status: 'DIMUAT' });
    await kirim(kasir, `/api/surat-jalan/${baru.id}/status`, { status: 'DIKIRIM', sopir: 'Budi' });
    const terlambat = await galat(kasir, `/api/surat-jalan/${baru.id}/batal`, { alasan: 'salah' });
    expect(terlambat.kode).toBe('STATUS_TIDAK_VALID');
  });

  it('S1 hanya pengantaran; Staf tidak berizin', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const langsung = await kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', nominal: 12000 }],
    });
    const salah = await galat(kasir, `/api/penjualan/${langsung.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: langsung.baris[0]!.id, qtyKirim: '1' }],
    });
    expect(salah.kode).toBe('STATUS_TIDAK_VALID');
    const inv = await invoice();
    const staf = await sesiUji('STAF_PENJUALAN');
    expect(
      (
        await galat(staf, `/api/penjualan/${inv.id}/surat-jalan`, {
          baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '1' }],
        })
      ).status,
    ).toBe(403);
  });
});
