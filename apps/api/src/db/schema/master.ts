import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  JENIS_DIMENSI,
  JENIS_DIMENSI_FISIK,
  JENIS_POTONGAN,
  KEPEMILIKAN,
  METODE_HARGA,
  SASARAN_PEMBELI,
  SASARAN_PROMO,
  STATUS_AKTIF,
  TIPE_NILAI,
} from '@sit/shared';
import {
  dalamDaftar,
  dibuatPada,
  diubahPada,
  kolomId,
  kolomRef,
  qty,
  statusAktif,
  tanggal,
  timestamptz,
  uang,
} from './kolom';
import { pengguna } from './sistem';

// Bagian MASTER di docs/03-skema-database-v3.sql.

export const kategori = pgTable(
  'kategori',
  {
    id: kolomId(),
    nama: varchar('nama', { length: 60 }).notNull().unique('kategori_nama_key'),
    keterangan: varchar('keterangan', { length: 150 }),
    urutan: integer('urutan').notNull().default(0),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [check('chk_kategori_status', dalamDaftar('status_aktif', STATUS_AKTIF))],
);

/** Merk barang (migrasi 0001, K-063): pilihan tetap agar merk tidak diketik ulang. */
export const merk = pgTable(
  'merk',
  {
    id: kolomId(),
    nama: varchar('nama', { length: 50 }).notNull().unique('merk_nama_key'),
    keterangan: varchar('keterangan', { length: 150 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [check('chk_merk_status', dalamDaftar('status_aktif', STATUS_AKTIF))],
);

export const satuan = pgTable(
  'satuan',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 10 }).notNull().unique('satuan_kode_key'),
    nama: varchar('nama', { length: 50 }).notNull(),
    jenisDimensi: varchar('jenis_dimensi', { length: 10, enum: JENIS_DIMENSI }).notNull(),
    faktorKeBasis: numeric('faktor_ke_basis', { precision: 18, scale: 6 })
      .notNull()
      .default(sql`1`),
    isBasis: boolean('is_basis').notNull().default(false),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    check('chk_satuan_dimensi', dalamDaftar('jenis_dimensi', JENIS_DIMENSI)),
    check('chk_satuan_faktor', sql`faktor_ke_basis > 0`),
    check('chk_satuan_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    // Satu satuan basis per dimensi fisik; JUMLAH/LAINNYA boleh banyak "basis".
    uniqueIndex('uq_satuan_basis_dimensi')
      .on(t.jenisDimensi)
      .where(sql`is_basis and ${dalamDaftar('jenis_dimensi', JENIS_DIMENSI_FISIK)}`),
  ],
);

export const jenisAtribut = pgTable(
  'jenis_atribut',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 30 }).notNull().unique('jenis_atribut_kode_key'),
    nama: varchar('nama', { length: 60 }).notNull(),
    tipeNilai: varchar('tipe_nilai', { length: 10, enum: TIPE_NILAI }).notNull(),
    jenisDimensi: varchar('jenis_dimensi', { length: 10, enum: JENIS_DIMENSI }),
    urutan: integer('urutan').notNull().default(0),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [
    check('chk_jenis_atribut_tipe', dalamDaftar('tipe_nilai', TIPE_NILAI)),
    check(
      'chk_jenis_atribut_dimensi',
      sql`jenis_dimensi is null or ${dalamDaftar('jenis_dimensi', JENIS_DIMENSI)}`,
    ),
    check('chk_jenis_atribut_teks', sql`tipe_nilai = 'ANGKA' or jenis_dimensi is null`),
    check('chk_jenis_atribut_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
  ],
);

export const pemasok = pgTable(
  'pemasok',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 12 }).notNull().unique('pemasok_kode_key'),
    namaPemasok: varchar('nama_pemasok', { length: 100 }).notNull(),
    noHp: varchar('no_hp', { length: 20 }),
    alamat: varchar('alamat', { length: 255 }),
    kontakPerson: varchar('kontak_person', { length: 100 }),
    keterangan: varchar('keterangan', { length: 150 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    /**
     * K-113 (migrasi 0019): parameter rekomendasi pemesanan ulang. Hari dari memesan sampai barang tiba, dan
     * jarak hari antara dua kali belanja ke pemasok ini. NULL = nilai bawaan toko (konfigurasi).
     */
    lamaKirimHari: integer('lama_kirim_hari'),
    jarakBelanjaHari: integer('jarak_belanja_hari'),
    /** K-237: lama tempo pembayaran yang biasa diberikan pemasok (hari); bawaan order bertempo. */
    tempoHari: integer('tempo_hari'),
    /**
     * K-225 (migrasi 0054): rekening bank pemasok untuk transfer. Hanya Owner yang mengisi/mengubah; transfer ke
     * rekening lain ditolak bagi selain Owner (mencegah pembayaran dialihkan).
     */
    rekening: varchar('rekening', { length: 100 }),
  },
  () => [
    check('chk_pemasok_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check(
      'chk_pemasok_lama_kirim',
      sql`lama_kirim_hari is null or lama_kirim_hari between 0 and 365`,
    ),
    check(
      'chk_pemasok_jarak_belanja',
      sql`jarak_belanja_hari is null or jarak_belanja_hari between 1 and 365`,
    ),
    check('chk_pemasok_tempo', sql`tempo_hari is null or tempo_hari between 1 and 365`),
  ],
);

