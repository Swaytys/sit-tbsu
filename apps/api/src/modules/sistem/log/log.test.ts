import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { logAktivitas } from '../../../db/schema';

type Log = { aksi: string; namaPengguna: string | null; ringkasan: string | null };

let owner: Awaited<ReturnType<typeof sesiUji>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  owner = await sesiUji('OWNER');
});

describe('log aktivitas (docs/04 §8)', () => {
  it('hanya Owner yang boleh melihat log', async () => {
    const admin = await sesiUji('ADMIN');
    expect((await minta('/api/log-aktivitas', { cookie: admin.cookie })).status).toBe(403);
    expect((await minta('/api/log-aktivitas', { cookie: owner.cookie })).status).toBe(200);
  });

  it('terbaru lebih dulu, dengan nama pengguna; bisa dicari dan disaring aksi', async () => {
    await db.insert(logAktivitas).values([
      { aksi: 'PENGGUNA_BUAT', idPengguna: owner.pengguna.id, ringkasan: 'Menambah Siti' },
      { aksi: 'LOGIN_GAGAL', idPengguna: null, usernamePercobaan: 'penyusup', ringkasan: 'x' },
    ]);

    const semua = await json<{ data: Log[]; meta: { total: number } }>(
      await minta('/api/log-aktivitas', { cookie: owner.cookie }),
    );
    // Login owner di beforeEach juga tercatat (LOGIN_SUKSES).
    expect(semua.meta.total).toBe(3);
    expect(semua.data[0]?.aksi).toBe('LOGIN_GAGAL');

    const cari = await json<{ data: Log[] }>(
      await minta('/api/log-aktivitas?cari=siti', { cookie: owner.cookie }),
    );
    expect(cari.data).toHaveLength(1);
    expect(cari.data[0]?.namaPengguna).toBe(owner.pengguna.namaPengguna);

    const saring = await json<{ data: Log[] }>(
      await minta('/api/log-aktivitas?aksi=LOGIN_SUKSES', { cookie: owner.cookie }),
    );
    expect(saring.data.map((l) => l.aksi)).toEqual(['LOGIN_SUKSES']);
  });

  it('log tidak bisa diubah atau dihapus lewat API (tidak ada rutenya)', async () => {
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
      const res = await minta('/api/log-aktivitas', { method, cookie: owner.cookie });
      expect(res.status).toBe(404);
    }
  });

  it('ekspor Excel: saringan dan rentang tanggal, dicatat; Admin ditolak; tanggal terbalik ditolak', async () => {
    await db.insert(logAktivitas).values([
      { aksi: 'PENGGUNA_BUAT', idPengguna: owner.pengguna.id, ringkasan: 'Menambah Siti' },
      {
        aksi: 'PENGGUNA_BUAT',
        idPengguna: owner.pengguna.id,
        ringkasan: 'Lama sekali',
        waktu: new Date('2020-01-15T03:00:00Z'),
      },
    ]);
    const admin = await sesiUji('ADMIN');
    expect((await minta('/api/log-aktivitas/ekspor', { cookie: admin.cookie })).status).toBe(403);

    const res = await minta(
      '/api/log-aktivitas/ekspor?aksi=PENGGUNA_BUAT&dari=2020-01-01&sampai=2020-01-31',
      {
        cookie: owner.cookie,
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain(
      'log-aktivitas-2020-01-01-sd-2020-01-31.xlsx',
    );
    const { muatXlsx } = await import('../../../lib/excel');
    const wb = await muatXlsx(new Uint8Array(await res.arrayBuffer()));
    const ws = wb.worksheets[0]!;
    expect(ws.rowCount).toBe(2); // judul + 1 baris (hanya log Januari 2020)
    expect(ws.getRow(2).getCell(6).text).toBe('Lama sekali');

    const catatan = await json<{ data: Log[] }>(
      await minta('/api/log-aktivitas?aksi=LAPORAN_EKSPOR', { cookie: owner.cookie }),
    );
    expect(catatan.data[0]?.ringkasan).toContain('Ekspor Excel log aktivitas (1 baris)');

    const terbalik = await minta('/api/log-aktivitas/ekspor?dari=2020-02-01&sampai=2020-01-01', {
      cookie: owner.cookie,
    });
    expect(terbalik.status).toBe(400);
  });
});
