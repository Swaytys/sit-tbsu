import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { env } from '../../../env';

beforeEach(async () => {
  await siapkanDatabaseSistem();
  env.TAILSCALE_CLI = 'Z:/tidak-ada/tailscale.exe';
});

describe('akses HP/tablet (K-217)', () => {
  it('tanpa Tailscale: status jelas; hanya pemegang izin pengaturan', async () => {
    const owner = await sesiUji('OWNER');
    const r = await minta('/api/akses-perangkat/periksa', { method: 'POST', cookie: owner.cookie });
    expect(r.status).toBe(200);
    const s = (await json<{ data: { tailscaleTerpasang: boolean; alamat: string | null } }>(r))
      .data;
    // Mesin uji bisa saja punya Tailscale terpasang di Program Files; yang pasti alamat hanya ada bila tersambung.
    if (!s.tailscaleTerpasang) expect(s.alamat).toBeNull();
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/akses-perangkat', { cookie: kasir.cookie })).status).toBe(403);
  });
});
