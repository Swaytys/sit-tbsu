import { zValidator } from '@hono/zod-validator';
import {
  skemaIsiContoh,
  skemaSelesaiSetupAwal,
  skemaSembunyikanPanduan,
  skemaTandaiPenyiapan,
  skemaUbahDataUsaha,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  bacaPanduan,
  isiContoh,
  nonaktifkanContoh,
  sembunyikanPanduan,
  tandaiLangkah,
} from './service';
import { bacaSetupAwal, selesaiSetupAwal, ubahDataUsaha } from '../setup-awal/service';

const izin = requirePermission('sistem.pengaturan.kelola');

/** K-168: panduan penyiapan pertama dan contoh data (Owner/Admin). */
export const penyiapanRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await bacaPanduan() }, 200))
  .post('/tandai', izin, zValidator('json', skemaTandaiPenyiapan, kaitValidasi), async (c) => {
    const { langkah, selesai } = c.req.valid('json');
    return c.json(
      { data: await tandaiLangkah(langkah, selesai, penggunaWajib(c), c.get('asal')) },
      200,
    );
  })
  .post(
    '/sembunyikan',
    izin,
    zValidator('json', skemaSembunyikanPanduan, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await sembunyikanPanduan(
            c.req.valid('json').sembunyikan,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post('/contoh', izin, zValidator('json', skemaIsiContoh, kaitValidasi), async (c) =>
    c.json(
      { data: await isiContoh(c.req.valid('json').jenis, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/contoh/nonaktifkan', izin, async (c) =>
    c.json({ data: await nonaktifkanContoh(penggunaWajib(c), c.get('asal')) }, 200),
  )
  // K-205: setup awal (lanjutan setelah masuk, dan mengulang dari Pengaturan).
  .get('/setup-awal', izin, async (c) => c.json({ data: await bacaSetupAwal() }, 200))
  .put('/setup-awal/usaha', izin, zValidator('json', skemaUbahDataUsaha, kaitValidasi), async (c) =>
    c.json(
      { data: await ubahDataUsaha(c.req.valid('json'), penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post(
    '/setup-awal/selesai',
    izin,
    zValidator('json', skemaSelesaiSetupAwal, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await selesaiSetupAwal(
            c.req.valid('json').dilewati,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  );
