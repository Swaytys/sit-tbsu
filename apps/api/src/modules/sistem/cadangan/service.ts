import { mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  BarisCadangan,
  JenisCadangan,
  PemicuCadangan,
  StatusCadanganData,
  StatusTujuanCadangan,
} from '@sit/shared';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import pg from 'pg';
import { db } from '../../../db/client';
import { cadangan, pengguna } from '../../../db/schema';
import { env } from '../../../env';
import { AppError } from '../../../lib/errors';
import type { PenggunaAktif } from '../../../lib/konteks';
import { logger } from '../../../lib/logger';
import { jamLokal, sekarang, tanggalOperasional, tambahJam } from '../../../lib/waktu';
import { catatLog } from '../log-aktivitas';
import { GalatProses, jalankan, ringkas, wajib } from './alat';
import { akarDisk, bacaAturan, programAda, simpanAturan } from './aturan';

/*
 * Cadangan data (docs/07 Fase 8, K-084).
 *  - Isi: dump database (pg_dump format custom, tanpa kompresi agar restic bisa mendeduplikasi) + folder
 *    unggahan (STORAGE_DIR).
 *  - Disimpan sebagai snapshot restic terenkripsi di repositori lokal (disk kedua) dan cloud (rclone).
 *  - Retensi 7 harian, 4 mingguan, 12 bulanan, 5 tahunan; sisanya dibuang otomatis (forget --prune).
 *  - Uji pulih: dump dari snapshot terbaru dipulihkan ke database sementara `<nama>_ujipulih`, dihitung
 *    isinya, lalu database sementara dihapus. Bulanan otomatis, atau tombol di Pengaturan › Cadangan.
 */

export type KonfigCadangan = {
  repoLokal: string | null;
  repoCloud: string | null;
  sandi: string | null;
  restic: string;
  rclone: string | null;
  pgBin: string | null;
  jam: number;
  folderKerja: string;
  databaseUrl: string;
  storageDir: string;
};

export function konfigCadangan(): KonfigCadangan {
  // K-198: pengaturan dari layar menang atas .env.
  const layar = bacaAturan();
  return {
    repoLokal: layar?.repoLokal ?? env.CADANGAN_REPO_LOKAL ?? null,
    repoCloud: layar ? layar.repoCloud : (env.CADANGAN_REPO_CLOUD ?? null),
    sandi: layar?.sandi ?? env.CADANGAN_SANDI ?? null,
    restic: env.CADANGAN_RESTIC,
    rclone: env.CADANGAN_RCLONE ?? null,
    pgBin: env.CADANGAN_PG_BIN ?? null,
    jam: env.CADANGAN_JAM,
    folderKerja: path.join(os.tmpdir(), 'bonsaiurip-cadangan'),
    databaseUrl: env.DATABASE_URL,
    storageDir: env.STORAGE_DIR,
  };
}

export const RETENSI = { harian: 7, mingguan: 4, bulanan: 12, tahunan: 5 } as const;
const TAG = 'bonsaiurip';
/** Proses BERJALAN lebih lama dari ini dianggap terhenti (server mati di tengah cadangan). */
const BATAS_BERJALAN_JAM = 3;
const BATAS_TERLEWAT_JAM = 26;
const SATU_JAM_MS = 60 * 60 * 1000;

let sedangBerjalan = false;

// --- Program luar ---

export function programPg(k: KonfigCadangan, nama: 'pg_dump' | 'pg_restore'): string {
  return k.pgBin ? path.join(k.pgBin, nama) : nama;
}

export function koneksiPg(url: string) {
  const u = new URL(url);
  return {
    argumen: ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username)],
    env: { PGPASSWORD: decodeURIComponent(u.password) },
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
}

function opsiRestic(k: KonfigCadangan, repo: string) {
  return {
    argumen: ['-r', repo, ...(k.rclone ? ['-o', `rclone.program=${k.rclone}`] : [])],
    env: { RESTIC_PASSWORD: k.sandi ?? '' },
  };
}

