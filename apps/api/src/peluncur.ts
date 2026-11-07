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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { connect, createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { jalankanMigrasi } from './db/migrator';
import {
  buatTantangan,
  idPemasanganBaru,
  PESAN_PERIKSA,
  periksaJawaban,
} from './lib/pemulihan-pengembang';
import { kosongkanData, ringkasDatabase, simpanKePustaka } from './modules/sistem/data/pustaka';

type Konfigurasi = {
  portDb: number;
  portAplikasi: number;
  sandiDb: string;
  /** Data awal pertama kali sudah diisi (password awal owner sudah dibuat). */
  sudahAwal: boolean;
  /** K-232: pengenal pemasangan ini (dipakai kode tantangan pemulihan Owner). */
  idPemasangan?: string;
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
/** K-204: langkah yang sedang dikerjakan, dibaca layar pembuka BonsaiUrip.exe. */
const BERKAS_STATUS = path.join(DATA, 'status-peluncur.txt');
/** K-211: hasil Pulihkan akses Owner, dibaca lalu dihapus BonsaiUrip.exe. */
const BERKAS_PULIH = path.join(DATA, 'pulihkan-owner.txt');
/** K-232: kode tantangan pemulihan Owner yang sedang berlaku (sekali pakai). */
const BERKAS_TANTANGAN = path.join(DATA, 'pulihkan-tantangan.json');
/** K-213: Pustaka data (salinan data lain) dan tanda "Mulai dari nol" yang ditulis Setup. */
const PUSTAKA = path.join(DATA, 'pustaka');
const BERKAS_NOL = path.join(DATA, 'mulai-dari-nol.flag');
const STORAGE = path.join(DATA, 'storage');
/** K-216: ada selama aplikasi menyala; masih ada saat menyala lagi = sebelumnya mati mendadak. */
const BERKAS_JALAN = path.join(DATA, 'sedang-berjalan.flag');
/** K-216: catatan mati mendadak, dibaca server (layar pemulihan) dan dihapus setelah diperiksa pengguna. */
const BERKAS_MATI = path.join(DATA, 'mati-mendadak.json');
/** K-215: kode keluar `--berhenti` bila shift masih terbuka. */
const KODE_SHIFT_TERBUKA = 3;
/** K-198/K-204: program cadangan restic bawaan paket (alat\restic.exe). */
const RESTIC = path.join(AKAR, 'alat', 'restic.exe');
const NAMA_DB = 'bonsaiurip';
const USER_DB = 'bonsai';

function catat(pesan: string): void {
  mkdirSync(LOG, { recursive: true });
  const baris = `${new Date().toISOString()} ${pesan}\n`;
  writeFileSync(path.join(LOG, 'peluncur.log'), baris, { flag: 'a' });
}

/** K-204: tulis langkah untuk layar pembuka (gagal menulis tidak menghentikan peluncur). */
function status(teks: string): void {
  try {
    writeFileSync(BERKAS_STATUS, teks);
  } catch {
    // Layar pembuka hanya tampilan.
  }
}

/** Password mudah dibaca (tanpa huruf/angka yang mirip: 0/O, 1/l/I). */
function sandiAcak(n: number): string {
  const huruf = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => huruf[randomInt(huruf.length)]).join('');
}

function bisaDipasang(port: number, alamat: string): Promise<boolean> {
  return new Promise((selesai) => {
    const s = createServer();
    s.once('error', () => selesai(false));
    s.once('listening', () => s.close(() => selesai(true)));
    s.listen(port, alamat);
  });
}

/** Ada program yang menerima sambungan di 127.0.0.1:port. */
function adaYangMenjawab(port: number): Promise<boolean> {
  return new Promise((selesai) => {
    const s = connect({ port, host: '127.0.0.1' });
    const akhiri = (hasil: boolean) => {
      s.destroy();
      selesai(hasil);
    };
    s.setTimeout(1500, () => akhiri(false));
    s.once('connect', () => akhiri(true));
    s.once('error', () => akhiri(false));
  });
}

/**
 * Port benar-benar kosong. Di Windows, port yang dipakai program lain di 0.0.0.0 masih bisa "dipasang" di
 * 127.0.0.1, jadi diperiksa tiga cara: pasang di 127.0.0.1, pasang di 0.0.0.0, dan tidak ada yang menjawab.
 */
async function portBebas(port: number): Promise<boolean> {
  if (await adaYangMenjawab(port)) return false;
  return (await bisaDipasang(port, '127.0.0.1')) && (await bisaDipasang(port, '0.0.0.0'));
}

/** Proses dengan PID ini masih hidup. */
function prosesHidup(pid: number): boolean {
  if (!(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** PID server BonsaiUrip yang dinyalakan peluncur ini sebelumnya (0 bila tidak ada). */
function pidServerKita(): number {
  if (!existsSync(BERKAS_PID)) return 0;
  const pid = Number(readFileSync(BERKAS_PID, 'utf8'));
  return Number.isFinite(pid) ? pid : 0;
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sambungan ke database dengan percobaan ulang: sesaat setelah dinyalakan (terutama setelah mati mendadak,
 * saat database memulihkan diri) PostgreSQL menjawab "the database system is starting up".
 */
async function sambungDb(url: string): Promise<pg.Client> {
  let galat: unknown;
  for (let i = 0; i < 60; i++) {
    const klien = new pg.Client({ connectionString: url });
    try {
      await klien.connect();
      return klien;
    } catch (err) {
      galat = err;
      await klien.end().catch(() => undefined);
      const pesan = err instanceof Error ? err.message : String(err);
      if (!/starting up|shutting down|ECONNREFUSED|recovery/i.test(pesan)) throw err;
      await tunggu(1000);
    }
  }
  throw galat instanceof Error ? galat : new Error(String(galat));
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
    // Port database dipakai program lain (mis. PostgreSQL lain): pakai port kosong berikutnya.
    if (!(await portBebas(k.portDb))) {
      const lama = k.portDb;
      k.portDb = await cariPort(k.portDb + 1);
      simpanKonfig(k);
      catat(`Port database ${lama} dipakai program lain; pindah ke port ${k.portDb}.`);
    }
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
  const klien = await sambungDb(urlDb(k, 'postgres'));
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
    STORAGE_DIR: STORAGE,
    PUSTAKA_DIR: PUSTAKA,
    MATI_MENDADAK_FILE: BERKAS_MATI,
    AKSES_TAILSCALE: '1',
    LOG_FILE: path.join(LOG, 'server.log'),
    LOG_LEVEL: 'info',
    SESSION_IDLE_MENIT: '60',
    SESSION_ABSOLUT_JAM: '12',
    CADANGAN_PG_BIN: PGBIN,
    ...(existsSync(RESTIC) ? { CADANGAN_RESTIC: RESTIC } : {}),
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
  // Server yang menjawab hanya dipakai bila itu server yang dinyalakan peluncur ini (PID tercatat masih hidup);
  // server lain di port yang sama (mis. salinan BonsaiUrip lain) tidak boleh dianggap milik kita.
  const pidLama = pidServerKita();
  if (prosesHidup(pidLama) && (await serverHidup(k))) return;
  if (prosesHidup(pidLama)) {
    // Server lama masih hidup tetapi tidak menjawab (macet): matikan dulu.
    spawnSync('taskkill', ['/PID', String(pidLama), '/T', '/F'], { windowsHide: true });
    await tunggu(1000);
  }
  if (!(await portBebas(k.portAplikasi))) {
    const lama = k.portAplikasi;
    k.portAplikasi = await cariPort(k.portAplikasi + 1);
    simpanKonfig(k);
    catat(`Port ${lama} dipakai program lain; server pindah ke port ${k.portAplikasi}.`);
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
  for (let i = 0; i < 90; i++) {
    await tunggu(1000);
    if (anak.pid && !prosesHidup(anak.pid)) break;
    if (await serverHidup(k)) return;
  }
  const log = path.join(LOG, 'server.log');
  const ekor = existsSync(log) ? readFileSync(log, 'utf8').split('\n').slice(-15).join('\n') : '';
  throw new Error(`Server tidak mau menyala.\n${ekor}`);
}

function bukaPeramban(k: Konfigurasi): void {
  spawn('cmd.exe', ['/c', 'start', '', `http://localhost:${k.portAplikasi}/`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

/** K-215: shift yang belum ditutup (BUKA atau DIHITUNG); `null` bila database tidak bisa dibaca. */
async function shiftTerbuka(k: Konfigurasi | null): Promise<string | null> {
  if (!k || pgJalan('pg_ctl', ['status', '-D', PGDATA]).kode !== 0) return null;
  const klien = new pg.Client({ connectionString: urlDb(k) });
  try {
    await klien.connect();
    const r = await klien.query<{ nomor: string }>(
      `select nomor from shift_kasir where status <> 'TUTUP' order by id desc limit 1`,
    );
    return r.rows[0]?.nomor ?? null;
  } catch {
    return null;
  } finally {
    await klien.end().catch(() => undefined);
  }
}

/**
 * K-215: aplikasi tidak boleh dimatikan selama shift terbuka (uang tunai belum dicocokkan). `--paksa` hanya untuk
 * keadaan darurat (dipakai Setup bila pengguna sudah memilih memaksa).
 */
async function berhentiAman(paksa: boolean): Promise<void> {
  const nomor = paksa ? null : await shiftTerbuka(bacaKonfig());
  if (nomor) {
    writeFileSync(
      BERKAS_GALAT,
      `Shift ${nomor} masih terbuka. Tutup shift dulu (Shift & Clerical Check › Tutup shift) sampai selesai, baru BonsaiUrip bisa dimatikan.`,
    );
    catat(`Matikan ditolak: shift ${nomor} masih terbuka.`);
    process.exitCode = KODE_SHIFT_TERBUKA;
    return;
  }
  berhenti();
}

function berhenti(): void {
  rmSync(BERKAS_JALAN, { force: true });
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

/**
 * K-211: menu Start › Pulihkan akses Owner. Database dinyalakan (bila mati) dan diperbarui, lalu skrip
 * pulihkan-owner.js membuat password sementara + kode pemulihan baru. Hasil ditulis ke berkas sementara yang dibaca
 * dan langsung dihapus BonsaiUrip.exe (hanya akun Windows pemilik folder data yang bisa membacanya).
 */
/**
 * K-232 langkah 1: kode tantangan sekali pakai (berlaku 60 menit) ditulis ke `BERKAS_TANTANGAN` untuk ditampilkan
 * BonsaiUrip.exe; pemilik mengirimkannya ke pengembang.
 */
function tantanganPulih(): void {
  const k = bacaKonfig();
  if (!k)
    throw new Error('BonsaiUrip belum pernah dinyalakan di komputer ini. Buka BonsaiUrip dulu.');
  if (!k.idPemasangan) {
    k.idPemasangan = idPemasanganBaru();
    simpanKonfig(k);
  }
  const t = buatTantangan(k.idPemasangan, new Date());
  writeFileSync(BERKAS_TANTANGAN, JSON.stringify({ ...t, salah: 0 }));
  catat('Kode tantangan pemulihan Owner dibuat.');
}

/**
 * K-211 + K-232 langkah 2: akses Owner dipulihkan hanya dengan kode jawaban pengembang yang cocok dengan kode
 * tantangan yang sedang berlaku. 5 kali salah membatalkan tantangan.
 */
async function pulihkanOwner(jawaban: string | undefined): Promise<void> {
  const k = bacaKonfig();
  if (!k)
    throw new Error('BonsaiUrip belum pernah dinyalakan di komputer ini. Buka BonsaiUrip dulu.');
  if (!jawaban || !existsSync(BERKAS_TANTANGAN) || !k.idPemasangan) {
    throw new Error(
      'Pemulihan akses Owner membutuhkan kode jawaban dari pengembang. Mulai dari langkah kode tantangan.',
    );
  }
  const t = JSON.parse(readFileSync(BERKAS_TANTANGAN, 'utf8')) as { kode: string; salah: number };
  const hasilPeriksa = periksaJawaban(t.kode, jawaban, k.idPemasangan, new Date());
  if (hasilPeriksa !== 'COCOK') {
    t.salah += 1;
    if (t.salah >= 5 || hasilPeriksa === 'KEDALUWARSA') rmSync(BERKAS_TANTANGAN, { force: true });
    else writeFileSync(BERKAS_TANTANGAN, JSON.stringify(t));
    catat(`Pemulihan Owner ditolak: ${hasilPeriksa}.`);
    throw new Error(
      PESAN_PERIKSA[hasilPeriksa] +
        (t.salah >= 5 ? ' Sudah 5 kali salah: kode tantangan dibatalkan, mulai lagi.' : ''),
    );
  }
  rmSync(BERKAS_TANTANGAN, { force: true });
  await siapkanDatabase(k);
  await jalankanMigrasi(urlDb(k));
  const r = spawnSync(process.execPath, [path.join(DIST, 'pulihkan-owner.js')], {
    cwd: DATA,
    env: lingkungan(k),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  });
  const baris = (r.stdout || '').trim().split('\n').pop() ?? '';
  let hasil: {
    galat?: string;
    username?: string;
    passwordSementara?: string;
    kodePemulihan?: string;
  };
  try {
    hasil = JSON.parse(baris) as typeof hasil;
  } catch {
    throw new Error(`Pemulihan gagal: ${(r.stderr || r.stdout || '').slice(-1500)}`);
  }
  if (hasil.galat || r.status !== 0) throw new Error(hasil.galat ?? 'Pemulihan gagal.');
  writeFileSync(
    BERKAS_PULIH,
    [
      `Username Owner      : ${hasil.username}`,
      `Password sementara  : ${hasil.passwordSementara}`,
      `Kode pemulihan baru : ${hasil.kodePemulihan}`,
      '',
      'Masuk dengan username dan password sementara di atas; Anda akan diminta membuat password baru.',
      'Catat kode pemulihan baru di kertas (kode lama tidak berlaku lagi).',
    ].join('\r\n'),
  );
  catat(`Akses Owner dipulihkan (${hasil.username}).`);
}

/**
 * K-213: Setup "Mulai dari nol" meninggalkan tanda. Data yang ada disimpan ke Pustaka (jenis LAMA) lalu database
 * dikosongkan, sehingga setup awal tampil lagi; data lama bisa dipakai kembali dari Pengaturan › Data.
 */
async function mulaiDariNol(k: Konfigurasi): Promise<void> {
  if (!existsSync(BERKAS_NOL)) return;
  status('Menyimpan data lama ke Pustaka…');
  const pgK = { url: urlDb(k), pgBin: PGBIN };
  const isi = await ringkasDatabase(pgK.url);
  if (isi.pengguna.length > 0 || isi.jumlah.barang > 0 || isi.jumlah.penjualan > 0) {
    const m = await simpanKePustaka({
      pg: pgK,
      akar: PUSTAKA,
      storageDir: STORAGE,
      jenis: 'LAMA',
      label: `Data sebelum "Mulai dari nol" (${new Date().toLocaleDateString('id-ID')})`,
    });
    catat(`Mulai dari nol: data lama disimpan ke Pustaka (${m.id}).`);
  }
  await kosongkanData({ pg: pgK, storageDir: STORAGE });
  rmSync(BERKAS_NOL, { force: true });
  catat('Mulai dari nol: database dikosongkan.');
}

/**
 * K-213: folder `BonsaiUrip-lama-<tanggal>` dari Setup 1.16.0 (data lama dipindah utuh) dikonversi ke Pustaka:
 * database lama dinyalakan sebentar di port lain, disalin, dimatikan, lalu foldernya dihapus agar disk tidak penuh.
 */
async function konversiFolderLama(k: Konfigurasi): Promise<void> {
  const induk = path.dirname(DATA);
  const awalan = `${path.basename(DATA)}-lama-`;
  let daftar: string[];
  try {
    daftar = readdirSync(induk).filter((n) => n.startsWith(awalan));
  } catch {
    return;
  }
  for (const nama of daftar) {
    const folder = path.join(induk, nama);
    const pgdata = path.join(folder, 'pgdata');
    const konfig = path.join(folder, 'peluncur.json');
    if (!existsSync(path.join(pgdata, 'PG_VERSION')) || !existsSync(konfig)) continue;
    status('Memindahkan data lama ke Pustaka…');
    const lama = JSON.parse(readFileSync(konfig, 'utf8')) as Konfigurasi;
    const port = await cariPort(k.portDb + 20);
    const nyala = spawnSync(
      path.join(PGBIN, 'pg_ctl.exe'),
      ['start', '-D', pgdata, '-o', `-p ${port} -c listen_addresses=127.0.0.1`, '-w', '-t', '60'],
      { stdio: 'ignore', windowsHide: true, timeout: 90_000 },
    );
    if (nyala.status !== 0) {
      catat(`Konversi ${nama}: database lama tidak mau menyala; folder dibiarkan.`);
      continue;
    }
    let berhasil = false;
    try {
      const m = await simpanKePustaka({
        pg: { url: urlDb({ ...lama, portDb: port }), pgBin: PGBIN },
        akar: PUSTAKA,
        storageDir: path.join(folder, 'storage'),
        jenis: 'LAMA',
        label: `Data lama (${nama.slice(awalan.length)})`,
      });
      catat(`Konversi ${nama}: disimpan ke Pustaka (${m.id}).`);
      berhasil = true;
    } catch (err) {
      catat(`Konversi ${nama} gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      pgJalan('pg_ctl', ['stop', '-D', pgdata, '-m', 'fast', '-w']);
    }
    if (berhasil) rmSync(folder, { recursive: true, force: true });
  }
}

async function utama(): Promise<void> {
  mkdirSync(DATA, { recursive: true });
  rmSync(BERKAS_GALAT, { force: true });
  const args = process.argv.slice(2);
  if (args.includes('--berhenti')) {
    await berhentiAman(args.includes('--paksa'));
    return;
  }
  if (args.includes('--pulihkan-owner')) {
    if (args.includes('--tantangan')) tantanganPulih();
    else await pulihkanOwner(args.find((a) => a.startsWith('--jawaban='))?.slice(10));
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
  // K-216: tanda "sedang berjalan" masih ada = aplikasi sebelumnya mati mendadak (listrik/komputer mati).
  const matiMendadak =
    existsSync(BERKAS_JALAN) && !(prosesHidup(pidServerKita()) && (await serverHidup(k)));
  const logServer = path.join(LOG, 'server.log');
  const terakhirHidup = existsSync(logServer) ? statSync(logServer).mtime.toISOString() : null;
  writeFileSync(BERKAS_JALAN, new Date().toISOString());
  status('Menyalakan database…');
  await siapkanDatabase(k);
  status('Memperbarui data…');
  catat('Migrasi database.');
  await jalankanMigrasi(urlDb(k));
  await mulaiDariNol(k);
  // K-216: mati mendadak saat shift terbuka → layar pemulihan (ringkasan shift dan langkah pemeriksaan).
  if (matiMendadak) {
    const nomor = await shiftTerbuka(k);
    catat(
      `Terdeteksi: aplikasi sebelumnya mati mendadak${nomor ? ` saat shift ${nomor} terbuka` : ''}.`,
    );
    if (nomor && !existsSync(BERKAS_MATI)) {
      writeFileSync(
        BERKAS_MATI,
        JSON.stringify({ terdeteksi: new Date().toISOString(), terakhirHidup, shift: nomor }),
      );
    }
  }
  isiDataAwal(k);
  try {
    await konversiFolderLama(k);
  } catch (err) {
    catat(`Konversi data lama: ${err instanceof Error ? err.message : String(err)}`);
  }
  status('Menyalakan BonsaiUrip…');
  await nyalakanServer(k);
  status('Membuka peramban…');
  // Setelah mati mendadak, peramban dibuka walau dinyalakan otomatis: layar pemulihan perlu diperiksa.
  if (!args.includes('--latar') || existsSync(BERKAS_MATI)) bukaPeramban(k);
  catat(`Siap di http://localhost:${k.portAplikasi}/`);
  rmSync(BERKAS_STATUS, { force: true });
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
