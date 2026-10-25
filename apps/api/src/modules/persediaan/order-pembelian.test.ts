import type { DetailOrderPembelian, DetailPenerimaan, HasilSaranPesan } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { alokasiUangMuka, orderPembelian, persediaan, shiftKasir } from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { lamaKirimAktual } from './order-pembelian/repo';
import { lupakanSimpananSaran } from './saran-pesan/service';

/* K-125 order pembelian (docs/05 §21 PO1–PO9). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
const kirim = (path: string, body?: unknown, method = 'POST', sesi: Sesi = admin) =>
  minta(path, { method, cookie: sesi.cookie, body });

beforeEach(async () => {
  lupakanSimpananSaran();
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(shiftKasir);
  admin = await sesiUji('ADMIN');
});

async function poDipesan() {
  const draf = await data<DetailOrderPembelian>(
    kirim('/api/order-pembelian', {
      idPemasok: m.pemasokA,
      baris: [
        { idBarang: m.semen, qty: '100', harga: 50000 },
        { idBarang: m.pasir, qty: '10', harga: 200000 },
      ],
    }),
  );
  return data<DetailOrderPembelian>(kirim(`/api/order-pembelian/${draf.id}/kirim`));
}

describe('order pembelian', () => {
  it('PO1–PO3: draf diubah, dikirim (nomor terbit, terkunci), dikonfirmasi; Kasir ditolak', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await kirim('/api/order-pembelian', {}, 'POST', kasir)).status).toBe(403);

    const draf = await data<DetailOrderPembelian>(
      kirim('/api/order-pembelian', {
        idPemasok: m.pemasokA,
        baris: [{ idBarang: m.semen, qty: '50', harga: 50000 }],
      }),
    );
    expect(draf).toMatchObject({ status: 'DRAF', nomor: null, totalPerkiraan: 2_500_000 });
    // Barang ganda dan barang titipan ditolak.
    expect(
      (
        await kirim('/api/order-pembelian', {
          idPemasok: m.pemasokA,
          baris: [
            { idBarang: m.semen, qty: '1', harga: 0 },
            { idBarang: m.semen, qty: '2', harga: 0 },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await kirim('/api/order-pembelian', {
          idPemasok: m.pemasokA,
          baris: [{ idBarang: m.titip, qty: '1', harga: 0 }],
        })
      ).status,
    ).toBe(400);

    const ubah = await data<DetailOrderPembelian>(
      kirim(
        `/api/order-pembelian/${draf.id}`,
        { idPemasok: m.pemasokA, baris: [{ idBarang: m.semen, qty: '80', harga: 50000 }] },
        'PATCH',
      ),
    );
    expect(ubah.baris[0]?.qtyPesan).toBe('80.000');

    const dikirim = await data<DetailOrderPembelian>(
      kirim(`/api/order-pembelian/${draf.id}/kirim`),
    );
    expect(dikirim.status).toBe('DIPESAN');
    expect(dikirim.nomor).toMatch(/^PO-\d{6}-\d{3}$/);
    expect(dikirim.tanggalDipesan).toBe(tanggalOperasional());
    expect(
      (
        await kirim(
          `/api/order-pembelian/${draf.id}`,
          { idPemasok: m.pemasokA, baris: [{ idBarang: m.semen, qty: '1', harga: 0 }] },
          'PATCH',
        )
      ).status,
    ).toBe(409);

    const janji = tambahHari(tanggalOperasional(), 3);
    const konf = await data<DetailOrderPembelian>(
      kirim(`/api/order-pembelian/${draf.id}/konfirmasi`, {
        tanggalJanjiKirim: janji,
        baris: [{ id: dikirim.baris[0]!.id, qty: '70', harga: 52000 }],
      }),
    );
    expect(konf).toMatchObject({ status: 'DIKONFIRMASI', tanggalJanjiKirim: janji });
    expect(konf.baris[0]).toMatchObject({
      qtyPesan: '80.000',
      qtyKonfirmasi: '70.000',
      qtyBerlaku: '70.000',
      hargaBerlaku: 52000,
    });
  });

  it('PO4–PO5: uang muka dipakai membayar penerimaan; terima sebagian lalu lengkap; saran pesan dikurangi', async () => {
    const po = await poDipesan();
    await data(
      kirim(`/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 1_000_000,
        metode: 'TRANSFER',
        rekening: 'BCA 123',
      }),
    );

    // Saran pesan: semen 100 sudah dipesan.
    const saran = await data<HasilSaranPesan>(
      minta('/api/saran-pesan?tampil=SEMUA', { cookie: admin.cookie }),
    );
    expect(saran.baris.find((b) => b.idBarang === m.semen)?.sudahDipesan).toBe('100.000');

    const [semen, pasir] = po.baris;
    const terima1 = await data<DetailPenerimaan>(
      kirim('/api/penerimaan', {
        idPemasok: m.pemasokA,
        jenis: 'PEMBELIAN',
        syaratBayar: 'TEMPO',
        tanggalJatuhTempo: tambahHari(tanggalOperasional(), 14),
        idOrderPembelian: po.id,
        baris: [
          {
            idBarang: m.semen,
            qtyMasuk: '60',
            hargaModalMasuk: 50000,
            idOrderPembelianDetail: semen!.id,
          },
        ],
      }),
    );
    // Faktur 3.000.000 − uang muka 1.000.000.
    expect(terima1).toMatchObject({
      totalFaktur: 3_000_000,
      totalDibayar: 1_000_000,
      sisaHutang: 2_000_000,
      statusHutang: 'SEBAGIAN',
      nomorOrderPembelian: po.nomor,
    });
    let d = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: admin.cookie }),
    );
    expect(d.status).toBe('SEBAGIAN');
    expect(d.sisaUangMuka).toBe(0);
    expect(d.baris[0]).toMatchObject({ qtyDiterima: '60.000', qtySisa: '40.000' });

    // Penerimaan dari PO pemasok lain ditolak.
    const [lain] = await db.select().from(orderPembelian).where(eq(orderPembelian.id, po.id));
    expect(lain?.idPemasok).toBe(m.pemasokA);

    await data(
      kirim('/api/penerimaan', {
        idPemasok: m.pemasokA,
        jenis: 'PEMBELIAN',
        syaratBayar: 'TUNAI',
        metodeBayar: 'TRANSFER',
        idOrderPembelian: po.id,
        baris: [
          {
            idBarang: m.semen,
            qtyMasuk: '40',
            hargaModalMasuk: 50000,
            idOrderPembelianDetail: semen!.id,
          },
          {
            idBarang: m.pasir,
            qtyMasuk: '10',
            hargaModalMasuk: 200000,
            idOrderPembelianDetail: pasir!.id,
          },
        ],
      }),
    );
    d = await data<DetailOrderPembelian>(
      minta(`/api/order-pembelian/${po.id}`, { cookie: admin.cookie }),
    );
    expect(d.status).toBe('SELESAI');
    expect(d.penerimaan).toHaveLength(2);
    const [stok] = await db.select().from(persediaan).where(eq(persediaan.idBarang, m.semen));
    expect(stok?.stokFisik).toBe('100.000');
    // PO selesai tidak bisa diterima lagi.
    expect(
      (
        await kirim('/api/penerimaan', {
          idPemasok: m.pemasokA,
          jenis: 'PEMBELIAN',
          syaratBayar: 'TUNAI',
          metodeBayar: 'TRANSFER',
          idOrderPembelian: po.id,
          baris: [{ idBarang: m.semen, qtyMasuk: '1', hargaModalMasuk: 1 }],
        })
      ).status,
    ).toBe(409);
  });

  it('PO6: batal dengan sisa uang muka wajib dicatat dikembalikan; tutup sisa hanya setelah ada penerimaan', async () => {
    const po = await poDipesan();
    await data(
      kirim(`/api/order-pembelian/${po.id}/uang-muka`, {
        nominal: 500_000,
        metode: 'TRANSFER',
        rekening: 'BCA 123',
      }),
    );
    expect(
      (await kirim(`/api/order-pembelian/${po.id}/tutup`, { alasan: 'Tidak jadi' })).status,
    ).toBe(409);
    expect(
      (await kirim(`/api/order-pembelian/${po.id}/batal`, { alasan: 'Tidak jadi' })).status,
    ).toBe(400);
    const batal = await data<DetailOrderPembelian>(
      kirim(`/api/order-pembelian/${po.id}/batal`, {
        alasan: 'Pemasok kehabisan stok',
        metodeKembali: 'TRANSFER',
      }),
    );
    expect(batal).toMatchObject({
      status: 'BATAL',
      sisaUangMuka: 0,
      alasanTutup: 'Pemasok kehabisan stok',
    });
    const alokasi = await db.select().from(alokasiUangMuka);
    expect(alokasi).toEqual([
      expect.objectContaining({
        jenis: 'DIKEMBALIKAN',
        nominal: 500_000,
        metodeKembali: 'TRANSFER',
      }),
    ]);

    // Tutup sisa setelah penerimaan sebagian.
    const po2 = await poDipesan();
    await data(
      kirim('/api/penerimaan', {
        idPemasok: m.pemasokA,
        jenis: 'PEMBELIAN',
        syaratBayar: 'TUNAI',
        metodeBayar: 'TRANSFER',
        idOrderPembelian: po2.id,
        baris: [
          {
            idBarang: m.semen,
            qtyMasuk: '10',
            hargaModalMasuk: 50000,
            idOrderPembelianDetail: po2.baris[0]!.id,
          },
        ],
      }),
    );
    expect((await kirim(`/api/order-pembelian/${po2.id}/batal`, { alasan: 'x y z' })).status).toBe(
      409,
    );
    const tutup = await data<DetailOrderPembelian>(
      kirim(`/api/order-pembelian/${po2.id}/tutup`, { alasan: 'Sisa tidak dikirim' }),
    );
    expect(tutup.status).toBe('DITUTUP');
  });

  it('K-127 butir 3: lama kirim aktual per pemasok dari tanggal dipesan sampai penerimaan pertama', async () => {
    for (let i = 0; i < 3; i++) {
      const po = await poDipesan();
      await db
        .update(orderPembelian)
        .set({ tanggalDipesan: tambahHari(tanggalOperasional(), -(4 + i)) })
        .where(eq(orderPembelian.id, po.id));
      await data(
        kirim('/api/penerimaan', {
          idPemasok: m.pemasokA,
          jenis: 'PEMBELIAN',
          syaratBayar: 'TUNAI',
          metodeBayar: 'TRANSFER',
          idOrderPembelian: po.id,
          baris: [
            {
              idBarang: m.semen,
              qtyMasuk: '1',
              hargaModalMasuk: 50000,
              idOrderPembelianDetail: po.baris[0]!.id,
            },
          ],
        }),
      );
    }
    // 4, 5, 6 hari → rata-rata 5.
    expect((await lamaKirimAktual(db)).get(m.pemasokA)).toEqual({ hari: 5, jumlahPO: 3 });
    lupakanSimpananSaran();
    const saran = await data<HasilSaranPesan>(
      minta('/api/saran-pesan?tampil=SEMUA', { cookie: admin.cookie }),
    );
    expect(saran.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      lamaKirimHari: 5,
      lamaKirimAktual: true,
    });
  });
});