/** Membuat repositori restic bila belum ada (pertama kali dipakai). */
async function pastikanRepo(k: KonfigCadangan, repo: string): Promise<void> {
  const o = opsiRestic(k, repo);
  const cek = await jalankan(k.restic, [...o.argumen, 'cat', 'config'], { env: o.env });
  if (cek.kode === 0) return;
  if (!/does not exist|unable to open config|Is there a repository/i.test(cek.galat)) {
    throw new GalatProses(k.restic, cek);
  }
  await wajib(k.restic, [...o.argumen, 'init'], { env: o.env, batasMs: 10 * 60 * 1000 });
}

/** Snapshot baru + pemangkasan sesuai retensi. Mengembalikan id snapshot pendek. */
async function simpanKeRepo(
  k: KonfigCadangan,
  repo: string,
  berkas: string[],
  batasMs: number,
): Promise<string> {
  await pastikanRepo(k, repo);
  const o = opsiRestic(k, repo);
  const h = await wajib(
    k.restic,
    [...o.argumen, 'backup', '--json', '--tag', TAG, '--host', TAG, ...berkas],
    { env: o.env, batasMs },
  );
  const ringkasan = h.keluaran
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.startsWith('{'))
    .map((b) => JSON.parse(b) as { message_type?: string; snapshot_id?: string })
    .find((m) => m.message_type === 'summary');
  if (!ringkasan?.snapshot_id) throw new Error('restic tidak melaporkan snapshot baru.');
  await wajib(
    k.restic,
    [
      ...o.argumen,
      'forget',
      '--tag',
      TAG,
      '--keep-daily',
      String(RETENSI.harian),
      '--keep-weekly',
      String(RETENSI.mingguan),
      '--keep-monthly',
      String(RETENSI.bulanan),
      '--keep-yearly',
      String(RETENSI.tahunan),
      '--prune',
    ],
    { env: o.env, batasMs },
  );
  return ringkasan.snapshot_id.slice(0, 8);
}

// --- Riwayat ---

const kolomRiwayat = {
  id: cadangan.id,
  jenis: cadangan.jenis,
  status: cadangan.status,
  pemicu: cadangan.pemicu,
  namaPengguna: pengguna.namaPengguna,
  waktuMulai: cadangan.waktuMulai,
  waktuSelesai: cadangan.waktuSelesai,
  ukuranDump: cadangan.ukuranDump,
  snapshotLokal: cadangan.snapshotLokal,
  statusLokal: cadangan.statusLokal,
  snapshotCloud: cadangan.snapshotCloud,
  statusCloud: cadangan.statusCloud,
  pesan: cadangan.pesan,
};

type BarisDb = {
  waktuMulai: Date;
  waktuSelesai: Date | null;
} & Omit<BarisCadangan, 'waktuMulai' | 'waktuSelesai'>;

function keBaris(b: BarisDb): BarisCadangan {
  return {
    ...b,
    waktuMulai: b.waktuMulai.toISOString(),
    waktuSelesai: b.waktuSelesai?.toISOString() ?? null,
  };
}

async function riwayat(batas: number, jenis?: JenisCadangan, status?: 'BERHASIL' | 'GAGAL') {
  const r = await db
    .select(kolomRiwayat)
    .from(cadangan)
    .leftJoin(pengguna, eq(pengguna.id, cadangan.idPengguna))
    .where(
      and(
        jenis ? eq(cadangan.jenis, jenis) : undefined,
        status ? eq(cadangan.status, status) : undefined,
      ),
    )
    .orderBy(desc(cadangan.waktuMulai), desc(cadangan.id))
    .limit(batas);
  return r.map(keBaris);
}

/** Proses yang tertinggal BERJALAN (server mati di tengah jalan) ditandai GAGAL. */
async function rapikanYangTerhenti(): Promise<void> {
  await db
    .update(cadangan)
    .set({
      status: 'GAGAL',
      waktuSelesai: sekarang(),
      pesan: 'Terhenti: server mati atau dinyalakan ulang saat proses berjalan.',
    })
    .where(
      and(
        eq(cadangan.status, 'BERJALAN'),
        lt(cadangan.waktuMulai, tambahJam(sekarang(), -BATAS_BERJALAN_JAM)),
      ),
    );
}

