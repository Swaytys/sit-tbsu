import { describe, expect, it, vi } from 'vitest';
import { app } from '../../../app';
import type * as RepoHealth from './repo';

// `ping` asli dipakai, kecuali satu tes yang mensimulasikan database mati.
const ping = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock('./repo', async (importOriginal) => {
  const asli = await importOriginal<typeof RepoHealth>();
  ping.mockImplementation(asli.ping);
  return { ping };
});

describe('GET /api/health', () => {
  it('200 dan melaporkan database ok (tanpa login)', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: 'ok', db: 'ok' } });
  });

  it('503 dengan format error standar bila database tidak dapat dihubungi', async () => {
    ping.mockRejectedValueOnce(new Error('koneksi putus'));
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: { kode: 'INTERNAL', pesan: 'Database tidak dapat dihubungi.' },
    });
  });
});

describe('rute tidak dikenal', () => {
  it('404 dengan format error standar', async () => {
    const res = await app.request('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { kode: 'TIDAK_DITEMUKAN', pesan: 'Alamat API tidak ditemukan.' },
    });
  });
});
