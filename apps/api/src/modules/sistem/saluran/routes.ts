import { zValidator } from '@hono/zod-validator';
import { skemaKontakSaya, skemaPengaturanSaluran, skemaUjiSaluran } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import {
  penggunaWajib,
  requireLogin,
  requirePermission,
} from '../../../middleware/require-permission';
import {
  bacaPengaturanSaluran,
  buatTautanTelegram,
  kontakSaya,
  periksaTautanTelegram,
  putusTelegram,
  ubahKontakSaya,
  ubahPengaturanSaluran,
  ujiSaluran,
} from './service';

const kelola = requirePermission('sistem.pengaturan.kelola');

/**
 * Saluran kode persetujuan (K-102). Pengaturan toko (token bot, SMTP) untuk Admin/Owner; kontak pribadi
 * (`/saya`) untuk tiap pengguna atas akunnya sendiri.
 */
export const saluranRoutes = new Hono<EnvApp>()
  .get('/', kelola, async (c) => c.json({ data: await bacaPengaturanSaluran() }, 200))
  .patch('/', kelola, zValidator('json', skemaPengaturanSaluran, kaitValidasi), async (c) => {
    const data = await ubahPengaturanSaluran(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/uji', kelola, zValidator('json', skemaUjiSaluran, kaitValidasi), async (c) =>
    c.json({ data: await ujiSaluran(penggunaWajib(c), c.req.valid('json').saluran) }, 200),
  )
  .get('/saya', requireLogin(), async (c) =>
    c.json({ data: await kontakSaya(penggunaWajib(c)) }, 200),
  )
  .patch('/saya', requireLogin(), zValidator('json', skemaKontakSaya, kaitValidasi), async (c) => {
    const data = await ubahKontakSaya(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/saya/telegram/tautan', requireLogin(), async (c) =>
    c.json({ data: await buatTautanTelegram(penggunaWajib(c)) }, 200),
  )
  .post('/saya/telegram/periksa', requireLogin(), async (c) =>
    c.json({ data: await periksaTautanTelegram(penggunaWajib(c), c.get('asal')) }, 200),
  )
  .delete('/saya/telegram', requireLogin(), async (c) =>
    c.json({ data: await putusTelegram(penggunaWajib(c), c.get('asal')) }, 200),
  );