async function mulai(
  jenis: JenisCadangan,
  pemicu: PemicuCadangan,
  pelaku: PenggunaAktif | null,
  k: KonfigCadangan,
): Promise<number> {
  if (!k.repoLokal || !k.sandi) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      'Cadangan belum diatur: Owner mengisi folder dan sandinya di Pengaturan › Cadangan.',
      409,
    );
  }
  await rapikanYangTerhenti();
  const [jalan] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(cadangan)
    .where(eq(cadangan.status, 'BERJALAN'));
  if (sedangBerjalan || (jalan?.n ?? 0) > 0) {
    throw new AppError(
      'KONFLIK',
      'Cadangan atau uji pulih sedang berjalan. Tunggu sampai selesai.',
      409,
    );
  }
  sedangBerjalan = true;
  try {
    const [b] = await db
      .insert(cadangan)
      .values({ jenis, pemicu, idPengguna: pelaku?.id ?? null })
      .returning({ id: cadangan.id });
    return b!.id;
  } catch (err) {
    sedangBerjalan = false;
    throw err;
  }
}

// --- Cadangan ---

async function prosesCadangan(id: number, pelaku: PenggunaAktif | null, k: KonfigCadangan) {
  const pg_ = koneksiPg(k.databaseUrl);
  const dump = path.join(k.folderKerja, `${pg_.database}.dump`);
  let ukuranDump: number | null = null;
  let statusLokal: StatusTujuanCadangan = 'GAGAL';
  let statusCloud: StatusTujuanCadangan = k.repoCloud ? 'GAGAL' : 'NONAKTIF';
  let snapshotLokal: string | null = null;
  let snapshotCloud: string | null = null;
  const pesan: string[] = [];
  try {
    await mkdir(k.folderKerja, { recursive: true });
    await wajib(
      programPg(k, 'pg_dump'),
      [...pg_.argumen, '--format=custom', '--compress=0', '--file', dump, pg_.database],
      { env: pg_.env, batasMs: SATU_JAM_MS },
    );
    ukuranDump = (await stat(dump)).size;
    const berkas = [dump, ...(existsSync(k.storageDir) ? [k.storageDir] : [])];
    try {
      snapshotLokal = await simpanKeRepo(k, k.repoLokal!, berkas, SATU_JAM_MS);
      statusLokal = 'BERHASIL';
    } catch (err) {
      pesan.push(`Lokal: ${pesanGalat(err)}`);
    }
    if (k.repoCloud) {
      try {
        snapshotCloud = await simpanKeRepo(k, k.repoCloud, berkas, 3 * SATU_JAM_MS);
        statusCloud = 'BERHASIL';
      } catch (err) {
        pesan.push(`Cloud: ${pesanGalat(err)}`);
      }
    }
  } catch (err) {
    pesan.push(`Dump database: ${pesanGalat(err)}`);
  } finally {
    // Dump belum terenkripsi: jangan tertinggal di disk.
    await rm(dump, { force: true });
  }
  const berhasil = statusLokal === 'BERHASIL' || statusCloud === 'BERHASIL';
  await db
    .update(cadangan)
    .set({
      status: berhasil ? 'BERHASIL' : 'GAGAL',
      waktuSelesai: sekarang(),
      ukuranDump,
      snapshotLokal,
      statusLokal,
      snapshotCloud,
      statusCloud,
      pesan: pesan.length ? ringkas(pesan.join(' | '), 1000) : null,
    })
    .where(eq(cadangan.id, id));
  await catatLog(db, {
    aksi: 'CADANGAN_JALANKAN',
    idPengguna: pelaku?.id ?? null,
    entitas: 'cadangan',
    idEntitas: id,
    ringkasan: berhasil
      ? `Cadangan berhasil (lokal ${statusLokal.toLowerCase()}, cloud ${statusCloud.toLowerCase()})`
      : `Cadangan gagal: ${ringkas(pesan.join(' | '), 200)}`,
  });
  if (!berhasil) logger.error({ id, pesan }, 'Cadangan gagal');
}

function pesanGalat(err: unknown): string {
  return err instanceof Error ? ringkas(err.message) : 'Kesalahan tidak dikenal';
}

/**
 * Memulai cadangan. `tunggu` = selesai baru kembali (skrip & jadwal); selain itu proses berjalan di
 * latar belakang dan baris riwayat BERJALAN langsung dikembalikan (tombol "Cadangkan sekarang").
 */
