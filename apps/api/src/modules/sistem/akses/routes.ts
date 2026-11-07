import { zValidator } from '@hono/zod-validator';
import { skemaAturLan } from '@sit/shared';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import type { EnvApp } from '../../../lib/konteks';
import { kaitValidasi } from '../../../lib/validasi';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import {
  aturLan,
  daftarPerangkat,
  lewatLan,
  NAMA_COOKIE_PERANGKAT,
  pasangCookiePerangkat,
  putuskanPerangkat,
  statusLan,
  statusPerangkatSaya,
} from './lan';
import { periksaAksesPerangkat, statusAksesPerangkat } from './tailscale';

const izin = requirePermission('sistem.pengaturan.kelola');
const paramId = z.object({ id: z.coerce.number().int().positive() });

/** K-217 + K-229: Pengaturan › Akses HP/tablet (Tailscale dan mode LAN toko). */
export const aksesRoutes = new Hono<EnvApp>()
  .get('/', izin, async (c) => c.json({ data: await statusAksesPerangkat() }, 200))
  .post('/periksa', izin, async (c) => c.json({ data: await periksaAksesPerangkat(false) }, 200))
  .post('/aktifkan', izin, async (c) => c.json({ data: await periksaAksesPerangkat(true) }, 200))
  .get('/lan', izin, async (c) => c.json({ data: await statusLan() }, 200))
  .post('/lan', izin, zValidator('json', skemaAturLan, kaitValidasi), async (c) =>
    c.json(
      { data: await aturLan(c.req.valid('json').aktif, penggunaWajib(c), c.get('asal')) },
      200,
    ),
  )
  .post(
    '/lan/perangkat/:id/:keputusan{setujui|tolak|cabut}',
    izin,
    zValidator(
      'param',
      paramId.extend({ keputusan: z.enum(['setujui', 'tolak', 'cabut']) }),
      kaitValidasi,
    ),
    async (c) => {
      const { id, keputusan } = c.req.valid('param');
      const status =
        keputusan === 'setujui' ? 'DISETUJUI' : keputusan === 'tolak' ? 'DITOLAK' : 'DICABUT';
      return c.json(
        { data: await putuskanPerangkat(id, status, penggunaWajib(c), c.get('asal')) },
        200,
      );
    },
  );

/**
 * K-229: HP/tablet di mode LAN mendaftarkan dirinya dan membaca status pendaftarannya. Rute publik (perangkat belum
 * disetujui dan belum ada sesi); tidak membuka data apa pun selain kode dan status perangkat itu sendiri.
 */
export const perangkatRoutes = new Hono<EnvApp>()
  .post('/daftar', async (c) => {
    const h = await daftarPerangkat(getCookie(c, NAMA_COOKIE_PERANGKAT), c.get('asal'));
    if (h.token) pasangCookiePerangkat(c, h.token);
    return c.json({ data: { status: h.status, kode: h.kode } }, 200);
  })
  .get('/status', async (c) =>
    c.json(
      {
        data: {
          ...(await statusPerangkatSaya(getCookie(c, NAMA_COOKIE_PERANGKAT))),
          // Hanya permintaan lewat HTTPS LAN yang wajib perangkat disetujui.
          jalurLan: lewatLan(c),
        },
      },
      200,
    ),
  );
