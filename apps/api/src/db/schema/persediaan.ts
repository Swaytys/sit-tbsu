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
} from 'drizzle-orm/pg-core';
import {
  JENIS_MUTASI,
  JENIS_PENERIMAAN,
  JENIS_PENYESUAIAN,
  KONDISI_STOK,
  STATUS_HUTANG,
  STATUS_PENYESUAIAN,
  SYARAT_BAYAR,
} from '@sit/shared';
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
import { returPenjualanDetail, voidTransaksiDetail } from './koreksi';
import { barang, barangSatuanJual, pemasok } from './master';
import { penjualanDetail } from './penjualan';
import { pengguna } from './sistem';
import { penyelesaianKonsinyasi, returPemasokDetail } from './transaksi-pemasok';

// Bagian PERSEDIAAN, PENERIMAAN BARANG, PENYESUAIAN STOK, dan MUTASI PERSEDIAAN (LEDGER).

/** Posisi stok per barang. Semua kolom stok & HPP adalah [CACHE] dari ledger (docs/03 §4). */
export const persediaan = pgTable(
  'persediaan',
  {
    id: kolomId(),
    idBarang: kolomRef('id_barang').notNull().unique('persediaan_id_barang_key'),
    stokFisik: qty('stok_fisik')
      .notNull()
      .default(sql`0`),
    stokDipesan: qty('stok_dipesan')
      .notNull()
      .default(sql`0`),
    stokTersedia: qty('stok_tersedia').generatedAlwaysAs(sql`stok_fisik - stok_dipesan`),
    stokRusak: qty('stok_rusak')
      .notNull()
      .default(sql`0`),
    hppRata2: uang('hpp_rata2').notNull().default(0),
    hargaBeliTerakhir: uang('harga_beli_terakhir').notNull().default(0),
    tanggalBeliTerakhir: tanggal('tanggal_beli_terakhir'),
    lokasiStok: varchar('lokasi_stok', { length: 50 }),
    keterangan: varchar('keterangan', { length: 150 }),
    terakhirMutasi: timestamptz('terakhir_mutasi'),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'persediaan_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    check('chk_persediaan_fisik', sql`stok_fisik >= 0`),
    check('chk_persediaan_dipesan', sql`stok_dipesan >= 0 and stok_dipesan <= stok_fisik`),
    check('chk_persediaan_rusak', sql`stok_rusak >= 0`),
    check('chk_persediaan_hpp', sql`hpp_rata2 >= 0 and harga_beli_terakhir >= 0`),
  ],
);

/** [APPEND] */
export const penerimaanBarang = pgTable(
  'penerimaan_barang',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('penerimaan_barang_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    idPemasok: kolomRef('id_pemasok').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    jenis: varchar('jenis', { length: 12, enum: JENIS_PENERIMAAN }).notNull(),
    syaratBayar: varchar('syarat_bayar', { length: 10, enum: SYARAT_BAYAR }),
    tanggalJatuhTempo: tanggal('tanggal_jatuh_tempo'),
    noFakturPemasok: varchar('no_faktur_pemasok', { length: 50 }),
    noSuratJalanPemasok: varchar('no_surat_jalan_pemasok', { length: 50 }),
    totalFaktur: uang('total_faktur').notNull().default(0),
    totalDibayar: uang('total_dibayar').notNull().default(0),
    totalReturPotong: uang('total_retur_potong').notNull().default(0),
    sisaHutang: uang('sisa_hutang').generatedAlwaysAs(
      sql`total_faktur - total_dibayar - total_retur_potong`,
    ),
    statusHutang: varchar('status_hutang', { length: 12, enum: STATUS_HUTANG })
      .notNull()
      .default('TIDAK_ADA'),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'penerimaan_barang_id_pemasok_fkey',
      columns: [t.idPemasok],
      foreignColumns: [pemasok.id],
    }),
    foreignKey({
      name: 'penerimaan_barang_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_penerimaan_jenis', dalamDaftar('jenis', JENIS_PENERIMAAN)),
    check(
      'chk_penerimaan_syarat',
      sql`(jenis = 'KONSINYASI' and syarat_bayar is null and tanggal_jatuh_tempo is null)
        or (jenis = 'PEMBELIAN' and syarat_bayar = 'TUNAI' and tanggal_jatuh_tempo is null)
        or (jenis = 'PEMBELIAN' and syarat_bayar = 'TEMPO' and tanggal_jatuh_tempo is not null)`,
    ),
    check('chk_penerimaan_status_hutang', dalamDaftar('status_hutang', STATUS_HUTANG)),
    check(
      'chk_penerimaan_total',
      sql`total_faktur >= 0 and total_dibayar >= 0 and total_retur_potong >= 0
        and total_dibayar + total_retur_potong <= total_faktur`,
    ),
    index('idx_penerimaan_pemasok').on(t.idPemasok),
    index('idx_penerimaan_tanggal').on(t.tanggalOperasional),
    index('idx_penerimaan_jatuh_tempo')
      .on(t.tanggalJatuhTempo)
      .where(sql`status_hutang in ('BELUM_LUNAS','SEBAGIAN')`),
  ],
);

