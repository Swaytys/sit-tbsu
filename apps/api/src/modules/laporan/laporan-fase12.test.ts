import type { DokumenLaporan } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, tingkatHarga } from '../../db/schema';

/*
 * Daftar Harga (Fase 12, K-090): harga jual per tier aktif, barang aktif per kategori; boleh dilihat Kasir
 * (laporan.penjualan) dan tidak memuat data sensitif.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(tingkatHarga);
  const [normal, grosir, mati] = await db
    .insert(tingkatHarga)
    .values([
      { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true, urutan: 1 },
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '15', urutan: 2 },
      {
        kode: 'LAMA',
        nama: 'Tier Lama',
        markupDefaultPersen: '10',
        urutan: 3,
        statusAktif: 'NONAKTIF',
      },
    ])
    .returning();
  const tetap = (idBarang: number, idTingkatHarga: number, harga: number) => ({
    idBarang,
    idTingkatHarga,
    metode: 'TETAP' as const,
    hargaTetap: harga,
    hargaJual: harga,
  });
  await db
    .insert(hargaBarang)
    .values([
      tetap(m.semen, normal!.id, 12_000),
      tetap(m.semen, grosir!.id, 11_000),
      tetap(m.semen, mati!.id, 10_000),
      tetap(m.pasir, normal!.id, 4000),
    ]);
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
});

describe('Laporan Daftar Harga', () => {
  it('kolom per tier aktif, barang aktif saja; Kasir boleh, Staf ditolak', async () => {
    const r = await minta('/api/laporan/daftar-harga', { cookie: kasir.cookie });
    expect(r.status).toBe(200);
    const dok = (await json<{ data: DokumenLaporan }>(r)).data;
    expect(dok.judul).toBe('Daftar Harga Barang');
    const bagian = dok.bagian.find((b) => b.jenis === 'tabel');
    if (bagian?.jenis !== 'tabel') throw new Error('tabel tidak ada');
    expect(bagian.tabel.kolom.map((k) => k.judul)).toEqual([
      'No',
      'Kode',
      'Nama Barang',
      'Satuan',
      'Normal',
      'Grosir',
    ]);
    const data = bagian.tabel.baris.filter((b) => b.gaya === 'data');
    // Semen, pasir, cat titipan (aktif); barang nonaktif tidak ikut.
    expect(data).toHaveLength(3);
    const semen = data.find((b) => JSON.stringify(b.sel).includes('Semen Gresik'));
    expect(semen?.sel.slice(4)).toEqual([
      { j: 'uang', v: 12_000 },
      { j: 'uang', v: 11_000 },
    ]);
    expect(JSON.stringify(dok)).not.toMatch(/hpp|harga modal|harga titip/i);
    expect((await minta('/api/laporan/daftar-harga', { cookie: staf.cookie })).status).toBe(403);
  });
});
