import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import {
  KONDISI_STOK,
  JENIS_ALOKASI_UANG_MUKA,
  METODE_PEMBAYARAN_PEMASOK,
  PENYELESAIAN_RETUR_PEMASOK,
  STATUS_HUTANG,
} from '@sit/shared';
import { shiftKasir } from './kas';
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
import { barang, pemasok } from './master';
import { orderPembelian, penerimaanBarang } from './persediaan';
import { pengguna } from './sistem';

// Bagian RETUR PEMASOK, KONSINYASI, dan PEMBAYARAN PEMASOK (tabel M2; UI mulai Fase 10–11).

/** [APPEND] */
export const returPemasok = pgTable(
  'retur_pemasok',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('retur_pemasok_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPemasok: kolomRef('id_pemasok').notNull(),
    idPenerimaan: kolomRef('id_penerimaan'),
    idPengguna: kolomRef('id_pengguna').notNull(),
    alasan: varchar('alasan', { length: 255 }).notNull(),
    penyelesaian: varchar('penyelesaian', {
      length: 22,
      enum: PENYELESAIAN_RETUR_PEMASOK,
    }).notNull(),
    totalRetur: uang('total_retur').notNull().default(0),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'retur_pemasok_id_pemasok_fkey',
      columns: [t.idPemasok],
      foreignColumns: [pemasok.id],
    }),
    foreignKey({
      name: 'retur_pemasok_id_penerimaan_fkey',
      columns: [t.idPenerimaan],
      foreignColumns: [penerimaanBarang.id],
    }),
    foreignKey({
      name: 'retur_pemasok_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_retur_pemasok_penyelesaian',
      dalamDaftar('penyelesaian', PENYELESAIAN_RETUR_PEMASOK),
    ),
    check('chk_retur_pemasok_total', sql`total_retur >= 0`),
    index('idx_retur_pemasok_pemasok').on(t.idPemasok),
  ],
);

