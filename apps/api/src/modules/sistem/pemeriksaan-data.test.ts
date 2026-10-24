import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HasilPemeriksaanData, HasilRapikanNoHp } from '@sit/shared';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { pelanggan } from '../../db/schema';

// K-137 butir 3: pindai data lama (ganda, format salah) dan rapikan No. HP.

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(pelanggan);
  admin = await sesiUji('ADMIN');
  // Data lama yang lolos sebelum aturan ketat (ditulis langsung, tanpa API).
  await db.insert(pelanggan).values([
    { kode: 'PLG-1', namaPelanggan: 'Toko Sumber Jaya', noHp: '0857 1111 2222' },
    { kode: 'PLG-2', namaPelanggan: 'Sumber  Jaya', noHp: '+6281399990000' },
    { kode: 'PLG-3', namaPelanggan: 'Budi', noHp: '085711112222' },
    { kode: 'PLG-4', namaPelanggan: 'Ani', noHp: '12ab' },
  ]);
});

describe('pemeriksaan data (K-137)', () => {
  it('menemukan nama sama, No. HP sama, format salah; rapikan No. HP memperbaiki yang bisa', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/pemeriksaan-data', { cookie: kasir.cookie })).status).toBe(403);

    const h = (
      await json<{ data: HasilPemeriksaanData }>(
        await minta('/api/pemeriksaan-data', { cookie: admin.cookie }),
      )
    ).data;
    const kode = (g: HasilPemeriksaanData['ganda'][number]) => g.data.map((d) => d.kode).sort();
    expect(h.ganda.find((g) => g.alasan === 'nama sama' && g.jenis === 'pelanggan')).toBeDefined();
    expect(kode(h.ganda.find((g) => g.alasan === 'nama sama' && g.jenis === 'pelanggan')!)).toEqual(
      ['PLG-1', 'PLG-2'],
    );
    expect(
      kode(h.ganda.find((g) => g.alasan === 'No. HP sama' && g.jenis === 'pelanggan')!),
    ).toEqual(['PLG-1', 'PLG-3']);
    const fmt = new Map(
      h.format.filter((f) => f.jenis === 'pelanggan').map((f) => [f.kode, f.alasan]),
    );
    expect(fmt.get('PLG-1')).toContain('bisa dirapikan: +6285711112222');
    expect(fmt.get('PLG-2')).toContain('spasi berlebih');
    expect(fmt.get('PLG-4')).toContain('perbaiki manual');

    const r = (
      await json<{ data: HasilRapikanNoHp }>(
        await minta('/api/pemeriksaan-data/rapikan-no-hp', {
          method: 'POST',
          cookie: admin.cookie,
        }),
      )
    ).data;
    expect(r.diubah).toBe(2);
    expect(r.gagal).toEqual([expect.stringContaining('12ab')]);
    const [p1] = await db.select().from(pelanggan).where(eq(pelanggan.kode, 'PLG-1'));
    expect(p1?.noHp).toBe('+6285711112222');
  });
});
