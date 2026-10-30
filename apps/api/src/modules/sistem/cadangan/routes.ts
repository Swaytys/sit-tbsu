import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { zValidator } from '@hono/zod-validator';
import { skemaAturCadangan } from '@sit/shared';
import { kaitValidasi } from '../../../lib/validasi';
import { aturCadangan, jalankanCadangan, jalankanUjiPulih, statusCadangan } from './service';

const kelola = requirePermission('sistem.cadangan.kelola');

/** Pengaturan › Cadangan (Owner, K-084): status, cadangkan sekarang, uji pulih sekarang. */
export const cadanganRoutes = new Hono<EnvApp>()
  .get('/', kelola, async (c) => c.json({ data: await statusCadangan() }, 200))
  .post('/jalankan', kelola, async (c) => {
    const data = await jalankanCadangan({ pemicu: 'MANUAL', pelaku: penggunaWajib(c) });
    return c.json({ data }, 202);
  })
  // K-198: atur folder dan sandi cadangan dari layar.
  .put('/aturan', kelola, zValidator('json', skemaAturCadangan, kaitValidasi), async (c) => {
    const { repoLokal, sandi } = c.req.valid('json');
    const data = await aturCadangan({ repoLokal, sandi }, penggunaWajib(c), c.get('asal').ip);
    return c.json({ data }, 200);
  })
  .post('/uji-pulih', kelola, async (c) => {
    const data = await jalankanUjiPulih({ pemicu: 'MANUAL', pelaku: penggunaWajib(c) });
    return c.json({ data }, 202);
  });
