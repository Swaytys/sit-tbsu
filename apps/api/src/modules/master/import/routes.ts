import { zValidator } from '@hono/zod-validator';
import { skemaProsesImport, skemaProsesMuatan, skemaUnduhMuatan } from '@sit/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { headerUnduhan } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { batasUnggahXlsx, berkasKiriman } from '../../../lib/unggah';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { bacaBerkasMuatan, berkasMuatan, prosesMuatan } from './muatan';
import { bacaBerkasImport, eksporBarang, prosesImportBarang, templatImport } from './service';

const izin = requirePermission('master.import.jalankan');
// K-161: isi massal data muatan = mengubah data barang yang sudah ada.
const kelolaBarang = requirePermission('master.barang.kelola');
const skemaJenisTemplat = z.object({
  jenis: z.enum(['ringkas', 'lengkap']).default('ringkas'),
});

/**
 * Import Excel barang (K-056, K-061, K-064): templat, ekspor data, baca berkas, pratinjau, simpan.
 * Pratinjau dan simpan menerima baris teks (JSON) sehingga baris bergalat bisa disunting di layar.
 */
export const importRoutes = new Hono<EnvApp>()
  .get('/barang/templat', izin, zValidator('query', skemaJenisTemplat, kaitValidasi), async (c) => {
    const { jenis } = c.req.valid('query');
    return c.body(await templatImport(jenis), 200, headerUnduhan(`templat-barang-${jenis}.xlsx`));
  })
  .get('/barang/ekspor', izin, async (c) => {
    const { isi, namaBerkas } = await eksporBarang(penggunaWajib(c).izin);
    return c.body(isi, 200, headerUnduhan(namaBerkas));
  })
  .post('/barang/baca', izin, batasUnggahXlsx, async (c) => {
    const { isi, nama } = await berkasKiriman(c, 'xlsx');
    return c.json({ data: await bacaBerkasImport(isi, nama, penggunaWajib(c)) }, 200);
  })
  .post(
    '/barang/pratinjau',
    izin,
    zValidator('json', skemaProsesImport, kaitValidasi),
    async (c) => {
      const data = await prosesImportBarang(
        c.req.valid('json'),
        false,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  .post('/barang', izin, zValidator('json', skemaProsesImport, kaitValidasi), async (c) => {
    const data = await prosesImportBarang(
      c.req.valid('json'),
      true,
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .get(
    '/muatan/berkas',
    kelolaBarang,
    zValidator('query', skemaUnduhMuatan, kaitValidasi),
    async (c) => {
      const { isi, namaBerkas } = await berkasMuatan(c.req.valid('query').belum === '1');
      return c.body(isi, 200, headerUnduhan(namaBerkas));
    },
  )
  .post('/muatan/baca', kelolaBarang, batasUnggahXlsx, async (c) => {
    const { isi, nama } = await berkasKiriman(c, 'xlsx');
    return c.json({ data: await bacaBerkasMuatan(isi, nama) }, 200);
  })
  .post(
    '/muatan/pratinjau',
    kelolaBarang,
    zValidator('json', skemaProsesMuatan, kaitValidasi),
    async (c) => {
      const data = await prosesMuatan(c.req.valid('json'), false, penggunaWajib(c), c.get('asal'));
      return c.json({ data }, 200);
    },
  )
  .post('/muatan', kelolaBarang, zValidator('json', skemaProsesMuatan, kaitValidasi), async (c) => {
    const data = await prosesMuatan(c.req.valid('json'), true, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
