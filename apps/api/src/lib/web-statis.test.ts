import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import type { EnvApp } from './konteks';
import { webStatis } from './web-statis';

const folder = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
mkdirSync(path.join(folder, 'assets'));
writeFileSync(path.join(folder, 'index.html'), '<!doctype html><title>BonsaiUrip</title>');
writeFileSync(path.join(folder, 'assets', 'index-abc.js'), 'console.info(1)');
afterAll(() => rmSync(folder, { recursive: true, force: true }));

function aplikasiUji() {
  const a = new Hono<EnvApp>();
  a.get('/api/health', (c) => c.json({ ok: true }));
  for (const m of webStatis(folder)) a.use('*', m);
  a.notFound((c) => c.text('tidak ada', 404));
  return a;
}

describe('produksi: web statis (K-082)', () => {
  it('rute aplikasi → index.html tanpa cache; aset ber-hash di-cache lama; /api tidak disentuh', async () => {
    const a = aplikasiUji();
    const halaman = await a.request('/laporan?laporan=penjualan');
    expect(halaman.status).toBe(200);
    expect(halaman.headers.get('cache-control')).toBe('no-cache');
    expect(await halaman.text()).toContain('BonsaiUrip');

    const aset = await a.request('/assets/index-abc.js');
    expect(aset.status).toBe(200);
    expect(aset.headers.get('cache-control')).toContain('immutable');

    expect(await (await a.request('/api/health')).json()).toEqual({ ok: true });
    expect((await a.request('/api/tidak-ada')).status).toBe(404);
    expect((await a.request('/favicon.ico')).status).toBe(404);
    expect((await a.request('/laporan', { method: 'POST' })).status).toBe(404);
  });

  it('folder build tidak ada → galat jelas saat menyala', () => {
    expect(() => webStatis(path.join(folder, 'tidak-ada'))).toThrow(/pnpm build/);
  });
});

describe('header keamanan & CSRF (K-083)', () => {
  it('CSP, X-Frame-Options, nosniff ada di setiap respons', async () => {
    const r = await app.request('/api/health');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('POST dari origin lain ditolak sebelum menyentuh data', async () => {
    const r = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://jahat.example',
      },
      body: 'username=a&password=b',
    });
    expect(r.status).toBe(403);
  });

  it('body JSON > 1 MB ditolak 413', async () => {
    const r = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'a', password: 'x'.repeat(1024 * 1024 + 10) }),
    });
    expect(r.status).toBe(413);
  });
});
