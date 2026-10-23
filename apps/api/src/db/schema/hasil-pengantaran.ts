import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import { KONDISI_RETUR, PENANGANAN_RUSAK } from '@sit/shared';
import { returPenjualan } from './koreksi';
import { dalamDaftar, kolomId, kolomRef, qty, timestamptz } from './kolom';
import { suratJalan, suratJalanDetail } from './penjualan';
import { pengguna } from './sistem';

/*
 * Hasil pengantaran per barang (migrasi 0023, K-149, docs/05 S10). [APPEND]: dicatat sekali per surat jalan,
 * tidak pernah diubah. Efek stok dan tagihan lewat retur yang dirujuk.
 */

export const suratJalanHasil = pgTable(
  'surat_jalan_hasil',
  {
    id: kolomId(),
    idSuratJalan: kolomRef('id_surat_jalan').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    waktu: timestamptz('waktu').notNull().defaultNow(),
    namaPenerima: varchar('nama_penerima', { length: 100 }),
    penangananRusak: varchar('penanganan_rusak', { length: 20, enum: PENANGANAN_RUSAK }),
    /** Retur tukar barang untuk barang rusak yang dikirim pengganti (K-151). */
    idReturTukar: kolomRef('id_retur_tukar'),
    /** Retur potong tagihan/refund untuk barang ditolak dan rusak yang tagihannya dikurangi. */
    idReturUang: kolomRef('id_retur_uang'),
    catatan: varchar('catatan', { length: 255 }),
  },
  (t) => [
    foreignKey({
      name: 'surat_jalan_hasil_id_surat_jalan_fkey',
      columns: [t.idSuratJalan],
      foreignColumns: [suratJalan.id],
    }),
    foreignKey({
      name: 'surat_jalan_hasil_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'surat_jalan_hasil_id_retur_tukar_fkey',
      columns: [t.idReturTukar],
      foreignColumns: [returPenjualan.id],
    }),
    foreignKey({
      name: 'surat_jalan_hasil_id_retur_uang_fkey',
      columns: [t.idReturUang],
      foreignColumns: [returPenjualan.id],
    }),
    unique('uq_surat_jalan_hasil').on(t.idSuratJalan),
    check(
      'chk_surat_jalan_hasil_penanganan',
      sql`penanganan_rusak is null or ${dalamDaftar('penanganan_rusak', PENANGANAN_RUSAK)}`,
    ),
  ],
);

export const suratJalanHasilDetail = pgTable(
  'surat_jalan_hasil_detail',
  {
    id: kolomId(),
    idHasil: kolomRef('id_hasil').notNull(),
    idSuratJalanDetail: kolomRef('id_surat_jalan_detail').notNull(),
    qtyDiterima: qty('qty_diterima').notNull(),
    qtyKembali: qty('qty_kembali').notNull(),
    qtyRusak: qty('qty_rusak').notNull(),
    qtyDitolak: qty('qty_ditolak').notNull(),
    kondisiDitolak: varchar('kondisi_ditolak', { length: 10, enum: KONDISI_RETUR }),
  },
  (t) => [
    foreignKey({
      name: 'surat_jalan_hasil_detail_id_hasil_fkey',
      columns: [t.idHasil],
      foreignColumns: [suratJalanHasil.id],
    }),
    foreignKey({
      name: 'surat_jalan_hasil_detail_id_surat_jalan_detail_fkey',
      columns: [t.idSuratJalanDetail],
      foreignColumns: [suratJalanDetail.id],
    }),
    unique('uq_surat_jalan_hasil_detail').on(t.idSuratJalanDetail),
    check(
      'chk_surat_jalan_hasil_qty',
      sql`qty_diterima >= 0 and qty_kembali >= 0 and qty_rusak >= 0 and qty_ditolak >= 0`,
    ),
    check(
      'chk_surat_jalan_hasil_kondisi',
      sql`kondisi_ditolak is null or ${dalamDaftar('kondisi_ditolak', KONDISI_RETUR)}`,
    ),
  ],
);