export const tingkatHarga = pgTable(
  'tingkat_harga',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 20 }).notNull().unique('tingkat_harga_kode_key'),
    nama: varchar('nama', { length: 50 }).notNull(),
    markupDefaultPersen: numeric('markup_default_persen', { precision: 6, scale: 2 })
      .notNull()
      .default(sql`0`),
    urutan: integer('urutan').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    /**
     * K-098 (migrasi 0011): total nilai belanja transaksi (rupiah, dihitung dengan harga tier dasar) agar tier
     * ini dipakai otomatis untuk semua barang; tier dasar selalu kosong; tier lain wajib terisi selama aktif (K-099).
     */
    minBelanja: uang('min_belanja'),
  },
  () => [
    check('chk_tingkat_harga_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check(
      'chk_tingkat_harga_min_belanja',
      sql`min_belanja is null or (min_belanja > 0 and not is_default)`,
    ),
    // K-099: tier aktif selain tier dasar wajib punya syarat belanja (tidak ada tier pilihan manual).
    check(
      'chk_tingkat_harga_aktif_bersyarat',
      sql`is_default or min_belanja is not null or status_aktif = 'NONAKTIF'`,
    ),
    // Tepat satu tier default.
    uniqueIndex('uq_tingkat_harga_default')
      .on(sql`(1)`)
      .where(sql`is_default`),
  ],
);

/**
 * K-097 (migrasi 0009): golongan pelanggan (mis. Distributor, Kontraktor, Tukang). Dipakai sasaran promo,
 * bukan harga jual (harga jual hanya ditentukan qty).
 */
