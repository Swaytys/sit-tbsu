import { zValidator } from '@hono/zod-validator';
import {
  skemaDaftarHarian,
  skemaHitungOpname,
  skemaTimbangBarang,
  skemaTugaskanOpname,
} from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  aturTimbang,
  catatHitung,
  daftarPenghitung,
  kinerjaOpname,
  lembarHitung,
  mulaiHitung,
  ringkasanOpname,
  susunDaftarHarian,
  tugasOpname,
  tugaskanOpname,
} from './service';

const atur = requirePermission('persediaan.opname.atur');
const hitung = requirePermission('persediaan.opname.hitung');

/** K-240/K-227: Stok Opname bertahap (ringkasan ABC, daftar harian, lembar hitung, kinerja). */
export const opnameRoutes = new Hono<EnvApp>()
  .get('/ringkasan', requirePermission('persediaan.stok.lihat'), async (c) =>
    c.json({ data: await ringkasanOpname() }, 200),
  )
  .get('/kinerja', atur, async (c) => c.json({ data: await kinerjaOpname() }, 200))
  .get('/penghitung', atur, async (c) => c.json({ data: await daftarPenghitung() }, 200))
  .get('/tugas', hitung, async (c) => c.json({ data: await tugasOpname(penggunaWajib(c)) }, 200))
  .post('/daftar-harian', atur, zValidator('json', skemaDaftarHarian, kaitValidasi), async (c) => {
    const { jumlah, idPenghitung } = c.req.valid('json');
    return c.json(
      { data: await susunDaftarHarian(jumlah, idPenghitung, penggunaWajib(c), c.get('asal')) },
      201,
    );
  })
  .put(
    '/barang/:id/timbang',
    requirePermission('master.barang.kelola'),
    paramId,
    zValidator('json', skemaTimbangBarang, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await aturTimbang(
            c.req.valid('param').id,
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .patch(
    '/:id/penghitung',
    atur,
    paramId,
    zValidator('json', skemaTugaskanOpname, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await tugaskanOpname(
            c.req.valid('param').id,
            c.req.valid('json').idPenghitung,
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  )
  .get('/:id/lembar', hitung, paramId, async (c) =>
    c.json({ data: await lembarHitung(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post('/:id/mulai', hitung, paramId, async (c) =>
    c.json(
      { data: await mulaiHitung(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post(
    '/:id/hitung',
    hitung,
    paramId,
    zValidator('json', skemaHitungOpname, kaitValidasi),
    async (c) =>
      c.json(
        {
          data: await catatHitung(
            c.req.valid('param').id,
            c.req.valid('json'),
            penggunaWajib(c),
            c.get('asal'),
          ),
        },
        200,
      ),
  );
