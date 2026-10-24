import { zValidator } from '@hono/zod-validator';
import { skemaBukaTahun, skemaTahunParam } from '@sit/shared';
import { Hono } from 'hono';
import { headerUnduhan } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { berkasArsip, bukaTahun, daftarTahun, periksaArsip, tutupTahunIni } from './service';

const kelola = requirePermission('sistem.cadangan.kelola');
const param = zValidator('param', skemaTahunParam, kaitValidasi);

/** Pengaturan › Arsip tahunan (Owner, K-165): daftar tahun, tutup, buka kembali, periksa, unduh berkas. */
export const arsipRoutes = new Hono<EnvApp>()
  .get('/', kelola, async (c) => c.json({ data: await daftarTahun() }, 200))
  .post('/:tahun/tutup', kelola, param, async (c) => {
    const data = await tutupTahunIni(c.req.valid('param').tahun, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post(
    '/:tahun/buka',
    kelola,
    param,
    zValidator('json', skemaBukaTahun, kaitValidasi),
    async (c) => {
      await bukaTahun(
        c.req.valid('param').tahun,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data: null }, 200);
    },
  )
  .post('/:tahun/periksa', kelola, param, async (c) => {
    const data = await periksaArsip(c.req.valid('param').tahun, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .get('/:tahun/berkas', kelola, param, async (c) => {
    const { isi, nama } = await berkasArsip(c.req.valid('param').tahun);
    return c.body(new Uint8Array(isi), 200, {
      ...headerUnduhan(nama),
      'Content-Type': 'application/gzip',
    });
  });
