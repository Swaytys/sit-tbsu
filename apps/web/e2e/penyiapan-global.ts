import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

/*
 * Penyiapan sebelum seluruh tes e2e (K-106). Tes berjalan di database pengembangan dan menghitung dengan
 * harga tier dasar; tier lain yang sedang diaktifkan pemilik (mis. "Harga 23%" mulai belanja Rp 500.000)
 * mengubah total dan menggagalkan tes yang tidak ada hubungannya. Karena itu tier selain tier dasar
 * dinonaktifkan selama tes berjalan, lalu diaktifkan kembali sesudahnya.
 *
 * Daftar tier yang dinonaktifkan disimpan di berkas sementara. Bila tes terhenti paksa (mis. kehabisan
 * memori) sehingga pemulihan tidak sempat jalan, penyiapan berikutnya memulihkannya lebih dulu.
 */

const BERKAS = join(tmpdir(), 'tbsu-e2e-tier-dinonaktifkan.json');

type Tier = { id: number; nama: string; isDefault: boolean; statusAktif: string };

async function masukAdmin(baseURL: string): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const res = await api.post('/api/auth/masuk-cepat', { data: { peran: 'ADMIN' } });
  if (!res.ok()) {
    throw new Error(
      `Penyiapan e2e: masuk cepat Admin gagal (${res.status()}). Pastikan server pengembangan berjalan di ${baseURL} dan pnpm db:seed sudah dijalankan.`,
    );
  }
  return api;
}

async function aturStatus(api: APIRequestContext, id: number, statusAktif: 'AKTIF' | 'NONAKTIF') {
  const res = await api.patch(`/api/tingkat-harga/${id}/status`, { data: { statusAktif } });
  if (!res.ok()) {
    throw new Error(`Penyiapan e2e: tier ${id} → ${statusAktif} gagal: ${await res.text()}`);
  }
}

async function pulihkan(api: APIRequestContext): Promise<void> {
  if (!existsSync(BERKAS)) return;
  const id = JSON.parse(readFileSync(BERKAS, 'utf8')) as number[];
  for (const x of id) await aturStatus(api, x, 'AKTIF');
  rmSync(BERKAS);
}

export default async function penyiapanGlobal(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173';
  const api = await masukAdmin(baseURL);
  await pulihkan(api); // sisa penyiapan yang tidak sempat dipulihkan
  const res = await api.get('/api/tingkat-harga');
  const tier = ((await res.json()) as { data: Tier[] }).data;
  const dimatikan = tier.filter((t) => !t.isDefault && t.statusAktif === 'AKTIF');
  if (dimatikan.length > 0) {
    writeFileSync(BERKAS, JSON.stringify(dimatikan.map((t) => t.id)));
    for (const t of dimatikan) await aturStatus(api, t.id, 'NONAKTIF');
  }
  await api.dispose();

  // Nilai kembalian = pemulihan setelah semua tes selesai.
  return async () => {
    const lagi = await masukAdmin(baseURL);
    await pulihkan(lagi);
    await lagi.dispose();
  };
}
