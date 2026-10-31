import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  POLA_ID_DATA,
  SIMPAN_PENGAMAN,
  VERSI_APLIKASI,
  type JenisData,
  type ManifestData,
  type RingkasData,
} from '@sit/shared';
import pg from 'pg';
import { jalankanMigrasi } from '../../../db/migrator';
import { AppError } from '../../../lib/errors';
import { wajib } from '../cadangan/alat';

/*
 * K-213: Pustaka data. Tiap data = satu folder `<akar>/<id>/` berisi `db.dump` (pg_dump format custom, terkompres),
 * `storage/` (gambar dan berkas unggahan; folder `sistem/` milik komputer tidak ikut), dan `manifest.json`.
 * Pengaman otomatis di `<akar>/pengaman/<id>/`. Modul ini tidak memakai koneksi `db` aplikasi sehingga dipakai juga
 * oleh peluncur desktop (konversi data lama, "Mulai dari nol").
 *
 * Berkas pindah perangkat `.bonsai`: "BONSAIURIP-DATA1\n" + panjang kepala (4 byte) + kepala JSON (versi, nama toko,
 * tanggal, salt, iv) + isi terenkripsi AES-256-GCM (kunci scrypt dari sandi) + tag 16 byte. Isi = arsip sederhana
 * [panjang nama][nama][panjang isi][isi] untuk manifest.json, db.dump, dan storage/**.
 */

export type PengaturanPg = { url: string; pgBin: string | null };

const pgProgram = (k: PengaturanPg, nama: 'pg_dump' | 'pg_restore') =>
  k.pgBin ? path.join(k.pgBin, nama) : nama;

function koneksi(url: string) {
  const u = new URL(url);
  return {
    argumen: ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username)],
    env: { PGPASSWORD: decodeURIComponent(u.password) },
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
}

/** Folder `storage` yang ikut data: semua kecuali `sistem` (aturan cadangan per komputer) dan berkas sementara. */
const BUKAN_DATA = new Set(['sistem', 'tmp', 'sementara']);

async function ukuranFolder(folder: string): Promise<number> {
  if (!existsSync(folder)) return 0;
  let total = 0;
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const p = path.join(folder, e.name);
    total += e.isDirectory() ? await ukuranFolder(p) : (await stat(p)).size;
  }
  return total;
}

// --- Ringkasan isi database ---

/** Ringkasan isi database `url` (tabel yang belum ada di versi lama dihitung 0). */
export async function ringkasDatabase(url: string): Promise<RingkasData> {
  const k = new pg.Client({ connectionString: url });
  await k.connect();
  const coba = async <T>(sql: string, bawaan: T, ubah: (r: pg.QueryResult) => T): Promise<T> => {
    try {
      return ubah(await k.query(sql));
    } catch {
      return bawaan;
    }
  };
  try {
    const konfig = await coba(
      `select kode, nilai from konfigurasi where kode in ('nama_toko','nama_badan_usaha','kota_toko')`,
      new Map<string, string>(),
      (r) =>
        new Map(r.rows.map((b: { kode: string; nilai: string | null }) => [b.kode, b.nilai ?? ''])),
    );
    const hitung = (t: string) =>
      coba(`select count(*)::int as n from ${t}`, 0, (r) => Number((r.rows[0] as { n: number }).n));
    const rentang = await coba(
      'select min(tanggal) as a, max(tanggal) as b from penjualan',
      { a: null as Date | null, b: null as Date | null },
      (r) => r.rows[0] as { a: Date | null; b: Date | null },
    );
    return {
      namaToko: konfig.get('nama_toko') ?? '',
      namaBadanUsaha: konfig.get('nama_badan_usaha') ?? '',
      kotaToko: konfig.get('kota_toko') ?? '',
      versiAplikasi: VERSI_APLIKASI,
      migrasi: await coba('select count(*)::int as n from drizzle.__drizzle_migrations', 0, (r) =>
        Number((r.rows[0] as { n: number }).n),
      ),
      pengguna: await coba(
        'select username, nama_pengguna, peran, status_aktif from pengguna order by id',
        [],
        (r) =>
          r.rows.map(
            (b: {
              username: string;
              nama_pengguna: string;
              peran: string;
              status_aktif: string;
            }) => ({
              username: b.username,
              namaPengguna: b.nama_pengguna,
              peran: b.peran,
              aktif: b.status_aktif === 'AKTIF',
            }),
          ),
      ),
      jumlah: {
        barang: await hitung('barang'),
        pelanggan: await hitung('pelanggan'),
        pemasok: await hitung('pemasok'),
        penjualan: await hitung('penjualan'),
      },
      transaksiPertama: rentang.a ? new Date(rentang.a).toISOString() : null,
      transaksiTerakhir: rentang.b ? new Date(rentang.b).toISOString() : null,
    };
  } finally {
    await k.end();
  }
}

