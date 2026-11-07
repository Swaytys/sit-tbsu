/* eslint-disable no-console -- skrip baris perintah: keluarannya dibaca di terminal */
/*
 * K-119: tes layar (Playwright) memakai PostgreSQL sendiri yang sekali pakai, bukan database pengembangan.
 * Klaster PostgreSQL dibuat di .uji-e2e/ (port 54399, hanya 127.0.0.1), database tbsu_e2e dimigrasi dan diisi data
 * awal (akun demo), lalu server API (3100) dan web (5174) dinyalakan khusus untuk tes. Selesai tes semuanya
 * dimatikan. Database pengembangan dan data percobaan pemilik tidak tersentuh.
 *
 *   node scripts/uji/e2e-terpisah.mjs jalan [argumen playwright…]   siapkan → tes → matikan
 *   node scripts/uji/e2e-terpisah.mjs mulai                         siapkan dan biarkan menyala
 *   node scripts/uji/e2e-terpisah.mjs berhenti                      matikan
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(AKAR, '.uji-e2e');
const PGDATA = path.join(DIR, 'pgdata');
const BERKAS_PID = path.join(DIR, 'server.json');
const PORT_DB = 54399;
const PORT_API = 3100;
const PORT_WEB = 5174;
const URL_DB = `postgres://sit@127.0.0.1:${PORT_DB}/tbsu_e2e`;
const URL_WEB = `http://localhost:${PORT_WEB}`;

function cariPgBin() {
  const calon = [
    process.env.PG_BIN,
    path.join(AKAR, 'installer', 'paket', 'pgsql', 'bin'),
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'D:\\PostgreSQL\\17\\bin',
  ].filter(Boolean);
  for (const c of calon)
    if (existsSync(path.join(c, 'pg_ctl.exe')) || existsSync(path.join(c, 'pg_ctl'))) return c;
  throw new Error('PostgreSQL 17 tidak ditemukan. Isi PG_BIN dengan folder bin PostgreSQL.');
}
const PGBIN = cariPgBin();
const pgProgram = (nama) => path.join(PGBIN, process.platform === 'win32' ? `${nama}.exe` : nama);

function jalankan(perintah, args, env = {}) {
  const r = spawnSync(perintah, args, {
    cwd: AKAR,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`${perintah} ${args.join(' ')} gagal (kode ${r.status}).`);
}

const envServer = {
  DATABASE_URL: URL_DB,
  NODE_ENV: 'development',
  PORT: String(PORT_API),
  SALURAN_TIRUAN: '1',
  LOGIN_MAKS_PER_MENIT: '600',
  STORAGE_DIR: path.join(DIR, 'storage'),
  PUSTAKA_DIR: path.join(DIR, 'pustaka'),
  LOG_LEVEL: 'warn',
};

function berhenti() {
  if (existsSync(BERKAS_PID)) {
    const { pid } = JSON.parse(readFileSync(BERKAS_PID, 'utf8'));
    for (const p of pid) {
      if (process.platform === 'win32')
        spawnSync('taskkill', ['/PID', String(p), '/T', '/F'], { stdio: 'ignore' });
      else {
        try {
          process.kill(-p);
        } catch {
          // proses sudah berhenti
        }
      }
    }
    rmSync(BERKAS_PID, { force: true });
  }
  if (existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    spawnSync(pgProgram('pg_ctl'), ['stop', '-D', PGDATA, '-m', 'fast', '-w'], { stdio: 'ignore' });
  }
}

async function tungguSiap(batasDetik) {
  for (let i = 0; i < batasDetik; i++) {
    try {
      const r = await fetch(`${URL_WEB}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return;
    } catch {
      // belum menyala
    }
    await new Promise((s) => setTimeout(s, 1000));
  }
  throw new Error(`Server uji tidak menyala dalam ${batasDetik} detik.`);
}

async function mulai() {
  berhenti();
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  console.log('[e2e] Membuat PostgreSQL uji sekali pakai…');
  jalankan(pgProgram('initdb'), [
    '-D',
    PGDATA,
    '-U',
    'sit',
    '-A',
    'trust',
    '-E',
    'UTF8',
    '--no-locale',
  ]);
  const nyala = spawnSync(
    pgProgram('pg_ctl'),
    [
      'start',
      '-D',
      PGDATA,
      '-l',
      path.join(DIR, 'postgres.log'),
      '-o',
      `-p ${PORT_DB} -c listen_addresses=127.0.0.1`,
      '-w',
    ],
    { stdio: 'ignore' },
  );
  if (nyala.status !== 0)
    throw new Error(`PostgreSQL uji gagal menyala (lihat ${path.join(DIR, 'postgres.log')}).`);
  jalankan(pgProgram('createdb'), [
    '-h',
    '127.0.0.1',
    '-p',
    String(PORT_DB),
    '-U',
    'sit',
    'tbsu_e2e',
  ]);
  console.log('[e2e] Migrasi dan data awal…');
  jalankan('pnpm', ['--filter', '@sit/api', 'db:migrate'], envServer);
  jalankan('pnpm', ['--filter', '@sit/api', 'db:seed'], envServer);
  console.log('[e2e] Menyalakan server uji (API 3100, web 5174)…');
  const opsi = (env) => ({
    cwd: AKAR,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  });
  const api = spawn('pnpm', ['--filter', '@sit/api', 'dev'], opsi(envServer));
  const web = spawn(
    'pnpm',
    ['--filter', '@sit/web', 'dev'],
    opsi({ PORT_WEB: String(PORT_WEB), PORT_API: String(PORT_API) }),
  );
  writeFileSync(BERKAS_PID, JSON.stringify({ pid: [api.pid, web.pid] }));
  api.unref();
  web.unref();
  await tungguSiap(120);
  console.log(`[e2e] Siap: ${URL_WEB} (database ${URL_DB})`);
}

const [perintah, ...sisa] = process.argv.slice(2);
try {
  if (perintah === 'mulai') await mulai();
  else if (perintah === 'berhenti') berhenti();
  else if (perintah === 'jalan') {
    let kode = 1;
    try {
      await mulai();
      const r = spawnSync('pnpm', ['--filter', '@sit/web', 'exec', 'playwright', 'test', ...sisa], {
        cwd: AKAR,
        env: { ...process.env, E2E_URL: URL_WEB },
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      kode = r.status ?? 1;
    } finally {
      berhenti();
    }
    process.exitCode = kode;
  } else {
    console.error(
      'Pemakaian: node scripts/uji/e2e-terpisah.mjs jalan [argumen playwright] | mulai | berhenti',
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[e2e] ${err instanceof Error ? err.message : String(err)}`);
  berhenti();
  process.exitCode = 1;
}
