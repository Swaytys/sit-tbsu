import { sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { satuan } from '../../db/schema';

/*
 * Satuan baris transaksi (K-091): satuan jual baris bila ada, selain itu satuan dasar barang. Kueri yang
 * menampilkan qty baris penjualan/order melakukan:
 *   .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
 *   .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, <detail>.idSatuanJual))
 *   .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
 */

/** Alias tabel satuan untuk satuan jual baris. */
export const satuanBaris = alias(satuan, 'satuan_baris');

/** Kode satuan baris: satuan jual, atau satuan dasar. */
export const kodeSatuanBaris = sql<string>`coalesce(${satuanBaris.kode}, ${satuan.kode})`;
