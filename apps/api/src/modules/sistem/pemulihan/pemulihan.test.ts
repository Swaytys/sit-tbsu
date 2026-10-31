import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { shiftKasir } from '../../../db/schema';
import { env } from '../../../env';

const berkas = path.join(os.tmpdir(), 'bonsaiurip-uji-mati-mendadak.json');

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(shiftKasir);
  env.MATI_MENDADAK_FILE = berkas;
});

afterEach(async () => {
  env.MATI_MENDADAK_FILE = undefined;
  await rm(berkas, { force: true });
});

describe('pemulihan setelah mati mendadak (K-216) dan status shift di health (K-215)', () => {
  it('catatan peluncur dibaca semua pengguna; ditandai selesai oleh pemegang shift', async () => {
    const staf = await sesiUji('STAF_PENJUALAN');
    const kosong = await json<{ data: unknown }>(
      await minta('/api/pemulihan', { cookie: staf.cookie }),
    );
    expect(kosong.data).toBeNull();

    await writeFile(
      berkas,
      JSON.stringify({
        terdeteksi: '2026-10-31T08:00:00.000Z',
        terakhirHidup: null,
        shift: 'SHF-261031-001',
      }),
    );
    const ada = await json<{ data: { shift: string } }>(
      await minta('/api/pemulihan', { cookie: staf.cookie }),
    );
    expect(ada.data.shift).toBe('SHF-261031-001');
    expect(
      (await minta('/api/pemulihan/selesai', { method: 'POST', cookie: staf.cookie })).status,
    ).toBe(403);

    const kasir = await sesiUji('KASIR');
    expect(
      (await minta('/api/pemulihan/selesai', { method: 'POST', cookie: kasir.cookie })).status,
    ).toBe(200);
    expect(existsSync(berkas)).toBe(false);
  });

  it('health melaporkan ada shift terbuka (tanpa rincian)', async () => {
    const health = async () =>
      (await json<{ data: { shiftTerbuka: boolean } }>(await minta('/api/health'))).data
        .shiftTerbuka;
    expect(await health()).toBe(false);
    const kasir = await sesiUji('KASIR');
    const buka = await minta('/api/shift/buka', {
      method: 'POST',
      cookie: kasir.cookie,
      body: { modalAwal: 0 },
    });
    expect(buka.status).toBe(201);
    expect(await health()).toBe(true);
  });
});
