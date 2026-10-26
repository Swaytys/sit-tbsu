/*
 * K-188 v2: peluncur aplikasi desktop BonsaiUrip (dipanggil BonsaiUrip.exe). Semua berjalan sebagai pengguna biasa
 * (tanpa hak Administrator, tanpa terminal):
 *   1. Folder data per pengguna: %LOCALAPPDATA%\BonsaiUrip (database, gambar, log, pengaturan peluncur).
 *   2. PostgreSQL bawaan paket (folder pgsql\) dibuat sekali (initdb, password acak) dan dinyalakan di port pribadi
 *      hanya untuk komputer ini (listen localhost). Tidak menyentuh PostgreSQL lain yang mungkin terpasang.
 *   3. Database aplikasi dibuat bila belum ada, migrasi dijalankan, data awal diisi (akun owner dengan password
 *      awal acak pada pemakaian pertama; ditampilkan BonsaiUrip.exe lalu wajib diganti saat masuk).
 *   4. Server aplikasi dinyalakan di latar (http://localhost:PORT; localhost dianggap aman oleh peramban sehingga
 *      cookie sesi dan cetak struk langsung tetap berfungsi), lalu peramban dibuka.
 * Argumen: (kosong) = nyalakan + buka peramban; --latar = nyalakan tanpa membuka peramban (saat Windows mulai);
 * --berhenti = matikan server dan database.
 * Galat ditulis ke <data>\galat-peluncur.txt agar BonsaiUrip.exe bisa menampilkannya.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { jalankanMigrasi } from './db/migrator';

type Konfigurasi = {
  portDb: number;
  portAplikasi: number;
  sandiDb: string;
  /** Data awal pertama kali sudah diisi (password awal owner sudah dibuat). */
  sudahAwal: boolean;
};

const DIST = path.dirname(fileURLToPath(import.meta.url));
/** Akar paket terpasang: <app>\apps\api\dist → <app>. */
const AKAR = path.resolve(DIST, '..', '..', '..');
const PGBIN = path.join(AKAR, 'pgsql', 'bin');
const DATA =
  process.env.BONSAIURIP_DATA ??
  path.join(process.env.LOCALAPPDATA ?? path.join(AKAR, 'data-lokal'), 'BonsaiUrip');
const PGDATA = path.join(DATA, 'pgdata');
const LOG = path.join(DATA, 'log');
const BERKAS_KONFIG = path.join(DATA, 'peluncur.json');
const BERKAS_GALAT = path.join(DATA, 'galat-peluncur.txt');
const BERKAS_PID = path.join(DATA, 'server.pid');
const NAMA_DB = 'bonsaiurip';
const USER_DB = 'bonsai';

function catat(pesan: string): void {
  mkdirSync(LOG, { recursive: true });
  const baris = `${new Date().toISOString()} ${pesan}\n`;
  writeFileSync(path.join(LOG, 'peluncur.log'), baris, { flag: 'a' });
}

/** Password mudah dibaca (tanpa huruf/angka yang mirip: 0/O, 1/l/I). */
function sandiAcak(n: number): string {
  const huruf = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => huruf[randomInt(huruf.length)]).join('');
}

function portBebas(port: number): Promise<boolean> {
  return new Promise((selesai) => {
    const s = createServer();
    s.once('error', () => selesai(false));
    s.once('listening', () => s.close(() => selesai(true)));
    s.listen(port, '127.0.0.1');
  });
}

async function cariPort(mulai: number): Promise<number> {
  for (let p = mulai; p < mulai + 50; p++) if (await portBebas(p)) return p;
  throw new Error(`Tidak ada port kosong di sekitar ${mulai}.`);
}

function bacaKonfig(): Konfigurasi | null {
  if (!existsSync(BERKAS_KONFIG)) return null;
  return JSON.parse(readFileSync(BERKAS_KONFIG, 'utf8')) as Konfigurasi;
}

function simpanKonfig(k: Konfigurasi): void {
  writeFileSync(BERKAS_KONFIG, JSON.stringify(k, null, 2));
}

