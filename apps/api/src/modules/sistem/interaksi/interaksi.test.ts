import type { BarisInteraksi, RingkasanInteraksi } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { logAktivitas, logInteraksi } from '../../../db/schema';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let owner: Sesi;
let kasir: Sesi;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  owner = await sesiUji('OWNER');
  kasir = await sesiUji('KASIR');
});

const kejadian = (ubah: Record<string, unknown> = {}) => ({
  waktu: new Date().toISOString(),
  jenis: 'KLIK',
  halaman: '/order',
  elemen: 'Simpan order',
  keterangan: null,
  angka: null,
  ...ubah,
});

const kirim = (sesi: Sesi, daftar: unknown[]) =>
  minta('/api/log-interaksi', {
    method: 'POST',
    cookie: sesi.cookie,
    body: { idSesiKlien: 'abc12345-uji', kejadian: daftar },
  });

const nyalakan = (aktif: boolean, tingkat = 'SEMUA') =>
  minta('/api/log-interaksi/setelan', {
    method: 'PUT',
    cookie: owner.cookie,
    body: { aktif, tingkat },
  });

describe('log interaksi penelitian (K-190)', () => {
  it('mati (bawaan): kiriman diabaikan; Owner menyalakan, tercatat di log audit; Kasir tidak boleh mengatur', async () => {
    const setelan = await json<{ data: { aktif: boolean } }>(
      await minta('/api/log-interaksi/setelan', { cookie: kasir.cookie }),
    );
    expect(setelan.data.aktif).toBe(false);
    const abai = await json<{ data: { diterima: number } }>(await kirim(kasir, [kejadian()]));
    expect(abai.data.diterima).toBe(0);
    expect(await db.select().from(logInteraksi)).toHaveLength(0);

    expect(
      (
        await minta('/api/log-interaksi/setelan', {
          method: 'PUT',
          cookie: kasir.cookie,
          body: { aktif: true, tingkat: 'SEMUA' },
        })
      ).status,
    ).toBe(403);
    expect((await minta('/api/log-interaksi', { cookie: kasir.cookie })).status).toBe(403);

    const r = await json<{ data: RingkasanInteraksi }>(await nyalakan(true, 'BERMAKNA'));
    expect(r.data).toMatchObject({ aktif: true, tingkat: 'BERMAKNA', jumlah: 0 });
    const audit = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGATURAN_UBAH'));
    expect(audit[0]?.ringkasan).toContain('Log interaksi penelitian dinyalakan');
  });

  it('kejadian disimpan dengan pengguna dari sesi; angka panjang dan id di alamat disamarkan; waktu ngawur diganti', async () => {
    await nyalakan(true);
    const res = await kirim(kasir, [
      kejadian({
        jenis: 'HALAMAN',
        halaman: '/penjualan/123?dari=pengiriman',
        elemen: null,
        angka: 45000,
      }),
      kejadian({ elemen: 'Hubungi 0812-3456-7890 atau 081234567890', keterangan: 'Rp 1.500.000' }),
      kejadian({ jenis: 'TOMBOL', keterangan: 'F2', waktu: '2001-01-01T00:00:00Z' }),
    ]);
    expect((await json<{ data: { diterima: number } }>(res)).data.diterima).toBe(3);
    const baris = await db.select().from(logInteraksi).orderBy(logInteraksi.id);
    expect(baris.every((b) => b.idPengguna === kasir.pengguna.id)).toBe(true);
    expect(baris[0]).toMatchObject({ halaman: '/penjualan/:id', angka: 45000, jenis: 'HALAMAN' });
    expect(baris[1]!.elemen).not.toMatch(/\d{7}/);
    expect(baris[1]!.keterangan).toBe('Rp #');
    expect(baris[2]!.waktu.getFullYear()).toBeGreaterThan(2001);
  });

  it('validasi: jenis tidak dikenal dan kiriman terlalu besar ditolak; tanpa login ditolak', async () => {
    await nyalakan(true);
    expect((await kirim(kasir, [kejadian({ jenis: 'KETIK' })])).status).toBe(400);
    expect(
      (
        await kirim(
          kasir,
          Array.from({ length: 101 }, () => kejadian()),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await minta('/api/log-interaksi', {
          method: 'POST',
          body: { idSesiKlien: 'abc12345-uji', kejadian: [kejadian()] },
        })
      ).status,
    ).toBe(401);
  });

  it('Owner melihat, menyaring, meringkas, dan mengekspor Excel/CSV (ekspor dicatat)', async () => {
    await nyalakan(true);
    await kirim(kasir, [
      kejadian(),
      kejadian({ jenis: 'CARI', elemen: 'Cari barang', angka: 4, halaman: '/penjualan-langsung' }),
    ]);
    await kirim(owner, [kejadian({ jenis: 'DIALOG', elemen: 'Rit baru', keterangan: 'buka' })]);

    const semua = await json<{ data: BarisInteraksi[]; meta: { total: number } }>(
      await minta('/api/log-interaksi', { cookie: owner.cookie }),
    );
    expect(semua.meta.total).toBe(3);
    expect(semua.data[0]).toMatchObject({ jenis: 'DIALOG', peran: 'OWNER' });
    const cari = await json<{ data: BarisInteraksi[] }>(
      await minta('/api/log-interaksi?jenis=CARI&lokasi=langsung', { cookie: owner.cookie }),
    );
    expect(cari.data).toHaveLength(1);
    const per = await json<{ data: BarisInteraksi[] }>(
      await minta(`/api/log-interaksi?idPengguna=${kasir.pengguna.id}`, { cookie: owner.cookie }),
    );
    expect(per.data).toHaveLength(2);

    const r = await json<{ data: RingkasanInteraksi }>(
      await minta('/api/log-interaksi/ringkasan', { cookie: owner.cookie }),
    );
    expect(r.data).toMatchObject({ jumlah: 3, jumlahPengguna: 2 });

    const xlsx = await minta('/api/log-interaksi/ekspor', { cookie: owner.cookie });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
    const csv = await minta('/api/log-interaksi/ekspor?format=CSV&jenis=CARI', {
      cookie: owner.cookie,
    });
    expect(csv.headers.get('content-type')).toContain('text/csv');
    const teks = await csv.text();
    expect(teks).toContain('Waktu (WIB),ID pengguna,Pengguna');
    expect(teks.trim().split('\r\n')).toHaveLength(2);
    const ekspor = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'LAPORAN_EKSPOR'));
    expect(ekspor.map((e) => e.ringkasan)).toEqual(
      expect.arrayContaining([expect.stringContaining('Ekspor CSV log interaksi (1 baris)')]),
    );
  });
});