export async function jalankanCadangan(p: {
  pemicu: PemicuCadangan;
  pelaku?: PenggunaAktif | null;
  tunggu?: boolean;
  konfig?: KonfigCadangan;
}): Promise<BarisCadangan> {
  const k = p.konfig ?? konfigCadangan();
  const pelaku = p.pelaku ?? null;
  const id = await mulai('CADANGAN', p.pemicu, pelaku, k);
  const proses = prosesCadangan(id, pelaku, k).finally(() => {
    sedangBerjalan = false;
  });
  if (p.tunggu) await proses;
  else proses.catch((err: unknown) => logger.error({ err }, 'Cadangan gagal tak terduga'));
  return barisById(id);
}

async function barisById(id: number): Promise<BarisCadangan> {
  const [b] = await db
    .select(kolomRiwayat)
    .from(cadangan)
    .leftJoin(pengguna, eq(pengguna.id, cadangan.idPengguna))
    .where(eq(cadangan.id, id));
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Riwayat cadangan tidak ditemukan.', 404);
  return keBaris(b);
}

// --- Uji pulih ---

/** Path berkas di dalam snapshot restic: `C:\a\b.dump` → `/C/a/b.dump`. */
export function pathDalamSnapshot(berkas: string): string {
  const p = berkas.replace(/\\/g, '/');
  return /^[A-Za-z]:\//.test(p) ? `/${p[0]}${p.slice(2)}` : p;
}

async function prosesUjiPulih(id: number, pelaku: PenggunaAktif | null, k: KonfigCadangan) {
  const pg_ = koneksiPg(k.databaseUrl);
  const berkas = path.join(k.folderKerja, 'uji-pulih.dump');
  const namaUji = `${pg_.database}_ujipulih`;
  let status: 'BERHASIL' | 'GAGAL' = 'GAGAL';
  let pesan = '';
  let snapshot: string | null = null;
  try {
    await mkdir(k.folderKerja, { recursive: true });
    const o = opsiRestic(k, k.repoLokal!);
    const daftar = await wajib(
      k.restic,
      [...o.argumen, 'snapshots', '--json', '--tag', TAG, '--latest', '1'],
      { env: o.env },
    );
    const snap = (JSON.parse(daftar.keluaran) as { short_id: string; paths: string[] }[]).at(-1);
    const pathDump = snap?.paths.find((p) => p.endsWith('.dump'));
    if (!snap || !pathDump) throw new Error('Belum ada snapshot cadangan untuk diuji.');
    snapshot = snap.short_id;
    await wajib(k.restic, [...o.argumen, 'dump', snap.short_id, pathDalamSnapshot(pathDump)], {
      env: o.env,
      keBerkas: berkas,
      batasMs: SATU_JAM_MS,
    });
    const isi = await wajib(programPg(k, 'pg_restore'), ['--list', berkas]);
    const tabel = isi.keluaran.split('\n').filter((b) => / TABLE DATA /.test(b)).length;
    if (tabel === 0) throw new Error('Arsip dump tidak berisi data tabel.');

    const admin = new pg.Client({ connectionString: k.databaseUrl });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${namaUji}"`);
      await admin.query(`CREATE DATABASE "${namaUji}"`);
    } catch (err) {
      if ((err as { code?: string }).code === '42501') {
        status = 'BERHASIL';
        pesan = `Terbatas: arsip snapshot ${snapshot} utuh (${tabel} tabel berisi data). Pemulihan penuh ke database uji butuh hak CREATEDB untuk user database.`;
        return;
      }
      throw err;
    } finally {
      await admin.end();
    }
    const urlUji = new URL(k.databaseUrl);
    urlUji.pathname = `/${namaUji}`;
    try {
      await wajib(
        programPg(k, 'pg_restore'),
        [...pg_.argumen, '--no-owner', '--no-privileges', '--dbname', namaUji, berkas],
        { env: pg_.env, batasMs: SATU_JAM_MS },
      );
      const uji = new pg.Client({ connectionString: urlUji.toString() });
      await uji.connect();
      try {
        const hitung = async (t: string) =>
          Number(
            (await uji.query<{ n: string }>(`select count(*)::text as n from ${t}`)).rows[0]?.n,
          );
        const [barang, penjualan, mutasi] = [
          await hitung('barang'),
          await hitung('penjualan'),
          await hitung('mutasi_persediaan'),
        ];
        status = 'BERHASIL';
        pesan = `Snapshot ${snapshot} berhasil dipulihkan ke database uji: ${tabel} tabel, ${barang} barang, ${penjualan} penjualan, ${mutasi} mutasi stok.`;
      } finally {
        await uji.end();
      }
    } finally {
      const bersih = new pg.Client({ connectionString: k.databaseUrl });
      await bersih.connect();
      // Hanya database sementara bernama *_ujipulih yang dihapus.
      if (namaUji.endsWith('_ujipulih')) await bersih.query(`DROP DATABASE IF EXISTS "${namaUji}"`);
      await bersih.end();
    }
  } catch (err) {
    status = 'GAGAL';
    pesan = pesanGalat(err);
  } finally {
    await rm(berkas, { force: true });
    await db
      .update(cadangan)
      .set({
        status,
        waktuSelesai: sekarang(),
        snapshotLokal: snapshot,
        statusLokal: status,
        pesan: ringkas(pesan, 1000),
      })
      .where(eq(cadangan.id, id));
    await catatLog(db, {
      aksi: 'CADANGAN_UJI_PULIH',
      idPengguna: pelaku?.id ?? null,
      entitas: 'cadangan',
      idEntitas: id,
      ringkasan: ringkas(`Uji pulih ${status.toLowerCase()}: ${pesan}`, 255),
    });
  }
}

