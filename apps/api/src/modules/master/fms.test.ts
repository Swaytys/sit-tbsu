import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Kendaraan, Notifikasi, StatistikArmada } from '@sit/shared';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { catatanBbm, kendaraan, logAktivitas, perjalanan, sopir } from '../../db/schema';
import { saatLokal, tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungKesehatan } from './armada/service';

// K-162 (docs/13 §5): catatan BBM/servis, odometer, pengingat servis & surat, statistik armada.

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};

let admin: Sesi;
let kasir: Sesi;
let truk: Kendaraan;
let idSopir: number;
const hariIni = tanggalOperasional();

const kirim = (s: Sesi, path: string, body: unknown) =>
  minta(path, { method: 'POST', cookie: s.cookie, body });

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(kendaraan, sopir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const res = await kirim(admin, '/api/kendaraan', {
    plat: 'S 1234 AB',
    jenis: 'Truk engkel',
    kapasitasKg: 4000,
    servisTiapKm: 5000,
    servisTiapBulan: 6,
  });
  expect(res.status).toBe(201);
  truk = (await json<{ data: Kendaraan }>(res)).data;
  idSopir = (
    await json<{ data: { id: number } }>(await kirim(admin, '/api/sopir', { nama: 'Budi' }))
  ).data.id;
});

const bbm = (s: Sesi, isi: Record<string, unknown>) =>
  kirim(s, '/api/armada/bbm', {
    idKendaraan: truk.id,
    tanggal: hariIni,
    liter: '30',
    totalRp: 300_000,
    ...isi,
  });

