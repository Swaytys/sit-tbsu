import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  varchar,
  bigint,
} from 'drizzle-orm/pg-core';
import { PERAN, STATUS_AKTIF, TIPE_KONFIGURASI } from '@sit/shared';
import {
  dalamDaftar,
  dibuatPada,
  diubahPada,
  kolomId,
  kolomRef,
  statusAktif,
  timestamptz,
} from './kolom';

// Bagian SISTEM di docs/03-skema-database-v3.sql.

export const konfigurasi = pgTable(
  'konfigurasi',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 60 }).notNull().unique('konfigurasi_kode_key'),
    nilai: text('nilai'),
    tipe: varchar('tipe', { length: 10, enum: TIPE_KONFIGURASI }).notNull().default('TEKS'),
    deskripsi: varchar('deskripsi', { length: 255 }),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [check('chk_konfigurasi_tipe', dalamDaftar('tipe', TIPE_KONFIGURASI))],
);

export const penghitungNomor = pgTable(
  'penghitung_nomor',
  {
    prefix: varchar('prefix', { length: 10 }).notNull(),
    tanggalKode: char('tanggal_kode', { length: 6 }).notNull(),
    nilaiTerakhir: integer('nilai_terakhir').notNull().default(0),
  },
  (t) => [primaryKey({ name: 'penghitung_nomor_pkey', columns: [t.prefix, t.tanggalKode] })],
);

export const pengguna = pgTable(
  'pengguna',
  {
    id: kolomId(),
    kode: varchar('kode', { length: 12 }).notNull().unique('pengguna_kode_key'),
    namaPengguna: varchar('nama_pengguna', { length: 100 }).notNull(),
    username: varchar('username', { length: 50 }).notNull().unique('pengguna_username_key'),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    peran: varchar('peran', { length: 20, enum: PERAN }).notNull(),
    statusAktif: statusAktif(),
    noHp: varchar('no_hp', { length: 20 }),
    wajibGantiPassword: boolean('wajib_ganti_password').notNull().default(false),
    gagalLoginBerturut: integer('gagal_login_berturut').notNull().default(0),
    terkunciSampai: timestamptz('terkunci_sampai'),
    loginTerakhir: timestamptz('login_terakhir'),
    dibuatPada: dibuatPada(),
    diubahPada: diubahPada(),
  },
  () => [
    check('chk_pengguna_peran', dalamDaftar('peran', PERAN)),
    check('chk_pengguna_status', dalamDaftar('status_aktif', STATUS_AKTIF)),
  ],
);

/** [APPEND] */
export const sesiLogin = pgTable(
  'sesi_login',
  {
    id: kolomId(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique('sesi_login_token_hash_key'),
    dibuatPada: dibuatPada(),
    kadaluarsaAbsolut: timestamptz('kadaluarsa_absolut').notNull(),
    terakhirAktif: timestamptz('terakhir_aktif').notNull().defaultNow(),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    dicabutPada: timestamptz('dicabut_pada'),
    alasanCabut: varchar('alasan_cabut', { length: 50 }),
  },
  (t) => [
    foreignKey({
      name: 'sesi_login_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    index('idx_sesi_pengguna').on(t.idPengguna),
  ],
);

/** [APPEND] */
export const logAktivitas = pgTable(
  'log_aktivitas',
  {
    id: kolomId(),
    waktu: timestamptz('waktu').notNull().defaultNow(),
    idPengguna: kolomRef('id_pengguna'),
    usernamePercobaan: varchar('username_percobaan', { length: 50 }),
    aksi: varchar('aksi', { length: 60 }).notNull(),
    entitas: varchar('entitas', { length: 40 }),
    idEntitas: bigint('id_entitas', { mode: 'number' }),
    nomorDokumen: varchar('nomor_dokumen', { length: 30 }),
    ringkasan: text('ringkasan'),
    dataLama: jsonb('data_lama'),
    dataBaru: jsonb('data_baru'),
    ip: varchar('ip', { length: 45 }),
  },
  (t) => [
    foreignKey({
      name: 'log_aktivitas_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    index('idx_log_waktu').on(t.waktu),
    index('idx_log_pengguna').on(t.idPengguna),
    index('idx_log_entitas').on(t.entitas, t.idEntitas),
  ],
);
