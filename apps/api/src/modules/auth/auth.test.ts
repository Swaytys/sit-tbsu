import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aturKonfigurasi,
  buatPenggunaUji,
  cookieSesi,
  json,
  loginUji,
  minta,
  PASSWORD_UJI,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { db } from '../../db/client';
import { logAktivitas, pengguna, sesiLogin } from '../../db/schema';
import { hashToken } from './token';

type Galat = { error: { kode: string; pesan: string } };

async function logTerakhir() {
  const [baris] = await db.select().from(logAktivitas).orderBy(desc(logAktivitas.id)).limit(1);
  return baris;
}

function loginSalah(username: string) {
  return minta('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'password-salah-sekali' },
  });
}

beforeEach(siapkanDatabaseSistem);

describe('auth › login', () => {
  it('berhasil: cookie httpOnly SameSite=Lax, sesi disimpan sebagai hash, log LOGIN_SUKSES', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    const res = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: p.username, password: PASSWORD_UJI },
    });

    expect(res.status).toBe(200);
    const body = await json<{ data: { username: string; peran: string; izin: string[] } }>(res);
    expect(body.data).toMatchObject({ username: p.username, peran: 'KASIR' });
    expect(body.data.izin).toContain('penjualan.checkout');
    expect(body.data.izin).not.toContain('master.barang.lihat_hpp');
    // docs/04 §5: password_hash tidak pernah dikirim API.
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toContain('$argon2');

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    const token = cookieSesi(res).split('=')[1] ?? '';
    const [sesi] = await db.select().from(sesiLogin).where(eq(sesiLogin.idPengguna, p.id));
    expect(sesi?.tokenHash).toBe(hashToken(token));
    expect(sesi?.tokenHash).not.toBe(token);

    expect(await logTerakhir()).toMatchObject({ aksi: 'LOGIN_SUKSES', idPengguna: p.id });
  });

  it('username tidak peka huruf besar/kecil dan spasi di tepi', async () => {
    const p = await buatPenggunaUji({ peran: 'STAF_PENJUALAN', username: 'budi.s' });
    const res = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: '  Budi.S ', password: PASSWORD_UJI },
    });
    expect(res.status).toBe(200);
    expect((await json<{ data: { id: number } }>(res)).data.id).toBe(p.id);
  });

  it('password salah → 401 pesan umum, hitungan gagal bertambah, log LOGIN_GAGAL', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    const res = await loginSalah(p.username);

    expect(res.status).toBe(401);
    expect((await json<Galat>(res)).error).toEqual({
      kode: 'BELUM_LOGIN',
      pesan: 'Username atau password salah.',
    });
    const [baris] = await db.select().from(pengguna).where(eq(pengguna.id, p.id));
    expect(baris?.gagalLoginBerturut).toBe(1);
    expect(await logTerakhir()).toMatchObject({ aksi: 'LOGIN_GAGAL', idPengguna: p.id });
  });

  it('username tidak dikenal → pesan sama, log LOGIN_GAGAL tanpa id pengguna', async () => {
    const res = await loginSalah('tidak.ada');
    expect(res.status).toBe(401);
    expect((await json<Galat>(res)).error.pesan).toBe('Username atau password salah.');
    expect(await logTerakhir()).toMatchObject({
      aksi: 'LOGIN_GAGAL',
      idPengguna: null,
      usernamePercobaan: 'tidak.ada',
    });
  });

  it('5 kali salah berturut → akun dikunci 15 menit; password benar pun ditolak (docs/04 §7)', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    for (let i = 0; i < 4; i++) expect((await loginSalah(p.username)).status).toBe(401);

    const kelima = await loginSalah(p.username);
    expect((await json<Galat>(kelima)).error.pesan).toMatch(/dikunci sampai pukul \d{2}:\d{2}/);

    const [baris] = await db.select().from(pengguna).where(eq(pengguna.id, p.id));
    const menitKunci = ((baris?.terkunciSampai?.getTime() ?? 0) - Date.now()) / 60_000;
    expect(menitKunci).toBeGreaterThan(14);
    expect(menitKunci).toBeLessThanOrEqual(15);

    const benar = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: p.username, password: PASSWORD_UJI },
    });
    expect(benar.status).toBe(401);
    expect((await json<Galat>(benar)).error.pesan).toMatch(/Akun terkunci sampai pukul/);
  });

  it('batas gagal dan lama kunci dibaca dari konfigurasi', async () => {
    await aturKonfigurasi({ login_maks_gagal: '2', login_kunci_menit: '30' });
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    await loginSalah(p.username);
    const kedua = await loginSalah(p.username);
    expect((await json<Galat>(kedua)).error.pesan).toMatch(/Password salah 2 kali/);
    const [baris] = await db.select().from(pengguna).where(eq(pengguna.id, p.id));
    const menitKunci = ((baris?.terkunciSampai?.getTime() ?? 0) - Date.now()) / 60_000;
    expect(menitKunci).toBeGreaterThan(29);
  });

  it('login berhasil mereset hitungan gagal', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    await loginSalah(p.username);
    await loginSalah(p.username);
    await loginUji(p.username);
    const [baris] = await db.select().from(pengguna).where(eq(pengguna.id, p.id));
    expect(baris?.gagalLoginBerturut).toBe(0);
    expect(baris?.loginTerakhir).not.toBeNull();
  });

  it('akun nonaktif tidak bisa login', async () => {
    const p = await buatPenggunaUji({ peran: 'ADMIN', statusAktif: 'NONAKTIF' });
    const res = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: p.username, password: PASSWORD_UJI },
    });
    expect(res.status).toBe(401);
    expect((await json<Galat>(res)).error.pesan).toBe('Akun Anda nonaktif. Hubungi Owner.');
  });

  // Setiap percobaan menjalankan argon2 tiruan (penyamaan waktu), jadi tes ini butuh waktu lebih.
  it('rate limit: percobaan ke-21 dalam semenit dari IP yang sama → 429', async () => {
    for (let i = 0; i < 20; i++) expect((await loginSalah('tidak.ada')).status).toBe(401);
    const ke21 = await loginSalah('tidak.ada');
    expect(ke21.status).toBe(429);
    expect((await json<Galat>(ke21)).error.kode).toBe('TERLALU_BANYAK_PERCOBAAN');
  }, 60_000);

  it('input kosong ditolak dengan pesan validasi Bahasa Indonesia', async () => {
    const res = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: '', password: '' },
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error).toMatchObject({
      kode: 'VALIDASI',
      pesan: 'Username wajib diisi.',
    });
  });
});

