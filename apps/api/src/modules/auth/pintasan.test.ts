import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';

type Data<T> = { data: T };

beforeEach(siapkanDatabaseSistem);

describe('pintasan keyboard per pengguna (K-145)', () => {
  it('tersimpan di akun sendiri; dobel dan tombol peramban ditolak; tanpa login ditolak', async () => {
    const kasir = await sesiUji('KASIR');
    const staf = await sesiUji('STAF_PENJUALAN');

    const awal = await json<Data<Record<string, string>>>(
      await minta('/api/auth/pintasan', { cookie: kasir.cookie }),
    );
    expect(awal.data).toEqual({});

    const simpan = (cookie: string, body: unknown) =>
      minta('/api/auth/pintasan', { method: 'PUT', cookie, body });
    expect((await simpan(kasir.cookie, { KASIR_CARI: 'F8' })).status).toBe(400);
    expect((await simpan(kasir.cookie, { KASIR_CARI: 'F5' })).status).toBe(400);
    const ok = await simpan(kasir.cookie, { KASIR_CARI: 'F6', ORDER_DAFTAR: 'F6' });
    expect(ok.status).toBe(200);
    expect((await json<Data<Record<string, string>>>(ok)).data).toEqual({
      KASIR_CARI: 'F6',
      ORDER_DAFTAR: 'F6',
    });

    // Pengguna lain tidak terpengaruh.
    const lain = await json<Data<Record<string, string>>>(
      await minta('/api/auth/pintasan', { cookie: staf.cookie }),
    );
    expect(lain.data).toEqual({});
    expect((await minta('/api/auth/pintasan')).status).toBe(401);
  });
});