export async function jalankanUjiPulih(p: {
  pemicu: PemicuCadangan;
  pelaku?: PenggunaAktif | null;
  tunggu?: boolean;
  konfig?: KonfigCadangan;
}): Promise<BarisCadangan> {
  const k = p.konfig ?? konfigCadangan();
  const pelaku = p.pelaku ?? null;
  const id = await mulai('UJI_PULIH', p.pemicu, pelaku, k);
  const proses = prosesUjiPulih(id, pelaku, k).finally(() => {
    sedangBerjalan = false;
  });
  if (p.tunggu) await proses;
  else proses.catch((err: unknown) => logger.error({ err }, 'Uji pulih gagal tak terduga'));
  return barisById(id);
}

// --- Status, peringatan, jadwal ---

export async function peringatanCadangan(k: KonfigCadangan = konfigCadangan()): Promise<string[]> {
  if (!k.repoLokal || !k.sandi) {
    return env.NODE_ENV === 'production'
      ? [
          'Cadangan data belum diatur. Owner: buka Pengaturan › Cadangan lalu isi folder dan sandinya.',
        ]
      : [];
  }
  const hasil: string[] = [];
  const [terakhir] = await riwayat(1, 'CADANGAN');
  const [berhasil] = await riwayat(1, 'CADANGAN', 'BERHASIL');
  const [uji] = await riwayat(1, 'UJI_PULIH');
  if (terakhir?.status === 'GAGAL') hasil.push(`Cadangan terakhir gagal: ${terakhir.pesan ?? '-'}`);
  if (!berhasil) hasil.push('Belum pernah ada cadangan yang berhasil.');
  else if (
    new Date(berhasil.waktuMulai).getTime() <
    sekarang().getTime() - BATAS_TERLEWAT_JAM * SATU_JAM_MS
  ) {
    hasil.push(`Tidak ada cadangan berhasil dalam ${BATAS_TERLEWAT_JAM} jam terakhir.`);
  }
  if (berhasil && k.repoCloud && berhasil.statusCloud !== 'BERHASIL') {
    hasil.push('Cadangan terakhir tidak sampai ke cloud (hanya tersimpan lokal).');
  }
  if (berhasil && berhasil.statusLokal !== 'BERHASIL') {
    hasil.push('Cadangan terakhir tidak tersimpan di disk lokal (hanya cloud).');
  }
  if (uji?.status === 'GAGAL') hasil.push(`Uji pulih terakhir gagal: ${uji.pesan ?? '-'}`);
  return hasil;
}

