import { zValidator } from '@hono/zod-validator';
import {
  POLA_ID_DATA,
  skemaEksporData,
  skemaKonfirmasiData,
  skemaSalinanData,
  skemaSandiImpor,
  UKURAN_BERKAS_DATA_MAKS,
} from '@sit/shared';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AppError } from '../../../lib/errors';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { batasPercobaanLogin } from '../../../middleware/batas-percobaan';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  akarPustaka,
  ambilDariHarian,
  eksporData,
  gantiDataAktif,
  hapusData,
  imporData,
  jagaGantiData,
  pakaiData,
  pastikanBelumAdaPengguna,
  simpanSalinan,
  snapshotHarian,
  statusData,
} from './service';
import { daftarPustaka } from './pustaka';

const izin = requirePermission('sistem.data.kelola');
const paramId = z.object({ id: z.string().regex(POLA_ID_DATA, 'Data tidak dikenal.') });
const batasBerkas = bodyLimit({
  maxSize: UKURAN_BERKAS_DATA_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Berkas data maksimal 500 MB.', 413);
  },
});

async function bacaKirimanImpor(c: Context<EnvApp>) {
  const isi = await c.req.parseBody();
  const berkas = isi.berkas;
  if (!(berkas instanceof File))
    throw new AppError('VALIDASI', 'Pilih berkas data (.bonsai).', 400);
  const sandi = skemaSandiImpor.safeParse({ sandi: isi.sandi });
  if (!sandi.success) throw new AppError('VALIDASI', 'Sandi berkas wajib diisi.', 400);
  return { berkas: new Uint8Array(await berkas.arrayBuffer()), sandi: sandi.data.sandi };
}

/** K-213: Pengaturan › Data (Owner). */
export const dataRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await statusData() }, 200))
  .post('/salinan', izin, zValidator('json', skemaSalinanData, kaitValidasi), async (c) =>
    c.json(
      { data: await simpanSalinan(c.req.valid('json').label, penggunaWajib(c), c.get('asal')) },
      201,
    ),
  )
  .post(
    '/:id/pakai',
    izin,
    zValidator('param', paramId, kaitValidasi),
    zValidator('json', skemaKonfirmasiData, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await pakaiData(
            c.req.valid('param').id,
            c.req.valid('json').password,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .post(
    '/:id/hapus',
    izin,
    zValidator('param', paramId, kaitValidasi),
    zValidator('json', skemaKonfirmasiData, kaitValidasi),
    async (c) => {
      await hapusData(
        c.req.valid('param').id,
        c.req.valid('json').password,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: { dihapus: true } }, 200);
    },
  )
  .post('/ekspor', izin, zValidator('json', skemaEksporData, kaitValidasi), async (c) => {
    const { isi, nama } = await eksporData(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.body(new Uint8Array(isi), 200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${nama}"`,
    });
  })
  .post('/impor', izin, batasBerkas, async (c) => {
    const { berkas, sandi } = await bacaKirimanImpor(c);
    return c.json(
      { data: await imporData(berkas, sandi, { id: penggunaWajib(c).id }, c.get('asal')) },
      201,
    );
  })
  .get('/cadangan-harian', izin, async (c) => c.json({ data: await snapshotHarian() }, 200))
  .post(
    '/cadangan-harian/:id',
    izin,
    zValidator('param', z.object({ id: z.string().max(64) }), kaitValidasi),
    async (c) =>
      c.json(
        { data: await ambilDariHarian(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
        201,
      ),
  );

/**
 * K-213: setup awal "Lanjutkan data yang sudah ada". Rute publik, hanya berlaku selama belum ada pengguna sama
 * sekali (aplikasi baru dipasang); setelah data dipakai, pengguna masuk dengan akun dari data itu.
 */
export const dataSetupRoutes = new Hono<EnvApp>()
  .get('/setup-data', async (c) => {
    await pastikanBelumAdaPengguna();
    const { pustaka } = await daftarPustaka(akarPustaka());
    return c.json({ data: pustaka }, 200);
  })
  .post('/setup-data/impor', batasPercobaanLogin, batasBerkas, async (c) => {
    await pastikanBelumAdaPengguna();
    const { berkas, sandi } = await bacaKirimanImpor(c);
    const m = await imporData(berkas, sandi, { id: null }, c.get('asal'));
    await gantiDataAktif(m.id, { id: null, nama: 'setup awal' }, c.get('asal'));
    return c.json({ data: m }, 200);
  })
  .post(
    '/setup-data/:id/pakai',
    batasPercobaanLogin,
    zValidator('param', paramId, kaitValidasi),
    async (c) => {
      await pastikanBelumAdaPengguna();
      return c.json(
        {
          data: await gantiDataAktif(
            c.req.valid('param').id,
            { id: null, nama: 'setup awal' },
            c.get('asal'),
          ),
        },
        200,
      );
    },
  );

export const jagaGantiDataRute = jagaGantiData;
