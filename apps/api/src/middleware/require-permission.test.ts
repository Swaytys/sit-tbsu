import { DAFTAR_IZIN, IZIN_PER_PERAN, PERAN, type Izin } from '@sit/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../test/pembantu';
import { app, RUTE_PUBLIK } from '../app';
import type { EnvApp } from '../lib/konteks';
import { muatSesi } from './auth';
import { errorHandler } from './error-handler';
import { periksaDeklarasiIzin, requireLogin, requirePermission } from './require-permission';

describe('guard default (CLAUDE.md aturan 5)', () => {
  it('semua rute aplikasi mendeklarasikan izin atau terdaftar sebagai rute publik', () => {
    expect(periksaDeklarasiIzin(app.routes, RUTE_PUBLIK)).toEqual([]);
  });

  it('rute tanpa deklarasi terdeteksi sehingga server menolak menyala', () => {
    const uji = new Hono<EnvApp>()
      .get('/lupa', (c) => c.text('x'))
      .get('/berizin', requirePermission('master.barang.lihat'), (c) => c.text('y'))
      .post('/milik-sendiri', requireLogin(), (c) => c.text('z'));
    expect(periksaDeklarasiIzin(uji.routes, [])).toEqual(['GET /lupa']);
  });

  it('daftar rute publik: health, login, dan akun pertama/pemulihan K-191 (masuk cepat hanya di pengembangan)', () => {
    expect(RUTE_PUBLIK).toEqual([
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/auth/penyiapan',
      'POST /api/auth/akun-pertama',
      'POST /api/auth/pulihkan',
    ]);
  });
});

describe('requirePermission', () => {
  beforeEach(siapkanDatabaseSistem);

  // Aplikasi uji kecil agar penjaga bisa dicoba dengan izin yang tidak dimiliki Kasir.
  const ujiIzin = new Hono<EnvApp>()
    .use(muatSesi)
    .get('/khusus-owner', requirePermission('master.pengguna.kelola'), (c) => c.text('ok'))
    .onError(errorHandler);

  it('tanpa login → 401 BELUM_LOGIN', async () => {
    const res = await minta('/api/satuan');
    expect(res.status).toBe(401);
    expect((await json(res)).error?.kode).toBe('BELUM_LOGIN');
  });

  it('peran tanpa izin → 403 TIDAK_BERIZIN', async () => {
    const { cookie } = await sesiUji('KASIR');
    const res = await ujiIzin.request('/khusus-owner', { headers: { cookie } });
    expect(res.status).toBe(403);
    expect((await json(res)).error?.kode).toBe('TIDAK_BERIZIN');
  });

  it('peran dengan izin → lolos', async () => {
    const { cookie } = await sesiUji('OWNER');
    const res = await ujiIzin.request('/khusus-owner', { headers: { cookie } });
    expect(res.status).toBe(200);
  });

  it('semua peran boleh membaca satuan (master.barang.lihat)', async () => {
    const { cookie } = await sesiUji('STAF_PENJUALAN');
    expect((await minta('/api/satuan', { cookie })).status).toBe(200);
  });
});

describe('matriks peran (docs/04 §3)', () => {
  const izin = (peran: (typeof PERAN)[number]) => IZIN_PER_PERAN[peran];

  it('peran bertingkat: Staf ⊂ Kasir ⊂ Admin ⊂ Owner', () => {
    for (let i = 1; i < PERAN.length; i++) {
      const bawah = PERAN[i - 1];
      const atas = PERAN[i];
      if (!bawah || !atas) continue;
      for (const kode of izin(bawah)) expect(izin(atas).has(kode)).toBe(true);
    }
  });

  it('Owner memiliki semua izin; kelola pengguna dan log hanya Owner', () => {
    for (const kode of Object.keys(DAFTAR_IZIN) as Izin[])
      expect(izin('OWNER').has(kode)).toBe(true);
    expect(izin('ADMIN').has('master.pengguna.kelola')).toBe(false);
    expect(izin('ADMIN').has('sistem.log.lihat')).toBe(false);
  });

  it('data sensitif: Kasir tidak melihat HPP, Admin melihat', () => {
    expect(izin('KASIR').has('master.barang.lihat_hpp')).toBe(false);
    expect(izin('ADMIN').has('master.barang.lihat_hpp')).toBe(true);
  });

  it('Staf tidak melihat omzet, laporan, maupun persediaan penuh', () => {
    const staf = izin('STAF_PENJUALAN');
    expect(staf.has('dashboard.omzet')).toBe(false);
    expect(staf.has('laporan.penjualan')).toBe(false);
    expect(staf.has('persediaan.stok.lihat')).toBe(false);
    expect(staf.has('persediaan.stok.lihat_tersedia')).toBe(true);
  });
});

describe('CSRF', () => {
  it('POST bergaya form dari origin lain ditolak 403', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://situs-jahat.example',
      },
      body: 'username=owner&password=apa-saja',
    });
    expect(res.status).toBe(403);
    expect((await json(res)).error?.kode).toBe('TIDAK_BERIZIN');
  });
});
