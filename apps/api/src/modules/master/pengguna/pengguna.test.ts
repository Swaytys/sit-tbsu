import { and, desc, eq, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buatPenggunaUji,
  json,
  loginUji,
  minta,
  PASSWORD_UJI,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { logAktivitas, pengguna, sesiLogin } from '../../../db/schema';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Pengguna = {
  id: number;
  kode: string;
  username: string;
  peran: string;
  statusAktif: string;
  wajibGantiPassword: boolean;
  sesiAktif: number;
};

const BARU = {
  namaPengguna: 'Siti Rahayu',
  username: 'Siti.R',
  peran: 'KASIR',
  noHp: '0857-1234-1234',
  password: 'awal-siti-123',
};

let owner: Awaited<ReturnType<typeof sesiUji>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  owner = await sesiUji('OWNER');
});

function tambah(body: unknown = BARU) {
  return minta('/api/pengguna', { method: 'POST', cookie: owner.cookie, body });
}

async function logTerakhir(aksi: string) {
  const [baris] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return baris;
}

describe('pengguna › izin (docs/04 §3: hanya Owner)', () => {
  it('Admin dan Kasir ditolak 403; tanpa login 401', async () => {
    for (const peran of ['ADMIN', 'KASIR'] as const) {
      const { cookie } = await sesiUji(peran);
      const res = await minta('/api/pengguna', { cookie });
      expect(res.status).toBe(403);
      expect((await json<Galat>(res)).error.kode).toBe('TIDAK_BERIZIN');
    }
    expect((await minta('/api/pengguna')).status).toBe(401);
  });
});

describe('pengguna › tambah', () => {
  it('kode dari penomoran, username huruf kecil, wajib ganti password, log tanpa password', async () => {
    const res = await tambah();
    expect(res.status).toBe(201);
    const { data } = await json<{ data: Pengguna }>(res);
    expect(data).toMatchObject({
      kode: 'USR-00001',
      username: 'siti.r',
      peran: 'KASIR',
      statusAktif: 'AKTIF',
      wajibGantiPassword: true,
    });
    expect(data).not.toHaveProperty('passwordHash');

    const log = await logTerakhir('PENGGUNA_BUAT');
    expect(log).toMatchObject({ idPengguna: owner.pengguna.id, idEntitas: data.id });
    expect(JSON.stringify(log)).not.toContain('awal-siti-123');
    expect(JSON.stringify(log)).not.toContain('$argon2');

    // Pengguna baru bisa login dan diwajibkan mengganti password.
    const cookie = await loginUji('siti.r', 'awal-siti-123');
    const saya = await json<{ data: { wajibGantiPassword: boolean } }>(
      await minta('/api/auth/saya', { cookie }),
    );
    expect(saya.data.wajibGantiPassword).toBe(true);
  });

  it('username yang sudah dipakai → 409 KONFLIK dengan pesan di kolom username', async () => {
    await tambah();
    const res = await tambah({ ...BARU, username: 'siti.r', namaPengguna: 'Siti Lain' });
    expect(res.status).toBe(409);
    const galat = await json<Galat>(res);
    expect(galat.error.kode).toBe('KONFLIK');
    expect(galat.error.detail?.kolom?.username?.[0]).toBe('Username "siti.r" sudah dipakai.');
  });

  it('input tidak valid ditolak dengan pesan Bahasa Indonesia', async () => {
    const res = await tambah({ ...BARU, username: 'ab', password: 'pendek' });
    expect(res.status).toBe(400);
    const galat = await json<Galat>(res);
    expect(galat.error.detail?.kolom?.username?.[0]).toBe('Username minimal 3 karakter.');
    expect(galat.error.detail?.kolom?.password?.[0]).toBe('Password minimal 8 karakter.');
  });
});