describe('catatan BBM dan servis', () => {
  it('odometer tidak boleh mundur menurut tanggal; catatan susulan boleh di antaranya; batal membuka kembali', async () => {
    expect(
      (await bbm(kasir, { odometerKm: 10_000, tanggal: tambahHari(hariIni, -10) })).status,
    ).toBe(201);
    expect((await bbm(kasir, { odometerKm: 10_500, idSopir, penuh: true })).status).toBe(201);

    const mundur = await bbm(kasir, { odometerKm: 10_400 });
    expect(mundur.status).toBe(400);
    expect((await json<Galat>(mundur)).error.detail?.kolom?.odometerKm?.[0]).toContain(
      'lebih kecil dari catatan sebelumnya (10.500 km)',
    );
    // Susulan bertanggal di antara dua catatan: harus di antara angkanya.
    const tengah = tambahHari(hariIni, -5);
    expect((await bbm(kasir, { odometerKm: 10_600, tanggal: tengah })).status).toBe(400);
    expect((await bbm(kasir, { odometerKm: 10_200, tanggal: tengah })).status).toBe(201);

    expect((await bbm(kasir, { tanggal: tambahHari(hariIni, 1) })).status).toBe(400);
    expect((await bbm(kasir, { liter: '0' })).status).toBe(400);

    // Batal catatan 10.500 (salah ketik) → 10.400 sekarang diterima.
    const [salah] = await db
      .select({ id: catatanBbm.id })
      .from(catatanBbm)
      .where(eq(catatanBbm.odometerKm, 10_500));
    expect(
      (await kirim(kasir, `/api/armada/bbm/${salah!.id}/batal`, { alasan: 'Salah ketik' })).status,
    ).toBe(403);
    expect(
      (await kirim(admin, `/api/armada/bbm/${salah!.id}/batal`, { alasan: 'Salah ketik' })).status,
    ).toBe(200);
    expect(
      (await kirim(admin, `/api/armada/bbm/${salah!.id}/batal`, { alasan: 'Lagi' })).status,
    ).toBe(409);
    expect((await bbm(kasir, { odometerKm: 10_400 })).status).toBe(201);

    const daftar = await json<{
      data: { odometerKm: number; batalPada: string | null; namaSopir: string | null }[];
    }>(await minta(`/api/armada/bbm?idKendaraan=${truk.id}`, { cookie: kasir.cookie }));
    expect(daftar.data).toHaveLength(4);
    expect(daftar.data.find((d) => d.odometerKm === 10_500)).toMatchObject({ namaSopir: 'Budi' });
    expect(daftar.data.find((d) => d.odometerKm === 10_500)?.batalPada).not.toBeNull();
    const log = await db
      .select({ aksi: logAktivitas.aksi })
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'ARMADA_CATATAN_BATAL'));
    expect(log).toHaveLength(1);
  });

  it('servis hanya Admin/Owner; kendaraan nonaktif ditolak; rit harus milik kendaraan itu', async () => {
    const servis = {
      idKendaraan: truk.id,
      tanggal: hariIni,
      odometerKm: 12_000,
      jenis: 'Ganti oli',
      biayaRp: 450_000,
    };
    expect((await kirim(kasir, '/api/armada/servis', servis)).status).toBe(403);
    expect((await kirim(admin, '/api/armada/servis', servis)).status).toBe(201);
    expect((await kirim(admin, '/api/armada/servis', { ...servis, jenis: 'x' })).status).toBe(400);

    const [admRow] = await db.select().from(kendaraan).where(eq(kendaraan.id, truk.id));
    const [rit] = await db
      .insert(perjalanan)
      .values({
        nomor: 'TRP-UJI-1',
        idKendaraan: truk.id,
        idSopir,
        idPengguna: admin.pengguna.id,
        status: 'SELESAI',
        waktuBerangkat: new Date(),
        waktuKembali: new Date(),
      })
      .returning({ id: perjalanan.id });
    const lain = await json<{ data: Kendaraan }>(
      await kirim(admin, '/api/kendaraan', { plat: 'L 1 X', jenis: 'Pikap' }),
    );
    const salahRit = await kirim(kasir, '/api/armada/bbm', {
      idKendaraan: lain.data.id,
      tanggal: hariIni,
      liter: '10',
      totalRp: 100_000,
      idPerjalanan: rit!.id,
    });
    expect(salahRit.status).toBe(400);
    expect((await json<Galat>(salahRit)).error.pesan).toContain(`bukan rit kendaraan L 1 X`);

    await minta(`/api/kendaraan/${lain.data.id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: { statusAktif: 'NONAKTIF' },
    });
    const nonaktif = await kirim(kasir, '/api/armada/bbm', {
      idKendaraan: lain.data.id,
      tanggal: hariIni,
      liter: '10',
      totalRp: 100_000,
    });
    expect(nonaktif.status).toBe(400);
    expect(admRow?.servisTiapKm).toBe(5000);
  });
});

describe('kesehatan kendaraan dan pengingat', () => {
  const k = { servisTiapKm: 5000, servisTiapBulan: 6, berlakuStnk: null, berlakuKir: null };
  const servis = { tanggal: '2026-01-10', odometerKm: 10_000, jenis: 'Ganti oli' };

  it('servis berikutnya dari km dan bulan; tingkat terburuk dipakai; surat 30 hari', () => {
    const aman = hitungKesehatan(
      k,
      { odometerKm: 12_000, tanggal: '2026-03-01' },
      servis,
      '2026-03-01',
    );
    expect(aman.servisBerikut).toEqual({ km: 15_000, tanggal: '2026-07-10', tingkat: 'AMAN' });
    expect(
      hitungKesehatan(k, { odometerKm: 14_600, tanggal: '' }, servis, '2026-03-01').servisBerikut
        ?.tingkat,
    ).toBe('SEGERA');
    expect(
      hitungKesehatan(k, { odometerKm: 15_000, tanggal: '' }, servis, '2026-03-01').servisBerikut
        ?.tingkat,
    ).toBe('LEWAT');
    expect(hitungKesehatan(k, undefined, servis, '2026-06-30').servisBerikut?.tingkat).toBe(
      'SEGERA',
    );
    expect(hitungKesehatan(k, undefined, servis, '2026-07-11').servisBerikut?.tingkat).toBe(
      'LEWAT',
    );
    expect(hitungKesehatan(k, undefined, undefined, '2026-07-11').servisBerikut).toBeNull();

    const surat = hitungKesehatan(
      { ...k, berlakuStnk: '2026-03-31', berlakuKir: '2026-02-28' },
      undefined,
      undefined,
      '2026-03-01',
    );
    expect(surat).toMatchObject({ stnk: 'SEGERA', kir: 'LEWAT' });
    expect(
      hitungKesehatan({ ...k, berlakuStnk: '2026-04-01' }, undefined, undefined, '2026-03-01').stnk,
    ).toBe('AMAN');
  });

  it('daftar kendaraan membawa kesehatan; notifikasi STNK/KIR dan servis hanya untuk pengelola armada', async () => {
    await minta(`/api/kendaraan/${truk.id}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: {
        plat: truk.plat,
        jenis: truk.jenis,
        kapasitasKg: 4000,
        berlakuKir: tambahHari(hariIni, -1),
        servisTiapKm: 5000,
        servisTiapBulan: 6,
      },
    });
    await kirim(admin, '/api/armada/servis', {
      idKendaraan: truk.id,
      tanggal: tambahHari(hariIni, -3),
      odometerKm: 10_000,
      jenis: 'Servis besar',
      biayaRp: 1_000_000,
    });
    await bbm(kasir, { odometerKm: 14_700 });
    const daftar = await json<{ data: Kendaraan[] }>(
      await minta('/api/kendaraan', { cookie: kasir.cookie }),
    );
    expect(daftar.data[0]?.kesehatan).toMatchObject({
      odometerKm: 14_700,
      kir: 'LEWAT',
      servisBerikut: { km: 15_000, tingkat: 'SEGERA' },
    });

    const notif = async (s: Sesi) =>
      (await json<{ data: Notifikasi[] }>(await minta('/api/notifikasi', { cookie: s.cookie })))
        .data;
    const n = await notif(admin);
    expect(n.find((x) => x.jenis === 'ARMADA_SURAT')).toMatchObject({
      judul: 'STNK/KIR kendaraan sudah habis',
      rincian: ['S 1234 AB: KIR habis'],
    });
    expect(n.find((x) => x.jenis === 'ARMADA_SERVIS')?.rincian?.[0]).toContain(
      'S 1234 AB: segera (15.000 km)',
    );
    expect((await notif(kasir)).some((x) => x.jenis.startsWith('ARMADA_'))).toBe(false);
  });
});

