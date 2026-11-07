import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import forge from 'node-forge';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { app } from '../../../app';
import { perangkatLan } from '../../../db/schema';
import { pastikanSertifikatLan } from './sertifikat-lan';

type Data<T> = { data: T };
const folder = mkdtempSync(path.join(tmpdir(), 'bonsai-lan-'));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe('sertifikat toko mode LAN (K-229)', () => {
  it('CA toko menandatangani sertifikat server untuk IP komputer; IP baru = sertifikat server baru, CA tetap', () => {
    const a = pastikanSertifikatLan(folder, 'UD Uji', ['192.168.1.10']);
    const ca = forge.pki.certificateFromPem(a.caPem);
    const server = forge.pki.certificateFromPem(a.cert);
    expect(ca.verify(server)).toBe(true);
    const san = server.getExtension('subjectAltName') as { altNames: { ip?: string }[] };
    expect(san.altNames.map((x) => x.ip)).toContain('192.168.1.10');
    expect(a.sidikJari).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);

    const b = pastikanSertifikatLan(folder, 'UD Uji', ['192.168.1.10']);
    expect(b.cert).toBe(a.cert);
    const c = pastikanSertifikatLan(folder, 'UD Uji', ['10.0.0.5']);
    expect(c.cert).not.toBe(a.cert);
    expect(c.sidikJari).toBe(a.sidikJari);
  });
});

const ASAL_LAN = 'https://192.168.1.10:7443';
function mintaLan(p: string, opsi: { method?: string; cookie?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    origin: ASAL_LAN,
    'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/140',
  };
  if (opsi.cookie) headers.cookie = opsi.cookie;
  if (opsi.body !== undefined) headers['content-type'] = 'application/json';
  return app.fetch(
    new Request(`${ASAL_LAN}${p}`, {
      method: opsi.method ?? 'GET',
      headers,
      body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
    }),
    { jalurLan: true },
  );
}

describe('perangkat terdaftar mode LAN (K-229)', () => {
  beforeEach(async () => {
    await siapkanDatabaseSistem();
    await kosongkanTabel(perangkatLan);
  });

  it('API lewat LAN ditolak sampai perangkat disetujui; Kasir tidak bisa menyetujui; dicabut = ditolak lagi', async () => {
    const tolak = await mintaLan('/api/auth/saya');
    expect(tolak.status).toBe(403);
    expect((await json<{ error: { kode: string } }>(tolak)).error.kode).toBe(
      'PERANGKAT_BELUM_DISETUJUI',
    );

    const daftar = await mintaLan('/api/perangkat/daftar', { method: 'POST' });
    expect(daftar.status).toBe(200);
    const { kode, status } = (await json<Data<{ kode: string; status: string }>>(daftar)).data;
    expect(status).toBe('MENUNGGU');
    expect(kode).toMatch(/^\d{6}$/);
    const cookie = daftar.headers.getSetCookie()[0]!.split(';')[0]!;
    expect(daftar.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);
    // Daftar ulang dengan cookie yang sama tidak membuat perangkat baru.
    const ulang = await mintaLan('/api/perangkat/daftar', { method: 'POST', cookie });
    expect((await json<Data<{ kode: string }>>(ulang)).data.kode).toBe(kode);

    const kasir = await sesiUji('KASIR');
    const owner = await sesiUji('OWNER');
    const lan = await json<Data<{ perangkat: { id: number; kode: string }[] }>>(
      await minta('/api/akses-perangkat/lan', { cookie: owner.cookie }),
    );
    const id = lan.data.perangkat.find((p) => p.kode === kode)!.id;
    expect(
      (
        await minta(`/api/akses-perangkat/lan/perangkat/${id}/setujui`, {
          method: 'POST',
          cookie: kasir.cookie,
        })
      ).status,
    ).toBe(403);
    const setuju = await minta(`/api/akses-perangkat/lan/perangkat/${id}/setujui`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(setuju.status).toBe(200);

    // Disetujui: penjaga perangkat lolos (belum masuk = 401, bukan 403 perangkat).
    expect((await mintaLan('/api/auth/saya', { cookie })).status).not.toBe(403);
    // Perangkat lain tanpa cookie tetap ditolak.
    expect((await mintaLan('/api/auth/saya')).status).toBe(403);
    // Server utama (bukan LAN) tidak terpengaruh.
    expect((await minta('/api/auth/saya')).status).toBe(401);

    const cabut = await minta(`/api/akses-perangkat/lan/perangkat/${id}/cabut`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(cabut.status).toBe(200);
    expect((await mintaLan('/api/auth/saya', { cookie })).status).toBe(403);
  });
});