describe('auth › sesi', () => {
  it('GET /api/auth/saya tanpa cookie → 401 BELUM_LOGIN', async () => {
    const res = await minta('/api/auth/saya');
    expect(res.status).toBe(401);
    expect((await json<Galat>(res)).error.kode).toBe('BELUM_LOGIN');
  });

  it('GET /api/auth/saya mengembalikan pengguna dan izinnya', async () => {
    const { pengguna: p, cookie } = await sesiUji('OWNER');
    const res = await minta('/api/auth/saya', { cookie });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: number; izin: string[] } }>(res);
    expect(body.data.id).toBe(p.id);
    expect(body.data.izin).toContain('master.pengguna.kelola');
  });

  it('sesi menganggur melewati batas idle (60 menit) berakhir dan dicabut', async () => {
    const { pengguna: p, cookie } = await sesiUji('KASIR');
    await db
      .update(sesiLogin)
      .set({ terakhirAktif: new Date(Date.now() - 61 * 60_000) })
      .where(eq(sesiLogin.idPengguna, p.id));

    expect((await minta('/api/auth/saya', { cookie })).status).toBe(401);
    const [sesi] = await db.select().from(sesiLogin).where(eq(sesiLogin.idPengguna, p.id));
    expect(sesi?.alasanCabut).toBe('IDLE');
    expect(sesi?.dicabutPada).not.toBeNull();
  });

  it('sesi melewati batas absolut berakhir walau terus dipakai', async () => {
    const { pengguna: p, cookie } = await sesiUji('KASIR');
    await db
      .update(sesiLogin)
      .set({ kadaluarsaAbsolut: new Date(Date.now() - 60_000) })
      .where(eq(sesiLogin.idPengguna, p.id));

    expect((await minta('/api/auth/saya', { cookie })).status).toBe(401);
    const [sesi] = await db.select().from(sesiLogin).where(eq(sesiLogin.idPengguna, p.id));
    expect(sesi?.alasanCabut).toBe('KADALUARSA');
  });

  it('logout mencabut sesi: cookie lama tidak berlaku lagi, log LOGOUT', async () => {
    const { pengguna: p, cookie } = await sesiUji('KASIR');
    const res = await minta('/api/auth/logout', { method: 'POST', cookie });
    expect(res.status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie })).status).toBe(401);
    expect(await logTerakhir()).toMatchObject({ aksi: 'LOGOUT', idPengguna: p.id });
  });

  it('pengguna yang dinonaktifkan kehilangan sesinya', async () => {
    const { pengguna: p, cookie } = await sesiUji('KASIR');
    await db.update(pengguna).set({ statusAktif: 'NONAKTIF' }).where(eq(pengguna.id, p.id));
    expect((await minta('/api/auth/saya', { cookie })).status).toBe(401);
  });
});

