import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ManifestData, StatusData } from '@sit/shared';
import { eq } from 'drizzle-orm';
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
