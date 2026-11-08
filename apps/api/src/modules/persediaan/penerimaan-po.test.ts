import type { DetailOrderPembelian, DetailPenerimaan } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { db } from '../../db/client';
import { persediaan } from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { sudahDipesan } from './order-pembelian/repo';

/* K-236/K-237: penerimaan dari order pembelian mewarisi kesepakatan; barang ditolak; bayar kurang (docs/05 §21). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let kepala: Sesi;
let persediaanSesi: Sesi;

async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
const kirim = (sesi: Sesi, path: string, body?: unknown) =>
  minta(path, { method: 'POST', cookie: sesi.cookie, body });
async function galat(r: Promise<Response>) {
  const res = await r;
  return { status: res.status, pesan: (await json(res)).error?.pesan ?? '' };
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await db.update(persediaan).set({ hargaBeliTerakhir: 50_000 });
  kepala = await sesiUji('ADMIN');
  persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
});

/** Order 10 sak semen @ Rp 50.000 (Rp 500.000) yang sudah dikirim ke pemasok. */
async function orderDikirim(sepakat: Record<string, unknown>, qty = '10') {
  const draf = await data<DetailOrderPembelian>(
    kirim(kepala, '/api/order-pembelian', {
      idPemasok: m.pemasokA,
      tanggalKirimDiminta: tambahHari(tanggalOperasional(), 3),
      caraKirim: 'DIANTAR',
      ...sepakat,
      baris: [{ idBarang: m.semen, qty, harga: 50_000 }],
    }),
  );
  return data<DetailOrderPembelian>(kirim(kepala, `/api/order-pembelian/${draf.id}/kirim`));
}

function terima(po: DetailOrderPembelian, baris: Record<string, unknown>, isi = {}) {
  return {
    idPemasok: m.pemasokA,
    jenis: 'PEMBELIAN',
    idOrderPembelian: po.id,
    metodeBayar: 'TRANSFER',
    referensi: 'TRF-0001',
    baris: [
      {
        idBarang: m.semen,
        hargaModalMasuk: 50_000,
        idOrderPembelianDetail: po.baris[0]!.id,
        ...baris,
      },
    ],
    ...isi,
  };
}