export async function ukuranDatabase(url: string): Promise<number> {
  const k = new pg.Client({ connectionString: url });
  await k.connect();
  try {
    const r = await k.query<{ n: string }>(
      'select pg_database_size(current_database())::text as n',
    );
    return Number(r.rows[0]?.n ?? 0);
  } finally {
    await k.end();
  }
}

// --- Daftar ---

async function bacaManifest(folder: string): Promise<ManifestData | null> {
  try {
    return JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8')) as ManifestData;
  } catch {
    return null;
  }
}

export function folderEntri(akar: string, id: string, jenis?: JenisData): string {
  if (!POLA_ID_DATA.test(id)) throw new AppError('VALIDASI', 'Data tidak dikenal.', 400);
  return jenis === 'PENGAMAN' ? path.join(akar, 'pengaman', id) : path.join(akar, id);
}

async function daftarDi(folder: string): Promise<ManifestData[]> {
  if (!existsSync(folder)) return [];
  const hasil: ManifestData[] = [];
  for (const e of await readdir(folder, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'pengaman' || !POLA_ID_DATA.test(e.name)) continue;
    const m = await bacaManifest(path.join(folder, e.name));
    if (m && existsSync(path.join(folder, e.name, 'db.dump'))) hasil.push(m);
  }
  return hasil.sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
}

export async function daftarPustaka(akar: string) {
  return { pustaka: await daftarDi(akar), pengaman: await daftarDi(path.join(akar, 'pengaman')) };
}

export async function cariEntri(
  akar: string,
  id: string,
): Promise<{ folder: string; manifest: ManifestData }> {
  for (const folder of [folderEntri(akar, id), folderEntri(akar, id, 'PENGAMAN')]) {
    const m = await bacaManifest(folder);
    if (m && existsSync(path.join(folder, 'db.dump'))) return { folder, manifest: m };
  }
  throw new AppError('TIDAK_DITEMUKAN', 'Data tidak ditemukan di Pustaka.', 404);
}

// --- Simpan ---

