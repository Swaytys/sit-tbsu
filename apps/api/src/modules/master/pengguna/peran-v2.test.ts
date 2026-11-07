import { beforeEach, describe, expect, it } from 'vitest';
import {
  json,
  minta,
  PASSWORD_UJI,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../../test/pembantu';

beforeEach(siapkanDatabaseSistem);

const get = (path: string, cookie: string) => minta(path, { cookie }).then((r) => r.status);

describe('peran V2: pemisahan tugas (K-225)', () => {
  it('Administrator Sistem: akun Staf/Kasir/Admin Persediaan/Gudang saja; tidak bisa mengatur Kepala Toko, Owner, atau sesamanya', async () => {
    const sistem = await sesiUji('ADMIN_SISTEM');
    const tambah = (peran: string, username: string) =>
      minta('/api/pengguna', {
        method: 'POST',
        cookie: sistem.cookie,
        body: { namaPengguna: `Uji ${username}`, username, peran, password: PASSWORD_UJI },
      });
    expect((await tambah('KASIR', 'kasir.baru')).status).toBe(201);
    expect((await tambah('ADMIN_PERSEDIAAN', 'persediaan.baru')).status).toBe(201);
    for (const [peran, u] of [
      ['ADMIN', 'kepala.baru'],
      ['OWNER', 'owner.baru'],
      ['ADMIN_SISTEM', 'sistem.baru'],
    ]) {
      const r = await tambah(peran!, u!);
      expect(r.status).toBe(403);
      expect((await json(r)).error?.pesan).toContain('hanya bisa diatur Owner');
    }
    // Akun Kepala Toko yang sudah ada tidak bisa diubah/di-reset oleh Administrator Sistem.
    const kepala = await sesiUji('ADMIN');
    const ubah = await minta(`/api/pengguna/${kepala.pengguna.id}`, {
      method: 'PATCH',
      cookie: sistem.cookie,
      body: { namaPengguna: 'Ganti', username: kepala.pengguna.username, peran: 'ADMIN' },
    });
    expect(ubah.status).toBe(403);
    const nonaktif = await minta(`/api/pengguna/${kepala.pengguna.id}/nonaktifkan`, {
      method: 'POST',
      cookie: sistem.cookie,
    });
    expect(nonaktif.status).toBe(403);
  });

  it('wewenang per peran ditolak 403 di luar tugasnya', async () => {
    const sistem = await sesiUji('ADMIN_SISTEM');
    const persediaan = await sesiUji('ADMIN_PERSEDIAAN');
    const gudang = await sesiUji('PETUGAS_GUDANG');
    const kepala = await sesiUji('ADMIN');

    // Administrator Sistem: akses perangkat & cadangan ya; pengaturan umum, uang, tutup tahun tidak.
    expect(await get('/api/akses-perangkat/lan', sistem.cookie)).toBe(200);
    expect(await get('/api/cadangan', sistem.cookie)).toBe(200);
    expect(await get('/api/pengaturan', sistem.cookie)).toBe(403);
    expect(await get('/api/arsip', sistem.cookie)).toBe(403);
    expect(await get('/api/hutang', sistem.cookie)).toBe(403);

    // Admin Persediaan: penerimaan & order pembelian ya; shift, persetujuan retur, bayar hutang tidak.
    expect(await get('/api/penerimaan', persediaan.cookie)).toBe(200);
    expect(await get('/api/order-pembelian', persediaan.cookie)).toBe(200);
    const buka = await minta('/api/shift/buka', {
      method: 'POST',
      cookie: persediaan.cookie,
      body: { modalAwal: 0 },
    });
    expect(buka.status).toBe(403);
    expect(await get('/api/pengguna', persediaan.cookie)).toBe(403);

    // Petugas Gudang: stok ya; penerimaan dan harga modal tidak.
    expect(await get('/api/stok', gudang.cookie)).toBe(200);
    expect(await get('/api/penerimaan', gudang.cookie)).toBe(403);

    // Kepala Toko: tidak mengatur akun dan perangkat.
    expect(await get('/api/pengguna', kepala.cookie)).toBe(403);
    expect(await get('/api/akses-perangkat/lan', kepala.cookie)).toBe(403);
  });
});