export const golonganPelanggan = pgTable(
  'golongan_pelanggan',
  {
    id: kolomId(),
    nama: varchar('nama', { length: 60 }).notNull().unique('golongan_pelanggan_nama_key'),
    keterangan: varchar('keterangan', { length: 150 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [check('chk_golongan_pelanggan_status', dalamDaftar('status_aktif', STATUS_AKTIF))],
);

export const pelanggan = pgTable(
  'pelanggan',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 12 }).notNull().unique('pelanggan_kode_key'),
    namaPelanggan: varchar('nama_pelanggan', { length: 100 }).notNull(),
    noHp: varchar('no_hp', { length: 20 }),
    email: varchar('email', { length: 100 }),
    alamat: varchar('alamat', { length: 255 }),
    termHari: integer('term_hari').notNull().default(0),
    limitKredit: uang('limit_kredit'),
    keterangan: varchar('keterangan', { length: 150 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    /** K-097 (migrasi 0009): golongan untuk sasaran promo. */
    idGolongan: kolomRef('id_golongan'),
  },
  (t) => [
    foreignKey({
      name: 'pelanggan_id_golongan_fkey',
      columns: [t.idGolongan],
      foreignColumns: [golonganPelanggan.id],
    }),
    index('idx_pelanggan_golongan').on(t.idGolongan),
    check('chk_pelanggan_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check('chk_pelanggan_term', sql`term_hari >= 0`),
    check('chk_pelanggan_limit', sql`limit_kredit is null or limit_kredit >= 0`),
    index('idx_pelanggan_nama').on(t.namaPelanggan),
    index('idx_pelanggan_hp').on(t.noHp),
  ],
);

export const barang = pgTable(
  'barang',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 12 }).notNull().unique('barang_kode_key'),
    barcode: varchar('barcode', { length: 64 }).unique('barang_barcode_key'),
    namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
    idKategori: kolomRef('id_kategori').notNull(),
    idSatuanDasar: kolomRef('id_satuan_dasar').notNull(),
    stokMinimum: qty('stok_minimum')
      .notNull()
      .default(sql`0`),
    hargaModalAwal: uang('harga_modal_awal').notNull().default(0),
    kepemilikan: varchar('kepemilikan', { length: 15, enum: KEPEMILIKAN })
      .notNull()
      .default('MILIK_SENDIRI'),
    idPemasokKonsinyasi: kolomRef('id_pemasok_konsinyasi'),
    hargaTitip: uang('harga_titip'),
    hargaOtomatis: boolean('harga_otomatis').notNull().default(true),
    perluTinjauHarga: boolean('perlu_tinjau_harga').notNull().default(false),
    gambar: varchar('gambar', { length: 255 }),
    keterangan: varchar('keterangan', { length: 255 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    // Ditambahkan migrasi 0001 (K-063); di akhir agar urutan kolom sama dengan database.
    idMerk: kolomRef('id_merk'),
    // K-161 (migrasi 0026): data muatan per satuan dasar, untuk menghitung muatan kendaraan (docs/13 §2.1).
    beratKg: numeric('berat_kg', { precision: 12, scale: 3 }),
    panjangCm: numeric('panjang_cm', { precision: 10, scale: 1 }),
    lebarCm: numeric('lebar_cm', { precision: 10, scale: 1 }),
    tinggiCm: numeric('tinggi_cm', { precision: 10, scale: 1 }),
    /** Pasir, batu, tanah: tanpa ukuran per buah; volume dari `volume_m3`. */
    curah: boolean('curah').notNull().default(false),
    volumeM3: numeric('volume_m3', { precision: 12, scale: 4 }),
    /** K-127: batas atas metode saran pesan min–maks; kosong = metode itu tidak dipakai untuk barang ini. */
    stokMaksimum: qty('stok_maksimum'),
    /** K-225: pembelian barang ini selalu wajib disetujui Owner (mahal/langka); diatur hanya oleh Owner. */
    perluPersetujuanBeli: boolean('perlu_persetujuan_beli').notNull().default(false),
    /** K-227: hitung dengan timbangan: `timbang_jumlah_sampel` (satuan dasar) beratnya `timbang_berat_sampel_gram`. */
    timbangJumlahSampel: qty('timbang_jumlah_sampel'),
    timbangBeratSampelGram: numeric('timbang_berat_sampel_gram', { precision: 14, scale: 3 }),
  },
  (t) => [
    foreignKey({
      name: 'barang_id_kategori_fkey',
      columns: [t.idKategori],
      foreignColumns: [kategori.id],
    }),
    foreignKey({
      name: 'barang_id_merk_fkey',
      columns: [t.idMerk],
      foreignColumns: [merk.id],
    }),
    foreignKey({
      name: 'barang_id_satuan_dasar_fkey',
      columns: [t.idSatuanDasar],
      foreignColumns: [satuan.id],
    }),
    foreignKey({
      name: 'barang_id_pemasok_konsinyasi_fkey',
      columns: [t.idPemasokKonsinyasi],
      foreignColumns: [pemasok.id],
    }),
    check('chk_barang_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check(
      'chk_barang_muatan',
      sql`(berat_kg is null or berat_kg >= 0) and (panjang_cm is null or panjang_cm > 0)
        and (lebar_cm is null or lebar_cm > 0) and (tinggi_cm is null or tinggi_cm > 0)
        and (volume_m3 is null or volume_m3 > 0)`,
    ),
    check(
      'chk_barang_timbang',
      sql`(timbang_jumlah_sampel is null and timbang_berat_sampel_gram is null)
        or (timbang_jumlah_sampel > 0 and timbang_berat_sampel_gram > 0)`,
    ),
    check('chk_barang_kepemilikan', dalamDaftar('kepemilikan', KEPEMILIKAN)),
    check(
      'chk_barang_konsinyasi',
      sql`(kepemilikan = 'MILIK_SENDIRI' and id_pemasok_konsinyasi is null and harga_titip is null)
        or (kepemilikan = 'KONSINYASI' and id_pemasok_konsinyasi is not null and harga_titip is not null and harga_titip >= 0)`,
    ),
    check('chk_barang_stok_min', sql`stok_minimum >= 0`),
    check(
      'chk_barang_stok_maks',
      sql`stok_maksimum is null or (stok_maksimum > 0 and stok_maksimum >= stok_minimum)`,
    ),
    check('chk_barang_modal_awal', sql`harga_modal_awal >= 0`),
    index('idx_barang_nama').on(t.namaBarang),
    index('idx_barang_kategori').on(t.idKategori),
    index('idx_barang_merk').on(t.idMerk),
  ],
);

export const barangAtribut = pgTable(
  'barang_atribut',
  {
    id: kolomId(),
    idBarang: kolomRef('id_barang').notNull(),
    idJenisAtribut: kolomRef('id_jenis_atribut').notNull(),
    nilaiAngka: numeric('nilai_angka', { precision: 18, scale: 4 }),
    idSatuan: kolomRef('id_satuan'),
    nilaiTeks: varchar('nilai_teks', { length: 150 }),
    urutan: integer('urutan').notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: 'barang_atribut_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'barang_atribut_id_jenis_atribut_fkey',
      columns: [t.idJenisAtribut],
      foreignColumns: [jenisAtribut.id],
    }),
    foreignKey({
      name: 'barang_atribut_id_satuan_fkey',
      columns: [t.idSatuan],
      foreignColumns: [satuan.id],
    }),
    unique('uq_barang_atribut').on(t.idBarang, t.idJenisAtribut),
    check('chk_barang_atribut_nilai', sql`num_nonnulls(nilai_angka, nilai_teks) = 1`),
  ],
);