describe('statistik armada', () => {
  it('rit, ketepatan, lama, pemakaian daya angkut, BBM, km/liter, biaya per km, sopir bermasalah', async () => {
    const jam = (j: string, hari = 0) => saatLokal(tambahHari(hariIni, hari), j);
    await db.insert(perjalanan).values([
      {
        nomor: 'TRP-UJI-1',
        idKendaraan: truk.id,
        idSopir,
        idPengguna: admin.pengguna.id,
        status: 'SELESAI',
        jadwalBerangkat: jam('08:00', -1),
        waktuBerangkat: jam('08:10', -1),
        waktuKembali: jam('10:10', -1),
        muatanBeratKg: '2000',
      },
      {
        nomor: 'TRP-UJI-2',
        idKendaraan: truk.id,
        idSopir,
        idPengguna: admin.pengguna.id,
        status: 'SELESAI',
        jadwalBerangkat: jam('08:00', -1),
        waktuBerangkat: jam('09:00', -1),
        waktuKembali: jam('10:00', -1),
        muatanBeratKg: '3000',
      },
      // Di luar periode.
      {
        nomor: 'TRP-UJI-3',
        idKendaraan: truk.id,
        idSopir,
        idPengguna: admin.pengguna.id,
        status: 'SELESAI',
        waktuBerangkat: jam('08:00', -40),
        waktuKembali: jam('09:00', -40),
      },
    ]);
    await bbm(kasir, {
      odometerKm: 1_000,
      tanggal: tambahHari(hariIni, -2),
      liter: '20',
      totalRp: 200_000,
    });
    await bbm(kasir, { odometerKm: 1_300, liter: '10', totalRp: 100_000 });
    await kirim(admin, '/api/armada/servis', {
      idKendaraan: truk.id,
      tanggal: hariIni,
      odometerKm: 1_300,
      jenis: 'Ganti oli',
      biayaRp: 300_000,
    });

    const dari = tambahHari(hariIni, -7);
    expect(
      (
        await minta(`/api/armada/statistik?dari=${dari}&sampai=${hariIni}`, {
          cookie: kasir.cookie,
        })
      ).status,
    ).toBe(403);
    const res = await minta(`/api/armada/statistik?dari=${dari}&sampai=${hariIni}`, {
      cookie: admin.cookie,
    });
    expect(res.status).toBe(200);
    const s = (await json<{ data: StatistikArmada }>(res)).data;
    expect(s.kendaraan).toHaveLength(1);
    expect(s.kendaraan[0]).toMatchObject({
      plat: 'S 1234 AB',
      rit: 2,
      suratJalan: 0,
      rataLamaMenit: 90,
      tepatWaktu: 1,
      berjadwal: 2,
      rataPakaiPersen: 63,
      bbmLiter: '30.00',
      bbmRp: 300_000,
      kmTempuh: 300,
      kmPerLiter: '10.0',
      servisRp: 300_000,
      biayaPerKm: 2_000,
    });
    expect(Number(s.kendaraan[0]?.muatanKg)).toBe(5000);
    expect(s.sopir[0]).toMatchObject({ nama: 'Budi', rit: 2, suratJalanBermasalah: 0 });

    const terbalik = await minta(`/api/armada/statistik?dari=${hariIni}&sampai=${dari}`, {
      cookie: admin.cookie,
    });
    expect(terbalik.status).toBe(400);
    const [n] = await db
      .select({ id: catatanBbm.id })
      .from(catatanBbm)
      .where(and(eq(catatanBbm.idKendaraan, truk.id), eq(catatanBbm.odometerKm, 1_300)));
    expect(n).toBeDefined();
  });
});