/** [APPEND] */
export const returPemasokDetail = pgTable(
  'retur_pemasok_detail',
  {
    id: kolomId(),
    idReturPemasok: kolomRef('id_retur_pemasok').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    kondisiAsal: varchar('kondisi_asal', { length: 6, enum: KONDISI_STOK })
      .notNull()
      .default('BAIK'),
    qtyDasar: qty('qty_dasar').notNull(),
    hppSatuan: uang('hpp_satuan').notNull(),
    subtotal: uang('subtotal').notNull(),
    keterangan: varchar('keterangan', { length: 150 }),
  },
  (t) => [
    foreignKey({
      name: 'retur_pemasok_detail_id_retur_pemasok_fkey',
      columns: [t.idReturPemasok],
      foreignColumns: [returPemasok.id],
    }),
    foreignKey({
      name: 'retur_pemasok_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    check('chk_retur_pemasok_detail_kondisi', dalamDaftar('kondisi_asal', KONDISI_STOK)),
    check('chk_retur_pemasok_detail', sql`qty_dasar > 0 and hpp_satuan >= 0 and subtotal >= 0`),
    index('idx_retur_pemasok_detail_header').on(t.idReturPemasok),
    index('idx_retur_pemasok_detail_barang').on(t.idBarang),
  ],
);

/** [APPEND] kecuali cache hutang. */
export const penyelesaianKonsinyasi = pgTable(
  'penyelesaian_konsinyasi',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('penyelesaian_konsinyasi_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPemasok: kolomRef('id_pemasok').notNull(),
    periodeMulai: tanggal('periode_mulai').notNull(),
    periodeSelesai: tanggal('periode_selesai').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    total: uang('total').notNull().default(0),
    totalDibayar: uang('total_dibayar').notNull().default(0),
    sisaHutang: uang('sisa_hutang').generatedAlwaysAs(sql`total - total_dibayar`),
    statusHutang: varchar('status_hutang', { length: 12, enum: STATUS_HUTANG })
      .notNull()
      .default('BELUM_LUNAS'),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'penyelesaian_konsinyasi_id_pemasok_fkey',
      columns: [t.idPemasok],
      foreignColumns: [pemasok.id],
    }),
    foreignKey({
      name: 'penyelesaian_konsinyasi_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_ksg_periode', sql`periode_selesai >= periode_mulai`),
    check(
      'chk_ksg_status',
      dalamDaftar(
        'status_hutang',
        STATUS_HUTANG.filter((s) => s !== 'TIDAK_ADA'),
      ),
    ),
    check('chk_ksg_total', sql`total >= 0 and total_dibayar >= 0 and total_dibayar <= total`),
    index('idx_ksg_pemasok').on(t.idPemasok),
  ],
);

/** [APPEND] */
export const penyelesaianKonsinyasiDetail = pgTable(
  'penyelesaian_konsinyasi_detail',
  {
    id: kolomId(),
    idPenyelesaian: kolomRef('id_penyelesaian').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    qtyTerjual: qty('qty_terjual')
      .notNull()
      .default(sql`0`),
    qtyRetur: qty('qty_retur')
      .notNull()
      .default(sql`0`),
    qtyNeto: qty('qty_neto').notNull(),
    hargaTitip: uang('harga_titip').notNull(),
    subtotal: uang('subtotal').notNull(),
    /** K-092: barang titipan yang dimusnahkan toko (toko menanggung, dibayar ke penitip). */
    qtyGantiRugi: qty('qty_ganti_rugi')
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    foreignKey({
      name: 'penyelesaian_konsinyasi_detail_id_penyelesaian_fkey',
      columns: [t.idPenyelesaian],
      foreignColumns: [penyelesaianKonsinyasi.id],
    }),
    foreignKey({
      name: 'penyelesaian_konsinyasi_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    // Satu baris per barang per harga titip saat jual (KS9, K-089).
    unique('uq_ksg_detail').on(t.idPenyelesaian, t.idBarang, t.hargaTitip),
    check(
      'chk_ksg_detail',
      sql`qty_terjual >= 0 and qty_retur >= 0 and qty_ganti_rugi >= 0 and qty_neto >= 0 and harga_titip >= 0 and subtotal >= 0`,
    ),
  ],
);

/**
 * K-241 (migrasi 0052): hutang ke pemasok yang sudah ada sebelum memakai aplikasi (bagian Persediaan Awal). Tidak
 * menambah stok. [APPEND] kecuali `total_dibayar`, `status_hutang` (cache dari pembayaran_pemasok), `diubah_pada`.
 */
export const hutangAwal = pgTable(
  'hutang_awal',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('hutang_awal_nomor_key'),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPemasok: kolomRef('id_pemasok').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    noFakturLama: varchar('no_faktur_lama', { length: 50 }),
    tanggalFaktur: tanggal('tanggal_faktur'),
    total: uang('total').notNull(),
    totalDibayar: uang('total_dibayar').notNull().default(0),
    sisaHutang: uang('sisa_hutang').generatedAlwaysAs(sql`total - total_dibayar`),
    statusHutang: varchar('status_hutang', { length: 12, enum: STATUS_HUTANG })
      .notNull()
      .default('BELUM_LUNAS'),
    tanggalJatuhTempo: tanggal('tanggal_jatuh_tempo').notNull(),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'hutang_awal_id_pemasok_fkey',
      columns: [t.idPemasok],
      foreignColumns: [pemasok.id],
    }),
    foreignKey({
      name: 'hutang_awal_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_hutang_awal_total',
      sql`total > 0 and total_dibayar >= 0 and total_dibayar <= total`,
    ),
    check('chk_hutang_awal_status', dalamDaftar('status_hutang', STATUS_HUTANG)),
    index('idx_hutang_awal_pemasok').on(t.idPemasok),
  ],
);

/** [APPEND] */
export const pembayaranPemasok = pgTable(
  'pembayaran_pemasok',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('pembayaran_pemasok_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPemasok: kolomRef('id_pemasok').notNull(),
    idPenerimaan: kolomRef('id_penerimaan'),
    idPenyelesaianKonsinyasi: kolomRef('id_penyelesaian_konsinyasi'),
    idPengguna: kolomRef('id_pengguna').notNull(),
    nominal: uang('nominal').notNull(),
    metode: varchar('metode', { length: 10, enum: METODE_PEMBAYARAN_PEMASOK }).notNull(),
    idReturPemasok: kolomRef('id_retur_pemasok'),
    rekening: varchar('rekening', { length: 60 }),
    referensi: varchar('referensi', { length: 60 }),
    idShift: kolomRef('id_shift'),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    /** K-125: uang muka order pembelian (dibayar sebelum barang datang). */
    idOrderPembelian: kolomRef('id_order_pembelian'),
    /** K-241 (migrasi 0052): pembayaran hutang awal pemasok. */
    idHutangAwal: kolomRef('id_hutang_awal'),
  },
  (t) => [
    foreignKey({
      name: 'pembayaran_pemasok_id_order_pembelian_fkey',
      columns: [t.idOrderPembelian],
      foreignColumns: [orderPembelian.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_pemasok_fkey',
      columns: [t.idPemasok],
      foreignColumns: [pemasok.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_penerimaan_fkey',
      columns: [t.idPenerimaan],
      foreignColumns: [penerimaanBarang.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_penyelesaian_konsinyasi_fkey',
      columns: [t.idPenyelesaianKonsinyasi],
      foreignColumns: [penyelesaianKonsinyasi.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_retur_pemasok_fkey',
      columns: [t.idReturPemasok],
      foreignColumns: [returPemasok.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    foreignKey({
      name: 'pembayaran_pemasok_id_hutang_awal_fkey',
      columns: [t.idHutangAwal],
      foreignColumns: [hutangAwal.id],
    }),
    check(
      'chk_pbp_sumber',
      sql`num_nonnulls(id_penerimaan, id_penyelesaian_konsinyasi, id_order_pembelian, id_hutang_awal) = 1`,
    ),
    check('chk_pbp_metode', dalamDaftar('metode', METODE_PEMBAYARAN_PEMASOK)),
    check('chk_pbp_kompensasi', sql`(metode = 'KOMPENSASI') = (id_retur_pemasok is not null)`),
    check('chk_pbp_nominal', sql`nominal > 0`),
    index('idx_pbp_pemasok').on(t.idPemasok),
    index('idx_pbp_penerimaan').on(t.idPenerimaan),
    index('idx_pbp_ksg').on(t.idPenyelesaianKonsinyasi),
  ],
);

/**
 * K-125 [APPEND]: pemakaian uang muka order pembelian. DIPAKAI = menjadi pembayaran penerimaan dari PO itu;
 * DIKEMBALIKAN = pemasok mengembalikan sisa uang muka (PO ditutup/batal). Sisa uang muka = Σ uang muka − Σ baris ini.
 */
export const alokasiUangMuka = pgTable(
  'alokasi_uang_muka',
  {
    id: kolomId(),
    idPembayaranPemasok: kolomRef('id_pembayaran_pemasok').notNull(),
    jenis: varchar('jenis', { length: 12, enum: JENIS_ALOKASI_UANG_MUKA }).notNull(),
    idPenerimaan: kolomRef('id_penerimaan'),
    nominal: uang('nominal').notNull(),
    metodeKembali: varchar('metode_kembali', { length: 10, enum: METODE_PEMBAYARAN_PEMASOK }),
    idShift: kolomRef('id_shift'),
    idPengguna: kolomRef('id_pengguna').notNull(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'alokasi_uang_muka_id_pembayaran_pemasok_fkey',
      columns: [t.idPembayaranPemasok],
      foreignColumns: [pembayaranPemasok.id],
    }),
    foreignKey({
      name: 'alokasi_uang_muka_id_penerimaan_fkey',
      columns: [t.idPenerimaan],
      foreignColumns: [penerimaanBarang.id],
    }),
    foreignKey({
      name: 'alokasi_uang_muka_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    foreignKey({
      name: 'alokasi_uang_muka_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_alokasi_jenis', dalamDaftar('jenis', JENIS_ALOKASI_UANG_MUKA)),
    check('chk_alokasi_nominal', sql`nominal > 0`),
    check(
      'chk_alokasi_sumber',
      sql`(jenis = 'DIPAKAI' and id_penerimaan is not null and metode_kembali is null)
        or (jenis = 'DIKEMBALIKAN' and id_penerimaan is null and metode_kembali in ('TUNAI', 'TRANSFER', 'DEPOSIT'))`,
    ),
    index('idx_alokasi_pembayaran').on(t.idPembayaranPemasok),
  ],
);
