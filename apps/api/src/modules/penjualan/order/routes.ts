import { zValidator } from '@hono/zod-validator';
import {
  skemaBatalOrder,
  skemaCariAntrean,
  skemaCariDrafBarang,
  skemaCariOrder,
  skemaOrder,
  skemaPratinjauOrder,
  skemaSimpanOrder,
} from '@sit/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { dengarkan } from '../../../lib/siaran';
import { kaitValidasi, paramId } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  batalOrder,
  buatOrder,
  daftarOrder,
  detailOrder,
  drafBarangLain,
  keDrafOrder,
  kirimOrder,
  lepasOrder,
  papanAntrean,
  pratinjauOrder,
  prosesOrder,
  simpanOrder,
  ubahOrder,
} from './service';

const buat = requirePermission('penjualan.order.buat');
const checkout = requirePermission('penjualan.checkout');
const opsiKirim = zValidator(
  'query',
  z.object({ kirim: z.enum(['true', 'false']).optional() }),
  kaitValidasi,
);

/** Lama satu koneksi siaran; peramban menyambung ulang otomatis (izin diperiksa lagi saat itu). */
const UMUR_SIARAN_MS = 15 * 60 * 1000;
const DETAK_MS = 20 * 1000;

/** Order penjualan & antrean (docs/05 §3). Pemeriksaan pemilik/kunci ada di service. */
export const orderRoutes = new Hono<EnvApp>()
  .get('/antrean', checkout, zValidator('query', skemaCariAntrean, kaitValidasi), async (c) =>
    c.json({ data: await papanAntrean(c.req.valid('query').jenis) }, 200),
  )
  /**
   * Siaran perubahan antrean (Server-Sent Events, K-073): hanya tanda "berubah", tanpa data; layar memuat
   * ulang papan antrean sendiri. Header X-Accel-Buffering agar proxy tidak menahan aliran.
   */
  .get('/antrean/siaran', buat, (c) => {
    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async (aliran) => {
      let terbuka = true;
      const kirim = (event: string, data: string) =>
        aliran.writeSSE({ event, data }).catch(() => {
          terbuka = false; // koneksi sudah putus
        });
      const berhenti = dengarkan('antrean', () => {
        if (terbuka) void kirim('antrean', String(Date.now()));
      });
      aliran.onAbort(() => {
        terbuka = false;
        berhenti();
      });
      const mulai = Date.now();
      while (terbuka && Date.now() - mulai < UMUR_SIARAN_MS) {
        await kirim('detak', '');
        await aliran.sleep(DETAK_MS);
      }
      berhenti();
    });
  })
  /** K-122 butir 4: draf lain yang memuat barang ini (peringatan saat menambah barang). */
  .get('/draf-barang', buat, zValidator('query', skemaCariDrafBarang, kaitValidasi), async (c) =>
    c.json({ data: await drafBarangLain(c.req.valid('query'), penggunaWajib(c)) }, 200),
  )
  .get('/', buat, zValidator('query', skemaCariOrder, kaitValidasi), async (c) =>
    c.json(await daftarOrder(c.req.valid('query'), penggunaWajib(c)), 200),
  )
  .get('/:id', buat, paramId, async (c) =>
    c.json({ data: await detailOrder(c.req.valid('param').id, penggunaWajib(c)) }, 200),
  )
  /** PR5: pratinjau harga/promo/total tanpa menyimpan (layar order & kasir, setiap isi berubah). */
  .post('/pratinjau', buat, zValidator('json', skemaPratinjauOrder, kaitValidasi), async (c) =>
    c.json({ data: await pratinjauOrder(c.req.valid('json'), penggunaWajib(c)) }, 200),
  )
  .post('/', buat, opsiKirim, zValidator('json', skemaOrder, kaitValidasi), async (c) => {
    const data = await buatOrder(
      c.req.valid('json'),
      { kirim: c.req.valid('query').kirim === 'true' },
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 201);
  })
  .put('/:id', buat, paramId, zValidator('json', skemaOrder, kaitValidasi), async (c) => {
    const data = await ubahOrder(
      c.req.valid('param').id,
      c.req.valid('json'),
      penggunaWajib(c),
      c.get('asal'),
    );
    return c.json({ data }, 200);
  })
  .post('/:id/kirim', buat, paramId, async (c) =>
    c.json(
      { data: await kirimOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  /** R11 (K-122): simpan untuk diambil nanti (menahan stok, di luar antrean). */
  .post(
    '/:id/simpan',
    buat,
    paramId,
    zValidator('json', skemaSimpanOrder, kaitValidasi),
    async (c) => {
      const data = await simpanOrder(
        c.req.valid('param').id,
        c.req.valid('json'),
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  )
  /** R13 (K-122): kembalikan ke draf (reservasi dilepas, barang tetap). */
  .post('/:id/draf', buat, paramId, async (c) =>
    c.json(
      { data: await keDrafOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/:id/proses', checkout, paramId, async (c) =>
    c.json(
      { data: await prosesOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post('/:id/lepas', checkout, paramId, async (c) =>
    c.json(
      { data: await lepasOrder(c.req.valid('param').id, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post(
    '/:id/batal',
    requirePermission('penjualan.order.batal_sendiri'),
    paramId,
    zValidator('json', skemaBatalOrder, kaitValidasi),
    async (c) => {
      const data = await batalOrder(
        c.req.valid('param').id,
        c.req.valid('json').alasan,
        penggunaWajib(c),
        c.get('asal'),
      );
      return c.json({ data }, 200);
    },
  );
