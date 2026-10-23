import type { Pelanggan, Pemasok } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../test/pembantu';
import { kosongkanTabel } from '../../test/reset';
import { pelanggan, pemasok } from '../db/schema';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;
let owner: Sesi;

async function kirim<T>(sesi: Sesi, path: string, body: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  return {
    status: r.status,
    isi: await json<{ data: T; error: { kode: string; pesan: string } }>(r),
  };
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(pemasok, pelanggan);
  admin = await sesiUji('ADMIN');
  owner = await sesiUji('OWNER');
});

describe('cek versi data master (K-164)', () => {
  it('dua admin membuka pemasok yang sama: simpanan kedua ditolak, bukan menimpa diam-diam', async () => {
    const dasar = { namaPemasok: 'CV Semen Jaya', noHp: '081234567890' };
    const p = (await kirim<Pemasok>(admin, '/api/pemasok', dasar)).isi.data;
    expect(p.versi).toBeTruthy();
    // Keduanya memuat versi yang sama; Admin menyimpan duluan.
    const a = await kirim<Pemasok>(
      admin,
      `/api/pemasok/${p.id}`,
      { ...dasar, alamat: 'Jl. A', versi: p.versi },
      'PATCH',
    );
    expect(a.status).toBe(200);
    expect(a.isi.data.versi).not.toBe(p.versi);
    const b = await kirim<Pemasok>(
      owner,
      `/api/pemasok/${p.id}`,
      { ...dasar, alamat: 'Jl. B', versi: p.versi },
      'PATCH',
    );
    expect(b.status).toBe(409);
    expect(b.isi.error.pesan).toContain('sudah diubah orang lain');
    // Setelah memuat ulang (versi terbaru), simpanan diterima.
    const c = await kirim<Pemasok>(
      owner,
      `/api/pemasok/${p.id}`,
      { ...dasar, alamat: 'Jl. B', versi: a.isi.data.versi },
      'PATCH',
    );
    expect(c.status).toBe(200);
    expect(c.isi.data.alamat).toBe('Jl. B');
  });

  it('pelanggan: versi lama ditolak; tanpa versi (klien lama) tetap diterima', async () => {
    const dasar = { namaPelanggan: 'Toko Makmur', noHp: '081234567891' };
    const p = (await kirim<Pelanggan>(admin, '/api/pelanggan', dasar)).isi.data;
    await kirim(
      admin,
      `/api/pelanggan/${p.id}`,
      { ...dasar, alamat: 'X', versi: p.versi },
      'PATCH',
    );
    const lama = await kirim(
      owner,
      `/api/pelanggan/${p.id}`,
      { ...dasar, alamat: 'Y', versi: p.versi },
      'PATCH',
    );
    expect(lama.status).toBe(409);
    const tanpa = await kirim(owner, `/api/pelanggan/${p.id}`, { ...dasar, alamat: 'Z' }, 'PATCH');
    expect(tanpa.status).toBe(200);
  });
});