describe('auth › ganti password', () => {
  it('password lama salah ditolak', async () => {
    const { cookie } = await sesiUji('KASIR');
    const res = await minta('/api/auth/ganti-password', {
      method: 'POST',
      cookie,
      body: {
        passwordLama: 'bukan-ini',
        passwordBaru: 'password-baru-1',
        konfirmasi: 'password-baru-1',
      },
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Password lama salah.');
  });

  it('berhasil: password baru berlaku, sesi lain dicabut, sesi ini tetap, log tercatat', async () => {
    const { pengguna: p, cookie } = await sesiUji('KASIR');
    const cookieLain = await loginUji(p.username);

    const res = await minta('/api/auth/ganti-password', {
      method: 'POST',
      cookie,
      body: {
        passwordLama: PASSWORD_UJI,
        passwordBaru: 'password-baru-1',
        konfirmasi: 'password-baru-1',
      },
    });
    expect(res.status).toBe(200);

    expect((await minta('/api/auth/saya', { cookie })).status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie: cookieLain })).status).toBe(401);
    await expect(loginUji(p.username)).rejects.toThrow();
    await expect(loginUji(p.username, 'password-baru-1')).resolves.toContain('sit_sesi=');
    const [logGanti] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGGUNA_GANTI_PASSWORD'));
    expect(logGanti?.idPengguna).toBe(p.id);
  });

  it('password baru lebih pendek dari konfigurasi.password_min ditolak', async () => {
    await aturKonfigurasi({ password_min: '12' });
    const { cookie } = await sesiUji('KASIR');
    const res = await minta('/api/auth/ganti-password', {
      method: 'POST',
      cookie,
      body: { passwordLama: PASSWORD_UJI, passwordBaru: 'pendek-10c', konfirmasi: 'pendek-10c' },
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Password minimal 12 karakter.');
  });

  it('wajib ganti password: rute lain 403 sampai password diganti', async () => {
    const { cookie } = await sesiUji('ADMIN', { wajibGantiPassword: true });

    const diblok = await minta('/api/satuan', { cookie });
    expect(diblok.status).toBe(403);
    expect((await json<Galat>(diblok)).error.kode).toBe('WAJIB_GANTI_PASSWORD');
    expect((await minta('/api/auth/saya', { cookie })).status).toBe(200);

    await minta('/api/auth/ganti-password', {
      method: 'POST',
      cookie,
      body: {
        passwordLama: PASSWORD_UJI,
        passwordBaru: 'password-baru-1',
        konfirmasi: 'password-baru-1',
      },
    });
    expect((await minta('/api/satuan', { cookie })).status).toBe(200);
  });
});
