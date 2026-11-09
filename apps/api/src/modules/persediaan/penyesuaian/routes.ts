import { zValidator } from '@hono/zod-validator';
import { skemaBuatLembarOpname, skemaCariPenyesuaian, skemaPenyesuaian } from '@sit/shared';
import { Hono } from 'hono';
import { headerUnduhan } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { batasUnggahXlsx, berkasKiriman } from '../../../lib/unggah';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  batalkanPenyesuaian,
  buatLembarOpname,
  buatPenyesuaian,
  daftarPenyesuaian,
  detailPenyesuaian,
  selesaikanPenyesuaian,
  ubahPenyesuaian,
} from './service';
import { imporSaldoAwal, templatSaldoAwal } from './saldo-awal';

const lihat = requirePermission('persediaan.stok.lihat');
const kelola = requirePermission('persediaan.penyesuaian.kelola');

/** Penyesuaian stok (docs/05 §12): Admin dan Owner. */
export const penyesuaianRoutes = new Hono<EnvApp>()
  .get('/saldo-awal/templat', kelola, async (c) =>
    c.body(await templatSaldoAwal(), 200, headerUnduhan('templat-saldo-awal.xlsx')),
  )
  .post('/saldo-awal/impor', kelola, batasUnggahXlsx, async (c) => {
    const { isi, nama } = await berkasKiriman(c, 'xlsx');
    const data = await imporSaldoAwal(isi, nama, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .get('/', lihat, zValidator('query', skemaCariPenyesuaian, kaitValidasi), async (c) =>
    c.json(await daftarPenyesuaian(c.req.valid('query'), penggunaWajib(c)), 200),
  )
  .get('/:id', lihat, paramId, async (c) =>
    c.json({ data: await detailPenyesuaian(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaPenyesuaian, kaitValidasi), async (c) => {
    const data = await buatPenyesuaian(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .post(
    '/lembar-opname',
    kelola,
    zValidator('json', skemaBuatLembarOpname, kaitValidasi),
    async (c) => {
      const data = await buatLembarOpname(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 201);
    },
  )
  .put('/:id', kelola, paramId, zValidator('json', skemaPenyesuaian, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPenyesuaian(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/:id/selesai', kelola, paramId, async (c) => {
    const data = await selesaikanPenyesuaian(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/batal', kelola, paramId, async (c) => {
    const data = await batalkanPenyesuaian(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