/** Menjalankan program PostgreSQL bawaan; galat membawa keluaran programnya. */
function pgJalan(program: string, args: string[]): { kode: number; keluaran: string } {
  const exe = path.join(PGBIN, `${program}.exe`);
  if (!existsSync(exe)) throw new Error(`Berkas ${program}.exe tidak ada di paket (${PGBIN}).`);
  const r = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  return { kode: r.status ?? -1, keluaran: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function urlDb(k: Konfigurasi, db = NAMA_DB): string {
  return `postgres://${USER_DB}:${encodeURIComponent(k.sandiDb)}@127.0.0.1:${k.portDb}/${db}`;
}

/** 1–2: database bawaan dibuat sekali lalu dinyalakan. */
async function siapkanDatabase(k: Konfigurasi): Promise<void> {
  if (!existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    catat('Membuat database baru (initdb).');
    rmSync(PGDATA, { recursive: true, force: true });
    const berkasSandi = path.join(DATA, `.pw-${randomBytes(4).toString('hex')}`);
    writeFileSync(berkasSandi, k.sandiDb);
    try {
      const r = pgJalan('initdb', [
        '-D',
        PGDATA,
        '-U',
        USER_DB,
        '-A',
        'scram-sha-256',
        `--pwfile=${berkasSandi}`,
        '-E',
        'UTF8',
        '--no-locale',
      ]);
      if (r.kode !== 0) throw new Error(`initdb gagal:\n${r.keluaran}`);
    } finally {
      rmSync(berkasSandi, { force: true });
    }
  }
  if (pgJalan('pg_ctl', ['status', '-D', PGDATA]).kode !== 0) {
    catat(`Menyalakan database di port ${k.portDb}.`);
    const logPg = path.join(LOG, 'postgres.log');
    // Tanpa pipa keluaran: proses postgres mewarisi pegangan keluaran pg_ctl dan tidak pernah menutupnya,
    // sehingga menunggu keluaran membuat peluncur tertahan sampai batas waktu.
    const r = spawnSync(
      path.join(PGBIN, 'pg_ctl.exe'),
      [
        'start',
        '-D',
        PGDATA,
        '-l',
        logPg,
        '-o',
        `-p ${k.portDb} -c listen_addresses=127.0.0.1`,
        '-w',
        '-t',
        '60',
      ],
      { stdio: 'ignore', windowsHide: true, timeout: 90_000 },
    );
    if (r.status !== 0) {
      const ekor = existsSync(logPg)
        ? readFileSync(logPg, 'utf8').split('\n').slice(-15).join('\n')
        : '';
      throw new Error(`Database tidak mau menyala.\n${ekor}`);
    }
  }
  const klien = new pg.Client({ connectionString: urlDb(k, 'postgres') });
  await klien.connect();
  try {
    const ada = await klien.query('select 1 from pg_database where datname = $1', [NAMA_DB]);
    if (ada.rowCount === 0) {
      catat('Membuat database aplikasi.');
      await klien.query(`create database ${NAMA_DB} encoding 'UTF8' template template0`);
    }
  } finally {
    await klien.end();
  }
}

/** Lingkungan server dan skrip data awal (pengganti berkas .env pada pemasangan desktop). */
function lingkungan(k: Konfigurasi): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(k.portAplikasi),
    DATABASE_URL: urlDb(k),
    STORAGE_DIR: path.join(DATA, 'storage'),
    LOG_FILE: path.join(LOG, 'server.log'),
    LOG_LEVEL: 'info',
    SESSION_IDLE_MENIT: '60',
    SESSION_ABSOLUT_JAM: '12',
    CADANGAN_PG_BIN: PGBIN,
  };
}

/**
 * 3: data awal (konfigurasi, satuan, tier harga). Akun Owner TIDAK dibuat di sini (K-191): pemakaian pertama membuka
 * halaman "Buat akun pertama" di peramban, jadi tidak ada password bawaan yang ditampilkan atau disimpan di berkas.
 */
function isiDataAwal(k: Konfigurasi): void {
  const r = spawnSync(process.execPath, [path.join(DIST, 'db', 'seed.js')], {
    cwd: DATA,
    env: { ...lingkungan(k), SEED_OWNER_PASSWORD: '' },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  });
  if (r.status !== 0)
    throw new Error(`Data awal gagal:\n${(r.stderr || r.stdout || '').slice(-2000)}`);
  if (!k.sudahAwal) {
    k.sudahAwal = true;
    simpanKonfig(k);
  }
}

async function serverHidup(k: Konfigurasi): Promise<boolean> {
  try {
    const r = await fetch(`http://localhost:${k.portAplikasi}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** 4: server di latar; menunggu sampai menjawab. */
async function nyalakanServer(k: Konfigurasi): Promise<void> {
  if (await serverHidup(k)) return;
  if (!(await portBebas(k.portAplikasi))) {
    k.portAplikasi = await cariPort(k.portAplikasi + 1);
    simpanKonfig(k);
  }
  catat(`Menyalakan server di port ${k.portAplikasi}.`);
  const anak = spawn(process.execPath, [path.join(DIST, 'index.js')], {
    cwd: DATA,
    env: lingkungan(k),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  anak.unref();
  writeFileSync(BERKAS_PID, String(anak.pid ?? ''));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await serverHidup(k)) return;
  }
  const log = path.join(LOG, 'server.log');
  const ekor = existsSync(log) ? readFileSync(log, 'utf8').split('\n').slice(-15).join('\n') : '';
  throw new Error(`Server tidak menjawab dalam 60 detik.\n${ekor}`);
}

function bukaPeramban(k: Konfigurasi): void {
  spawn('cmd.exe', ['/c', 'start', '', `http://localhost:${k.portAplikasi}/`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

function berhenti(): void {
  if (existsSync(BERKAS_PID)) {
    const pid = Number(readFileSync(BERKAS_PID, 'utf8'));
    if (pid > 0) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    rmSync(BERKAS_PID, { force: true });
  }
  if (existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    pgJalan('pg_ctl', ['stop', '-D', PGDATA, '-m', 'fast', '-w']);
  }
  catat('Server dan database dimatikan.');
}

async function utama(): Promise<void> {
  mkdirSync(DATA, { recursive: true });
  rmSync(BERKAS_GALAT, { force: true });
  const args = process.argv.slice(2);
  if (args.includes('--berhenti')) {
    berhenti();
    return;
  }
  let k = bacaKonfig();
  if (!k) {
    k = {
      portDb: await cariPort(54329),
      portAplikasi: await cariPort(7878),
      sandiDb: sandiAcak(24),
      sudahAwal: false,
    };
    simpanKonfig(k);
  }
  await siapkanDatabase(k);
  catat('Migrasi database.');
  await jalankanMigrasi(urlDb(k));
  isiDataAwal(k);
  await nyalakanServer(k);
  if (!args.includes('--latar')) bukaPeramban(k);
  catat(`Siap di http://localhost:${k.portAplikasi}/`);
}

utama().catch((err: unknown) => {
  const pesan = err instanceof Error ? err.message : String(err);
  try {
    mkdirSync(DATA, { recursive: true });
    writeFileSync(BERKAS_GALAT, pesan);
    catat(`GAGAL: ${pesan}`);
  } catch {
    // Folder data tidak bisa ditulis: pesan tetap keluar lewat kode keluar.
  }
  process.exitCode = 1;
});
