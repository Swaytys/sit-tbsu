import type { HasilCari } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { pelanggan } from '../../db/schema';
import { db } from '../../db/client';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

async function cari(sesi: Sesi, q: string) {
  const r = await minta(`/api/cari?q=${encodeURIComponent(q)}`, { cookie: sesi.cookie });
  return (await json<{ data: HasilCari[] }>(r)).data;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan);
  await db
    .insert(pelanggan)
    .values({ kode: 'PLG-00001', namaPelanggan: 'Semen Makmur Toko', noHp: '081234567890' });
});

describe('pencarian universal (K-167)', () => {
  it('hasil disaring per izin: Staf melihat barang tanpa tautan ubah, tidak melihat pemasok', async () => {
    const staf = await sesiUji('STAF_PENJUALAN');
    const h = await cari(staf, 'semen');
    expect(h.some((x) => x.jenis === 'BARANG' && x.tautan === null)).toBe(true);
    expect(h.some((x) => x.jenis === 'PELANGGAN')).toBe(true);
    expect(h.some((x) => x.jenis === 'PEMASOK')).toBe(false);
    const admin = await sesiUji('ADMIN');
    const a = await cari(admin, 'semen');
    expect(a.find((x) => x.jenis === 'BARANG')?.tautan).toMatch(/^\/barang\/\d+$/);
    expect((await cari(admin, 'jaya')).some((x) => x.jenis === 'PEMASOK')).toBe(true);
  });

  it('kata kurang dari 2 huruf kosong; tanpa login ditolak', async () => {
    const admin = await sesiUji('ADMIN');
    expect(await cari(admin, 's')).toEqual([]);
    expect((await minta('/api/cari?q=semen')).status).toBe(401);
  });
});