export async function statusCadangan(): Promise<StatusCadanganData> {
  const k = konfigCadangan();
  await rapikanYangTerhenti();
  const daftar = await riwayat(30);
  const ada = await programAda(k.restic);
  const peringatan = await peringatanCadangan(k);
  if (!ada) {
    peringatan.unshift(
      'Program cadangan (restic) belum terpasang di komputer server: cadangan tidak bisa berjalan. Pasang ulang BonsaiUrip versi terbaru atau ikuti panduan pemasangan bagian "Cadangan".',
    );
  }
  const diskSama = k.repoLokal !== null && akarDisk(k.repoLokal) === akarDisk(k.storageDir);
  if (diskSama) {
    peringatan.push(
      'Folder cadangan berada di disk yang sama dengan data. Bila disk itu rusak, cadangan ikut hilang: pakai disk kedua atau flashdisk/hardisk eksternal.',
    );
  }
  return {
    aktif: !!(k.repoLokal && k.sandi),
    sumberAturan: bacaAturan() ? 'LAYAR' : k.repoLokal ? 'ENV' : null,
    programAda: ada,
    diskSama,
    cloudAktif: !!k.repoCloud,
    repoLokal: k.repoLokal,
    repoCloud: k.repoCloud,
    jam: k.jam,
    retensi: `${RETENSI.harian} harian, ${RETENSI.mingguan} mingguan, ${RETENSI.bulanan} bulanan, ${RETENSI.tahunan} tahunan`,
    sedangBerjalan: daftar.some((b) => b.status === 'BERJALAN'),
    terakhirBerhasil: (await riwayat(1, 'CADANGAN', 'BERHASIL'))[0] ?? null,
    ujiPulihTerakhir: (await riwayat(1, 'UJI_PULIH'))[0] ?? null,
    riwayat: daftar,
    peringatan,
  };
}

/**
 * Dipanggil server tiap 10 menit: cadangan harian setelah jam yang diatur, atau segera bila cadangan
 * berhasil terakhir sudah > 24 jam (server mati semalam). Tanggal 1 tiap bulan disusul uji pulih.
 */
export async function cekJadwalCadangan(k: KonfigCadangan = konfigCadangan()): Promise<void> {
  if (!k.repoLokal || !k.sandi || sedangBerjalan) return;
  const kini = sekarang();
  const hariIni = tanggalOperasional(kini);
  const jam = Number(jamLokal(kini).slice(0, 2));
  const [berhasil] = await riwayat(1, 'CADANGAN', 'BERHASIL');
  const tanggalBerhasil = berhasil ? tanggalOperasional(new Date(berhasil.waktuMulai)) : null;
  const terlalaLama =
    !berhasil || new Date(berhasil.waktuMulai).getTime() < kini.getTime() - 24 * SATU_JAM_MS;
  const sudahHariIni = tanggalBerhasil === hariIni;
  // Percobaan gagal hari ini tidak diulang terus-menerus: jeda 1 jam.
  const [gagalBaru] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(cadangan)
    .where(
      and(
        eq(cadangan.jenis, 'CADANGAN'),
        eq(cadangan.status, 'GAGAL'),
        gte(cadangan.waktuMulai, tambahJam(kini, -1)),
      ),
    );
  if ((gagalBaru?.n ?? 0) > 0) return;
  if (!sudahHariIni && (jam >= k.jam || terlalaLama)) {
    await jalankanCadangan({ pemicu: 'JADWAL', tunggu: true, konfig: k });
    if (hariIni.endsWith('-01')) {
      const [uji] = await riwayat(1, 'UJI_PULIH');
      if (!uji || tanggalOperasional(new Date(uji.waktuMulai)) !== hariIni) {
        await jalankanUjiPulih({ pemicu: 'JADWAL', tunggu: true, konfig: k });
      }
    }
  }
}

/** K-198: Owner mengatur folder dan sandi cadangan dari layar. Sandi tidak pernah dikembalikan API atau dilog. */
export async function aturCadangan(
  input: { repoLokal: string; sandi: string },
  pelaku: PenggunaAktif,
  ip: string | null,
): Promise<StatusCadanganData> {
  const k = konfigCadangan();
  await simpanAturan(
    { repoLokal: input.repoLokal, sandi: input.sandi, repoCloud: k.repoCloud },
    k.restic,
  );
  await db.transaction(async (tx) => {
    await catatLog(tx, {
      aksi: 'CADANGAN_ATUR',
      idPengguna: pelaku.id,
      entitas: 'cadangan',
      ringkasan: `Folder cadangan diatur: ${input.repoLokal} (sandi diganti/diatur, tidak dicatat)`,
      ip,
    });
  });
  return statusCadangan();
}
