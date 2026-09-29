import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { ARAH_KAS, JENIS_KAS_SHIFT, STATUS_SHIFT } from '@sit/shared';
import {
  dalamDaftar,
  dibuatPada,
  diubahPada,
  kolomId,
  kolomRef,
  tanggal,
  timestamptz,
  uang,
} from './kolom';
import { returPenjualan, voidTransaksi } from './koreksi';
import { pengguna } from './sistem';
import { pembayaranPemasok } from './transaksi-pemasok';

// Bagian SHIFT KASIR dan KAS SHIFT & CLERICAL.

/** [APPEND] kecuali status/waktu_tutup. */
export const shiftKasir = pgTable(
  'shift_kasir',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('shift_kasir_nomor_key'),
    idKasir: kolomRef('id_kasir').notNull(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    waktuBuka: timestamptz('waktu_buka').notNull().defaultNow(),
    waktuTutup: timestamptz('waktu_tutup'),
    modalAwal: uang('modal_awal').notNull().default(0),
    status: varchar('status', { length: 10, enum: STATUS_SHIFT }).notNull().default('BUKA'),
    dibukaKembaliOleh: kolomRef('dibuka_kembali_oleh'),
    alasanBukaKembali: varchar('alasan_buka_kembali', { length: 255 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'shift_kasir_id_kasir_fkey',
      columns: [t.idKasir],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'shift_kasir_dibuka_kembali_oleh_fkey',
      columns: [t.dibukaKembaliOleh],
      foreignColumns: [pengguna.id],
    }),
    check('chk_shift_status', dalamDaftar('status', STATUS_SHIFT)),
    check('chk_shift_modal', sql`modal_awal >= 0`),
    // Satu shift BUKA per kasir.
    uniqueIndex('uq_shift_buka_per_kasir')
      .on(t.idKasir)
      .where(sql`status = 'BUKA'`),
    index('idx_shift_tanggal').on(t.tanggalOperasional),
  ],
);

/** [APPEND] Kas masuk/keluar NON-penjualan per shift. */
export const kasShift = pgTable(
  'kas_shift',
  {
    id: kolomId(),
    idShift: kolomRef('id_shift').notNull(),
    waktu: timestamptz('waktu').notNull().defaultNow(),
    jenis: varchar('jenis', { length: 20, enum: JENIS_KAS_SHIFT }).notNull(),
    arah: varchar('arah', { length: 6, enum: ARAH_KAS }).notNull(),
    nominal: uang('nominal').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    idRetur: kolomRef('id_retur'),
    idVoid: kolomRef('id_void'),
    idPembayaranPemasok: kolomRef('id_pembayaran_pemasok'),
    keterangan: varchar('keterangan', { length: 255 }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'kas_shift_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    foreignKey({
      name: 'kas_shift_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'kas_shift_id_retur_fkey',
      columns: [t.idRetur],
      foreignColumns: [returPenjualan.id],
    }),
    foreignKey({
      name: 'kas_shift_id_void_fkey',
      columns: [t.idVoid],
      foreignColumns: [voidTransaksi.id],
    }),
    foreignKey({
      name: 'kas_shift_id_pembayaran_pemasok_fkey',
      columns: [t.idPembayaranPemasok],
      foreignColumns: [pembayaranPemasok.id],
    }),
    check('chk_kas_jenis', dalamDaftar('jenis', JENIS_KAS_SHIFT)),
    check('chk_kas_arah', dalamDaftar('arah', ARAH_KAS)),
    check('chk_kas_nominal', sql`nominal > 0`),
    check('chk_kas_ref', sql`num_nonnulls(id_retur, id_void, id_pembayaran_pemasok) <= 1`),
    index('idx_kas_shift').on(t.idShift),
  ],
);

/** [APPEND] Satu per shift. */
export const clericalCheck = pgTable(
  'clerical_check',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('clerical_check_nomor_key'),
    idShift: kolomRef('id_shift').notNull().unique('clerical_check_id_shift_key'),
    idPengguna: kolomRef('id_pengguna').notNull(),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    modalAwal: uang('modal_awal').notNull(),
    tunaiPenjualan: uang('tunai_penjualan').notNull(),
    kasMasukLain: uang('kas_masuk_lain').notNull().default(0),
    kasKeluar: uang('kas_keluar').notNull().default(0),
    saldoSistem: uang('saldo_sistem').notNull(),
    uangFisik: uang('uang_fisik').notNull(),
    selisih: uang('selisih').generatedAlwaysAs(sql`uang_fisik - saldo_sistem`),
    keterangan: varchar('keterangan', { length: 255 }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'clerical_check_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    foreignKey({
      name: 'clerical_check_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_clerical_keterangan', sql`uang_fisik = saldo_sistem or keterangan is not null`),
    check(
      'chk_clerical_nilai',
      sql`modal_awal >= 0 and tunai_penjualan >= 0 and kas_masuk_lain >= 0 and kas_keluar >= 0 and uang_fisik >= 0`,
    ),
    index('idx_clerical_tanggal').on(t.tanggalOperasional),
  ],
);
