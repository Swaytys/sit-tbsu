import { zValidator } from '@hono/zod-validator';
import {
  skemaBuatKodePemulihan,
  skemaCatatTur,
  skemaPintasan,
  skemaGantiPassword,
  skemaLogin,
  skemaMasukCepat,
  skemaMintaKodeEmail,
  skemaPulihkanPassword,
  skemaResetLewatEmail,
  skemaSetupAwal,
  skemaUlangTur,
} from '@sit/shared';
import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { env } from '../../env';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { batasPercobaanLogin } from '../../middleware/batas-percobaan';
import { penggunaWajib, requireLogin } from '../../middleware/require-permission';
import { kotakKeluarUji } from '../sistem/saluran/service';
import { statusPenyiapan } from '../sistem/setup-awal/service';
import { buatKodePemulihan, buatSetupAwal, infoKodePemulihan, pulihkanPassword } from './pemulihan';
import { mintaKodeEmail, resetLewatEmail } from './reset-email';
import { bacaPintasan, simpanPintasan } from './pintasan';
import { bacaTur, catatTur, ulangTur } from './tur';
import { gantiPassword, keSaya, login, logout, masukCepat, type HasilLogin } from './service';
import { NAMA_COOKIE_SESI } from './token';

/** Cookie sesi: httpOnly, SameSite=Lax, Secure di produksi (CLAUDE.md § Keamanan). */
function pasangCookieSesi(c: Context<EnvApp>, hasil: HasilLogin): void {
  setCookie(c, NAMA_COOKIE_SESI, hasil.token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: hasil.kadaluarsa,
  });
}

export const authRoutes = new Hono<EnvApp>()
  // Rute publik (CLAUDE.md aturan 5).
  .post('/login', batasPercobaanLogin, zValidator('json', skemaLogin, kaitValidasi), async (c) => {
    const hasil = await login(c.req.valid('json'), c.get('asal'));
    pasangCookieSesi(c, hasil);
    return c.json({ data: hasil.pengguna }, 200);
  })
  // K-191 (publik, docs/04 §7): halaman "Buat akun pertama" hanya berlaku selama belum ada pengguna, dan
  // pemulihan password dengan kode sekali pakai. Keduanya memakai batas laju yang sama dengan login.
  .get('/penyiapan', async (c) => c.json({ data: await statusPenyiapan() }, 200))
  // K-205: setup awal (data usaha + akun Owner pertama), hanya selama belum ada pengguna.
  .post(
    '/setup-awal',
    batasPercobaanLogin,
    zValidator('json', skemaSetupAwal, kaitValidasi),
    async (c) => {
      const { kodePemulihan, ...hasil } = await buatSetupAwal(c.req.valid('json'), c.get('asal'));
      pasangCookieSesi(c, hasil);
      return c.json({ data: { pengguna: hasil.pengguna, kodePemulihan } }, 201);
    },
  )
  // K-209: lupa password dengan kode verifikasi email.
  .post(
    '/lupa-email',
    batasPercobaanLogin,
    zValidator('json', skemaMintaKodeEmail, kaitValidasi),
    async (c) =>
      c.json({ data: await mintaKodeEmail(c.req.valid('json').username, c.get('asal')) }, 200),
  )
  .post(
    '/lupa-email/reset',
    batasPercobaanLogin,
    zValidator('json', skemaResetLewatEmail, kaitValidasi),
    async (c) => c.json({ data: await resetLewatEmail(c.req.valid('json'), c.get('asal')) }, 200),
  )
  // K-145: tombol pintasan milik pengguna sendiri.
  .get('/pintasan', requireLogin(), async (c) =>
    c.json({ data: await bacaPintasan(penggunaWajib(c).id) }, 200),
  )
  .put('/pintasan', requireLogin(), zValidator('json', skemaPintasan, kaitValidasi), async (c) =>
    c.json({ data: await simpanPintasan(penggunaWajib(c).id, c.req.valid('json')) }, 200),
  )
  // K-206: status tur fitur milik pengguna sendiri.
  .get('/tur', requireLogin(), async (c) =>
    c.json({ data: await bacaTur(penggunaWajib(c).id) }, 200),
  )
  .post('/tur', requireLogin(), zValidator('json', skemaCatatTur, kaitValidasi), async (c) => {
    const { kode, hasil } = c.req.valid('json');
    return c.json({ data: await catatTur(penggunaWajib(c).id, kode, hasil) }, 200);
  })
  .post('/tur/ulang', requireLogin(), zValidator('json', skemaUlangTur, kaitValidasi), async (c) =>
    c.json({ data: await ulangTur(penggunaWajib(c).id, c.req.valid('json').kode) }, 200),
  )
  .post(
    '/pulihkan',
    batasPercobaanLogin,
    zValidator('json', skemaPulihkanPassword, kaitValidasi),
    async (c) => c.json({ data: await pulihkanPassword(c.req.valid('json'), c.get('asal')) }, 200),
  )
  .get('/kode-pemulihan', requireLogin({ bolehWajibGantiPassword: true }), async (c) =>
    c.json({ data: await infoKodePemulihan(penggunaWajib(c).id) }, 200),
  )
  .post(
    '/kode-pemulihan',
    requireLogin({ bolehWajibGantiPassword: true }),
    zValidator('json', skemaBuatKodePemulihan, kaitValidasi),
    async (c) => {
      const data = await buatKodePemulihan(
        penggunaWajib(c),
        c.req.valid('json').password,
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/logout', requireLogin({ bolehWajibGantiPassword: true }), async (c) => {
    await logout(penggunaWajib(c), c.get('asal'));
    deleteCookie(c, NAMA_COOKIE_SESI, { path: '/' });
    return c.json({ data: { berhasil: true } }, 200);
  })
  .get('/saya', requireLogin({ bolehWajibGantiPassword: true }), (c) => {
    const p = penggunaWajib(c);
    return c.json({ data: keSaya(p) }, 200);
  })
  .post(
    '/ganti-password',
    requireLogin({ bolehWajibGantiPassword: true }),
    zValidator('json', skemaGantiPassword, kaitValidasi),
    async (c) => {
      const pengguna = await gantiPassword(penggunaWajib(c), c.req.valid('json'), c.get('asal'));
      return c.json({ data: pengguna }, 200);
    },
  );

/**
 * Masuk cepat per peran dengan akun demo. HANYA dipasang saat NODE_ENV=development (K-021), sehingga
 * rute ini tidak ada di produksi. Service juga menolak bila bukan mode pengembangan.
 */
export const authDevRoutes = new Hono<EnvApp>()
  .post(
    '/masuk-cepat',
    batasPercobaanLogin,
    zValidator('json', skemaMasukCepat, kaitValidasi),
    async (c) => {
      const hasil = await masukCepat(c.req.valid('json').peran, c.get('asal'));
      pasangCookieSesi(c, hasil);
      return c.json({ data: hasil.pengguna }, 200);
    },
  )
  // Kotak keluar uji (K-102): pesan kode persetujuan yang "terkirim" selama pengembangan, untuk mencoba
  // alurnya tanpa bot Telegram atau akun email sungguhan dan untuk tes e2e. Tidak ada di produksi.
  .get('/pesan-uji', requireLogin(), (c) => c.json({ data: kotakKeluarUji() }, 200));
