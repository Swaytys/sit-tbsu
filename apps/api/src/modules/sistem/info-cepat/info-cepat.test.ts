import type { DetailPenjualan, InfoCepat } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import { hargaBarang, pelanggan, shiftKasir } from '../../../db/schema';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;
let staf: Sesi;
let inv: DetailPenjualan;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  const m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan, shiftKasir);
  admin = await sesiUji('ADMIN');
  staf = await sesiUji('STAF_PENJUALAN');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: idTier,
    metode: 'TETAP',
    hargaTetap: 12000,
    hargaJual: 12000,
  });
  const [p] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90002', namaPelanggan: 'CV Info', noHp: '0812', alamat: 'Jl. I' })
    .returning();
  const sa = await minta('/api/penyesuaian', {
    method: 'POST',
    cookie: admin.cookie,
    body: { jenis: 'SALDO_AWAL', baris: [{ idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 }] },
  });
  const idSa = (await json<{ data: { id: number } }>(sa)).data.id;
  await minta(`/api/penyesuaian/${idSa}/selesai`, { method: 'POST', cookie: admin.cookie });
  const r = await minta('/api/penjualan/checkout', {
    method: 'POST',
    cookie: admin.cookie,
    body: {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: p!.id,
        alamatKirim: 'Jl. I',
        baris: [{ idBarang: m.semen, qty: '2' }],
      },
    },
  });
  inv = (await json<{ data: DetailPenjualan }>(r)).data;
});

describe('info cepat dokumen (K-181)', () => {
  it('invoice: pembeli, total, sisa, barang; nomor huruf kecil tetap ditemukan', async () => {
    const r = await minta(`/api/info-cepat?nomor=${inv.nomor.toLowerCase()}`, {
      cookie: admin.cookie,
    });
    expect(r.status).toBe(200);
    const d = (await json<{ data: InfoCepat }>(r)).data;
    expect(d).toMatchObject({ nomor: inv.nomor, judul: 'CV Info', tautan: `/penjualan/${inv.id}` });
    expect(d.ringkas).toEqual(expect.arrayContaining([{ label: 'Total', nilai: 'Rp 24.000' }]));
    expect(d.barang[0]?.qty).toBe('2 sak');
    // Order asal juga bisa dilihat.
    const o = await minta(`/api/info-cepat?nomor=${inv.nomorOrder}`, { cookie: admin.cookie });
    expect((await json<{ data: InfoCepat }>(o)).data.jenis).toBe('Order penjualan');
  });

  it('izin mengikuti halaman detail; nomor tak dikenal 404; tanpa login 401', async () => {
    const r = await minta(`/api/info-cepat?nomor=${inv.nomor}`, { cookie: staf.cookie });
    expect(r.status).toBe(403);
    expect(
      (await minta('/api/info-cepat?nomor=INV-000000-999', { cookie: admin.cookie })).status,
    ).toBe(404);
    expect((await minta(`/api/info-cepat?nomor=${inv.nomor}`)).status).toBe(401);
  });
});
