import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PASSWORD_UJI,
  buatPenggunaUji,
  cookieSesi,
  json,
  loginUji,
  minta,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { db } from '../../db/client';
import { logAktivitas, pengguna } from '../../db/schema';

type Data<T> = { data: T };

beforeEach(async () => {
  await siapkanDatabaseSistem();
});

const akun = {
  namaPengguna: 'Pak Harto',
  username: 'Harto',
  password: 'rahasia-toko-1',
  konfirmasi: 'rahasia-toko-1',
};

export const usahaUji = {
  jenisUsaha: 'BAHAN_BANGUNAN',
  jenisUsahaLain: '',
  namaToko: 'Toko Maju Jaya',
  namaBadanUsaha: 'UD. Maju Jaya',
  sloganToko: 'Lengkap, murah, cepat',
  alamatToko: 'Jl. Merdeka 1',
  kotaToko: 'Kediri',
  telpToko: '(0354) 123456',
  emailToko: '',
};
export const operasionalUji = {
  layanan: ['LANGSUNG', 'ANTAR'],
  shiftJamBuka: '07:00',
  shiftJamTutup: '17:00',
};

/** K-205: setup awal menggantikan rute akun pertama K-191 (Owner + data usaha sekaligus). */
async function buatAkunPertama(isi: Record<string, unknown> = akun) {
  return minta('/api/auth/setup-awal', {
    method: 'POST',
    body: { usaha: usahaUji, operasional: operasionalUji, owner: { email: '', noHp: '', ...isi } },
  });
}

describe('akun pertama lewat setup awal (K-191, K-205)', () => {
  it('hanya selama belum ada pengguna: membuat Owner, langsung masuk, memberi kode pemulihan sekali', async () => {
    const awal = await json<Data<{ perluAkunPertama: boolean }>>(
      await minta('/api/auth/penyiapan'),
    );
    expect(awal.data.perluAkunPertama).toBe(true);

    const beda = await buatAkunPertama({ ...akun, konfirmasi: 'lain-sekali' });
    expect(beda.status).toBe(400);

    const res = await buatAkunPertama();
    expect(res.status).toBe(201);
    const hasil =
      await json<Data<{ pengguna: { peran: string; username: string }; kodePemulihan: string }>>(
        res,
      );
    expect(hasil.data.pengguna).toMatchObject({ peran: 'OWNER', username: 'harto' });
    expect(hasil.data.kodePemulihan).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    const cookie = cookieSesi(res);
    expect((await minta('/api/auth/saya', { cookie })).status).toBe(200);
    const [p] = await db.select().from(pengguna).where(eq(pengguna.username, 'harto'));
    expect(p?.wajibGantiPassword).toBe(false);
    expect(p?.kodePemulihanHash).not.toContain(hasil.data.kodePemulihan);
    const log = await db.select().from(logAktivitas).where(eq(logAktivitas.aksi, 'SETUP_AWAL'));
    expect(log).toHaveLength(1);

    const lagi = await buatAkunPertama({ ...akun, username: 'penyusup' });
    expect(lagi.status).toBe(409);
    expect(
      (await json<Data<{ perluAkunPertama: boolean }>>(await minta('/api/auth/penyiapan'))).data
        .perluAkunPertama,
    ).toBe(false);
  });

  it('dua permintaan bersamaan: hanya satu Owner yang jadi', async () => {
    const hasil = await Promise.all([
      buatAkunPertama(),
      buatAkunPertama({ ...akun, username: 'kembar' }),
    ]);
    expect(hasil.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(pengguna)).toHaveLength(1);
  });

  it('tidak bisa dipakai bila sudah ada pengguna (mis. dari seed atau Data Pengguna)', async () => {
    await buatPenggunaUji({ peran: 'KASIR' });
    expect((await buatAkunPertama()).status).toBe(409);
  });
});

