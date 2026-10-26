import { zValidator } from '@hono/zod-validator';
import {
  skemaAkunPertama,
  skemaBuatKodePemulihan,
  skemaGantiPassword,
  skemaLogin,
  skemaMasukCepat,
  skemaPulihkanPassword,
} from '@sit/shared';
import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { env } from '../../env';
import type { EnvApp } from '../../lib/konteks';
import { kaitValidasi } from '../../lib/validasi';
import { batasPercobaanLogin } from '../../middleware/batas-percobaan';
import { penggunaWajib, requireLogin } from '../../middleware/require-permission';
import { kotakKeluarUji } from '../sistem/saluran/service';
import {
  buatAkunPertama,
  buatKodePemulihan,
  infoKodePemulihan,
  pulihkanPassword,
  statusPenyiapan,
} from './pemulihan';
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
  .post(
    '/akun-pertama',
    batasPercobaanLogin,
    zValidator('json', skemaAkunPertama, kaitValidasi),
    async (c) => {
      const { kodePemulihan, ...hasil } = await buatAkunPertama(c.req.valid('json'), c.get('asal'));
      pasangCookieSesi(c, hasil);
      return c.json({ data: { pengguna: hasil.pengguna, kodePemulihan } }, 201);
    },
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
