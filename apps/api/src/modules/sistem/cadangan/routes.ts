import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { jalankanCadangan, jalankanUjiPulih, statusCadangan } from './service';

const kelola = requirePermission('sistem.cadangan.kelola');

/** Pengaturan › Cadangan (Owner, K-084): status, cadangkan sekarang, uji pulih sekarang. */
export const cadanganRoutes = new Hono<EnvApp>()
  .get('/', kelola, async (c) => c.json({ data: await statusCadangan() }, 200))
  .post('/jalankan', kelola, async (c) => {
    const data = await jalankanCadangan({ pemicu: 'MANUAL', pelaku: penggunaWajib(c) });
    return c.json({ data }, 202);
  })
  .post('/uji-pulih', kelola, async (c) => {
    const data = await jalankanUjiPulih({ pemicu: 'MANUAL', pelaku: penggunaWajib(c) });
    return c.json({ data }, 202);
  });
