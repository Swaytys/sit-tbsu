import { describe, expect, it, vi } from 'vitest';
import { VERSI_APLIKASI } from '@sit/shared';
import { app } from '../../../app';
import type * as RepoHealth from './repo';

// `ping` asli dipakai, kecuali satu tes yang mensimulasikan database mati.
const ping = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock('./repo', async (importOriginal) => {
  const asli = await importOriginal<typeof RepoHealth>();
  ping.mockImplementation(asli.ping);
  return { ...asli, ping };
});

describe('GET /api/health', () => {
  it('200 dan melaporkan database ok (tanpa login)', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const isi = (await res.json()) as {
      data: { status: string; versi: string; migrasi: { terpasang: number; tersedia: number } };
    };
    expect(isi.data).toMatchObject({ status: 'ok', db: 'ok', versi: VERSI_APLIKASI });
    // Database uji sudah dimigrasi penuh: semua migrasi yang dibawa aplikasi terpasang.
    expect(isi.data.migrasi.terpasang).toBe(isi.data.migrasi.tersedia);
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
