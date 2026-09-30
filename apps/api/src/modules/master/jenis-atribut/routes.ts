import { zValidator } from '@hono/zod-validator';
import { skemaIdParam, skemaJenisAtribut, skemaSaringStatus, skemaUbahStatus } from '@sit/shared';
import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  daftarJenisAtribut,
  tambahJenisAtribut,
  ubahJenisAtribut,
  ubahStatusJenisAtribut,
} from './service';

// Jenis atribut dikelola dengan izin satuan (docs/04 §2: "Kelola satuan, jenis atribut, satuan jual").
const kelola = requirePermission('master.satuan.kelola');
const param = zValidator('param', skemaIdParam, kaitValidasi);

export const jenisAtributRoutes = new Hono<EnvApp>()
  .get(
    '/',
    requirePermission('master.barang.lihat'),
    zValidator('query', skemaSaringStatus, kaitValidasi),
    async (c) => c.json({ data: await daftarJenisAtribut(c.req.valid('query').status) }, 200),
  )
  .post('/', kelola, zValidator('json', skemaJenisAtribut, kaitValidasi), async (c) => {
    const data = await tambahJenisAtribut(c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 201);
  })
  .patch('/:id', kelola, param, zValidator('json', skemaJenisAtribut, kaitValidasi), async (c) => {
    const { id } = c.req.valid('param');
    const data = await ubahJenisAtribut(id, c.req.valid('json'), penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .patch(
    '/:id/status',
    kelola,
    param,
    zValidator('json', skemaUbahStatus, kaitValidasi),
    async (c) => {
      const { id } = c.req.valid('param');
      const { statusAktif } = c.req.valid('json');
      const data = await ubahStatusJenisAtribut(id, statusAktif, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  );
