import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  ARAH_KAS,
  CARA_BUKA_SHIFT,
  JENIS_HITUNG_KAS,
  JENIS_KAS_SHIFT,
  JENIS_REKENING,
  STATUS_AKTIF,
  STATUS_SHIFT,
  type RincianPecahan,
} from '@sit/shared';
import {
  dalamDaftar,
  dibuatPada,
  diubahPada,
  kolomId,
  kolomRef,
  statusAktif,
  tanggal,
  timestamptz,
  uang,
} from './kolom';
import { returPenjualan, voidTransaksi } from './koreksi';
import { pengguna } from './sistem';
import { pembayaranPemasok } from './transaksi-pemasok';

// Bagian SHIFT KASIR dan KAS SHIFT & CLERICAL.

/**
 * K-111 (migrasi 0018): rekening toko = tujuan pembayaran non-tunai yang diterima toko (rekening bank untuk
 * TRANSFER, mesin EDC, QRIS). Data master: tidak dihapus, dinonaktifkan. `nama` = label lengkap yang
 * disalin ke `pembayaran_penjualan.rekening` saat pembayaran dicatat.
 */
export const rekeningToko = pgTable(
  'rekening_toko',
  {
    id: kolomId(),
    jenis: varchar('jenis', { length: 10, enum: JENIS_REKENING }).notNull(),
    bank: varchar('bank', { length: 30 }).notNull(),
    nomor: varchar('nomor', { length: 30 }),
    atasNama: varchar('atas_nama', { length: 40 }),
    nama: varchar('nama', { length: 60 }).notNull(),
    /** Terpilih otomatis saat kasir memilih metode ini; paling banyak satu per jenis. */
    isDefault: boolean('is_default').notNull().default(false),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    check('chk_rekening_jenis', dalamDaftar('jenis', JENIS_REKENING)),
    check('chk_rekening_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    uniqueIndex('uq_rekening_default_per_jenis')
      .on(t.jenis)
      .where(sql`is_default and status_aktif = 'AKTIF'`),
    index('idx_rekening_jenis').on(t.jenis, t.statusAktif),
  ],
);

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
    /**
     * K-109 (migrasi 0016): jadwal shift toko saat shift ini dibuka (`HH:mm`, Asia/Jakarta), dibekukan agar
     * perubahan pengaturan tidak mengubah shift yang sedang berjalan. NULL = tanpa jadwal.
     */
    jadwalBuka: varchar('jadwal_buka', { length: 5 }),
    jadwalTutup: varchar('jadwal_tutup', { length: 5 }),
    /** Kolom status: kapan pengingat "shift perlu ditutup" terakhir dikirim ke atasan (sekali per hari). */
    diingatkanPada: timestamptz('diingatkan_pada'),
    /**
     * K-121 (migrasi 0020): cara membuka shift; usulan modal = uang ditinggal saat shift terakhir ditutup;
     * rincian pecahan hitungan buka; batas hitung susulan (HITUNG_NANTI). `hitung_buka_pada` = kolom status:
     * kapan hitung susulan dikirim.
     */
    caraBuka: varchar('cara_buka', { length: 15, enum: CARA_BUKA_SHIFT })
      .notNull()
      .default('HITUNG'),
    modalUsulan: uang('modal_usulan'),
    rincianBuka: jsonb('rincian_buka').$type<RincianPecahan>(),
    batasHitungBuka: timestamptz('batas_hitung_buka'),
    hitungBukaPada: timestamptz('hitung_buka_pada'),
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
    check('chk_shift_cara_buka', dalamDaftar('cara_buka', CARA_BUKA_SHIFT)),
    // Satu shift belum tutup (BUKA/DIHITUNG) per kasir.
    uniqueIndex('uq_shift_buka_per_kasir')
      .on(t.idKasir)
      .where(sql`status <> 'TUTUP'`),
    // K-132, U10 (migrasi 0024): satu shift belum tutup untuk seluruh toko, dijaga database (pagar kedua setelah
    // kunci transaksi di service).
    uniqueIndex('uq_shift_toko_terbuka')
      .on(sql`(true)`)
      .where(sql`status <> 'TUTUP'`),
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
    /**
     * K-121 (migrasi 0020): uang ditinggal di laci untuk shift berikutnya (sisanya disetor); koreksi modal bersih
     * (sudah termasuk di `modal_awal` = modal efektif); toleransi selisih saat itu; jumlah hitungan (1 atau 2).
     * Penjelasan atasan = kolom status yang diisi setelah shift ditutup (angka tidak berubah).
     */
    uangDitinggal: uang('uang_ditinggal').notNull().default(0),
    koreksiModal: bigint('koreksi_modal', { mode: 'number' }).notNull().default(0),
    toleransi: uang('toleransi').notNull().default(0),
    jumlahHitung: integer('jumlah_hitung').notNull().default(1),
    penjelasanAtasan: varchar('penjelasan_atasan', { length: 255 }),
    dijelaskanOleh: kolomRef('dijelaskan_oleh'),
    dijelaskanPada: timestamptz('dijelaskan_pada'),
  },
  (t) => [
    foreignKey({
      name: 'clerical_check_dijelaskan_oleh_fkey',
      columns: [t.dijelaskanOleh],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_clerical_ditinggal',
      sql`uang_ditinggal >= 0 and uang_ditinggal <= uang_fisik and jumlah_hitung between 1 and 2`,
    ),
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

/**
 * K-121 (migrasi 0020): setiap hitungan uang laci yang dikirim kasir/atasan, termasuk yang tidak dipakai
 * (hitungan pertama sebelum hitung ulang). [APPEND] Hitung buta tetap bermakna karena hitungan pertama tidak bisa
 * dihapus atau diganti. `saldo_sistem` = saldo menurut sistem saat hitungan tutup, atau tunai bersih sejak buka
 * saat hitung susulan.
 */
export const hitungKas = pgTable(
  'hitung_kas',
  {
    id: kolomId(),
    idShift: kolomRef('id_shift').notNull(),
    jenis: varchar('jenis', { length: 15, enum: JENIS_HITUNG_KAS }).notNull(),
    waktu: timestamptz('waktu').notNull().defaultNow(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    uangFisik: uang('uang_fisik').notNull(),
    rincian: jsonb('rincian').$type<RincianPecahan>(),
    saldoSistem: bigint('saldo_sistem', { mode: 'number' }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'hitung_kas_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    foreignKey({
      name: 'hitung_kas_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_hitung_kas_jenis', dalamDaftar('jenis', JENIS_HITUNG_KAS)),
    check('chk_hitung_kas_nilai', sql`uang_fisik >= 0`),
    index('idx_hitung_kas_shift').on(t.idShift),
  ],
);