describe('pengguna › daftar', () => {
  it('berhalaman, bisa dicari, dan bisa disaring status', async () => {
    await tambah();
    await tambah({ ...BARU, username: 'budi.s', namaPengguna: 'Budi Santoso', peran: 'ADMIN' });

    const semua = await json<{ data: Pengguna[]; meta: { total: number } }>(
      await minta('/api/pengguna?perHalaman=2', { cookie: owner.cookie }),
    );
    expect(semua.meta).toEqual({ total: 3, halaman: 1, perHalaman: 2 });
    expect(semua.data).toHaveLength(2);

    const cari = await json<{ data: Pengguna[] }>(
      await minta('/api/pengguna?cari=budi', { cookie: owner.cookie }),
    );
    expect(cari.data.map((p) => p.username)).toEqual(['budi.s']);

    const nonaktif = await json<{ data: Pengguna[] }>(
      await minta('/api/pengguna?status=NONAKTIF', { cookie: owner.cookie }),
    );
    expect(nonaktif.data).toHaveLength(0);
  });

  it('karakter khusus pencarian (%, _) dicari apa adanya', async () => {
    await tambah();
    const res = await json<{ data: Pengguna[] }>(
      await minta('/api/pengguna?cari=%25', { cookie: owner.cookie }),
    );
    expect(res.data).toHaveLength(0);
  });
});

describe('pengguna › ubah', () => {
  it('log PENGGUNA_UBAH mencatat nilai lama dan baru yang berubah saja', async () => {
    const { data } = await json<{ data: Pengguna }>(await tambah());
    const res = await minta(`/api/pengguna/${data.id}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: { namaPengguna: 'Siti Rahayu', username: 'siti.r', peran: 'ADMIN', noHp: '' },
    });
    expect(res.status).toBe(200);
    expect((await json<{ data: Pengguna }>(res)).data.peran).toBe('ADMIN');

    const log = await logTerakhir('PENGGUNA_UBAH');
    expect(log?.dataLama).toEqual({ peran: 'KASIR', noHp: '0857-1234-1234' });
    expect(log?.dataBaru).toEqual({ peran: 'ADMIN', noHp: null });
  });

  it('pengguna tidak dikenal → 404', async () => {
    const res = await minta('/api/pengguna/999999', {
      method: 'PATCH',
      cookie: owner.cookie,
      body: { namaPengguna: 'X', username: 'xxx', peran: 'KASIR' },
    });
    expect(res.status).toBe(404);
  });
});

describe('pengguna › Owner terakhir (docs/04 §7)', () => {
  it('satu-satunya Owner aktif tidak bisa diturunkan perannya', async () => {
    const res = await minta(`/api/pengguna/${owner.pengguna.id}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: { namaPengguna: 'Owner', username: owner.pengguna.username, peran: 'ADMIN' },
    });
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.pesan).toMatch(/satu-satunya Owner aktif/);
  });

  it('dua Owner saling menonaktifkan bersamaan → hanya satu berhasil, tetap ada Owner aktif', async () => {
    const ownerLain = await buatPenggunaUji({ peran: 'OWNER' });
    const cookieLain = await loginUji(ownerLain.username);

    const [a, b] = await Promise.all([
      minta(`/api/pengguna/${ownerLain.id}/nonaktifkan`, { method: 'POST', cookie: owner.cookie }),
      minta(`/api/pengguna/${owner.pengguna.id}/nonaktifkan`, {
        method: 'POST',
        cookie: cookieLain,
      }),
    ]);
    // Yang kalah ditolak 409 (Owner terakhir) atau 401 (sesinya sudah dicabut lebih dulu),
    // tergantung urutan waktu; yang penting hanya satu yang berhasil.
    const status = [a.status, b.status].sort();
    expect(status[0]).toBe(200);
    expect([401, 409]).toContain(status[1]);

    const ownerAktif = await db
      .select()
      .from(pengguna)
      .where(and(eq(pengguna.peran, 'OWNER'), eq(pengguna.statusAktif, 'AKTIF')));
    expect(ownerAktif).toHaveLength(1);
  });

  it('tidak bisa menonaktifkan akun sendiri', async () => {
    await buatPenggunaUji({ peran: 'OWNER' });
    const res = await minta(`/api/pengguna/${owner.pengguna.id}/nonaktifkan`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.pesan).toBe(
      'Anda tidak bisa menonaktifkan akun sendiri.',
    );
  });
});

