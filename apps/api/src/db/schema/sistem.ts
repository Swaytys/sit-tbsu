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
import {
  JENIS_CADANGAN,
  JENIS_INTERAKSI,
  PEMICU_CADANGAN,
  PERAN,
  STATUS_AKTIF,
  STATUS_CADANGAN,
  STATUS_TUJUAN_CADANGAN,
  STATUS_TUTUP_TAHUN,
  TIPE_KONFIGURASI,
} from '@sit/shared';
import { sql } from 'drizzle-orm';
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
    /** K-102 (migrasi 0014): tujuan kode persetujuan sekali pakai. Keduanya boleh kosong. */
    email: varchar('email', { length: 120 }),
    telegramChatId: varchar('telegram_chat_id', { length: 20 }),
    /** K-191 (migrasi 0035): hash argon2id kode pemulihan sekali pakai (lupa password); kosong = belum dibuat. */
    kodePemulihanHash: varchar('kode_pemulihan_hash', { length: 255 }),
    kodePemulihanDibuatPada: timestamptz('kode_pemulihan_dibuat_pada'),
    /** K-206 (migrasi 0041): tur fitur yang sudah selesai/dilewati pengguna ini. */
    turStatus: jsonb('tur_status')
      .$type<{ selesai: string[]; dilewati: string[] }>()
      .notNull()
      .default(sql`'{"selesai":[],"dilewati":[]}'::jsonb`),
    /** K-145 (migrasi 0043): tombol pintasan yang diganti pengguna ini; kosong = bawaan. */
    pintasan: jsonb('pintasan')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
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

/**
 * K-209 (migrasi 0041): kode verifikasi lupa password lewat email. 6 angka, disimpan sebagai hash SHA-256, berlaku
 * 10 menit, sekali pakai, gugur setelah 5 kali salah. Permintaan baru menggugurkan kode lama (status kolom saja).
 */
