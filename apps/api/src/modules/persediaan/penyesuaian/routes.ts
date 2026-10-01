import { zValidator } from '@hono/zod-validator';
import {
  skemaBuatLembarOpname,
  skemaCariPenyesuaian,
  skemaIdParam,
  skemaPenyesuaian,
} from '@sit/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, UKURAN_XLSX_MAKS } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
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

const batasUnggah = bodyLimit({
  maxSize: UKURAN_XLSX_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Ukuran berkas Excel maksimal 5 MB.', 413);
  },
});

const lihat = requirePermission('persediaan.stok.lihat');
const kelola = requirePermission('persediaan.penyesuaian.kelola');
const param = zValidator('param', skemaIdParam, kaitValidasi);

/** Penyesuaian stok (docs/05 §12): Admin dan Owner. */
export const penyesuaianRoutes = new Hono<EnvApp>()
  .get('/saldo-awal/templat', kelola, async (c) =>
    c.body(await templatSaldoAwal(), 200, headerUnduhan('templat-saldo-awal.xlsx')),
  )
  .post('/saldo-awal/impor', kelola, batasUnggah, async (c) => {
    const body = await c.req.parseBody();
    if (!(body.berkas instanceof File)) {
      throw new AppError('VALIDASI', 'Pilih berkas Excel (.xlsx) untuk diunggah.', 400);
    }
    const isi = new Uint8Array(await body.berkas.arrayBuffer());
    const data = await imporSaldoAwal(
      isi,
      body.berkas.name.slice(0, 100),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 201);
  })
  .get('/', lihat, zValidator('query', skemaCariPenyesuaian, kaitValidasi), async (c) =>
    c.json(await daftarPenyesuaian(c.req.valid('query')), 200),
  )
  .get('/:id', lihat, param, async (c) =>
    c.json({ data: await detailPenyesuaian(c.req.valid('param').id) }, 200),
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
  .put('/:id', kelola, param, zValidator('json', skemaPenyesuaian, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahPenyesuaian(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/:id/selesai', kelola, param, async (c) => {
    const data = await selesaikanPenyesuaian(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/batal', kelola, param, async (c) => {
    const data = await batalkanPenyesuaian(
      c.req.valid('param').id,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  });
