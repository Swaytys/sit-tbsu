import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import {
  KONDISI_RETUR,
  LINGKUP_VOID,
  METODE_REFUND,
  PENYELESAIAN_RETUR,
  STATUS_PERSETUJUAN,
} from '@sit/shared';
import { shiftKasir } from './kas';
import { penyelesaianKonsinyasi } from './transaksi-pemasok';
import {
  dalamDaftar,
  dibuatPada,
  diubahPada,
  kolomId,
  kolomRef,
  qty,
  tanggal,
  timestamptz,
  uang,
} from './kolom';
import { barang } from './master';
import { penjualan, penjualanDetail } from './penjualan';
import { pengguna } from './sistem';

// Bagian RETUR PENJUALAN dan VOID.

/** [APPEND] kecuali status persetujuan. */
export const returPenjualan = pgTable(
  'retur_penjualan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('retur_penjualan_nomor_key'),
    idPenjualan: kolomRef('id_penjualan').notNull(),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPengaju: kolomRef('id_pengaju').notNull(),
    idPenyetuju: kolomRef('id_penyetuju'),
    waktuPersetujuan: timestamptz('waktu_persetujuan'),
    status: varchar('status', { length: 10, enum: STATUS_PERSETUJUAN })
      .notNull()
      .default('MENUNGGU'),
    alasan: varchar('alasan', { length: 255 }).notNull(),
    penyelesaian: varchar('penyelesaian', { length: 15, enum: PENYELESAIAN_RETUR }).notNull(),
    totalRetur: uang('total_retur').notNull().default(0),
    metodeRefund: varchar('metode_refund', { length: 10, enum: METODE_REFUND }),
    rekeningRefund: varchar('rekening_refund', { length: 60 }),
    referensiRefund: varchar('referensi_refund', { length: 60 }),
    idShift: kolomRef('id_shift'),
    alasanPenolakan: varchar('alasan_penolakan', { length: 255 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'retur_penjualan_id_penjualan_fkey',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    foreignKey({
      name: 'retur_penjualan_id_pengaju_fkey',
      columns: [t.idPengaju],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'retur_penjualan_id_penyetuju_fkey',
      columns: [t.idPenyetuju],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'retur_penjualan_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    check('chk_retur_status', dalamDaftar('status', STATUS_PERSETUJUAN)),
    check('chk_retur_penyelesaian', dalamDaftar('penyelesaian', PENYELESAIAN_RETUR)),
    check(
      'chk_retur_refund',
      sql`penyelesaian <> 'REFUND' or metode_refund in ('TUNAI','TRANSFER')`,
    ),
    check('chk_retur_total', sql`total_retur >= 0`),
    index('idx_retur_penjualan').on(t.idPenjualan),
    index('idx_retur_status').on(t.status),
    index('idx_retur_tanggal').on(t.tanggalOperasional),
  ],
);

/** [APPEND] */
export const returPenjualanDetail = pgTable(
  'retur_penjualan_detail',
  {
    id: kolomId(),
    idRetur: kolomRef('id_retur').notNull(),
    idPenjualanDetail: kolomRef('id_penjualan_detail').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    qtyRetur: qty('qty_retur').notNull(),
    qtyReturDasar: qty('qty_retur_dasar').notNull(),
    hargaSatuanEfektif: uang('harga_satuan_efektif').notNull(),
    nominalRetur: uang('nominal_retur').notNull(),
    kondisi: varchar('kondisi', { length: 6, enum: KONDISI_RETUR }).notNull(),
    idBarangPengganti: kolomRef('id_barang_pengganti'),
    qtyPenggantiDasar: qty('qty_pengganti_dasar'),
    keterangan: varchar('keterangan', { length: 150 }),
    dibuatPada: dibuatPada(),
    /** KS5–KS6 (K-089): penyelesaian konsinyasi yang sudah memperhitungkan retur baris ini. */
    idPenyelesaianKonsinyasi: kolomRef('id_penyelesaian_konsinyasi'),
  },
  (t) => [
    foreignKey({
      name: 'retur_penjualan_detail_id_retur_fkey',
      columns: [t.idRetur],
      foreignColumns: [returPenjualan.id],
    }),
    foreignKey({
      name: 'retur_penjualan_detail_id_penjualan_detail_fkey',
      columns: [t.idPenjualanDetail],
      foreignColumns: [penjualanDetail.id],
    }),
    foreignKey({
      name: 'retur_penjualan_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'retur_penjualan_detail_id_barang_pengganti_fkey',
      columns: [t.idBarangPengganti],
      foreignColumns: [barang.id],
    }),
    check('chk_retur_detail_qty', sql`qty_retur > 0 and qty_retur_dasar > 0`),
    check('chk_retur_detail_nominal', sql`nominal_retur >= 0 and harga_satuan_efektif >= 0`),
    check('chk_retur_detail_kondisi', dalamDaftar('kondisi', KONDISI_RETUR)),
    check(
      'chk_retur_detail_tukar',
      sql`num_nonnulls(id_barang_pengganti, qty_pengganti_dasar) in (0, 2)
        and (qty_pengganti_dasar is null or qty_pengganti_dasar > 0)`,
    ),
    index('idx_retur_detail_header').on(t.idRetur),
    index('idx_retur_detail_penjualan').on(t.idPenjualanDetail),
    index('idx_retur_detail_barang').on(t.idBarang),
    foreignKey({
      name: 'retur_penjualan_detail_id_penyelesaian_konsinyasi_fkey',
      columns: [t.idPenyelesaianKonsinyasi],
      foreignColumns: [penyelesaianKonsinyasi.id],
    }),
    index('idx_retur_detail_ksg').on(t.idPenyelesaianKonsinyasi),
  ],
);

/** [APPEND] kecuali status persetujuan. */
export const voidTransaksi = pgTable(
  'void_transaksi',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('void_transaksi_nomor_key'),
    idPenjualan: kolomRef('id_penjualan').notNull(),
    lingkup: varchar('lingkup', { length: 10, enum: LINGKUP_VOID }).notNull(),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPengaju: kolomRef('id_pengaju').notNull(),
    idPenyetuju: kolomRef('id_penyetuju'),
    waktuPersetujuan: timestamptz('waktu_persetujuan'),
    status: varchar('status', { length: 10, enum: STATUS_PERSETUJUAN })
      .notNull()
      .default('MENUNGGU'),
    alasan: varchar('alasan', { length: 255 }).notNull(),
    alasanPenolakan: varchar('alasan_penolakan', { length: 255 }),
    nominalVoid: uang('nominal_void').notNull().default(0),
    nominalRefund: uang('nominal_refund').notNull().default(0),
    metodeRefund: varchar('metode_refund', { length: 10, enum: METODE_REFUND }),
    idShift: kolomRef('id_shift'),
    keterangan: varchar('keterangan', { length: 150 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'void_transaksi_id_penjualan_fkey',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    foreignKey({
      name: 'void_transaksi_id_pengaju_fkey',
      columns: [t.idPengaju],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'void_transaksi_id_penyetuju_fkey',
      columns: [t.idPenyetuju],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'void_transaksi_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    check('chk_void_lingkup', dalamDaftar('lingkup', LINGKUP_VOID)),
    check('chk_void_status', dalamDaftar('status', STATUS_PERSETUJUAN)),
    check('chk_void_refund', sql`metode_refund is null or metode_refund in ('TUNAI','TRANSFER')`),
    check('chk_void_nominal', sql`nominal_void >= 0 and nominal_refund >= 0`),
    index('idx_void_penjualan').on(t.idPenjualan),
    index('idx_void_status').on(t.status),
  ],
);

/** [APPEND] Lingkup TRANSAKSI = satu baris per item. */
export const voidTransaksiDetail = pgTable(
  'void_transaksi_detail',
  {
    id: kolomId(),
    idVoid: kolomRef('id_void').notNull(),
    idPenjualanDetail: kolomRef('id_penjualan_detail').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    qtyDasar: qty('qty_dasar').notNull(),
    nominal: uang('nominal').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'void_transaksi_detail_id_void_fkey',
      columns: [t.idVoid],
      foreignColumns: [voidTransaksi.id],
    }),
    foreignKey({
      name: 'void_transaksi_detail_id_penjualan_detail_fkey',
      columns: [t.idPenjualanDetail],
      foreignColumns: [penjualanDetail.id],
    }),
    foreignKey({
      name: 'void_transaksi_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    unique('uq_void_detail').on(t.idVoid, t.idPenjualanDetail),
    check('chk_void_detail', sql`qty_dasar > 0 and nominal >= 0`),
    index('idx_void_detail_penjualan_detail').on(t.idPenjualanDetail),
  ],
);