export const kodeResetPassword = pgTable(
  'kode_reset_password',
  {
    id: kolomId(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    kodeHash: char('kode_hash', { length: 64 }).notNull(),
    kedaluwarsa: timestamptz('kedaluwarsa').notNull(),
    salah: integer('salah').notNull().default(0),
    dipakaiPada: timestamptz('dipakai_pada'),
    digugurkanPada: timestamptz('digugurkan_pada'),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'kode_reset_password_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    index('idx_kode_reset_pengguna').on(t.idPengguna),
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

/**
 * Riwayat cadangan & uji pulih (Fase 8, K-084). [APPEND] kecuali kolom hasil (status, waktu_selesai,
 * ukuran, snapshot, pesan) yang diisi saat proses yang sama selesai.
 */
export const cadangan = pgTable(
  'cadangan',
  {
    id: kolomId(),
    jenis: varchar('jenis', { length: 10, enum: JENIS_CADANGAN }).notNull(),
    status: varchar('status', { length: 10, enum: STATUS_CADANGAN }).notNull().default('BERJALAN'),
    pemicu: varchar('pemicu', { length: 20, enum: PEMICU_CADANGAN }).notNull(),
    idPengguna: kolomRef('id_pengguna'),
    waktuMulai: timestamptz('waktu_mulai').notNull().defaultNow(),
    waktuSelesai: timestamptz('waktu_selesai'),
    ukuranDump: bigint('ukuran_dump', { mode: 'number' }),
    snapshotLokal: varchar('snapshot_lokal', { length: 64 }),
    statusLokal: varchar('status_lokal', { length: 10, enum: STATUS_TUJUAN_CADANGAN }),
    snapshotCloud: varchar('snapshot_cloud', { length: 64 }),
    statusCloud: varchar('status_cloud', { length: 10, enum: STATUS_TUJUAN_CADANGAN }),
    pesan: varchar('pesan', { length: 1000 }),
  },
  (t) => [
    foreignKey({
      name: 'cadangan_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_cadangan_jenis', dalamDaftar('jenis', JENIS_CADANGAN)),
    check('chk_cadangan_status', dalamDaftar('status', STATUS_CADANGAN)),
    check('chk_cadangan_pemicu', dalamDaftar('pemicu', PEMICU_CADANGAN)),
    check(
      'chk_cadangan_tujuan',
      sql`(status_lokal is null or status_lokal in ('BERHASIL','GAGAL','NONAKTIF'))
        and (status_cloud is null or status_cloud in ('BERHASIL','GAGAL','NONAKTIF'))`,
    ),
    index('idx_cadangan_waktu').on(t.waktuMulai),
  ],
);

/**
 * K-164 (migrasi 0025): kunci idempoten kiriman data. Browser memberi tiap kiriman perubahan header
 * `Idempotency-Key`; kiriman ulang dengan kunci sama (mis. jaringan putus sebelum jawaban sampai) mendapat jawaban
 * yang tersimpan, tidak dijalankan dua kali. Data teknis: dibersihkan otomatis setelah 24 jam.
 */
export const kunciIdempoten = pgTable(
  'kunci_idempoten',
  {
    kunci: varchar('kunci', { length: 64 }).notNull(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    metode: varchar('metode', { length: 8 }).notNull(),
    jalur: varchar('jalur', { length: 255 }).notNull(),
    hashBody: char('hash_body', { length: 64 }).notNull(),
    /** PROSES = sedang dijalankan; SELESAI = jawaban tersimpan. */
    status: varchar('status', { length: 10 }).notNull().default('PROSES'),
    kodeHttp: integer('kode_http'),
    respons: text('respons'),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    primaryKey({ name: 'kunci_idempoten_pkey', columns: [t.kunci, t.idPengguna] }),
    foreignKey({
      name: 'kunci_idempoten_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_kunci_idempoten_status', sql`status in ('PROSES','SELESAI')`),
    index('idx_kunci_idempoten_dibuat').on(t.dibuatPada),
  ],
);

/**
 * K-165 (migrasi 0031): tutup tahun / arsip tahunan. Satu baris per tahun yang pernah ditutup. Tahun DITUTUP
 * dikunci dari dokumen baru atau perubahan bertanggal tahun itu; isinya diekspor ke berkas arsip (gzip JSON,
 * ber-SHA-256) di folder penyimpanan yang ikut dicadangkan. Data tetap di database (dibaca seperti biasa).
 * Kolom status dan kolom buka/tutup berubah saat ditutup ulang atau dibuka kembali.
 */
export const tutupTahun = pgTable(
  'tutup_tahun',
  {
    tahun: integer('tahun').primaryKey(),
    status: varchar('status', { length: 10, enum: STATUS_TUTUP_TAHUN }).notNull(),
    ditutupPada: timestamptz('ditutup_pada').notNull(),
    ditutupOleh: kolomRef('ditutup_oleh').notNull(),
    ringkasan: jsonb('ringkasan').notNull(),
    berkas: varchar('berkas', { length: 255 }).notNull(),
    sha256: char('sha256', { length: 64 }).notNull(),
    ukuran: bigint('ukuran', { mode: 'number' }).notNull(),
    dibukaPada: timestamptz('dibuka_pada'),
    dibukaOleh: kolomRef('dibuka_oleh'),
    alasanBuka: varchar('alasan_buka', { length: 255 }),
  },
  (t) => [
    foreignKey({
      name: 'tutup_tahun_ditutup_oleh_fkey',
      columns: [t.ditutupOleh],
      foreignColumns: [pengguna.id],
    }),
    foreignKey({
      name: 'tutup_tahun_dibuka_oleh_fkey',
      columns: [t.dibukaOleh],
      foreignColumns: [pengguna.id],
    }),
    check('chk_tutup_tahun_status', dalamDaftar('status', STATUS_TUTUP_TAHUN)),
    check('chk_tutup_tahun_tahun', sql`tahun between 2000 and 2999`),
    check(
      'chk_tutup_tahun_buka',
      sql`(status = 'DIBUKA') = (dibuka_pada is not null and alasan_buka is not null)`,
    ),
  ],
);

/**
 * K-190: log interaksi untuk penelitian (docs/03 §6). [APPEND] Terpisah dari log audit; hanya nama elemen, halaman,
 * dan angka (lama/jumlah hasil), tidak pernah isi ketikan. `waktu` = saat kejadian di peramban (dikirim berkelompok).
 */
export const logInteraksi = pgTable(
  'log_interaksi',
  {
    id: kolomId(),
    idPengguna: kolomRef('id_pengguna').notNull(),
    idSesiKlien: varchar('id_sesi_klien', { length: 40 }).notNull(),
    waktu: timestamptz('waktu').notNull(),
    jenis: varchar('jenis', { length: 10 }).notNull(),
    halaman: varchar('halaman', { length: 120 }).notNull(),
    elemen: varchar('elemen', { length: 150 }),
    keterangan: varchar('keterangan', { length: 255 }),
    angka: integer('angka'),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    foreignKey({
      name: 'log_interaksi_id_pengguna_fkey',
      columns: [t.idPengguna],
      foreignColumns: [pengguna.id],
    }),
    check('chk_log_interaksi_jenis', dalamDaftar('jenis', JENIS_INTERAKSI)),
    index('idx_log_interaksi_waktu').on(t.waktu),
    index('idx_log_interaksi_pengguna').on(t.idPengguna, t.waktu),
  ],
);