describe('pengguna › nonaktif, aktifkan, reset password, cabut sesi', () => {
  it('menonaktifkan mencabut semua sesi pengguna itu seketika', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(200);

    const res = await minta(`/api/pengguna/${kasir.pengguna.id}/nonaktifkan`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(res.status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(401);
    await expect(loginUji(kasir.pengguna.username)).rejects.toThrow();
    expect(await logTerakhir('PENGGUNA_NONAKTIF')).toMatchObject({ idEntitas: kasir.pengguna.id });

    const lagi = await minta(`/api/pengguna/${kasir.pengguna.id}/nonaktifkan`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(lagi.status).toBe(409);
  });

  it('mengaktifkan kembali: bisa login lagi dan kunci gagal login dibuka', async () => {
    const kasir = await buatPenggunaUji({ peran: 'KASIR', statusAktif: 'NONAKTIF' });
    await db
      .update(pengguna)
      .set({ terkunciSampai: new Date(Date.now() + 3_600_000), gagalLoginBerturut: 3 })
      .where(eq(pengguna.id, kasir.id));

    const res = await minta(`/api/pengguna/${kasir.id}/aktifkan`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(res.status).toBe(200);
    await expect(loginUji(kasir.username)).resolves.toContain('sit_sesi=');
    expect(await logTerakhir('PENGGUNA_AKTIFKAN')).toMatchObject({ idEntitas: kasir.id });
  });

  it('reset password: sesi lama dicabut, password baru berlaku, wajib ganti saat login', async () => {
    const kasir = await sesiUji('KASIR');
    const res = await minta(`/api/pengguna/${kasir.pengguna.id}/reset-password`, {
      method: 'POST',
      cookie: owner.cookie,
      body: { passwordBaru: 'reset-oleh-owner' },
    });
    expect(res.status).toBe(200);
    expect((await json<{ data: Pengguna }>(res)).data.wajibGantiPassword).toBe(true);

    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(401);
    await expect(loginUji(kasir.pengguna.username, PASSWORD_UJI)).rejects.toThrow();
    const cookieBaru = await loginUji(kasir.pengguna.username, 'reset-oleh-owner');
    expect((await minta('/api/satuan', { cookie: cookieBaru })).status).toBe(403);

    const log = await logTerakhir('PENGGUNA_RESET_PASSWORD');
    expect(JSON.stringify(log)).not.toContain('reset-oleh-owner');
  });

  it('reset password akun sendiri diarahkan ke menu Ganti password', async () => {
    const res = await minta(`/api/pengguna/${owner.pengguna.id}/reset-password`, {
      method: 'POST',
      cookie: owner.cookie,
      body: { passwordBaru: 'apa-saja-panjang' },
    });
    expect(res.status).toBe(409);
  });

  it('cabut sesi: semua sesi pengguna itu berakhir; sesi Owner sendiri yang dipakai tetap', async () => {
    const kasir = await sesiUji('KASIR');
    const res = await minta(`/api/pengguna/${kasir.pengguna.id}/cabut-sesi`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(res.status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(401);

    const sesiOwnerLain = await loginUji(owner.pengguna.username);
    await minta(`/api/pengguna/${owner.pengguna.id}/cabut-sesi`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect((await minta('/api/auth/saya', { cookie: owner.cookie })).status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie: sesiOwnerLain })).status).toBe(401);
    const aktif = await db
      .select()
      .from(sesiLogin)
      .where(and(eq(sesiLogin.idPengguna, owner.pengguna.id), isNull(sesiLogin.dicabutPada)));
    expect(aktif).toHaveLength(1);
  });
});