/** [APPEND] */
export const penerimaanBarangDetail = pgTable(
  'penerimaan_barang_detail',
  {
    id: kolomId(),
    idPenerimaan: kolomRef('id_penerimaan').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    idSatuanJual: kolomRef('id_satuan_jual'),
    faktor: numeric('faktor', { precision: 12, scale: 4 })
      .notNull()
      .default(sql`1`),
    qtyMasuk: qty('qty_masuk').notNull(),
    qtyDasar: qty('qty_dasar').notNull(),
    hargaModalMasuk: uang('harga_modal_masuk').notNull(),
    hargaModalDasar: uang('harga_modal_dasar').notNull(),
    subtotal: uang('subtotal').notNull(),
    keterangan: varchar('keterangan', { length: 150 }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'penerimaan_barang_detail_id_penerimaan_fkey',
      columns: [t.idPenerimaan],
      foreignColumns: [penerimaanBarang.id],
    }),
    foreignKey({
      name: 'penerimaan_barang_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'penerimaan_barang_detail_id_satuan_jual_fkey',
      columns: [t.idSatuanJual],
      foreignColumns: [barangSatuanJual.id],
    }),
    check('chk_penerimaan_detail_qty', sql`qty_masuk > 0 and qty_dasar > 0 and faktor > 0`),
    check(
      'chk_penerimaan_detail_harga',
      sql`harga_modal_masuk >= 0 and harga_modal_dasar >= 0 and subtotal >= 0`,
    ),
    index('idx_penerimaan_detail_header').on(t.idPenerimaan),
    index('idx_penerimaan_detail_barang').on(t.idBarang),
  ],
);

/** [APPEND] kecuali status. */
export const penyesuaianStok = pgTable(
  'penyesuaian_stok',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('penyesuaian_stok_nomor_key'),
    tanggal: timestamptz('tanggal').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    jenis: varchar('jenis', { length: 15, enum: JENIS_PENYESUAIAN }).notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    status: varchar('status', { length: 10, enum: STATUS_PENYESUAIAN }).notNull().default('DRAFT'),
    waktuSelesai: timestamptz('waktu_selesai'),
    alasan: varchar('alasan', { length: 255 }),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'penyesuaian_stok_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_penyesuaian_jenis', dalamDaftar('jenis', JENIS_PENYESUAIAN)),
    check('chk_penyesuaian_status', dalamDaftar('status', STATUS_PENYESUAIAN)),
    index('idx_penyesuaian_tanggal').on(t.tanggalOperasional),
  ],
);