/** [M2] Satuan jual alternatif per barang. */
export const barangSatuanJual = pgTable(
  'barang_satuan_jual',
  {
    id: kolomId(),
    idBarang: kolomRef('id_barang').notNull(),
    idSatuan: kolomRef('id_satuan').notNull(),
    faktorKeDasar: numeric('faktor_ke_dasar', { precision: 12, scale: 4 }).notNull(),
    barcode: varchar('barcode', { length: 64 }).unique('barang_satuan_jual_barcode_key'),
    isDefaultJual: boolean('is_default_jual').notNull().default(false),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'barang_satuan_jual_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'barang_satuan_jual_id_satuan_fkey',
      columns: [t.idSatuan],
      foreignColumns: [satuan.id],
    }),
    unique('uq_barang_satuan_jual').on(t.idBarang, t.idSatuan),
    check('chk_bsj_faktor', sql`faktor_ke_dasar > 0`),
    check('chk_bsj_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
  ],
);

export const hargaBarang = pgTable(
  'harga_barang',
  {
    id: kolomId(),
    idBarang: kolomRef('id_barang').notNull(),
    idTingkatHarga: kolomRef('id_tingkat_harga').notNull(),
    idSatuanJual: kolomRef('id_satuan_jual'),
    metode: varchar('metode', { length: 10, enum: METODE_HARGA }).notNull().default('TETAP'),
    markupPersen: numeric('markup_persen', { precision: 6, scale: 2 }),
    hargaTetap: uang('harga_tetap'),
    hargaJual: uang('harga_jual').notNull(),
    dasarMarkupSaatHitung: uang('dasar_markup_saat_hitung'),
    idPengguna: kolomRef('id_pengguna'),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  (t) => [
    foreignKey({
      name: 'harga_barang_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'harga_barang_id_tingkat_harga_fkey',
      columns: [t.idTingkatHarga],
      foreignColumns: [tingkatHarga.id],
    }),
    foreignKey({
      name: 'harga_barang_id_satuan_jual_fkey',
      columns: [t.idSatuanJual],
      foreignColumns: [barangSatuanJual.id],
    }),
    foreignKey({
      name: 'harga_barang_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    unique('uq_harga_barang').on(t.idBarang, t.idTingkatHarga, t.idSatuanJual).nullsNotDistinct(),
    check('chk_harga_metode', dalamDaftar('metode', METODE_HARGA)),
    check(
      'chk_harga_isi',
      sql`(metode = 'IKUT_TIER' and markup_persen is null and harga_tetap is null)
        or (metode = 'MARKUP' and markup_persen is not null and harga_tetap is null)
        or (metode = 'TETAP' and harga_tetap is not null)`,
    ),
    check('chk_harga_jual', sql`harga_jual >= 0`),
    index('idx_harga_barang_barang').on(t.idBarang),
  ],
);

/** [M2] */
export const promo = pgTable(
  'promo',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 20 }).notNull().unique('promo_kode_key'),
    nama: varchar('nama', { length: 100 }).notNull(),
    tanggalMulai: tanggal('tanggal_mulai').notNull(),
    tanggalSelesai: tanggal('tanggal_selesai').notNull(),
    jenisPotongan: varchar('jenis_potongan', { length: 12, enum: JENIS_POTONGAN }).notNull(),
    potonganPersen: numeric('potongan_persen', { precision: 6, scale: 2 }),
    potonganNominal: uang('potongan_nominal'),
    maksPotongan: uang('maks_potongan'),
    sasaran: varchar('sasaran', { length: 10, enum: SASARAN_PROMO }).notNull(),
    minQty: qty('min_qty'),
    minBelanja: uang('min_belanja'),
    keterangan: varchar('keterangan', { length: 255 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    // K-097 (migrasi 0009): pembeli yang berhak dan syarat belanja kumulatif pelanggan.
    sasaranPembeli: varchar('sasaran_pembeli', { length: 10, enum: SASARAN_PEMBELI })
      .notNull()
      .default('SEMUA'),
    idGolongan: kolomRef('id_golongan'),
    /** Belanja pelanggan (neto) dalam `hari_belanja` hari terakhir minimal sekian rupiah. */
    minBelanjaPelanggan: uang('min_belanja_pelanggan'),
    hariBelanja: integer('hari_belanja'),
    /**
     * K-110 (migrasi 0017): anggaran promo = jumlah seluruh potongan yang boleh diberikan promo ini
     * (rupiah); NULL = tanpa batas. Yang sudah terpakai dihitung dari baris penjualan (bukan void).
     */
    anggaran: uang('anggaran'),
    /**
     * K-110: potongan paling banyak untuk satu pembeli dari promo ini; NULL = tanpa batas. Pelanggan
     * terdata: dijumlah dari semua transaksinya; pembeli umum: per transaksi.
     */
    maksPerPembeli: uang('maks_per_pembeli'),
    // K-163 (migrasi 0029): waktu berlaku sampai menit; tanggal_mulai/tanggal_selesai menjadi tanggal lokal dari
    // keduanya (dipakai saringan dan laporan).
    mulaiPada: timestamptz('mulai_pada').notNull(),
    selesaiPada: timestamptz('selesai_pada').notNull(),
    /** Hari berlaku: bit (hari ISO − 1), Senin = 1 … Minggu = 64; NULL = setiap hari. */
    hariBerlaku: integer('hari_berlaku'),
    /** Jam harian `HH:mm` (zona toko), mis. happy hour 13:00–15:00; keduanya NULL = sepanjang hari. */
    jamMulai: varchar('jam_mulai', { length: 5 }),
    jamSelesai: varchar('jam_selesai', { length: 5 }),
    /** HARGA_KHUSUS: harga per satuan dasar. */
    hargaKhusus: uang('harga_khusus'),
    /**
     * GRATIS: setiap beli `beli_qty` mendapat `gratis_qty` gratis (satuan dasar, barang yang sama). K-185
     * BELI_POTONG: setiap kelipatan `beli_qty` dipotong `potongan_nominal` rupiah.
     */
    beliQty: qty('beli_qty'),
    gratisQty: qty('gratis_qty'),
    /** Templat kampanye: tidak pernah berlaku, hanya disalin menjadi promo baru. */
    templat: boolean('templat').notNull().default(false),
    /**
     * K-194 (migrasi 0040): GRATIS/BELI_POTONG berlaku paling banyak sekian kelipatan per baris (1 = sekali);
     * NULL = tanpa batas.
     */
    maksKelipatan: integer('maks_kelipatan'),
  },
  (t) => [
    foreignKey({
      name: 'promo_id_golongan_fkey',
      columns: [t.idGolongan],
      foreignColumns: [golonganPelanggan.id],
    }),
    check('chk_promo_sasaran_pembeli', dalamDaftar('sasaran_pembeli', SASARAN_PEMBELI)),
    check(
      'chk_promo_anggaran',
      sql`(anggaran is null or anggaran > 0) and (maks_per_pembeli is null or maks_per_pembeli > 0)
        and (anggaran is null or maks_per_pembeli is null or maks_per_pembeli < anggaran)`,
    ),
    check('chk_promo_golongan', sql`(sasaran_pembeli = 'GOLONGAN') = (id_golongan is not null)`),
    check(
      'chk_promo_belanja_pelanggan',
      sql`(min_belanja_pelanggan is null and hari_belanja is null)
        or (min_belanja_pelanggan > 0 and hari_belanja between 1 and 3650)`,
    ),
    check('chk_promo_tanggal', sql`tanggal_selesai >= tanggal_mulai`),
    check('chk_promo_waktu', sql`selesai_pada > mulai_pada`),
    check('chk_promo_hari', sql`hari_berlaku is null or hari_berlaku between 1 and 127`),
    check(
      'chk_promo_jam',
      sql`(jam_mulai is null and jam_selesai is null)
        or (jam_mulai ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and jam_selesai ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and jam_mulai < jam_selesai)`,
    ),
    check('chk_promo_jenis', dalamDaftar('jenis_potongan', JENIS_POTONGAN)),
    check(
      'chk_promo_nilai',
      sql`(jenis_potongan = 'PERSEN' and potongan_persen is not null and potongan_persen between 0 and 100
          and potongan_nominal is null and harga_khusus is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'NOMINAL' and potongan_nominal is not null and potongan_nominal >= 0
          and potongan_persen is null and harga_khusus is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'HARGA_KHUSUS' and harga_khusus > 0 and potongan_persen is null
          and potongan_nominal is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'GRATIS' and beli_qty > 0 and gratis_qty > 0 and potongan_persen is null
          and potongan_nominal is null and harga_khusus is null)
        or (jenis_potongan = 'BELI_POTONG' and beli_qty > 0 and potongan_nominal > 0
          and potongan_persen is null and harga_khusus is null and gratis_qty is null)`,
    ),
    check('chk_promo_sasaran', dalamDaftar('sasaran', SASARAN_PROMO)),
    check(
      'chk_promo_kelipatan',
      sql`maks_kelipatan is null or (maks_kelipatan between 1 and 1000 and jenis_potongan in ('GRATIS','BELI_POTONG'))`,
    ),
    check('chk_promo_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
  ],
);

/**
 * K-163 (migrasi 0029): sasaran promo, boleh beberapa: tepat satu dari barang, kategori, atau merk per baris,
 * sesuai `promo.sasaran`. Tabel penghubung master (diganti seluruhnya saat promo diubah, sebelum dipakai).
 * K-185 (migrasi 0037): untuk `promo.sasaran = KELOMPOK` satu baris = satu kelompok, berisi satu sampai tiga
 * kolom sekaligus (kategori DAN merk DAN barang).
 */
export const promoSasaran = pgTable(
  'promo_sasaran',
  {
    id: kolomId(),
    idPromo: kolomRef('id_promo').notNull(),
    idBarang: kolomRef('id_barang'),
    idKategori: kolomRef('id_kategori'),
    idMerk: kolomRef('id_merk'),
  },
  (t) => [
    foreignKey({
      name: 'promo_sasaran_id_promo_fkey',
      columns: [t.idPromo],
      foreignColumns: [promo.id],
    }),
    foreignKey({
      name: 'promo_sasaran_id_barang_fkey',
      columns: [t.idBarang],
      foreignColumns: [barang.id],
    }),
    foreignKey({
      name: 'promo_sasaran_id_kategori_fkey',
      columns: [t.idKategori],
      foreignColumns: [kategori.id],
    }),
    foreignKey({
      name: 'promo_sasaran_id_merk_fkey',
      columns: [t.idMerk],
      foreignColumns: [merk.id],
    }),
    check('chk_promo_sasaran_isi', sql`num_nonnulls(id_barang, id_kategori, id_merk) >= 1`),
    uniqueIndex('uq_promo_sasaran').on(
      t.idPromo,
      sql`coalesce(id_barang, 0)`,
      sql`coalesce(id_kategori, 0)`,
      sql`coalesce(id_merk, 0)`,
    ),
    index('idx_promo_sasaran_barang').on(t.idBarang),
  ],
);

/** K-097 (migrasi 0009): pelanggan yang berhak atas promo dengan `sasaran_pembeli = PELANGGAN`. */
export const promoPelanggan = pgTable(
  'promo_pelanggan',
  {
    idPromo: kolomRef('id_promo').notNull(),
    idPelanggan: kolomRef('id_pelanggan').notNull(),
  },
  (t) => [
    primaryKey({ name: 'promo_pelanggan_pkey', columns: [t.idPromo, t.idPelanggan] }),
    foreignKey({
      name: 'promo_pelanggan_id_promo_fkey',
      columns: [t.idPromo],
      foreignColumns: [promo.id],
    }),
    foreignKey({
      name: 'promo_pelanggan_id_pelanggan_fkey',
      columns: [t.idPelanggan],
      foreignColumns: [pelanggan.id],
    }),
    index('idx_promo_pelanggan_pelanggan').on(t.idPelanggan),
  ],
);
