import { zValidator } from '@hono/zod-validator';
import { skemaUbahPengaturan } from '@sit/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../../../lib/errors';
import type { EnvApp } from '../../../lib/konteks';
import { UKURAN_GAMBAR_MAKS } from '../../../lib/penyimpanan';
import { kaitValidasi } from '../../../lib/validasi';
import {
  penggunaWajib,
  requireLogin,
  requirePermission,
} from '../../../middleware/require-permission';
import {
  ambilLogo,
  bacaPengaturan,
  hapusLogo,
  tampilanToko,
  ubahPengaturan,
  unggahLogo,
} from './service';

const izin = requirePermission('sistem.pengaturan.kelola');
const batasUnggah = bodyLimit({
  maxSize: UKURAN_GAMBAR_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Ukuran gambar maksimal 2 MB.', 413);
  },
});

/**
 * Pengaturan toko — Admin dan Owner (docs/04 §3). Tampilan toko (nama, logo, baris per halaman) dibaca
 * semua pengguna login karena dipakai sidebar dan tabel (K-065).
 */
export const pengaturanRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await bacaPengaturan() }, 200))
  .patch('/', izin, zValidator('json', skemaUbahPengaturan, kaitValidasi), async (c) => {
    const data = await ubahPengaturan(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .get('/tampilan', requireLogin(), async (c) => c.json({ data: await tampilanToko() }, 200))
  .get('/logo', requireLogin(), async (c) => {
    const { isi, tipe } = await ambilLogo();
    return c.body(new Uint8Array(isi), 200, {
      'Content-Type': tipe,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  })
  .post('/logo', izin, batasUnggah, async (c) => {
    const body = await c.req.parseBody();
    if (!(body.berkas instanceof File)) {
      throw new AppError('VALIDASI', 'Pilih berkas gambar untuk diunggah.', 400);
    }
    const isi = new Uint8Array(await body.berkas.arrayBuffer());
    return c.json({ data: await unggahLogo(isi, penggunaWajib(c), c.get('asal')) }, 200);
  })
  .delete('/logo', izin, async (c) =>
    c.json({ data: await hapusLogo(penggunaWajib(c), c.get('asal')) }, 200),
  );
