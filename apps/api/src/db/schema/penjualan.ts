import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  unique,
  varchar,
  type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';
import {
  JENIS_PEMBAYARAN,
  JENIS_PENJUALAN,
  METODE_PEMBAYARAN,
  PRIORITAS_ORDER,
  STATUS_VERIFIKASI,
  STATUS_ITEM,
  STATUS_ORDER,
  STATUS_PEMBAYARAN,
  STATUS_PENGAMBILAN,
  STATUS_PENGIRIMAN,
  STATUS_SURAT_JALAN,
  STATUS_TRANSAKSI,
} from '@sit/shared';
import { rekeningToko, shiftKasir } from './kas';
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
import { barang, barangSatuanJual, pelanggan, promo, tingkatHarga } from './master';
import { pengguna } from './sistem';
import { penyelesaianKonsinyasi } from './transaksi-pemasok';

// Bagian ORDER PENJUALAN, PENJUALAN, SURAT JALAN, PEMBAYARAN PENJUALAN.

/** [APPEND] kecuali status & cache. */
export const orderPenjualan = pgTable(
  'order_penjualan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('order_penjualan_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    jenisPenjualan: varchar('jenis_penjualan', { length: 12, enum: JENIS_PENJUALAN }).notNull(),
    idPelanggan: kolomRef('id_pelanggan'),
    namaPembeli: varchar('nama_pembeli', { length: 100 }),
    idPengguna: kolomRef('id_pengguna').notNull(),
    idKasirProses: kolomRef('id_kasir_proses'),
    prioritas: varchar('prioritas', { length: 8, enum: PRIORITAS_ORDER })
      .notNull()
      .default('NORMAL'),
    status: varchar('status', { length: 10, enum: STATUS_ORDER }).notNull().default('DRAFT'),
    waktuMasukAntrean: timestamptz('waktu_masuk_antrean'),
    alamatKirim: varchar('alamat_kirim', { length: 255 }),
    catatanKirim: varchar('catatan_kirim', { length: 255 }),
    ongkir: uang('ongkir').notNull().default(0),
    subtotal: uang('subtotal').notNull().default(0),
    diskonTransaksi: uang('diskon_transaksi').notNull().default(0),
    total: uang('total').notNull().default(0),
    catatan: varchar('catatan', { length: 255 }),
    idPenjualan: kolomRef('id_penjualan'),
    alasanBatal: varchar('alasan_batal', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  // Tipe hasil ditulis eksplisit: order_penjualan dan penjualan saling merujuk (FK dua arah).
  (t): PgTableExtraConfigValue[] => [
    foreignKey({
      name: 'order_penjualan_id_pelanggan_fkey',
      columns: [t.idPelanggan],
      foreignColumns: [pelanggan.id],
    }),
    foreignKey({
      name: 'order_penjualan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'order_penjualan_id_kasir_proses_fkey',
      columns: [t.idKasirProses],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'fk_order_penjualan_hasil',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    check('chk_order_jenis', dalamDaftar('jenis_penjualan', JENIS_PENJUALAN)),
    check('chk_order_prioritas', dalamDaftar('prioritas', PRIORITAS_ORDER)),
    check('chk_order_status', dalamDaftar('status', STATUS_ORDER)),
    check(
      'chk_order_pengantaran',
      sql`jenis_penjualan = 'LANGSUNG' or (id_pelanggan is not null and alamat_kirim is not null)`,
    ),
    check(
      'chk_order_uang',
      sql`ongkir >= 0 and subtotal >= 0 and diskon_transaksi >= 0 and total >= 0`,
    ),
    index('idx_order_status').on(t.status),
    index('idx_order_pelanggan').on(t.idPelanggan),
    index('idx_order_pengguna').on(t.idPengguna),
    index('idx_order_tanggal').on(t.tanggalOperasional),
  ],
);

/** Boleh diubah selama order DRAFT/MENUNGGU. Kolom promo ditambah migrasi 0005 (K-087). */
export const orderPenjualanDetail = pgTable(
  'order_penjualan_detail',
  {
    id: kolomId(),
    idOrder: kolomRef('id_order').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    idSatuanJual: kolomRef('id_satuan_jual'),
    faktor: numeric('faktor', { precision: 12, scale: 4 })
      .notNull()
      .default(sql`1`),
    qty: qty('qty').notNull(),
    qtyDasar: qty('qty_dasar').notNull(),
    idTingkatHarga: kolomRef('id_tingkat_harga'),
    hargaSatuan: uang('harga_satuan').notNull(),
    hargaManual: boolean('harga_manual').notNull().default(false),
    diskonBaris: uang('diskon_baris').notNull().default(0),
    subtotal: uang('subtotal').notNull(),
    catatanItem: varchar('catatan_item', { length: 150 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    // Kolom promo ditambahkan migrasi 0005 (K-087), jadi berada di akhir tabel.
    idPromo: kolomRef('id_promo'),
    diskonPromo: uang('diskon_promo').notNull().default(0),
    /** PR5: promo baris dilepas kasir. */
    promoNonaktif: boolean('promo_nonaktif').notNull().default(false),
  },
  (t) => [
    foreignKey({
      name: 'order_penjualan_detail_id_order_fkey',
      columns: [t.idOrder],
      foreignColumns: [orderPenjualan.id],
    }),
    foreignKey({
      name: 'order_penjualan_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'order_penjualan_detail_id_satuan_jual_fkey',
      columns: [t.idSatuanJual],
      foreignColumns: [barangSatuanJual.id],
    }),
    foreignKey({
      name: 'order_penjualan_detail_id_tingkat_harga_fkey',
      columns: [t.idTingkatHarga],
      foreignColumns: [tingkatHarga.id],
    }),
    foreignKey({
      name: 'order_penjualan_detail_id_promo_fkey',
      columns: [t.idPromo],
      foreignColumns: [promo.id],
    }),
    check('chk_order_detail_qty', sql`qty > 0 and qty_dasar > 0 and faktor > 0`),
    check(
      'chk_order_detail_harga',
      sql`harga_satuan >= 0 and diskon_baris >= 0 and diskon_promo >= 0 and subtotal >= 0`,
    ),
    check('chk_order_detail_tier', sql`harga_manual or id_tingkat_harga is not null`),
    index('idx_order_detail_order').on(t.idOrder),
    index('idx_order_detail_barang').on(t.idBarang),
  ],
);

/** [APPEND] kecuali status & cache. Satu tabel untuk LANGSUNG dan PENGANTARAN. */
export const penjualan = pgTable(
  'penjualan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('penjualan_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    jenisPenjualan: varchar('jenis_penjualan', { length: 12, enum: JENIS_PENJUALAN }).notNull(),
    idOrder: kolomRef('id_order'),
    idPelanggan: kolomRef('id_pelanggan'),
    namaPembeli: varchar('nama_pembeli', { length: 100 }),
    idKasir: kolomRef('id_kasir').notNull(),
    idShift: kolomRef('id_shift'),
    totalBruto: uang('total_bruto').notNull(),
    totalDiskon: uang('total_diskon').notNull().default(0),
    diskonTransaksi: uang('diskon_transaksi').notNull().default(0),
    ongkir: uang('ongkir').notNull().default(0),
    totalNeto: uang('total_neto').notNull(),
    totalVoid: uang('total_void').notNull().default(0),
    totalRetur: uang('total_retur').notNull().default(0),
    totalDibayar: uang('total_dibayar').notNull().default(0),
    totalRefund: uang('total_refund').notNull().default(0),
    sisaTagihan: uang('sisa_tagihan').generatedAlwaysAs(
      sql`total_neto - total_void - total_retur - total_dibayar + total_refund`,
    ),
    statusPembayaran: varchar('status_pembayaran', { length: 12, enum: STATUS_PEMBAYARAN })
      .notNull()
      .default('BELUM_BAYAR'),
    bayarSaatTerima: boolean('bayar_saat_terima').notNull().default(false),
    tanggalJatuhTempo: tanggal('tanggal_jatuh_tempo'),
    statusTransaksi: varchar('status_transaksi', { length: 15, enum: STATUS_TRANSAKSI })
      .notNull()
      .default('SELESAI'),
    statusPengambilan: varchar('status_pengambilan', { length: 15, enum: STATUS_PENGAMBILAN }),
    statusPengiriman: varchar('status_pengiriman', { length: 10, enum: STATUS_PENGIRIMAN }),
    alamatKirim: varchar('alamat_kirim', { length: 255 }),
    catatanKirim: varchar('catatan_kirim', { length: 255 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'penjualan_id_order_fkey',
      columns: [t.idOrder],
      foreignColumns: [orderPenjualan.id],
    }),
    foreignKey({
      name: 'penjualan_id_pelanggan_fkey',
      columns: [t.idPelanggan],
      foreignColumns: [pelanggan.id],
    }),
    foreignKey({
      name: 'penjualan_id_kasir_fkey',
      columns: [t.idKasir],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'penjualan_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    check('chk_penjualan_jenis', dalamDaftar('jenis_penjualan', JENIS_PENJUALAN)),
    check('chk_penjualan_bayar', dalamDaftar('status_pembayaran', STATUS_PEMBAYARAN)),
    check('chk_penjualan_status', dalamDaftar('status_transaksi', STATUS_TRANSAKSI)),
    check(
      'chk_penjualan_langsung',
      sql`(jenis_penjualan = 'LANGSUNG' and status_pengambilan in ('DIAMBIL','BELUM_DIAMBIL') and status_pengiriman is null)
        or (jenis_penjualan = 'PENGANTARAN' and status_pengiriman in ('BELUM','SEBAGIAN','SELESAI') and status_pengambilan is null
            and id_pelanggan is not null and alamat_kirim is not null)`,
    ),
    check(
      'chk_penjualan_uang',
      sql`total_bruto >= 0 and total_diskon >= 0 and diskon_transaksi >= 0 and ongkir >= 0
        and total_neto >= 0 and total_dibayar >= 0 and total_void >= 0 and total_retur >= 0
        and total_refund >= 0 and total_void + total_retur <= total_neto and total_refund <= total_dibayar`,
    ),
    index('idx_penjualan_tanggal').on(t.tanggalOperasional),
    index('idx_penjualan_pelanggan').on(t.idPelanggan),
    index('idx_penjualan_kasir').on(t.idKasir),
    index('idx_penjualan_shift').on(t.idShift),
    index('idx_penjualan_order').on(t.idOrder),
    index('idx_penjualan_piutang')
      .on(t.tanggalJatuhTempo)
      .where(sql`status_pembayaran <> 'LUNAS' and status_transaksi <> 'VOID'`),
  ],
);

/** [APPEND] kecuali status_item & cache. */
export const penjualanDetail = pgTable(
  'penjualan_detail',
  {
    id: kolomId(),
    idPenjualan: kolomRef('id_penjualan').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    idSatuanJual: kolomRef('id_satuan_jual'),
    faktor: numeric('faktor', { precision: 12, scale: 4 })
      .notNull()
      .default(sql`1`),
    qty: qty('qty').notNull(),
    qtyDasar: qty('qty_dasar').notNull(),
    idTingkatHarga: kolomRef('id_tingkat_harga'),
    hargaSatuan: uang('harga_satuan').notNull(),
    hargaManual: boolean('harga_manual').notNull().default(false),
    diskonBaris: uang('diskon_baris').notNull().default(0),
    idPromo: kolomRef('id_promo'),
    diskonPromo: uang('diskon_promo').notNull().default(0),
    subtotal: uang('subtotal').notNull(),
    hppSaatTransaksi: uang('hpp_saat_transaksi').notNull(),
    qtyReturDasar: qty('qty_retur_dasar')
      .notNull()
      .default(sql`0`),
    statusItem: varchar('status_item', { length: 15, enum: STATUS_ITEM })
      .notNull()
      .default('NORMAL'),
    idPenyelesaianKonsinyasi: kolomRef('id_penyelesaian_konsinyasi'),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'penjualan_detail_id_penjualan_fkey',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    foreignKey({
      name: 'penjualan_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'penjualan_detail_id_satuan_jual_fkey',
      columns: [t.idSatuanJual],
      foreignColumns: [barangSatuanJual.id],
    }),
    foreignKey({
      name: 'penjualan_detail_id_tingkat_harga_fkey',
      columns: [t.idTingkatHarga],
      foreignColumns: [tingkatHarga.id],
    }),
    foreignKey({
      name: 'penjualan_detail_id_promo_fkey',
      columns: [t.idPromo],
      foreignColumns: [promo.id],
    }),
    foreignKey({
      name: 'fk_penjualan_detail_ksg',
      columns: [t.idPenyelesaianKonsinyasi],
      foreignColumns: [penyelesaianKonsinyasi.id],
    }),
    check('chk_penjualan_detail_qty', sql`qty > 0 and qty_dasar > 0 and faktor > 0`),
    check(
      'chk_penjualan_detail_harga',
      sql`harga_satuan >= 0 and diskon_baris >= 0 and diskon_promo >= 0 and subtotal >= 0 and hpp_saat_transaksi >= 0`,
    ),
    check('chk_penjualan_detail_status', dalamDaftar('status_item', STATUS_ITEM)),
    check('chk_penjualan_detail_tier', sql`harga_manual or id_tingkat_harga is not null`),
    check('chk_penjualan_detail_retur', sql`qty_retur_dasar >= 0 and qty_retur_dasar <= qty_dasar`),
    index('idx_penjualan_detail_header').on(t.idPenjualan),
    index('idx_penjualan_detail_barang').on(t.idBarang),
    index('idx_penjualan_detail_ksg').on(t.idPenyelesaianKonsinyasi),
    // Laporan Promo dan pemeriksaan "promo sudah dipakai" (K-087).
    index('idx_penjualan_detail_promo')
      .on(t.idPromo)
      .where(sql`id_promo is not null`),
  ],
);

/** [APPEND] kecuali status & waktu. Banyak surat jalan per invoice (K-024). */
export const suratJalan = pgTable(
  'surat_jalan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('surat_jalan_nomor_key'),
    idPenjualan: kolomRef('id_penjualan').notNull(),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    alamatKirim: varchar('alamat_kirim', { length: 255 }).notNull(),
    namaPenerima: varchar('nama_penerima', { length: 100 }),
    noHpPenerima: varchar('no_hp_penerima', { length: 20 }),
    sopir: varchar('sopir', { length: 100 }),
    kendaraan: varchar('kendaraan', { length: 50 }),
    status: varchar('status', { length: 10, enum: STATUS_SURAT_JALAN })
      .notNull()
      .default('DIPROSES'),
    waktuDimuat: timestamptz('waktu_dimuat'),
    waktuDikirim: timestamptz('waktu_dikirim'),
    waktuSelesai: timestamptz('waktu_selesai'),
    alasanBatal: varchar('alasan_batal', { length: 255 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'surat_jalan_id_penjualan_fkey',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    foreignKey({
      name: 'surat_jalan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_surat_jalan_status', dalamDaftar('status', STATUS_SURAT_JALAN)),
    index('idx_surat_jalan_penjualan').on(t.idPenjualan),
    index('idx_surat_jalan_status').on(t.status),
  ],
);

export const suratJalanDetail = pgTable(
  'surat_jalan_detail',
  {
    id: kolomId(),
    idSuratJalan: kolomRef('id_surat_jalan').notNull(),
    idPenjualanDetail: kolomRef('id_penjualan_detail').notNull(),
    qtyKirim: qty('qty_kirim').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'surat_jalan_detail_id_surat_jalan_fkey',
      columns: [t.idSuratJalan],
      foreignColumns: [suratJalan.id],
    }),
    foreignKey({
      name: 'surat_jalan_detail_id_penjualan_detail_fkey',
      columns: [t.idPenjualanDetail],
      foreignColumns: [penjualanDetail.id],
    }),
    unique('uq_surat_jalan_detail').on(t.idSuratJalan, t.idPenjualanDetail),
    check('chk_surat_jalan_detail_qty', sql`qty_kirim > 0`),
    index('idx_sj_detail_penjualan_detail').on(t.idPenjualanDetail),
  ],
);

/** [APPEND] */
export const pembayaranPenjualan = pgTable(
  'pembayaran_penjualan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('pembayaran_penjualan_nomor_key'),
    idPenjualan: kolomRef('id_penjualan').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    idShift: kolomRef('id_shift'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    jenis: varchar('jenis', { length: 10, enum: JENIS_PEMBAYARAN }).notNull(),
    metode: varchar('metode', { length: 10, enum: METODE_PEMBAYARAN }).notNull(),
    nominal: uang('nominal').notNull(),
    uangDiterima: uang('uang_diterima'),
    kembalian: uang('kembalian').notNull().default(0),
    rekening: varchar('rekening', { length: 60 }),
    referensi: varchar('referensi', { length: 60 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    /**
     * K-111 (migrasi 0018): rekening toko tujuan pembayaran non-tunai; `rekening` menyimpan labelnya saat itu.
     * NULL untuk tunai dan untuk pembayaran lama yang rekeningnya diketik.
     */
    idRekening: kolomRef('id_rekening'),
    /**
     * Kolom status (boleh berubah): hasil pengecekan uang masuk. NULL untuk tunai; non-tunai mulai dari
     * BELUM_DICEK.
     */
    statusVerifikasi: varchar('status_verifikasi', { length: 12, enum: STATUS_VERIFIKASI }),
    diverifikasiOleh: kolomRef('diverifikasi_oleh'),
    diverifikasiPada: timestamptz('diverifikasi_pada'),
    catatanVerifikasi: varchar('catatan_verifikasi', { length: 255 }),
  },
  (t) => [
    foreignKey({
      name: 'pembayaran_penjualan_id_rekening_fkey',
      columns: [t.idRekening],
      foreignColumns: [rekeningToko.id],
    }),
    foreignKey({
      name: 'pembayaran_penjualan_diverifikasi_oleh_fkey',
      columns: [t.diverifikasiOleh],
      foreignColumns: [pengguna.id],
    }),
    check('chk_pembayaran_verifikasi', dalamDaftar('status_verifikasi', STATUS_VERIFIKASI)),
    check(
      'chk_pembayaran_verifikasi_metode',
      sql`(metode = 'TUNAI') = (status_verifikasi is null)`,
    ),
    index('idx_pembayaran_verifikasi').on(t.statusVerifikasi),
    foreignKey({
      name: 'pembayaran_penjualan_id_penjualan_fkey',
      columns: [t.idPenjualan],
      foreignColumns: [penjualan.id],
    }),
    foreignKey({
      name: 'pembayaran_penjualan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'pembayaran_penjualan_id_shift_fkey',
      columns: [t.idShift],
      foreignColumns: [shiftKasir.id],
    }),
    check('chk_pembayaran_jenis', dalamDaftar('jenis', JENIS_PEMBAYARAN)),
    check('chk_pembayaran_metode', dalamDaftar('metode', METODE_PEMBAYARAN)),
    check(
      'chk_pembayaran_nominal',
      sql`nominal > 0 and kembalian >= 0 and (uang_diterima is null or uang_diterima >= nominal)`,
    ),
    check('chk_pembayaran_shift', sql`metode <> 'TUNAI' or id_shift is not null`),
    index('idx_pembayaran_penjualan').on(t.idPenjualan),
    index('idx_pembayaran_shift').on(t.idShift),
    index('idx_pembayaran_tanggal').on(t.tanggalOperasional),
  ],
);