describe('penerimaan dari order pembelian (K-236, K-237)', () => {
  it('tempo: jatuh tempo otomatis dari order (isian diabaikan); ditolak minta ganti tetap ditunggu', async () => {
    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 30 });
    const t1 = await data<DetailPenerimaan>(
      kirim(
        persediaanSesi,
        '/api/penerimaan',
        terima(
          po,
          { qtyMasuk: '8', qtyDitolak: '2', alasanTolak: 'Sak sobek', tindakanTolak: 'GANTI' },
          // Isian syarat di form tidak berpengaruh: kesepakatan order yang dipakai.
          { syaratBayar: 'TUNAI', tanggalJatuhTempo: tanggalOperasional() },
        ),
      ),
    );
    expect(t1).toMatchObject({
      syaratBayar: 'TEMPO',
      tanggalJatuhTempo: tambahHari(tanggalOperasional(), 30),
      totalFaktur: 400_000,
      totalDibayar: 0,
      statusHutang: 'BELUM_LUNAS',
      penyimpanganBayar: false,
    });
    expect(t1.ditolak).toEqual([
      {
        namaBarang: 'Semen Gresik 40 kg',
        kodeSatuan: 'sak',
        qty: '2.000',
        alasan: 'Sak sobek',
        tindakan: 'GANTI',
      },
    ]);
    const po2 = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: kepala.cookie }),
    );
    expect(po2.status).toBe('SEBAGIAN');
    expect(po2.baris[0]).toMatchObject({
      qtyDiterima: '8.000',
      qtyDitolak: '2.000',
      qtySisa: '2.000',
    });
    expect((await sudahDipesan(db)).get(m.semen)).toBe('2.000');

    await data(kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '2' })));
    const po3 = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: kepala.cookie }),
    );
    expect(po3.status).toBe('SELESAI');
  });

  it('ditolak dengan kurangi order: order selesai tanpa menunggu; semua ditolak ditolak simpan', async () => {
    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 14 });
    const semua = await galat(
      kirim(
        persediaanSesi,
        '/api/penerimaan',
        terima(po, {
          qtyMasuk: '0',
          qtyDitolak: '10',
          alasanTolak: 'Salah merek',
          tindakanTolak: 'GANTI',
        }),
      ),
    );
    expect(semua.status).toBe(400);
    const tanpaAlasan = await galat(
      kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '7', qtyDitolak: '3' })),
    );
    expect(tanpaAlasan.status).toBe(400);
    await data(
      kirim(
        persediaanSesi,
        '/api/penerimaan',
        terima(po, {
          qtyMasuk: '7',
          qtyDitolak: '3',
          alasanTolak: 'Basah',
          tindakanTolak: 'POTONG',
        }),
      ),
    );
    const po2 = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: kepala.cookie }),
    );
    expect(po2.status).toBe('SELESAI');
    expect(po2.baris[0]).toMatchObject({ qtyDipotong: '3.000', qtySisa: '0.000' });
    expect((await sudahDipesan(db)).get(m.semen)).toBeUndefined();
  });

  it('tunai saat datang: uang muka dipakai lalu sisa dilunasi; transfer wajib referensi', async () => {
    const po = await orderDikirim({ syaratBayar: 'SAAT_TERIMA', uangMukaRencana: 100_000 });
    await data(
      kirim(kepala, `/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 100_000,
        metode: 'TRANSFER',
        rekening: 'BCA 123',
        referensi: 'TRF-UM01',
      }),
    );
    const tanpaRef = await galat(
      kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '10' }, { referensi: '' })),
    );
    expect(tanpaRef.status).toBe(400);
    const t = await data<DetailPenerimaan>(
      kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '10' })),
    );
    expect(t).toMatchObject({
      syaratBayar: 'TUNAI',
      tanggalJatuhTempo: null,
      totalFaktur: 500_000,
      totalDibayar: 500_000,
      statusHutang: 'LUNAS',
    });
    expect(t.pembayaran.map((p) => p.nominal)).toEqual([400_000]);
  });

  it('tunai saat datang tetapi bayar kurang: hanya Kepala Toko/Owner, alasan dan jatuh tempo wajib', async () => {
    const po = await orderDikirim({ syaratBayar: 'SAAT_TERIMA' });
    const kurang = terima(po, { qtyMasuk: '10' }, { bayarSekarang: 300_000 });
    expect((await galat(kirim(persediaanSesi, '/api/penerimaan', kurang))).status).toBe(403);
    expect((await galat(kirim(kepala, '/api/penerimaan', kurang))).status).toBe(400);
    const terlalu = await galat(
      kirim(kepala, '/api/penerimaan', {
        ...kurang,
        alasanKurangBayar: 'Uang kas kurang',
        jatuhTempoKurangBayar: tambahHari(tanggalOperasional(), 60),
      }),
    );
    expect(terlalu.status).toBe(400);
    expect(terlalu.pesan).toContain('Isi jatuh tempo sisa');
    const lebih = await galat(
      kirim(kepala, '/api/penerimaan', terima(po, { qtyMasuk: '10' }, { bayarSekarang: 600_000 })),
    );
    expect(lebih.status).toBe(400);

    const t = await data<DetailPenerimaan>(
      kirim(kepala, '/api/penerimaan', {
        ...kurang,
        alasanKurangBayar: 'Uang kas kurang',
        jatuhTempoKurangBayar: tambahHari(tanggalOperasional(), 7),
      }),
    );
    expect(t).toMatchObject({
      syaratBayar: 'TEMPO',
      tanggalJatuhTempo: tambahHari(tanggalOperasional(), 7),
      totalDibayar: 300_000,
      statusHutang: 'SEBAGIAN',
      penyimpanganBayar: true,
      alasanPenyimpangan: 'Uang kas kurang',
    });
  });
});
