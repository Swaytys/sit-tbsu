import { Hono } from 'hono';
import type { EnvApp } from '../../../lib/konteks';
import { penggunaWajib, requirePermission } from '../../../middleware/require-permission';
import { periksaData, rapikanSemuaNoHp } from './service';

const kelola = requirePermission('sistem.pengaturan.kelola');

/** Pengaturan › Pemeriksaan data (Admin/Owner, K-137): data ganda dan format salah, rapikan No. HP. */
export const pemeriksaanDataRoutes = new Hono<EnvApp>()
  .get('/', kelola, async (c) => c.json({ data: await periksaData() }, 200))
  .post('/rapikan-no-hp', kelola, async (c) => {
    const data = await rapikanSemuaNoHp(penggunaWajib(c), c.get('asal'));
    return c.json({ data }, 200);
  });
