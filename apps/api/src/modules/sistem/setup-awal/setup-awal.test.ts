import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  beriEmail,
  buatPenggunaUji,
  cookieSesi,
  json,
  loginUji,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { kodeResetPassword, logAktivitas, pengguna } from '../../../db/schema';
import { pulihkanAksesOwnerLokal } from '../../auth/pemulihan';
import { kosongkanKotakKeluar, kotakKeluarUji } from '../saluran/service';

type Data<T> = { data: T };

beforeEach(async () => {
  await siapkanDatabaseSistem();
});

const usaha = {
  jenisUsaha: 'BAHAN_BANGUNAN',
  jenisUsahaLain: '',
  namaToko: 'Toko Maju Jaya',
  namaBadanUsaha: 'UD. Maju Jaya',
  sloganToko: 'Lengkap, murah, cepat',
  alamatToko: 'Jl. Merdeka 1',
  kotaToko: 'Kediri',
  telpToko: '(0354) 123456',
  emailToko: 'toko@contoh.test',
};
const operasional = {
  layanan: ['LANGSUNG', 'ANTAR'],
  shiftJamBuka: '07:00',
  shiftJamTutup: '17:00',
};
const owner = {
  namaPengguna: 'Bu Sari',
  username: 'sari',
  email: 'sari@contoh.test',
  noHp: '081234567890',
  password: 'rahasia-toko-1',
  konfirmasi: 'rahasia-toko-1',
};

const setupAwal = (isi: Record<string, unknown> = {}) =>
  minta('/api/auth/setup-awal', { method: 'POST', body: { usaha, operasional, owner, ...isi } });

describe('setup awal (K-205, K-207)', () => {
  it('membuat Owner + data usaha sekaligus; halaman masuk menampilkan identitas usaha', async () => {
    const sebelum = await json<Data<{ perluAkunPertama: boolean; namaToko: string }>>(
      await minta('/api/auth/penyiapan'),
    );
    expect(sebelum.data).toMatchObject({ perluAkunPertama: true, namaToko: '' });

    const res = await setupAwal();
    expect(res.status).toBe(201);
    const cookie = cookieSesi(res);
    const [p] = await db.select().from(pengguna).where(eq(pengguna.username, 'sari'));
    expect(p).toMatchObject({ peran: 'OWNER', email: 'sari@contoh.test', noHp: '+6281234567890' });

    const status = await json<Data<Record<string, unknown>>>(await minta('/api/auth/penyiapan'));
    expect(status.data).toEqual({
      perluAkunPertama: false,
      namaToko: 'Toko Maju Jaya',
      sloganToko: 'Lengkap, murah, cepat',
      kotaToko: 'Kediri',
      modeLatihan: false,
    });

    const setup = await json<
      Data<{ selesai: boolean; usaha: typeof usaha; operasional: typeof operasional }>
    >(await minta('/api/penyiapan/setup-awal', { cookie }));
    expect(setup.data.selesai).toBe(false);
    expect(setup.data.usaha).toEqual(usaha);
    expect(setup.data.operasional).toEqual(operasional);
    const tampilan = await json<Data<{ namaToko: string; kotaToko: string }>>(
      await minta('/api/pengaturan/tampilan', { cookie }),
    );
    expect(tampilan.data).toMatchObject({ namaToko: 'Toko Maju Jaya', kotaToko: 'Kediri' });

    // Langkah Profil toko di panduan penyiapan sudah selesai karena datanya diisi di setup awal.
    const panduan = await json<Data<{ langkah: { langkah: string; selesai: boolean }[] }>>(
      await minta('/api/penyiapan', { cookie }),
    );
    expect(panduan.data.langkah.find((l) => l.langkah === 'PROFIL')?.selesai).toBe(true);

    const selesai = await minta('/api/penyiapan/setup-awal/selesai', {
      method: 'POST',
      cookie,
      body: { dilewati: ['CADANGAN', 'KARYAWAN', 'CADANGAN'] },
    });
    expect(selesai.status).toBe(200);
    expect(
      (await json<Data<{ selesai: boolean; dilewati: string[] }>>(selesai)).data,
    ).toMatchObject({ selesai: true, dilewati: ['CADANGAN', 'KARYAWAN'] });
    const aksi = (await db.select({ a: logAktivitas.aksi }).from(logAktivitas)).map((l) => l.a);
    expect(aksi).toEqual(expect.arrayContaining(['SETUP_AWAL', 'SETUP_AWAL_SELESAI']));
  });

  it('validasi: jenis Lainnya wajib ditulis, jam tutup setelah jam buka, minimal satu layanan', async () => {
    const lain = await setupAwal({ usaha: { ...usaha, jenisUsaha: 'LAINNYA' } });
    expect(lain.status).toBe(400);
    const jam = await setupAwal({
      operasional: { ...operasional, shiftJamBuka: '17:00', shiftJamTutup: '08:00' },
    });
    expect(jam.status).toBe(400);
    const layanan = await setupAwal({ operasional: { ...operasional, layanan: [] } });
    expect(layanan.status).toBe(400);
    expect(await db.select().from(pengguna)).toHaveLength(0);
  });

  it('mengulang dari Pengaturan: hanya pemegang izin pengaturan; instalasi lama dianggap sudah selesai', async () => {
    const { cookie: ownerLama } = await sesiUji('OWNER');
    const lama = await json<Data<{ selesai: boolean }>>(
      await minta('/api/penyiapan/setup-awal', { cookie: ownerLama }),
    );
    expect(lama.data.selesai).toBe(true);
    const ubah = await minta('/api/penyiapan/setup-awal/usaha', {
      method: 'PUT',
      cookie: ownerLama,
      body: { usaha: { ...usaha, namaToko: 'Toko Baru' }, operasional },
    });
    expect(ubah.status).toBe(200);
    expect((await json<Data<{ usaha: { namaToko: string } }>>(ubah)).data.usaha.namaToko).toBe(
      'Toko Baru',
    );

    const { cookie: kasir } = await sesiUji('KASIR');
    expect((await minta('/api/penyiapan/setup-awal', { cookie: kasir })).status).toBe(403);
    expect(
      (
        await minta('/api/penyiapan/setup-awal/usaha', {
          method: 'PUT',
          cookie: kasir,
          body: { usaha, operasional },
        })
      ).status,
    ).toBe(403);
  });
});

