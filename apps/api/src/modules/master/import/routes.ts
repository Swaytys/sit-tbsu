import { zValidator } from '@hono/zod-validator';
import { skemaProsesImport } from '@sit/shared';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, UKURAN_XLSX_MAKS } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { bacaBerkasImport, eksporBarang, prosesImportBarang, templatImport } from './service';

const izin = requirePermission('master.import.jalankan');
const batasUnggah = bodyLimit({
  maxSize: UKURAN_XLSX_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Ukuran berkas Excel maksimal 5 MB.', 413);
  },
});
const skemaJenisTemplat = z.object({
  jenis: z.enum(['ringkas', 'lengkap']).default('ringkas'),
});

async function berkasKiriman(c: Context<EnvApp>): Promise<{ isi: Uint8Array; nama: string }> {
  const body = await c.req.parseBody();
  const berkas = body.berkas;
  if (!(berkas instanceof File)) {
    throw new AppError('VALIDASI', 'Pilih berkas Excel (.xlsx) untuk diunggah.', 400);
  }
  return { isi: new Uint8Array(await berkas.arrayBuffer()), nama: berkas.name.slice(0, 100) };
}

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
  .post('/barang/baca', izin, batasUnggah, async (c) => {
    const { isi, nama } = await berkasKiriman(c);
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
  });
