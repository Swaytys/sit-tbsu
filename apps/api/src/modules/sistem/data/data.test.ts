import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ManifestData, StatusData } from '@sit/shared';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cookieSesi,
  json,
  loginUji,
  minta,
  mintaForm,
  PASSWORD_UJI,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import { pelanggan, pengguna } from '../../../db/schema';
import { pangkasPengaman } from './pustaka';
import { akarPustaka } from './service';

type Data<T> = { data: T };

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(pelanggan);
  await rm(akarPustaka(), { recursive: true, force: true });
});

async function owner() {
  const s = await sesiUji('OWNER');
  return { ...s, username: s.pengguna.username };
}

const tambahPelanggan = (nama: string, hp: string) =>
  db.insert(pelanggan).values({ kode: `PLG-${hp.slice(-5)}`, namaPelanggan: nama, noHp: hp });

async function salinan(cookie: string, label: string): Promise<ManifestData> {
  const r = await minta('/api/data/salinan', { method: 'POST', cookie, body: { label } });
  expect(r.status).toBe(201);
  return (await json<Data<ManifestData>>(r)).data;
}

// Dump dan pemulihan database uji butuh beberapa detik per langkah.
describe('kelola data (K-213)', { timeout: 180_000 }, () => {
  it('salinan data aktif masuk Pustaka dengan ringkasan isi; hanya Owner', async () => {
    const o = await owner();
    await tambahPelanggan('Pelanggan A', '+6281200000001');
    const m = await salinan(o.cookie, 'Sebelum uji');
    expect(m).toMatchObject({ jenis: 'SALINAN', label: 'Sebelum uji' });
    expect(m.jumlah.pelanggan).toBe(1);
    expect(m.pengguna.map((p) => p.username)).toContain(o.username);
    expect(m.ukuranByte).toBeGreaterThan(0);

    const s = await json<Data<StatusData>>(await minta('/api/data', { cookie: o.cookie }));
    expect(s.data.pustaka.map((x) => x.id)).toEqual([m.id]);
    expect(s.data.aktif.jumlah.pelanggan).toBe(1);

    const admin = await sesiUji('ADMIN');
    expect((await minta('/api/data', { cookie: admin.cookie })).status).toBe(403);
  });

  it('pakai data: pengaman otomatis dibuat, isi diganti, sesi dicabut; pengaman bisa dipakai kembali', async () => {
    const o = await owner();
    await tambahPelanggan('Pelanggan Lama', '+6281200000002');
    const m = await salinan(o.cookie, 'Titik A');
    await tambahPelanggan('Pelanggan Baru', '+6281200000003');

    const salah = await minta(`/api/data/${m.id}/pakai`, {
      method: 'POST',
      cookie: o.cookie,
      body: { password: 'bukan-password' },
    });
    expect(salah.status).toBe(400);

    const r = await minta(`/api/data/${m.id}/pakai`, {
      method: 'POST',
      cookie: o.cookie,
      body: { password: PASSWORD_UJI },
    });
    expect(r.status).toBe(200);
    const nama = (await db.select().from(pelanggan)).map((p) => p.namaPelanggan);
    expect(nama).toEqual(['Pelanggan Lama']);
    expect((await minta('/api/auth/saya', { cookie: o.cookie })).status).toBe(401);

    const cookie = await loginUji(o.username);
    const s = await json<Data<StatusData>>(await minta('/api/data', { cookie }));
    expect(s.data.pengaman).toHaveLength(1);
    const balik = await minta(`/api/data/${s.data.pengaman[0]!.id}/pakai`, {
      method: 'POST',
      cookie,
      body: { password: PASSWORD_UJI },
    });
    expect(balik.status).toBe(200);
    expect((await db.select().from(pelanggan)).map((p) => p.namaPelanggan).sort()).toEqual([
      'Pelanggan Baru',
      'Pelanggan Lama',
    ]);
  });

  it('ekspor berkas .bonsai bersandi lalu impor; sandi salah ditolak; hapus perlu password', async () => {
    const o = await owner();
    await tambahPelanggan('Pelanggan Pindah', '+6281200000004');
    const ekspor = await minta('/api/data/ekspor', {
      method: 'POST',
      cookie: o.cookie,
      body: { sandi: 'sandi-pindah-1', sandiUlang: 'sandi-pindah-1', password: PASSWORD_UJI },
    });
    expect(ekspor.status).toBe(200);
    expect(ekspor.headers.get('content-disposition')).toMatch(/\.bonsai"$/);
    const berkas = new Uint8Array(await ekspor.arrayBuffer());
    expect(Buffer.from(berkas).toString('utf8')).not.toContain('Pelanggan Pindah');

    const kirim = (sandi: string) => {
      const f = new FormData();
      f.set('berkas', new File([berkas], 'data.bonsai'));
      f.set('sandi', sandi);
      return mintaForm('/api/data/impor', f, o.cookie);
    };
    const salah = await kirim('sandi-keliru');
    expect(salah.status).toBe(400);
    const r = await kirim('sandi-pindah-1');
    expect(r.status).toBe(201);
    const m = (await json<Data<ManifestData>>(r)).data;
    expect(m).toMatchObject({ jenis: 'IMPOR' });
    expect(m.jumlah.pelanggan).toBe(1);

    const tanpa = await minta(`/api/data/${m.id}/hapus`, {
      method: 'POST',
      cookie: o.cookie,
      body: { password: 'salah' },
    });
    expect(tanpa.status).toBe(400);
    const hapus = await minta(`/api/data/${m.id}/hapus`, {
      method: 'POST',
      cookie: o.cookie,
      body: { password: PASSWORD_UJI },
    });
    expect(hapus.status).toBe(200);
    expect(existsSync(path.join(akarPustaka(), m.id))).toBe(false);
  });

  it('setup awal: data di Pustaka bisa dipakai hanya selama belum ada pengguna', async () => {
    const o = await owner();
    const m = await salinan(o.cookie, 'Dari komputer lama');
    expect((await minta('/api/auth/setup-data')).status).toBe(409);

    await kosongkanTabel(pengguna);
    const daftar = await json<Data<ManifestData[]>>(await minta('/api/auth/setup-data'));
    expect(daftar.data.map((d) => d.id)).toEqual([m.id]);
    const r = await minta(`/api/auth/setup-data/${m.id}/pakai`, { method: 'POST' });
    expect(r.status).toBe(200);
    const [kembali] = await db.select().from(pengguna).where(eq(pengguna.username, o.username));
    expect(kembali).toBeDefined();
    const masuk = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: o.username, password: PASSWORD_UJI },
    });
    expect(cookieSesi(masuk)).toBeTruthy();
  });

  it('K-219 buat data toko baru: hanya Owner, ditolak saat shift terbuka, data lama tersimpan dan bisa dipakai lagi', async () => {
    const o = await owner();
    await tambahPelanggan('Pelanggan Toko Lama', '+6281200000005');
    const admin = await sesiUji('ADMIN');
    const lewatMasuk = (path: string, username: string, password: string) =>
      minta(`/api/auth/data-toko${path}`, { method: 'POST', body: { username, password } });

    expect((await lewatMasuk('/daftar', admin.pengguna.username, PASSWORD_UJI)).status).toBe(403);
    expect((await lewatMasuk('/daftar', o.username, 'bukan-password')).status).toBe(401);
    expect((await lewatMasuk('/daftar', o.username, PASSWORD_UJI)).status).toBe(200);
    expect(
      (
        await minta('/api/data/baru', {
          method: 'POST',
          cookie: admin.cookie,
          body: { password: PASSWORD_UJI },
        })
      ).status,
    ).toBe(403);

    // Shift terbuka: uang laci belum dicocokkan, data tidak boleh diganti.
    const buka = await minta('/api/shift/buka', {
      method: 'POST',
      cookie: o.cookie,
      body: { modalAwal: 0 },
    });
    expect(buka.status).toBe(201);
    const idShift = (await json<Data<{ id: number }>>(buka)).data.id;
    const ditolak = await lewatMasuk('/baru', o.username, PASSWORD_UJI);
    expect(ditolak.status).toBe(409);
    const tutup = await minta(`/api/shift/${idShift}/tutup`, {
      method: 'POST',
      cookie: o.cookie,
      body: { uangFisik: 0 },
    });
    expect(tutup.status).toBe(200);

    const r = await lewatMasuk('/baru', o.username, PASSWORD_UJI);
    expect(r.status).toBe(201);
    const lama = (await json<Data<ManifestData>>(r)).data;
    expect(lama).toMatchObject({ jenis: 'SALINAN' });
    expect(lama.jumlah.pelanggan).toBe(1);
    // Data baru kosong (setup awal tampil lagi), data awal terisi.
    expect(await db.select().from(pengguna)).toHaveLength(0);
    expect(await db.select().from(pelanggan)).toHaveLength(0);
    const tersimpan = await json<Data<ManifestData[]>>(await minta('/api/auth/setup-data'));
    expect(tersimpan.data.map((d) => d.id)).toContain(lama.id);
    // Data lama bisa dipakai kembali.
    expect((await minta(`/api/auth/setup-data/${lama.id}/pakai`, { method: 'POST' })).status).toBe(
      200,
    );
    expect((await db.select().from(pelanggan)).map((p) => p.namaPelanggan)).toEqual([
      'Pelanggan Toko Lama',
    ]);
  });

  it('K-168 data latihan: akun Owner sama, contoh barang berstok, pita latihan; data asli bisa dipakai lagi', async () => {
    const o = await owner();
    await tambahPelanggan('Pelanggan Asli', '+6281200000006');
    const r = await minta('/api/data/latihan', {
      method: 'POST',
      cookie: o.cookie,
      body: { password: PASSWORD_UJI },
    });
    expect(r.status).toBe(201);
    const asli = (await json<Data<ManifestData>>(r)).data;
    expect(asli.jumlah.pelanggan).toBe(1);

    const status = await json<Data<{ modeLatihan: boolean; namaToko: string }>>(
      await minta('/api/auth/penyiapan'),
    );
    expect(status.data.modeLatihan).toBe(true);
    expect(status.data.namaToko).toMatch(/^LATIHAN – /);
    // Owner masuk dengan username + password yang sama.
    const cookie = await loginUji(o.username);
    const s = await json<Data<StatusData>>(await minta('/api/data', { cookie }));
    expect(s.data.aktif.jumlah.barang).toBeGreaterThan(0);
    expect(s.data.aktif.jumlah.pelanggan).toBeGreaterThan(0);
    const [stok] = await db
      .execute<{ total: string }>(
        sql`select coalesce(sum(stok_fisik), 0)::text as total from persediaan`,
      )
      .then((x) => x.rows);
    expect(Number(stok!.total)).toBeGreaterThan(0);

    const kembali = await minta(`/api/data/${asli.id}/pakai`, {
      method: 'POST',
      cookie,
      body: { password: PASSWORD_UJI },
    });
    expect(kembali.status).toBe(200);
    expect((await db.select().from(pelanggan)).map((p) => p.namaPelanggan)).toEqual([
      'Pelanggan Asli',
    ]);
    const lagi = await json<Data<{ modeLatihan: boolean }>>(await minta('/api/auth/penyiapan'));
    expect(lagi.data.modeLatihan).toBe(false);
  });

  it('pengaman otomatis hanya 3 terbaru yang disimpan', async () => {
    const akar = akarPustaka();
    for (let i = 1; i <= 5; i++) {
      const id = `2026103100000${i}-aaaa000${i}`;
      const f = path.join(akar, 'pengaman', id);
      await mkdir(f, { recursive: true });
      await writeFile(path.join(f, 'db.dump'), 'x');
      await writeFile(
        path.join(f, 'manifest.json'),
        JSON.stringify({ id, jenis: 'PENGAMAN', dibuatPada: `2026-10-31T00:00:0${i}Z` }),
      );
    }
    await pangkasPengaman(akar);
    for (let i = 1; i <= 5; i++) {
      expect(existsSync(path.join(akar, 'pengaman', `2026103100000${i}-aaaa000${i}`))).toBe(i > 2);
    }
  });
});