describe('lupa password lewat email (K-209)', () => {
  const minta_ = (username: string) =>
    minta('/api/auth/lupa-email', { method: 'POST', body: { username } });
  const reset = (isi: Record<string, unknown>) =>
    minta('/api/auth/lupa-email/reset', {
      method: 'POST',
      body: { passwordBaru: 'password-baru-9', konfirmasi: 'password-baru-9', ...isi },
    });
  const kodeTerakhir = () => /(\d{6})/.exec(kotakKeluarUji()[0]?.isi ?? '')?.[1] ?? '';

  it('kode 6 angka ke email; salah ditolak; benar mengganti password dan mencabut sesi', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    await beriEmail(p.id);
    const cookieLama = await loginUji(p.username);

    const r = await minta_(p.username);
    expect(r.status).toBe(200);
    const kode = kodeTerakhir();
    expect(kode).toMatch(/^\d{6}$/);
    expect(kotakKeluarUji()[0]).toMatchObject({ saluran: 'EMAIL' });

    const salah = await reset({
      username: p.username,
      kode: kode === '000000' ? '111111' : '000000',
    });
    expect(salah.status).toBe(401);
    const benar = await reset({ username: p.username, kode });
    expect(benar.status).toBe(200);
    expect((await minta('/api/auth/saya', { cookie: cookieLama })).status).toBe(401);
    expect(await loginUji(p.username, 'password-baru-9')).toBeTruthy();
    // Sekali pakai.
    expect((await reset({ username: p.username, kode })).status).toBe(401);
  });

  it('jawaban sama untuk username tak dikenal / tanpa email (tanpa kirim); 5 kali salah menggugurkan kode', async () => {
    const tanpaEmail = await buatPenggunaUji({ peran: 'KASIR' });
    const a = await json<Data<{ pesan: string }>>(await minta_('tidak-ada'));
    const b = await json<Data<{ pesan: string }>>(await minta_(tanpaEmail.username));
    expect(a.data.pesan).toBe(b.data.pesan);
    expect(kotakKeluarUji()).toHaveLength(0);

    const p = await buatPenggunaUji({ peran: 'ADMIN' });
    await beriEmail(p.id);
    await minta_(p.username);
    const kode = kodeTerakhir();
    for (let i = 0; i < 5; i++) {
      expect((await reset({ username: p.username, kode: '99999' + String(i) })).status).toBe(401);
    }
    expect((await reset({ username: p.username, kode })).status).toBe(401);
    const [k] = await db.select().from(kodeResetPassword);
    expect(k?.digugurkanPada).not.toBeNull();
  });

  it('permintaan ulang dalam 1 menit tidak mengirim kode baru', async () => {
    const p = await buatPenggunaUji({ peran: 'KASIR' });
    await beriEmail(p.id);
    await minta_(p.username);
    kosongkanKotakKeluar();
    await minta_(p.username);
    expect(kotakKeluarUji()).toHaveLength(0);
  });
});

describe('tur fitur (K-206)', () => {
  it('selesai/dilewati per pengguna; ulang satu atau semua', async () => {
    const { cookie } = await sesiUji('KASIR');
    const catat = (kode: string, hasil: string) =>
      minta('/api/auth/tur', { method: 'POST', cookie, body: { kode, hasil } });
    await catat('PENGENALAN', 'SELESAI');
    await catat('KASIR', 'DILEWATI');
    const s = await json<Data<{ selesai: string[]; dilewati: string[] }>>(
      await minta('/api/auth/tur', { cookie }),
    );
    expect(s.data).toEqual({ selesai: ['PENGENALAN'], dilewati: ['KASIR'] });
    expect((await catat('TIDAK_ADA', 'SELESAI')).status).toBe(400);
    const ulang = await minta('/api/auth/tur/ulang', {
      method: 'POST',
      cookie,
      body: { kode: 'SEMUA' },
    });
    expect((await json<Data<unknown>>(ulang)).data).toEqual({ selesai: [], dilewati: [] });
    expect((await minta('/api/auth/tur')).status).toBe(401);
  });
});

describe('pulihkan akses Owner dari komputer server (K-211)', () => {
  it('password sementara wajib diganti, kode pemulihan baru, sesi lama dicabut', async () => {
    const o = await buatPenggunaUji({ peran: 'OWNER' });
    const cookieLama = await loginUji(o.username);
    const h = await pulihkanAksesOwnerLokal();
    expect(h.username).toBe(o.username);
    expect((await minta('/api/auth/saya', { cookie: cookieLama })).status).toBe(401);
    const masuk = await minta('/api/auth/login', {
      method: 'POST',
      body: { username: o.username, password: h.passwordSementara },
    });
    expect(masuk.status).toBe(200);
    expect((await json<Data<{ wajibGantiPassword: boolean }>>(masuk)).data.wajibGantiPassword).toBe(
      true,
    );
    expect(h.kodePemulihan).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  });

  it('tanpa Owner aktif: pesan jelas', async () => {
    await expect(pulihkanAksesOwnerLokal()).rejects.toThrow('Belum ada akun Owner');
  });
});