function idBaru(): string {
  const t = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${t}-${randomUUID().slice(0, 8)}`;
}

/** Menyimpan database `pg.url` + folder storage sebagai data baru di Pustaka. */
export async function simpanKePustaka(p: {
  pg: PengaturanPg;
  akar: string;
  storageDir: string;
  jenis: JenisData;
  label: string;
}): Promise<ManifestData> {
  const id = idBaru();
  const folder = folderEntri(p.akar, id, p.jenis);
  await mkdir(folder, { recursive: true });
  try {
    const k = koneksi(p.pg.url);
    await wajib(
      pgProgram(p.pg, 'pg_dump'),
      [...k.argumen, '--format=custom', '--file', path.join(folder, 'db.dump'), k.database],
      { env: k.env, batasMs: 60 * 60 * 1000 },
    );
    await salinStorage(p.storageDir, path.join(folder, 'storage'));
    const manifest: ManifestData = {
      ...(await ringkasDatabase(p.pg.url)),
      id,
      jenis: p.jenis,
      label: p.label,
      dibuatPada: new Date().toISOString(),
      ukuranByte: 0,
    };
    manifest.ukuranByte = await ukuranFolder(folder);
    await writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
    if (p.jenis === 'PENGAMAN') await pangkasPengaman(p.akar);
    return manifest;
  } catch (err) {
    await rm(folder, { recursive: true, force: true });
    throw err;
  }
}

async function salinStorage(dari: string, ke: string): Promise<void> {
  await mkdir(ke, { recursive: true });
  if (!existsSync(dari)) return;
  for (const e of await readdir(dari, { withFileTypes: true })) {
    if (BUKAN_DATA.has(e.name)) continue;
    await cp(path.join(dari, e.name), path.join(ke, e.name), { recursive: true });
  }
}

/** Pengaman otomatis: hanya SIMPAN_PENGAMAN terbaru yang disimpan. */
export async function pangkasPengaman(akar: string): Promise<void> {
  const daftar = await daftarDi(path.join(akar, 'pengaman'));
  for (const lama of daftar.slice(SIMPAN_PENGAMAN)) {
    await rm(folderEntri(akar, lama.id, 'PENGAMAN'), { recursive: true, force: true });
  }
}

export async function hapusEntri(akar: string, id: string): Promise<ManifestData> {
  const folder = folderEntri(akar, id);
  const m = await bacaManifest(folder);
  if (!m) throw new AppError('TIDAK_DITEMUKAN', 'Data tidak ditemukan di Pustaka.', 404);
  await rm(folder, { recursive: true, force: true });
  return m;
}

// --- Pulihkan (mengganti data aktif) ---

/**
 * Mengganti seluruh isi database `pg.url` dengan `folder/db.dump`, memperbarui strukturnya ke versi aplikasi ini,
 * lalu mengganti isi storage. Semua sesi login dicabut (akun mengikuti data yang dipulihkan).
 */
export async function pulihkanDari(p: {
  pg: PengaturanPg;
  folder: string;
  storageDir: string;
}): Promise<void> {
  const k = koneksi(p.pg.url);
  const klien = new pg.Client({ connectionString: p.pg.url });
  await klien.connect();
  try {
    await klien.query('drop schema if exists drizzle cascade');
    await klien.query('drop schema if exists public cascade');
    await klien.query('create schema public');
  } finally {
    await klien.end();
  }
  await wajib(
    pgProgram(p.pg, 'pg_restore'),
    [
      ...k.argumen,
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--dbname',
      k.database,
      path.join(p.folder, 'db.dump'),
    ],
    { env: k.env, batasMs: 60 * 60 * 1000 },
  );
  await jalankanMigrasi(p.pg.url);
  const sesudah = new pg.Client({ connectionString: p.pg.url });
  await sesudah.connect();
  try {
    await sesudah.query(
      `update sesi_login set dicabut_pada = now(), alasan_cabut = 'GANTI_DATA' where dicabut_pada is null`,
    );
  } finally {
    await sesudah.end();
  }
  await gantiStorage(path.join(p.folder, 'storage'), p.storageDir);
}

async function gantiStorage(dari: string, ke: string): Promise<void> {
  await mkdir(ke, { recursive: true });
  for (const e of await readdir(ke, { withFileTypes: true })) {
    if (!BUKAN_DATA.has(e.name)) await rm(path.join(ke, e.name), { recursive: true, force: true });
  }
  await salinStorage(dari, ke);
}

/** Mengosongkan database (untuk "Mulai dari nol"): struktur dibuat ulang lewat migrasi, storage dikosongkan. */
export async function kosongkanData(p: { pg: PengaturanPg; storageDir: string }): Promise<void> {
  const klien = new pg.Client({ connectionString: p.pg.url });
  await klien.connect();
  try {
    await klien.query('drop schema if exists drizzle cascade');
    await klien.query('drop schema if exists public cascade');
    await klien.query('create schema public');
  } finally {
    await klien.end();
  }
  await jalankanMigrasi(p.pg.url);
  if (existsSync(p.storageDir)) {
    for (const e of await readdir(p.storageDir, { withFileTypes: true })) {
      if (!BUKAN_DATA.has(e.name)) {
        await rm(path.join(p.storageDir, e.name), { recursive: true, force: true });
      }
    }
  }
}

// --- Berkas pindah perangkat (.bonsai) ---

const TANDA = Buffer.from('BONSAIURIP-DATA1\n', 'utf8');

async function daftarBerkas(akarEntri: string, sub = ''): Promise<string[]> {
  const hasil: string[] = [];
  for (const e of await readdir(path.join(akarEntri, sub), { withFileTypes: true })) {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) hasil.push(...(await daftarBerkas(akarEntri, rel)));
    else hasil.push(rel);
  }
  return hasil;
}

async function kemas(folder: string): Promise<Buffer> {
  const bagian: Buffer[] = [];
  for (const rel of await daftarBerkas(folder)) {
    const nama = Buffer.from(rel, 'utf8');
    const isi = await readFile(path.join(folder, rel));
    const kepala = Buffer.alloc(8);
    kepala.writeUInt32BE(nama.length, 0);
    kepala.writeUInt32BE(isi.length, 4);
    bagian.push(kepala, nama, isi);
  }
  return Buffer.concat(bagian);
}

async function bongkar(arsip: Buffer, ke: string): Promise<void> {
  let i = 0;
  const akar = path.resolve(ke);
  while (i < arsip.length) {
    const pjNama = arsip.readUInt32BE(i);
    const pjIsi = arsip.readUInt32BE(i + 4);
    i += 8;
    const rel = arsip.subarray(i, i + pjNama).toString('utf8');
    i += pjNama;
    const tujuan = path.resolve(akar, rel);
    // Nama berisi ../ atau jalur mutlak ditolak (berkas tidak boleh keluar dari folder data).
    if (!tujuan.startsWith(akar + path.sep))
      throw new AppError('VALIDASI', 'Isi berkas tidak sah.', 400);
    await mkdir(path.dirname(tujuan), { recursive: true });
    await writeFile(tujuan, arsip.subarray(i, i + pjIsi));
    i += pjIsi;
  }
}

function kunci(sandi: string, salt: Buffer): Buffer {
  return scryptSync(sandi, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export async function buatBerkasEkspor(folder: string, sandi: string): Promise<Buffer> {
  const m = await bacaManifest(folder);
  if (!m) throw new AppError('TIDAK_DITEMUKAN', 'Data tidak ditemukan.', 404);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kepala = Buffer.from(
    JSON.stringify({
      versi: 1,
      namaToko: m.namaToko,
      dibuatPada: m.dibuatPada,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
    }),
    'utf8',
  );
  const pjKepala = Buffer.alloc(4);
  pjKepala.writeUInt32BE(kepala.length, 0);
  const sandiAes = createCipheriv('aes-256-gcm', kunci(sandi, salt), iv);
  const isi = Buffer.concat([sandiAes.update(await kemas(folder)), sandiAes.final()]);
  return Buffer.concat([TANDA, pjKepala, kepala, isi, sandiAes.getAuthTag()]);
}

/** Membuka berkas .bonsai dan menyimpannya sebagai data IMPOR di Pustaka. */
export async function imporBerkas(
  akar: string,
  berkas: Uint8Array,
  sandi: string,
): Promise<ManifestData> {
  const b = Buffer.from(berkas);
  if (b.length < TANDA.length + 4 + 16 || !b.subarray(0, TANDA.length).equals(TANDA)) {
    throw new AppError('VALIDASI', 'Ini bukan berkas data BonsaiUrip (.bonsai).', 400);
  }
  const pjKepala = b.readUInt32BE(TANDA.length);
  const awalIsi = TANDA.length + 4 + pjKepala;
  let kepala: { salt: string; iv: string };
  try {
    kepala = JSON.parse(b.subarray(TANDA.length + 4, awalIsi).toString('utf8')) as typeof kepala;
  } catch {
    throw new AppError('VALIDASI', 'Berkas data rusak.', 400);
  }
  let arsip: Buffer;
  try {
    const buka = createDecipheriv(
      'aes-256-gcm',
      kunci(sandi, Buffer.from(kepala.salt, 'base64')),
      Buffer.from(kepala.iv, 'base64'),
    );
    buka.setAuthTag(b.subarray(b.length - 16));
    arsip = Buffer.concat([buka.update(b.subarray(awalIsi, b.length - 16)), buka.final()]);
  } catch {
    throw new AppError('VALIDASI', 'Sandi berkas salah, atau berkas rusak.', 400);
  }
  const id = idBaru();
  const folder = folderEntri(akar, id);
  await mkdir(folder, { recursive: true });
  try {
    await bongkar(arsip, folder);
    const asli = await bacaManifest(folder);
    if (!asli || !existsSync(path.join(folder, 'db.dump'))) {
      throw new AppError('VALIDASI', 'Berkas data tidak lengkap.', 400);
    }
    const m: ManifestData = {
      ...asli,
      id,
      jenis: 'IMPOR',
      label: `Impor: ${asli.label}`,
      dibuatPada: new Date().toISOString(),
      ukuranByte: await ukuranFolder(folder),
    };
    await writeFile(path.join(folder, 'manifest.json'), JSON.stringify(m, null, 2));
    return m;
  } catch (err) {
    await rm(folder, { recursive: true, force: true });
    throw err;
  }
}

export async function ukuranPustaka(akar: string): Promise<number> {
  return ukuranFolder(akar);
}
