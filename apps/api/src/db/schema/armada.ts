import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
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
  timestamptz,
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
  },
  () => [
    check('chk_kendaraan_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
    check('chk_kendaraan_kapasitas', sql`kapasitas_kg is null or kapasitas_kg > 0`),
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
    status: varchar('status', { length: 10, enum: STATUS_PERJALANAN }).notNull().default('JALAN'),
    waktuBerangkat: timestamptz('waktu_berangkat').notNull().defaultNow(),
    waktuKembali: timestamptz('waktu_kembali'),
    catatan: varchar('catatan', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
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
      sql`(status = 'JALAN' and waktu_kembali is null) or (status = 'SELESAI' and waktu_kembali is not null)`,
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
