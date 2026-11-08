import type { DetailOrderPembelian, Notifikasi } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import {
  aturKonfigurasi,
  beriEmail,
  kodeTerkirim,
  pesanTerkirim,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { db } from '../../db/client';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { logAktivitas, persediaan } from '../../db/schema';

/** K-236: kesepakatan lengkap agar order bisa diajukan/dikirim. */
const SEPAKAT = {
  tanggalKirimDiminta: tambahHari(tanggalOperasional(), 3),
  caraKirim: 'DIANTAR',
  syaratBayar: 'TEMPO',
  tempoHari: 30,
};

/* K-225 persetujuan order pembelian (pemisahan tugas siklus pembelian, docs/05 §21 PO10–PO14). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let persediaanSesi: Sesi;
let kepala: Sesi;
let owner: Sesi;

async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });
async function galat(r: Promise<Response>) {
  const res = await r;
  return { status: res.status, pesan: (await json(res)).error?.pesan ?? '' };
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  // Harga beli terakhir 50.000: harga di order sama, jadi tidak ada alasan kenaikan harga.
  await db.update(persediaan).set({ hargaBeliTerakhir: 50_000 });
  await aturKonfigurasi({
    po_batas_tanpa_persetujuan: '1000000',
    po_batas_kepala_toko: '10000000',
    po_ambang_naik_persen: '10',
  });
  persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
  kepala = await sesiUji('ADMIN');
  owner = await sesiUji('OWNER');
});

function draf(sesi: Sesi, qty: string, harga = 50_000, idBarang = m.semen) {
  return data<DetailOrderPembelian>(
    kirim(sesi, '/api/order-pembelian', {
      idPemasok: m.pemasokA,
      ...SEPAKAT,
      baris: [{ idBarang, qty, harga }],
    }),
  );
}
const detail = (sesi: Sesi, id: number) =>
  data<DetailOrderPembelian>(minta(`/api/order-pembelian/${id}`, { cookie: sesi.cookie }));

describe('persetujuan order pembelian (K-225)', () => {
  it('PO10: order sampai batas langsung dikirim; di atas batas wajib diajukan dulu', async () => {
    const kecil = await draf(persediaanSesi, '20'); // Rp 1.000.000 = batas
    expect(kecil.persetujuan.alasan).toEqual([]);
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(persediaanSesi, `/api/order-pembelian/${kecil.id}/kirim`),
        )
      ).status,
    ).toBe('DIPESAN');
    // Order tanpa alasan tidak bisa diajukan.
    const kecil2 = await draf(persediaanSesi, '10');
    expect(
      (await galat(kirim(persediaanSesi, `/api/order-pembelian/${kecil2.id}/ajukan`))).status,
    ).toBe(409);

    const besar = await draf(persediaanSesi, '30'); // Rp 1.500.000
    expect(besar.persetujuan.alasan[0]).toContain('di atas');
    expect(besar.persetujuan.perluOwner).toBe(false);
    const tolakKirim = await galat(kirim(persediaanSesi, `/api/order-pembelian/${besar.id}/kirim`));
    expect(tolakKirim.status).toBe(409);
    expect(tolakKirim.pesan).toContain('wajib disetujui');
    // Kepala Toko pun tidak boleh mengirim draf yang wajib disetujui tanpa mengajukan.
    const besarKepala = await draf(kepala, '30');
    expect(
      (await galat(kirim(kepala, `/api/order-pembelian/${besarKepala.id}/kirim`))).status,
    ).toBe(409);
  });

  it('PO11: diajukan, Admin Persediaan tidak bisa menyetujui (403), Kepala Toko menyetujui, lalu dikirim', async () => {
    const po = await draf(persediaanSesi, '30');
    const diajukan = await data<DetailOrderPembelian>(
      kirim(persediaanSesi, `/api/order-pembelian/${po.id}/ajukan`),
    );
    expect(diajukan.status).toBe('DIAJUKAN');
    expect(diajukan.persetujuan.alasan.length).toBeGreaterThan(0);
    // Isi terkunci selama menunggu.
    expect(
      (
        await kirim(
          persediaanSesi,
          `/api/order-pembelian/${po.id}`,
          {
            idPemasok: m.pemasokA,
            ...SEPAKAT,
            baris: [{ idBarang: m.semen, qty: '1', harga: 50_000 }],
          },
          'PATCH',
        )
      ).status,
    ).toBe(409);
    expect((await galat(kirim(persediaanSesi, `/api/order-pembelian/${po.id}/kirim`))).status).toBe(
      409,
    );
    expect((await kirim(persediaanSesi, `/api/order-pembelian/${po.id}/setujui`, {})).status).toBe(
      403,
    );

    // Notifikasi muncul untuk Kepala Toko.
    const notif = await data<Notifikasi[]>(minta('/api/notifikasi', { cookie: kepala.cookie }));
    expect(notif.find((n) => n.jenis === 'PO_MENUNGGU_PERSETUJUAN')?.jumlah).toBe(1);

    const setuju = await data<DetailOrderPembelian>(
      kirim(kepala, `/api/order-pembelian/${po.id}/setujui`, { catatan: 'Stok menipis' }),
    );
    expect(setuju.status).toBe('DISETUJUI');
    expect(setuju.nomor).toBeNull();
    expect(setuju.persetujuan).toMatchObject({
      namaPenyetuju: kepala.pengguna.namaPengguna,
      catatan: 'Stok menipis',
    });
    expect(setuju.persetujuan.disetujuiPada).not.toBeNull();

    const dikirim = await data<DetailOrderPembelian>(
      kirim(persediaanSesi, `/api/order-pembelian/${po.id}/kirim`),
    );
    expect(dikirim.status).toBe('DIPESAN');
    expect(dikirim.nomor).toMatch(/^PO-/);
    // Jejak tetap tampil setelah dikirim.
    expect(dikirim.persetujuan.namaPenyetuju).toBe(kepala.pengguna.namaPengguna);

    const log = await db
      .select({ aksi: logAktivitas.aksi })
      .from(logAktivitas)
      .where(eq(logAktivitas.idEntitas, po.id));
    expect(log.map((l) => l.aksi)).toEqual(expect.arrayContaining(['PO_AJUKAN', 'PO_SETUJUI']));
  });

  it('PO12: pembuat tidak boleh menyetujui ordernya sendiri; Owner boleh', async () => {
    const po = await draf(kepala, '30');
    await data(kirim(kepala, `/api/order-pembelian/${po.id}/ajukan`));
    const sendiri = await galat(kirim(kepala, `/api/order-pembelian/${po.id}/setujui`, {}));
    expect(sendiri.status).toBe(403);
    expect(sendiri.pesan).toContain('buatan sendiri');
    // Notifikasi tidak menghitung order buatan sendiri.
    const notif = await data<Notifikasi[]>(minta('/api/notifikasi', { cookie: kepala.cookie }));
    expect(notif.find((n) => n.jenis === 'PO_MENUNGGU_PERSETUJUAN')).toBeUndefined();

    const kepala2 = await sesiUji('ADMIN');
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(kepala2, `/api/order-pembelian/${po.id}/setujui`, {}),
        )
      ).status,
    ).toBe('DISETUJUI');

    // Owner menyetujui order buatannya sendiri dan boleh langsung mengirim draf besar.
    const milikOwner = await draf(owner, '30');
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(owner, `/api/order-pembelian/${milikOwner.id}/kirim`),
        )
      ).status,
    ).toBe('DIPESAN');
  });

  it('PO13: di atas batas Kepala Toko dan barang khusus hanya Owner', async () => {
    const besar = await draf(persediaanSesi, '300'); // Rp 15.000.000
    expect(besar.persetujuan.perluOwner).toBe(true);
    await data(kirim(persediaanSesi, `/api/order-pembelian/${besar.id}/ajukan`));
    const k = await galat(kirim(kepala, `/api/order-pembelian/${besar.id}/setujui`, {}));
    expect(k.status).toBe(403);
    expect(k.pesan).toContain('hanya bisa disetujui Owner');
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(owner, `/api/order-pembelian/${besar.id}/setujui`, {}),
        )
      ).status,
    ).toBe('DISETUJUI');

    // Hanya Owner yang menandai barang khusus.
    expect(
      (await kirim(kepala, `/api/order-pembelian/barang/${m.pasir}/khusus`, { perlu: true }))
        .status,
    ).toBe(403);
    await data(kirim(owner, `/api/order-pembelian/barang/${m.pasir}/khusus`, { perlu: true }));
    const khusus = await draf(persediaanSesi, '1', 50_000, m.pasir); // Rp 50.000, kecil
    expect(khusus.persetujuan.perluOwner).toBe(true);
    expect(khusus.persetujuan.alasan.join(' ')).toContain('wajib disetujui Owner');
    expect(
      (await galat(kirim(persediaanSesi, `/api/order-pembelian/${khusus.id}/kirim`))).status,
    ).toBe(409);
    const barang = await data<{ perluPersetujuanBeli: boolean }>(
      minta(`/api/barang/${m.pasir}`, { cookie: kepala.cookie }),
    );
    expect(barang.perluPersetujuanBeli).toBe(true);
  });

  it('PO14: harga naik melewati ambang dan harga kosong wajib disetujui; tolak kembali ke draf', async () => {
    const naik = await draf(persediaanSesi, '1', 60_000); // naik 20% dari 50.000
    expect(naik.persetujuan.alasan.join(' ')).toContain('Harga beli naik');
    const kosong = await draf(persediaanSesi, '1', 0);
    expect(kosong.persetujuan.alasan.join(' ')).toContain('belum diisi');

    await data(kirim(persediaanSesi, `/api/order-pembelian/${naik.id}/ajukan`));
    expect(
      (await kirim(kepala, `/api/order-pembelian/${naik.id}/tolak`, { alasan: '' })).status,
    ).toBe(400);
    const ditolak = await data<DetailOrderPembelian>(
      kirim(kepala, `/api/order-pembelian/${naik.id}/tolak`, { alasan: 'Tawar dulu ke pemasok' }),
    );
    expect(ditolak.status).toBe('DRAF');
    expect(ditolak.persetujuan.catatan).toBe('Ditolak: Tawar dulu ke pemasok');
    // Draf boleh diperbaiki lalu dikirim tanpa persetujuan bila alasannya hilang.
    await data(
      kirim(
        persediaanSesi,
        `/api/order-pembelian/${naik.id}`,
        {
          idPemasok: m.pemasokA,
          ...SEPAKAT,
          baris: [{ idBarang: m.semen, qty: '1', harga: 52_000 }],
        },
        'PATCH',
      ),
    );
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(persediaanSesi, `/api/order-pembelian/${naik.id}/kirim`),
        )
      ).status,
    ).toBe('DIPESAN');

    // Order yang diajukan boleh dibatalkan.
    await data(kirim(persediaanSesi, `/api/order-pembelian/${kosong.id}/ajukan`));
    expect(
      (
        await data<DetailOrderPembelian>(
          kirim(persediaanSesi, `/api/order-pembelian/${kosong.id}/batal`, {
            alasan: 'Salah input',
          }),
        )
      ).status,
    ).toBe('BATAL');
    expect((await detail(persediaanSesi, kosong.id)).status).toBe('BATAL');
  });

  it('K-245: setujui jarak jauh dengan kode; kode hanya untuk order yang sama dan isinya tidak berubah', async () => {
    await beriEmail(owner.pengguna.id);
    const po = await draf(persediaanSesi, '300'); // perlu Owner
    // Belum diajukan: tidak bisa minta kode.
    expect((await kirim(persediaanSesi, `/api/order-pembelian/${po.id}/minta-kode`)).status).toBe(
      409,
    );
    await data(kirim(persediaanSesi, `/api/order-pembelian/${po.id}/ajukan`));
    const info = await data<{ idPermintaan: number; penerima: { nama: string }[] }>(
      kirim(persediaanSesi, `/api/order-pembelian/${po.id}/minta-kode`),
    );
    expect(info.penerima.map((p) => p.nama)).toEqual([owner.pengguna.namaPengguna]);
    expect(pesanTerkirim(owner.pengguna.namaPengguna)).toContain(`draf #${po.id}`);
    const kode = kodeTerkirim(owner.pengguna.namaPengguna);

    const salah = await galat(
      kirim(persediaanSesi, `/api/order-pembelian/${po.id}/setujui-kode`, {
        idPermintaan: info.idPermintaan,
        kode: kode === '000000' ? '111111' : '000000',
      }),
    );
    expect(salah.status).toBe(400);
    const ok = await data<DetailOrderPembelian>(
      kirim(persediaanSesi, `/api/order-pembelian/${po.id}/setujui-kode`, {
        idPermintaan: info.idPermintaan,
        kode,
        catatan: 'Disetujui lewat telepon',
      }),
    );
    expect(ok.status).toBe('DISETUJUI');
    expect(ok.persetujuan.namaPenyetuju).toBe(owner.pengguna.namaPengguna);
    // Sekali pakai.
    expect(
      (
        await kirim(persediaanSesi, `/api/order-pembelian/${po.id}/setujui-kode`, {
          idPermintaan: info.idPermintaan,
          kode,
        })
      ).status,
    ).toBe(400);
  });
});
