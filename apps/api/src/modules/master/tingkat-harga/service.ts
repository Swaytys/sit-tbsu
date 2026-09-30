import type { Izin, TingkatHarga } from '@sit/shared';
import { db } from '../../../db/client';
import * as repo from './repo';

/**
 * Tingkat harga (tier) dibaca semua peran: namanya tampil di pelanggan, order, dan checkout. Markup default
 * hanya untuk pemegang `master.barang.lihat_hpp` karena membuka margin toko (docs/06 H12).
 */
export async function daftarTingkatHarga(izin: ReadonlySet<Izin>): Promise<TingkatHarga[]> {
  const lihatMarkup = izin.has('master.barang.lihat_hpp');
  const baris = await repo.daftarTingkatHarga(db);
  return baris.map(({ markupDefaultPersen, ...b }) =>
    lihatMarkup ? { ...b, markupDefaultPersen } : b,
  );
}
