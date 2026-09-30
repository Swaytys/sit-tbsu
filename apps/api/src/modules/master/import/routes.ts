import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, UKURAN_XLSX_MAKS } from '../../../lib/excel';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { prosesImportBarang, templatImport } from './service';

const izin = requirePermission('master.import.jalankan');
const batasUnggah = bodyLimit({
  maxSize: UKURAN_XLSX_MAKS + 64 * 1024,
  onError: () => {
    throw new AppError('VALIDASI', 'Ukuran berkas Excel maksimal 5 MB.', 413);
  },
});

async function berkasKiriman(c: Context<EnvApp>): Promise<{ isi: Uint8Array; nama: string }> {
  const body = await c.req.parseBody();
  const berkas = body.berkas;
  if (!(berkas instanceof File)) {
    throw new AppError('VALIDASI', 'Pilih berkas Excel (.xlsx) untuk diunggah.', 400);
  }
  return { isi: new Uint8Array(await berkas.arrayBuffer()), nama: berkas.name.slice(0, 100) };
}

/** Import Excel barang (docs/07 Fase 3, K-056): templat, pratinjau, simpan. */
export const importRoutes = new Hono<EnvApp>()
  .get('/barang/templat', izin, async (c) =>
    c.body(await templatImport(), 200, headerUnduhan('templat-import-barang.xlsx')),
  )
  .post('/barang/pratinjau', izin, batasUnggah, async (c) => {
    const { isi, nama } = await berkasKiriman(c);
    const data = await prosesImportBarang(isi, nama, false, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  })
  .post('/barang', izin, batasUnggah, async (c) => {
    const { isi, nama } = await berkasKiriman(c);
    const data = await prosesImportBarang(isi, nama, true, penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