describe('lupa password dengan kode pemulihan (K-191)', () => {
  async function ownerDenganKode() {
    const res = await buatAkunPertama();
    const { data } = await json<Data<{ kodePemulihan: string }>>(res);
    return { kode: data.kodePemulihan, cookie: cookieSesi(res) };
  }

  const pulihkan = (isi: Record<string, unknown>) =>
    minta('/api/auth/pulihkan', {
      method: 'POST',
      body: { konfirmasi: isi.passwordBaru, ...isi },
    });

  it('kode benar (huruf kecil, tanpa strip pun boleh): password baru, sesi lama dicabut, kode lama hangus', async () => {
    const { kode, cookie } = await ownerDenganKode();
    const salah = await pulihkan({
      username: 'harto',
      kodePemulihan: 'AAAAA-BBBBB-CCCCC-DDDDD',
      passwordBaru: 'password-baru-1',
    });
    expect(salah.status).toBe(401);
    expect((await json<{ error: { pesan: string } }>(salah)).error.pesan).toBe(
      'Username atau kode pemulihan salah.',
    );

    const ok = await pulihkan({
      username: 'HARTO',
      kodePemulihan: kode.toLowerCase().replace(/-/g, ' '),
      passwordBaru: 'password-baru-1',
    });
    expect(ok.status).toBe(200);
    const baru = (await json<Data<{ kodePemulihan: string }>>(ok)).data.kodePemulihan;
    expect(baru).not.toBe(kode);
    expect((await minta('/api/auth/saya', { cookie })).status).toBe(401);
    await loginUji('harto', 'password-baru-1');
    const ulang = await pulihkan({
      username: 'harto',
      kodePemulihan: kode,
      passwordBaru: 'password-baru-2',
    });
    expect(ulang.status).toBe(401);
    const log = await db.select({ aksi: logAktivitas.aksi }).from(logAktivitas);
    expect(log.map((l) => l.aksi)).toEqual(
      expect.arrayContaining(['PENGGUNA_PULIHKAN_GAGAL', 'PENGGUNA_PULIHKAN_PASSWORD']),
    );
  });

  it('akun terkunci karena salah password dibuka setelah dipulihkan; pengguna tanpa kode tidak bisa', async () => {
    const { kode } = await ownerDenganKode();
    await db
      .update(pengguna)
      .set({ terkunciSampai: new Date(Date.now() + 3600_000), gagalLoginBerturut: 0 })
      .where(eq(pengguna.username, 'harto'));
    await pulihkan({ username: 'harto', kodePemulihan: kode, passwordBaru: 'password-baru-1' });
    await loginUji('harto', 'password-baru-1');

    const kasir = await buatPenggunaUji({ peran: 'KASIR' });
    const tanpa = await pulihkan({
      username: kasir.username,
      kodePemulihan: kode,
      passwordBaru: 'password-baru-1',
    });
    expect(tanpa.status).toBe(401);
  });

  it('membuat kode baru untuk akun sendiri butuh password saat ini', async () => {
    const kasir = await buatPenggunaUji({ peran: 'KASIR' });
    const cookie = await loginUji(kasir.username);
    const info = await json<Data<{ ada: boolean }>>(
      await minta('/api/auth/kode-pemulihan', { cookie }),
    );
    expect(info.data.ada).toBe(false);
    const salah = await minta('/api/auth/kode-pemulihan', {
      method: 'POST',
      cookie,
      body: { password: 'bukan-password' },
    });
    expect(salah.status).toBe(400);
    const ok = await minta('/api/auth/kode-pemulihan', {
      method: 'POST',
      cookie,
      body: { password: PASSWORD_UJI },
    });
    const { kodePemulihan } = (await json<Data<{ kodePemulihan: string }>>(ok)).data;
    expect(
      (await json<Data<{ ada: boolean }>>(await minta('/api/auth/kode-pemulihan', { cookie }))).data
        .ada,
    ).toBe(true);
    const pulih = await pulihkan({
      username: kasir.username,
      kodePemulihan,
      passwordBaru: 'password-baru-9',
    });
    expect(pulih.status).toBe(200);
    expect((await minta('/api/auth/kode-pemulihan', { cookie: '' })).status).toBe(401);
  });
});
