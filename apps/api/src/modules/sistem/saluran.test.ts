import type { HasilUjiSaluran, KontakSaya, PengaturanSaluran, TautanTelegram } from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, pesanTerkirim, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { db } from '../../db/client';
import { konfigurasi, logAktivitas, pengguna } from '../../db/schema';

/*
 * Saluran kode persetujuan (K-102): pengaturan toko (token bot Telegram, SMTP) dan kontak pribadi pengguna.
 * Di tes tidak ada panggilan jaringan: pesan masuk kotak keluar uji.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
const TOKEN = '123456:RAHASIA-TOKEN-BOT';
const SANDI = 'sandi-aplikasi-rahasia';

let admin: Sesi;
let kasir: Sesi;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
});

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });
async function data<T>(r: Response | Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
const smtp = {
  smtpHost: 'smtp.contoh.test',
  smtpPort: 465,
  smtpPengguna: 'toko@contoh.test',
  emailPengirim: 'Toko <toko@contoh.test>',
};

describe('pengaturan saluran', () => {
  it('hanya Admin/Owner; token bot dan sandi email tersimpan tetapi tidak pernah dikembalikan atau dilog', async () => {
    expect((await minta('/api/saluran', { cookie: kasir.cookie })).status).toBe(403);
    expect((await kirim(kasir, '/api/saluran', smtp, 'PATCH')).status).toBe(403);

    const awal = await data<PengaturanSaluran>(minta('/api/saluran', { cookie: admin.cookie }));
    expect(awal.telegram.terpasang).toBe(false);
    expect(awal.email).toMatchObject({ terpasang: false, sandiTerisi: false });

    const res = await kirim(
      admin,
      '/api/saluran',
      { ...smtp, telegramToken: TOKEN, smtpSandi: SANDI },
      'PATCH',
    );
    const teks = await res.text();
    expect(res.status).toBe(200);
    expect(teks).not.toContain(TOKEN);
    expect(teks).not.toContain(SANDI);
    const p = (JSON.parse(teks) as { data: PengaturanSaluran }).data;
    expect(p.telegram.terpasang).toBe(true);
    expect(p.email).toMatchObject({
      terpasang: true,
      sandiTerisi: true,
      host: 'smtp.contoh.test',
      port: 465,
    });

    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGATURAN_UBAH'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('telegram_bot_token (rahasia)');
    expect(JSON.stringify(log)).not.toContain(TOKEN);
    expect(JSON.stringify(log)).not.toContain(SANDI);
    // Pengaturan umum tidak ikut membocorkannya.
    const umum = await (await minta('/api/pengaturan', { cookie: admin.cookie })).text();
    expect(umum).not.toContain(TOKEN);
    expect(umum).not.toContain(SANDI);

    // Rahasia yang dikosongkan = tidak diubah; token dihapus hanya lewat `hapusTelegram`.
    await data(kirim(admin, '/api/saluran', smtp, 'PATCH'));
    const [token] = await db
      .select()
      .from(konfigurasi)
      .where(eq(konfigurasi.kode, 'telegram_bot_token'));
    expect(token?.nilai).toBe(TOKEN);
    const hapus = await data<PengaturanSaluran>(
      kirim(admin, '/api/saluran', { ...smtp, hapusTelegram: true }, 'PATCH'),
    );
    expect(hapus.telegram.terpasang).toBe(false);
    expect(hapus.email.sandiTerisi).toBe(true);
  });
});

describe('kontak saya', () => {
  it('email divalidasi, tersimpan untuk akun sendiri, dan dicatat; penerima kode tampil di pengaturan', async () => {
    const tolak = await kirim(admin, '/api/saluran/saya', { email: 'bukan-email' }, 'PATCH');
    expect(tolak.status).toBe(400);
    const k = await data<KontakSaya>(
      kirim(admin, '/api/saluran/saya', { email: 'admin@contoh.test' }, 'PATCH'),
    );
    expect(k).toMatchObject({ email: 'admin@contoh.test', telegramTerhubung: false });
    const [baris] = await db.select().from(pengguna).where(eq(pengguna.id, admin.pengguna.id));
    expect(baris?.email).toBe('admin@contoh.test');
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'AKUN_KONTAK_UBAH'));
    expect(log?.idPengguna).toBe(admin.pengguna.id);

    // Kasir boleh mengisi email-nya, tetapi tidak menjadi penerima kode (bukan atasan).
    await data(kirim(kasir, '/api/saluran/saya', { email: 'kasir@contoh.test' }, 'PATCH'));
    await data(kirim(admin, '/api/saluran', { ...smtp, smtpSandi: SANDI }, 'PATCH'));
    const p = await data<PengaturanSaluran>(minta('/api/saluran', { cookie: admin.cookie }));
    expect(p.penerima).toEqual([{ nama: admin.pengguna.namaPengguna, saluran: ['EMAIL'] }]);

    // Dikosongkan lagi.
    const kosong = await data<KontakSaya>(
      kirim(admin, '/api/saluran/saya', { email: '' }, 'PATCH'),
    );
    expect(kosong.email).toBeNull();
  });

  it('uji per saluran menyebut tepat apa yang kurang, dan tidak pernah berpura-pura terkirim', async () => {
    const uji = (saluran: string) =>
      data<HasilUjiSaluran>(kirim(admin, '/api/saluran/uji', { saluran }));
    expect((await kirim(admin, '/api/saluran/uji', {})).status).toBe(400);
    expect((await kirim(kasir, '/api/saluran/uji', { saluran: 'EMAIL' })).status).toBe(403);

    // Telegram: token dulu, lalu akun harus dihubungkan.
    expect(await uji('TELEGRAM')).toMatchObject({ berhasil: false });
    expect((await uji('TELEGRAM')).pesan).toContain('Token bot belum diisi');
    await data(kirim(admin, '/api/saluran', { ...smtp, telegramToken: TOKEN }, 'PATCH'));
    const belumHubung = await uji('TELEGRAM');
    expect(belumHubung.berhasil).toBe(false);
    expect(belumHubung.pesan).toContain('belum dihubungkan');
    await db
      .update(pengguna)
      .set({ telegramChatId: '12345' })
      .where(eq(pengguna.id, admin.pengguna.id));
    expect(await uji('TELEGRAM')).toMatchObject({ saluran: 'TELEGRAM', berhasil: true });

    // Email: akun pengirim harus lengkap (sandi aplikasi), lalu alamat penerima milik akun sendiri.
    const tanpaSandi = await uji('EMAIL');
    expect(tanpaSandi.berhasil).toBe(false);
    expect(tanpaSandi.pesan).toContain('sandi aplikasi');
    const p = await data<PengaturanSaluran>(minta('/api/saluran', { cookie: admin.cookie }));
    expect(p.email).toMatchObject({ terpasang: false, kurang: ['sandi aplikasi'] });
    await data(kirim(admin, '/api/saluran', { ...smtp, smtpSandi: SANDI }, 'PATCH'));
    const tanpaAlamat = await uji('EMAIL');
    expect(tanpaAlamat.berhasil).toBe(false);
    expect(tanpaAlamat.pesan).toContain('belum punya alamat email');
    await data(kirim(admin, '/api/saluran/saya', { email: 'admin@contoh.test' }, 'PATCH'));
    expect(await uji('EMAIL')).toMatchObject({ saluran: 'EMAIL', berhasil: true });
    // Uji saluran tidak memakai kotak keluar tiruan.
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toBe('');
  });

  it('tautan Telegram butuh bot toko; kodenya milik akun yang memintanya', async () => {
    const tanpaBot = await kirim(admin, '/api/saluran/saya/telegram/tautan');
    expect(tanpaBot.status).toBe(409);
    await data(kirim(admin, '/api/saluran', { ...smtp, telegramToken: TOKEN }, 'PATCH'));
    const t = await data<TautanTelegram>(kirim(admin, '/api/saluran/saya/telegram/tautan'));
    expect(t.tautan).toMatch(/^https:\/\/t\.me\/bot_uji\?start=[0-9A-F]{10}$/);
    expect(t.perintah).toMatch(/^\/start [0-9A-F]{10}$/);
    // Kode baru menggantikan kode lama akun yang sama.
    const t2 = await data<TautanTelegram>(kirim(admin, '/api/saluran/saya/telegram/tautan'));
    expect(t2.perintah).not.toBe(t.perintah);
  });
});