/** [APPEND] selama DRAFT boleh diubah. */
export const penyesuaianStokDetail = pgTable(
  'penyesuaian_stok_detail',
  {
    id: kolomId(),
    idPenyesuaian: kolomRef('id_penyesuaian').notNull(),
    idBarang: kolomRef('id_barang').notNull(),
    kondisi: varchar('kondisi', { length: 6, enum: KONDISI_STOK }).notNull().default('BAIK'),
    qtySistem: qty('qty_sistem')
      .notNull()
      .default(sql`0`),
    qtyFisik: qty('qty_fisik'),
    qtySelisih: qty('qty_selisih')
      .notNull()
      .default(sql`0`),
    hppSatuan: uang('hpp_satuan').notNull().default(0),
    keterangan: varchar('keterangan', { length: 150 }),
    /** OPNAME (K-069): barang di lembar yang sengaja tidak dihitung; wajib alasan, tercatat siapa & kapan. */
    dikecualikan: boolean('dikecualikan').notNull().default(false),
    alasanKecuali: varchar('alasan_kecuali', { length: 150 }),
    idPenggunaKecuali: kolomRef('id_pengguna_kecuali'),
    waktuKecuali: timestamptz('waktu_kecuali'),
    /** K-092: pemusnahan barang titipan yang sudah ditagihkan sebagai ganti rugi di setoran konsinyasi. */
    idPenyelesaianKonsinyasi: kolomRef('id_penyelesaian_konsinyasi'),
  },
  (t) => [
    foreignKey({
      name: 'penyesuaian_stok_detail_id_penyelesaian_konsinyasi_fkey',
      columns: [t.idPenyelesaianKonsinyasi],
      foreignColumns: [penyelesaianKonsinyasi.id],
    }),
    index('idx_penyesuaian_detail_ksg').on(t.idPenyelesaianKonsinyasi),
    foreignKey({
      name: 'penyesuaian_stok_detail_id_pengguna_kecuali_fkey',
      columns: [t.idPenggunaKecuali],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_penyesuaian_detail_kecuali',
      sql`not dikecualikan or (alasan_kecuali is not null and id_pengguna_kecuali is not null and waktu_kecuali is not null)`,
    ),
    foreignKey({
      name: 'penyesuaian_stok_detail_id_penyesuaian_fkey',
      columns: [t.idPenyesuaian],
      foreignColumns: [penyesuaianStok.id],
    }),
    foreignKey({
      name: 'penyesuaian_stok_detail_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    unique('uq_penyesuaian_detail').on(t.idPenyesuaian, t.idBarang, t.kondisi),
    check('chk_penyesuaian_detail_kondisi', dalamDaftar('kondisi', KONDISI_STOK)),
    check('chk_penyesuaian_detail_hpp', sql`hpp_satuan >= 0`),
    index('idx_penyesuaian_detail_barang').on(t.idBarang),
  ],
);

/**
 * [APPEND] Ledger — sumber kebenaran stok. Ditulis HANYA oleh
 * modules/persediaan/ledger.ts (CLAUDE.md aturan 2).
 */
export const mutasiPersediaan = pgTable(
  'mutasi_persediaan',
  {
    id: kolomId(),
    idBarang: kolomRef('id_barang').notNull(),
    waktu: timestamptz('waktu').notNull().defaultNow(),
    tanggalOperasional: tanggal('tanggal_operasional').notNull(),
    jenisMutasi: varchar('jenis_mutasi', { length: 15, enum: JENIS_MUTASI }).notNull(),
    kondisi: varchar('kondisi', { length: 6, enum: KONDISI_STOK }).notNull().default('BAIK'),
    qtyMasuk: qty('qty_masuk')
      .notNull()
      .default(sql`0`),
    qtyKeluar: qty('qty_keluar')
      .notNull()
      .default(sql`0`),
    saldoSetelah: qty('saldo_setelah').notNull(),
    hppSatuan: uang('hpp_satuan').notNull().default(0),
    hppSetelah: uang('hpp_setelah').notNull().default(0),
    idPenerimaanDetail: kolomRef('id_penerimaan_detail'),
    idPenjualanDetail: kolomRef('id_penjualan_detail'),
    idReturDetail: kolomRef('id_retur_detail'),
    idVoidDetail: kolomRef('id_void_detail'),
    idPenyesuaianDetail: kolomRef('id_penyesuaian_detail'),
    idReturPemasokDetail: kolomRef('id_retur_pemasok_detail'),
    idPengguna: kolomRef('id_pengguna').notNull(),
    keterangan: varchar('keterangan', { length: 255 }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'mutasi_persediaan_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_penerimaan_detail_fkey',
      columns: [t.idPenerimaanDetail],
      foreignColumns: [penerimaanBarangDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_penjualan_detail_fkey',
      columns: [t.idPenjualanDetail],
      foreignColumns: [penjualanDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_retur_detail_fkey',
      columns: [t.idReturDetail],
      foreignColumns: [returPenjualanDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_void_detail_fkey',
      columns: [t.idVoidDetail],
      foreignColumns: [voidTransaksiDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_penyesuaian_detail_fkey',
      columns: [t.idPenyesuaianDetail],
      foreignColumns: [penyesuaianStokDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_retur_pemasok_detail_fkey',
      columns: [t.idReturPemasokDetail],
      foreignColumns: [returPemasokDetail.id],
    }),
    foreignKey({
      name: 'mutasi_persediaan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_mutasi_jenis', dalamDaftar('jenis_mutasi', JENIS_MUTASI)),
    check('chk_mutasi_kondisi', dalamDaftar('kondisi', KONDISI_STOK)),
    check(
      'chk_mutasi_qty',
      sql`qty_masuk >= 0 and qty_keluar >= 0 and saldo_setelah >= 0 and hpp_satuan >= 0 and hpp_setelah >= 0`,
    ),
    // Arah sesuai sebab.
    check(
      'chk_mutasi_arah',
      sql`(jenis_mutasi in ('SALDO_AWAL','PENERIMAAN','RETUR_JUAL','VOID') and qty_masuk > 0 and qty_keluar = 0)
        or (jenis_mutasi in ('PENJUALAN','TUKAR_RETUR','RETUR_PEMASOK','MUSNAH') and qty_keluar > 0 and qty_masuk = 0)
        or (jenis_mutasi in ('PENYESUAIAN','PINDAH_KONDISI') and ((qty_masuk > 0 and qty_keluar = 0) or (qty_keluar > 0 and qty_masuk = 0)))`,
    ),
    // Tepat satu referensi sumber, sesuai jenis.
    check(
      'chk_mutasi_ref',
      sql`num_nonnulls(id_penerimaan_detail, id_penjualan_detail, id_retur_detail, id_void_detail, id_penyesuaian_detail, id_retur_pemasok_detail) = 1
        and (jenis_mutasi <> 'PENERIMAAN' or id_penerimaan_detail is not null)
        and (jenis_mutasi <> 'PENJUALAN' or id_penjualan_detail is not null)
        and (jenis_mutasi not in ('RETUR_JUAL','TUKAR_RETUR') or id_retur_detail is not null)
        and (jenis_mutasi <> 'VOID' or id_void_detail is not null)
        and (jenis_mutasi not in ('SALDO_AWAL','PENYESUAIAN','PINDAH_KONDISI','MUSNAH') or id_penyesuaian_detail is not null)
        and (jenis_mutasi <> 'RETUR_PEMASOK' or id_retur_pemasok_detail is not null)`,
    ),
    check('chk_mutasi_musnah', sql`jenis_mutasi <> 'MUSNAH' or kondisi = 'RUSAK'`),
    index('idx_mutasi_barang_waktu').on(t.idBarang, t.waktu),
    index('idx_mutasi_tanggal').on(t.tanggalOperasional),
    index('idx_mutasi_penerimaan').on(t.idPenerimaanDetail),
    index('idx_mutasi_penjualan').on(t.idPenjualanDetail),
    index('idx_mutasi_retur').on(t.idReturDetail),
    index('idx_mutasi_void').on(t.idVoidDetail),
    index('idx_mutasi_penyesuaian').on(t.idPenyesuaianDetail),
    index('idx_mutasi_retur_pemasok').on(t.idReturPemasokDetail),
  ],
);
