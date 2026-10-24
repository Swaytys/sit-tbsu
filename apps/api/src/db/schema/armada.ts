import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { STATUS_AKTIF, STATUS_PERJALANAN } from '@sit/shared';
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
import { pengguna } from './sistem';

/*
 * FMS inti (migrasi 0023, K-150, docs/05 S8–S9): kendaraan dan sopir sebagai data master, perjalanan (trip)
 * yang mengelompokkan surat jalan yang berangkat bersama.
 */

/** [MASTER] Tidak dihapus; dinonaktifkan. */
export const kendaraan = pgTable(
  'kendaraan',
  {
    id: kolomId(),
    /** Huruf besar, satu spasi antarbagian ("S 1234 AB"); dirapikan skema Zod. */
    plat: varchar('plat', { length: 15 }).notNull(),
    jenis: varchar('jenis', { length: 30 }).notNull(),
    kapasitasKg: integer('kapasitas_kg'),
    catatan: varchar('catatan', { length: 255 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    // K-161 (migrasi 0026): ukuran bak (cm). `kapasitas_kg` = daya angkut dari buku KIR/STNK.
    bakPanjangCm: integer('bak_panjang_cm'),
    bakLebarCm: integer('bak_lebar_cm'),
    bakTinggiCm: integer('bak_tinggi_cm'),
    // K-162: masa berlaku dokumen kendaraan (pengingat).
    berlakuStnk: tanggal('berlaku_stnk'),
    berlakuKir: tanggal('berlaku_kir'),
    // K-162 (migrasi 0028): jadwal servis berkala.
    servisTiapKm: integer('servis_tiap_km'),
    servisTiapBulan: integer('servis_tiap_bulan'),
  },
  () => [
    check('chk_kendaraan_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check('chk_kendaraan_kapasitas', sql`kapasitas_kg is null or kapasitas_kg > 0`),
    check(
      'chk_kendaraan_bak',
      sql`(bak_panjang_cm is null or bak_panjang_cm > 0) and (bak_lebar_cm is null or bak_lebar_cm > 0)
        and (bak_tinggi_cm is null or bak_tinggi_cm > 0)`,
    ),
    check(
      'chk_kendaraan_servis',
      sql`(servis_tiap_km is null or servis_tiap_km > 0)
        and (servis_tiap_bulan is null or servis_tiap_bulan between 1 and 60)`,
    ),
    uniqueIndex('uq_kendaraan_plat').on(sql`upper(plat)`),
  ],
);

/** [MASTER] Sopir tidak punya akun; pencatatan oleh admin/kasir (K-149). */
export const sopir = pgTable(
  'sopir',
  {
    id: kolomId(),
    nama: varchar('nama', { length: 100 }).notNull(),
    noHp: varchar('no_hp', { length: 20 }),
    catatan: varchar('catatan', { length: 255 }),
    statusAktif: statusAktif(),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [
    check('chk_sopir_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    uniqueIndex('uq_sopir_nama').on(sql`lower(nama)`),
  ],
);

/** [APPEND] kecuali status & waktu_kembali. Satu perjalanan berjalan per kendaraan dan per sopir (S9). */
export const perjalanan = pgTable(
  'perjalanan',
  {
    id: kolomId(),
    nomor: varchar('nomor', { length: 30 }).notNull().unique('perjalanan_nomor_key'),
    idKendaraan: kolomRef('id_kendaraan').notNull(),
    idSopir: kolomRef('id_sopir').notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    status: varchar('status', { length: 12, enum: STATUS_PERJALANAN }).notNull().default('JALAN'),
    /** Diisi saat benar-benar berangkat; rit DIRENCANAKAN belum punya (K-160). */
    waktuBerangkat: timestamptz('waktu_berangkat').defaultNow(),
    waktuKembali: timestamptz('waktu_kembali'),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
    // K-161 (migrasi 0026): muatan saat berangkat (riwayat & utilisasi) dan alasan bila melewati batas lunak.
    muatanBeratKg: numeric('muatan_berat_kg', { precision: 12, scale: 3 }),
    muatanVolumeM3: numeric('muatan_volume_m3', { precision: 12, scale: 4 }),
    alasanMuatan: varchar('alasan_muatan', { length: 500 }),
    // K-160 (migrasi 0027): rit rencana.
    jadwalBerangkat: timestamptz('jadwal_berangkat'),
    alasanBatal: varchar('alasan_batal', { length: 255 }),
  },
  (t) => [
    foreignKey({
      name: 'perjalanan_id_kendaraan_fkey',
      columns: [t.idKendaraan],
      foreignColumns: [kendaraan.id],
    }),
    foreignKey({
      name: 'perjalanan_id_sopir_fkey',
      columns: [t.idSopir],
      foreignColumns: [sopir.id],
    }),
    foreignKey({
      name: 'perjalanan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_perjalanan_status', dalamDaftar('status', STATUS_PERJALANAN)),
    check(
      'chk_perjalanan_kembali',
      sql`(status in ('DIRENCANAKAN', 'BATAL') and waktu_kembali is null)
        or (status = 'JALAN' and waktu_kembali is null and waktu_berangkat is not null)
        or (status = 'SELESAI' and waktu_kembali is not null and waktu_berangkat is not null)`,
    ),
    uniqueIndex('uq_perjalanan_kendaraan_jalan')
      .on(t.idKendaraan)
      .where(sql`status = 'JALAN'`),
    uniqueIndex('uq_perjalanan_sopir_jalan')
      .on(t.idSopir)
      .where(sql`status = 'JALAN'`),
    index('idx_perjalanan_berangkat').on(t.waktuBerangkat),
  ],
);

/*
 * K-162 (migrasi 0028, docs/13 §5): catatan BBM dan servis kendaraan. [APPEND] kecuali kolom batal (catatan salah
 * dibatalkan dengan alasan lalu dicatat ulang). Odometer tidak boleh mundur (dicek service).
 */

const kolomBatal = () => ({
  batalPada: timestamptz('batal_pada'),
  alasanBatal: varchar('alasan_batal', { length: 255 }),
  dibatalkanOleh: kolomRef('dibatalkan_oleh'),
});

export const catatanBbm = pgTable(
  'catatan_bbm',
  {
    id: kolomId(),
    idKendaraan: kolomRef('id_kendaraan').notNull(),
    idSopir: kolomRef('id_sopir'),
    idPerjalanan: kolomRef('id_perjalanan'),
    tanggal: tanggal('tanggal').notNull(),
    odometerKm: integer('odometer_km'),
    liter: numeric('liter', { precision: 8, scale: 2 }).notNull(),
    totalRp: uang('total_rp').notNull(),
    /** Tangki diisi penuh (dipakai menghitung km per liter). */
    penuh: boolean('penuh').notNull().default(false),
    catatan: varchar('catatan', { length: 255 }),
    idPengguna: kolomRef('id_pengguna').notNull(),
    dibuatPada: dibuatPada(),
    ...kolomBatal(),
  },
  (t) => [
    foreignKey({
      name: 'catatan_bbm_id_kendaraan_fkey',
      columns: [t.idKendaraan],
      foreignColumns: [kendaraan.id],
    }),
    foreignKey({
      name: 'catatan_bbm_id_sopir_fkey',
      columns: [t.idSopir],
      foreignColumns: [sopir.id],
    }),
    foreignKey({
      name: 'catatan_bbm_id_perjalanan_fkey',
      columns: [t.idPerjalanan],
      foreignColumns: [perjalanan.id],
    }),
    foreignKey({
      name: 'catatan_bbm_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'catatan_bbm_dibatalkan_oleh_fkey',
      columns: [t.dibatalkanOleh],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_catatan_bbm_angka',
      sql`liter > 0 and total_rp >= 0 and (odometer_km is null or odometer_km >= 0)`,
    ),
    check('chk_catatan_bbm_batal', sql`(batal_pada is null) = (alasan_batal is null)`),
    index('idx_catatan_bbm_kendaraan').on(t.idKendaraan, t.tanggal),
  ],
);

export const catatanServis = pgTable(
  'catatan_servis',
  {
    id: kolomId(),
    idKendaraan: kolomRef('id_kendaraan').notNull(),
    tanggal: tanggal('tanggal').notNull(),
    odometerKm: integer('odometer_km'),
    jenis: varchar('jenis', { length: 100 }).notNull(),
    biayaRp: uang('biaya_rp').notNull(),
    bengkel: varchar('bengkel', { length: 100 }),
    catatan: varchar('catatan', { length: 255 }),
    idPengguna: kolomRef('id_pengguna').notNull(),
    dibuatPada: dibuatPada(),
    ...kolomBatal(),
  },
  (t) => [
    foreignKey({
      name: 'catatan_servis_id_kendaraan_fkey',
      columns: [t.idKendaraan],
      foreignColumns: [kendaraan.id],
    }),
    foreignKey({
      name: 'catatan_servis_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'catatan_servis_dibatalkan_oleh_fkey',
      columns: [t.dibatalkanOleh],
      foreignColumns: [pengguna.id],
    }),
    check(
      'chk_catatan_servis_angka',
      sql`biaya_rp >= 0 and (odometer_km is null or odometer_km >= 0)`,
    ),
    check('chk_catatan_servis_batal', sql`(batal_pada is null) = (alasan_batal is null)`),
    index('idx_catatan_servis_kendaraan').on(t.idKendaraan, t.tanggal),
  ],
);
