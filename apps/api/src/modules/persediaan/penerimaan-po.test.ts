import type { DetailOrderPembelian, DetailPenerimaan } from '@sit/shared';
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
    const kartu = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: kepala.cookie }),
    );
    expect(kartu.ringkasanUang).toMatchObject({
      nilaiOrder: 500_000,
      uangMukaDibayar: 100_000,
      uangMukaTerpakai: 100_000,
      uangMukaBelumTerpakai: 0,
      nilaiDiterima: 500_000,
      dibayarSaatDatang: 400_000,
      sisaTagihan: 0,
    });
    expect(kartu.riwayat.map((r) => r.aksi)).toEqual(
      expect.arrayContaining(['PO_BUAT', 'PO_KIRIM', 'PO_UANG_MUKA', 'PENERIMAAN_SIMPAN']),
    );
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

  it('K-237 jatuh tempo hanya diperpanjang Owner dengan alasan; uang muka ditolak setelah barang datang', async () => {
    const owner = await sesiUji('OWNER');
    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 10 });
    const t = await data<DetailPenerimaan>(
      kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '5' })),
    );
    const um = await galat(
      kirim(kepala, `/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 10_000,
        metode: 'TRANSFER',
        rekening: 'BCA 1',
        referensi: 'TRF-UM09',
      }),
    );
    expect(um.status).toBe(409);
    expect(um.pesan).toContain('sudah datang');

    const jalur = `/api/hutang/penerimaan/${t.id}/perpanjang`;
    const baru = tambahHari(tanggalOperasional(), 20);
    expect((await kirim(kepala, jalur, { tanggalBaru: baru, alasan: 'Kas seret' })).status).toBe(
      403,
    );
    expect((await kirim(owner, jalur, { tanggalBaru: baru, alasan: 'x' })).status).toBe(400);
    const mundur = await galat(
      kirim(owner, jalur, {
        tanggalBaru: tambahHari(tanggalOperasional(), 5),
        alasan: 'Kas seret',
      }),
    );
    expect(mundur.status).toBe(400);
    await data(kirim(owner, jalur, { tanggalBaru: baru, alasan: 'Kas seret minggu ini' }));
    const hutang = await data<
      { id: number; tanggalJatuhTempo: string; jumlahPerpanjang: number }[]
    >(minta('/api/hutang?perHalaman=100', { cookie: owner.cookie }));
    expect(hutang.find((h) => h.id === t.id)).toMatchObject({
      tanggalJatuhTempo: baru,
      jumlahPerpanjang: 1,
    });
  });

  it('K-225 tahap 3: tanpa order hanya tunai sampai batas; penerima bukan pembuat order (Owner boleh)', async () => {
    await aturKonfigurasi({
      penerimaan_tanpa_po_dibatasi: 'true',
      penerimaan_tanpa_po_batas: '100000',
      po_penerima_beda: 'true',
    });
    const owner = await sesiUji('OWNER');
    const tanpaOrder = (isi: Record<string, unknown>) => ({
      idPemasok: m.pemasokA,
      jenis: 'PEMBELIAN',
      metodeBayar: 'TRANSFER',
      referensi: 'TRF-0099',
      baris: [{ idBarang: m.semen, hargaModalMasuk: 50_000, qtyMasuk: '1' }],
      ...isi,
    });
    // Tunai Rp 50.000 ≤ batas: boleh.
    await data(kirim(persediaanSesi, '/api/penerimaan', tanpaOrder({ syaratBayar: 'TUNAI' })));
    // Tempo atau di atas batas: wajib order.
    const tempo = await galat(
      kirim(
        persediaanSesi,
        '/api/penerimaan',
        tanpaOrder({
          syaratBayar: 'TEMPO',
          tanggalJatuhTempo: tambahHari(tanggalOperasional(), 7),
        }),
      ),
    );
    expect(tempo.status).toBe(409);
    expect(tempo.pesan).toContain('wajib lewat order pembelian');
    const besar = tanpaOrder({
      syaratBayar: 'TUNAI',
      baris: [{ idBarang: m.semen, hargaModalMasuk: 50_000, qtyMasuk: '3' }],
    });
    expect((await galat(kirim(persediaanSesi, '/api/penerimaan', besar))).status).toBe(409);
    await data(kirim(owner, '/api/penerimaan', besar));
    // Daftar tinjau: penerimaan tanpa order.
    const tinjau = await data<{ nomor: string }[]>(
      minta('/api/penerimaan?tanpaOrder=true', { cookie: kepala.cookie }),
    );
    expect(tinjau).toHaveLength(2);

    // Order buatan Kepala Toko tidak boleh diterima Kepala Toko sendiri.
    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 7 });
    const sendiri = await galat(kirim(kepala, '/api/penerimaan', terima(po, { qtyMasuk: '10' })));
    expect(sendiri.status).toBe(403);
    expect(sendiri.pesan).toContain('pemisahan tugas');
    await data(kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '10' })));
  });

  it('K-237 deposit pemasok: kelebihan uang muka disimpan lalu dipakai untuk uang muka dan hutang', async () => {
    const po = await orderDikirim({ syaratBayar: 'SAAT_TERIMA', uangMukaRencana: 100_000 });
    await data(
      kirim(kepala, `/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 100_000,
        metode: 'TRANSFER',
        rekening: 'BCA 1',
        referensi: 'TRF-DEP1',
      }),
    );
    // Datang 1 sak (Rp 50.000): uang muka terpakai Rp 50.000, sisa order ditutup → sisa uang muka jadi deposit.
    await data(kirim(persediaanSesi, '/api/penerimaan', terima(po, { qtyMasuk: '1' })));
    await data(
      kirim(kepala, `/api/order-pembelian/${po.id}/tutup`, {
        alasan: 'Pemasok kehabisan stok',
        metodeKembali: 'DEPOSIT',
      }),
    );
    const saldo = async () =>
      (
        await data<{ saldo: number }>(
          minta(`/api/hutang/deposit/${m.pemasokA}`, { cookie: kepala.cookie }),
        )
      ).saldo;
    expect(await saldo()).toBe(50_000);

    const po2 = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 14 });
    await data(
      kirim(kepala, `/api/order-pembelian/${po2.id}/uang-muka`, {
        nominal: 30_000,
        metode: 'DEPOSIT',
      }),
    );
    expect(await saldo()).toBe(20_000);
    const lebih = await galat(
      kirim(kepala, `/api/order-pembelian/${po2.id}/uang-muka`, {
        nominal: 30_000,
        metode: 'DEPOSIT',
      }),
    );
    expect(lebih.status).toBe(400);
    expect(lebih.pesan).toContain('tidak cukup');

    const t = await data<DetailPenerimaan>(
      kirim(persediaanSesi, '/api/penerimaan', terima(po2, { qtyMasuk: '10' })),
    );
    await data(
      kirim(kepala, '/api/hutang/bayar', {
        jenis: 'PENERIMAAN',
        id: t.id,
        nominal: 20_000,
        metode: 'DEPOSIT',
      }),
    );
    expect(await saldo()).toBe(0);
  });

  it('K-225: harga faktur naik melewati ambang perlu Kepala Toko; bayar hutang di atas batas hanya Owner', async () => {
    await aturKonfigurasi({ hutang_batas_kepala_toko: '200000' });
    const owner = await sesiUji('OWNER');
    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 30 });
    // Order @50.000; faktur @60.000 (naik 20% > ambang 10%).
    const naik = terima(po, { qtyMasuk: '10', hargaModalMasuk: 60_000 });
    const ditolak = await galat(kirim(persediaanSesi, '/api/penerimaan', naik));
    expect(ditolak.status).toBe(403);
    expect(ditolak.pesan).toContain('naik lebih dari 10%');
    const t = await data<DetailPenerimaan>(kirim(kepala, '/api/penerimaan', naik));
    expect(t.totalFaktur).toBe(600_000);

    const bayar = (sesi: Sesi, nominal: number) =>
      kirim(sesi, '/api/hutang/bayar', {
        jenis: 'PENERIMAAN',
        id: t.id,
        nominal,
        metode: 'TRANSFER',
        rekening: 'BCA 1',
        referensi: `TRF-B${nominal}`,
      });
    expect((await galat(bayar(kepala, 300_000))).status).toBe(403);
    await data(bayar(kepala, 200_000));
    await data(bayar(owner, 400_000));
  });

  it('K-225: rekening pemasok hanya diubah Owner; transfer ke rekening lain hanya Owner', async () => {
    const owner = await sesiUji('OWNER');
    const pm = await data<{ versi: string; namaPemasok: string; noHp: string }>(
      minta(`/api/pemasok?perHalaman=100`, { cookie: owner.cookie }).then(async (r) => {
        const isi = await json<{
          data: { id: number; versi: string; namaPemasok: string; noHp: string }[];
        }>(r);
        return new Response(JSON.stringify({ data: isi.data.find((x) => x.id === m.pemasokA) }));
      }),
    );
    const ubah = (sesi: Sesi, rekening: string, versi: string) =>
      minta(`/api/pemasok/${m.pemasokA}`, {
        method: 'PATCH',
        cookie: sesi.cookie,
        body: { namaPemasok: pm.namaPemasok, noHp: pm.noHp, rekening, versi },
      });
    expect((await ubah(kepala, 'BCA 999 a.n. Penipu', pm.versi)).status).toBe(403);
    const r = await ubah(owner, 'BCA 123 a.n. CV Semen Jaya', pm.versi);
    expect(r.status).toBe(200);

    const po = await orderDikirim({ syaratBayar: 'TEMPO', tempoHari: 30 });
    const um = (sesi: Sesi, rekening: string) =>
      kirim(sesi, `/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 10_000,
        metode: 'TRANSFER',
        rekening,
        referensi: 'TRF-REK1',
      });
    expect((await galat(um(kepala, 'BCA 999 a.n. Penipu'))).status).toBe(403);
    await data(um(kepala, 'bca 123 a.n. cv semen jaya'));
    await data(um(owner, 'BRI 555 a.n. Lain'));
  });
});
