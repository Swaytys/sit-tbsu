import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ManifestData, SnapshotHarian, StatusData } from '@sit/shared';
import type { MiddlewareHandler } from 'hono';
import pg from 'pg';
import { db } from '../../../db/client';
import { env } from '../../../env';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, EnvApp, PenggunaAktif } from '../../../lib/konteks';
import { logger } from '../../../lib/logger';
import { cocokPassword } from '../../../lib/password';
import * as authRepo from '../../auth/repo';
import { wajib } from '../cadangan/alat';
import { konfigCadangan, opsiRestic, TAG } from '../cadangan/service';
import { isiDataAwal } from '../../../db/data-awal';
import * as shiftRepo from '../../kas/shift/repo';
import { invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import {
  buatBerkasEkspor,
  cariEntri,
  daftarPustaka,
  hapusEntri,
  imporBerkas,
  kosongkanData,
  pulihkanDari,
  ringkasDatabase,
  simpanKePustaka,
  ukuranDatabase,
  ukuranPustaka,
  type PengaturanPg,
} from './pustaka';

/*
 * K-213: kelola data (Pengaturan › Data, Owner). Mengganti data aktif = pengaman otomatis dibuat dulu, data terpilih
 * dipulihkan; bila gagal, pengaman dipulihkan kembali. Selama penggantian semua permintaan lain dijawab 503.
 */

export function akarPustaka(): string {
  return env.PUSTAKA_DIR ?? path.resolve(env.STORAGE_DIR, '..', 'pustaka');
}

function pgAktif(): PengaturanPg {
  return { url: env.DATABASE_URL, pgBin: env.CADANGAN_PG_BIN ?? null };
}

let sedangGanti = false;

/** Selama data diganti, permintaan lain ditolak sementara (database sedang dibangun ulang). */
export const jagaGantiData: MiddlewareHandler<EnvApp> = async (c, next) => {
  if (sedangGanti && !c.req.path.endsWith('/health')) {
    return c.json(
      {
        error: {
          kode: 'SEDANG_GANTI_DATA',
          pesan: 'Data aplikasi sedang diganti. Tunggu sebentar, lalu muat ulang halaman.',
        },
      },
      503,
    );
  }
  await next();
};

async function pastikanPassword(pelaku: PenggunaAktif, password: string): Promise<void> {
  const hash = await authRepo.passwordHashPengguna(db, pelaku.id);
  if (!hash || !(await cocokPassword(hash, password)))
    throw galatKolom('password', 'Password salah.');
}

export async function statusData(): Promise<StatusData> {
  const akar = akarPustaka();
  const { pustaka, pengaman } = await daftarPustaka(akar);
  return {
    aktif: {
      ...(await ringkasDatabase(env.DATABASE_URL)),
      ukuranByte: await ukuranDatabase(env.DATABASE_URL),
    },
    pustaka,
    pengaman,
    totalUkuranByte: await ukuranPustaka(akar),
    cadanganHarianSiap: konfigCadangan().repoLokal !== null && konfigCadangan().sandi !== null,
  };
}

export async function simpanSalinan(
  label: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ManifestData> {
  const m = await simpanKePustaka({
    pg: pgAktif(),
    akar: akarPustaka(),
    storageDir: env.STORAGE_DIR,
    jenis: 'SALINAN',
    label,
  });
  await catatLog(db, {
    aksi: 'DATA_SALINAN',
    idPengguna: pelaku.id,
    entitas: 'pustaka_data',
    ringkasan: `Salinan data toko disimpan: ${label}`,
    ip: asal.ip,
  });
  return m;
}

/** Data tidak boleh diganti selama uang laci shift belum dicocokkan (K-215, K-219). */
async function pastikanTanpaShift(tindakan: string): Promise<void> {
  const [shift] = await shiftRepo.shiftTerbuka(db);
  if (shift) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Shift ${shift.nomor} masih terbuka. Tutup shift dulu, baru ${tindakan}.`,
      409,
    );
  }
}

/** Inti mengganti data aktif; dipakai juga oleh setup awal (tanpa pengguna) dan tes. */
export async function gantiDataAktif(
  id: string,
  pelaku: { id: number | null; nama: string },
  asal: AsalRequest,
): Promise<ManifestData> {
  if (sedangGanti) throw new AppError('KONFLIK', 'Penggantian data lain sedang berjalan.', 409);
  await pastikanTanpaShift('ganti data toko');
  const akar = akarPustaka();
  const target = await cariEntri(akar, id);
  sedangGanti = true;
  try {
    const pengaman = await simpanKePustaka({
      pg: pgAktif(),
      akar,
      storageDir: env.STORAGE_DIR,
      jenis: 'PENGAMAN',
      label: `Sebelum memakai "${target.manifest.label}"`,
    });
    try {
      await pulihkanDari({ pg: pgAktif(), folder: target.folder, storageDir: env.STORAGE_DIR });
    } catch (err) {
      logger.error({ err }, 'Ganti data gagal; pengaman dipulihkan');
      const balik = await cariEntri(akar, pengaman.id);
      await pulihkanDari({ pg: pgAktif(), folder: balik.folder, storageDir: env.STORAGE_DIR });
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Data "${target.manifest.label}" tidak bisa dipakai (berkasnya rusak atau tidak cocok). Data sebelumnya sudah dikembalikan.`,
        409,
      );
    }
    invalidasiKonfigurasi();
    await catatLog(db, {
      aksi: 'DATA_GANTI',
      idPengguna: null,
      entitas: 'pustaka_data',
      ringkasan: `Data aktif diganti dengan "${target.manifest.label}" oleh ${pelaku.nama}; data sebelumnya disimpan sebagai pengaman otomatis`,
      ip: asal.ip,
    });
    return target.manifest;
  } finally {
    sedangGanti = false;
  }
}

export async function pakaiData(
  id: string,
  password: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ManifestData> {
  await pastikanPassword(pelaku, password);
  return gantiDataAktif(
    id,
    { id: pelaku.id, nama: `${pelaku.namaPengguna} (${pelaku.username})` },
    asal,
  );
}

/**
 * K-219: data toko baru yang kosong (setup awal dari awal) tanpa menghapus data yang sedang dipakai: data sekarang
 * disimpan dulu sebagai salinan (tidak ikut dipangkas), lalu database dikosongkan dan diisi data awal. Ditolak
 * selama shift masih terbuka (uang laci belum dicocokkan).
 */
export async function buatDataBaru(
  pelaku: { id: number | null; nama: string },
  asal: AsalRequest,
): Promise<ManifestData> {
  if (sedangGanti) throw new AppError('KONFLIK', 'Penggantian data lain sedang berjalan.', 409);
  await pastikanTanpaShift('buat data toko baru');
  sedangGanti = true;
  try {
    const nama = (await ringkasDatabase(env.DATABASE_URL)).namaToko || 'tanpa nama toko';
    const simpan = await simpanKePustaka({
      pg: pgAktif(),
      akar: akarPustaka(),
      storageDir: env.STORAGE_DIR,
      jenis: 'SALINAN',
      label: `Data ${nama} sebelum membuat data toko baru`,
    });
    await kosongkanData({ pg: pgAktif(), storageDir: env.STORAGE_DIR });
    await isiDataAwal(db, { passwordOwner: null, akunDemo: false });
    invalidasiKonfigurasi();
    await catatLog(db, {
      aksi: 'DATA_GANTI',
      idPengguna: null,
      entitas: 'pustaka_data',
      ringkasan: `Data toko baru (kosong) dibuat oleh ${pelaku.nama}; data "${nama}" disimpan dan bisa dipakai kembali`,
      ip: asal.ip,
    });
    return simpan;
  } finally {
    sedangGanti = false;
  }
}

export async function buatDataBaruDenganPassword(
  password: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ManifestData> {
  await pastikanPassword(pelaku, password);
  return buatDataBaru({ id: pelaku.id, nama: `${pelaku.namaPengguna} (${pelaku.username})` }, asal);
}

export async function hapusData(
  id: string,
  password: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await pastikanPassword(pelaku, password);
  const m = await hapusEntri(akarPustaka(), id);
  await catatLog(db, {
    aksi: 'DATA_HAPUS',
    idPengguna: pelaku.id,
    entitas: 'pustaka_data',
    ringkasan: `Data toko dihapus dari komputer: ${m.label} (${m.namaToko || 'tanpa nama toko'})`,
    ip: asal.ip,
  });
}

/** Berkas .bonsai terenkripsi dari data aktif (id kosong) atau data di Pustaka. */
export async function eksporData(
  input: { id?: string | undefined; sandi: string; password: string },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ isi: Buffer; nama: string }> {
  await pastikanPassword(pelaku, input.password);
  const akar = akarPustaka();
  let folder: string;
  let sementara: string | null = null;
  let label: string;
  if (input.id) {
    const e = await cariEntri(akar, input.id);
    folder = e.folder;
    label = e.manifest.namaToko || e.manifest.label;
  } else {
    sementara = path.join(os.tmpdir(), `bonsaiurip-ekspor-${Date.now()}`);
    const m = await simpanKePustaka({
      pg: pgAktif(),
      akar: sementara,
      storageDir: env.STORAGE_DIR,
      jenis: 'SALINAN',
      label: 'Ekspor data aktif',
    });
    folder = path.join(sementara, m.id);
    label = m.namaToko || 'data';
  }
  try {
    const isi = await buatBerkasEkspor(folder, input.sandi);
    const tanggal = new Date().toISOString().slice(0, 10);
    const aman =
      label
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'data';
    await catatLog(db, {
      aksi: 'DATA_EKSPOR',
      idPengguna: pelaku.id,
      entitas: 'pustaka_data',
      ringkasan: `Berkas pindah komputer (.bonsai) dibuat dari ${input.id ? `data tersimpan ${input.id}` : 'data yang sedang dipakai'}`,
      ip: asal.ip,
    });
    return { isi, nama: `BonsaiUrip-${aman}-${tanggal}.bonsai` };
  } finally {
    if (sementara) await rm(sementara, { recursive: true, force: true });
  }
}

export async function imporData(
  berkas: Uint8Array,
  sandi: string,
  pelaku: { id: number | null },
  asal: AsalRequest,
): Promise<ManifestData> {
  const m = await imporBerkas(akarPustaka(), berkas, sandi);
  if (pelaku.id !== null) {
    await catatLog(db, {
      aksi: 'DATA_IMPOR',
      idPengguna: pelaku.id,
      entitas: 'pustaka_data',
      ringkasan: `Berkas pindah komputer dimasukkan: ${m.namaToko || m.label}`,
      ip: asal.ip,
    });
  }
  return m;
}

// --- Dari cadangan harian (K-198) ---

export async function snapshotHarian(): Promise<SnapshotHarian[]> {
  const k = konfigCadangan();
  if (!k.repoLokal || !k.sandi) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      'Cadangan harian belum diatur (Pengaturan › Cadangan).',
      409,
    );
  }
  const o = opsiRestic(k, k.repoLokal);
  const h = await wajib(k.restic, [...o.argumen, 'snapshots', '--json', '--tag', TAG], {
    env: o.env,
  });
  const daftar = JSON.parse(h.keluaran || '[]') as {
    short_id: string;
    time: string;
    summary?: { total_bytes_processed?: number };
  }[];
  return daftar
    .map((s) => ({
      id: s.short_id,
      waktu: s.time,
      ukuranByte: s.summary?.total_bytes_processed ?? null,
    }))
    .sort((a, b) => b.waktu.localeCompare(a.waktu))
    .slice(0, 30);
}

async function cariBerkas(
  folder: string,
  cocok: (nama: string, dir: boolean) => boolean,
): Promise<string | null> {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const p = path.join(folder, e.name);
    if (cocok(e.name, e.isDirectory())) return p;
    if (e.isDirectory()) {
      const dalam = await cariBerkas(p, cocok);
      if (dalam) return dalam;
    }
  }
  return null;
}

/**
 * Snapshot cadangan harian dijadikan data di Pustaka: dipulihkan ke folder sementara, lalu dump-nya dimuat ke
 * database uji sementara untuk dibaca ringkasannya (bila user database boleh membuat database).
 */
export async function ambilDariHarian(
  snapshot: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ManifestData> {
  if (!/^[0-9a-f]{8,64}$/.test(snapshot))
    throw new AppError('VALIDASI', 'Snapshot tidak dikenal.', 400);
  const k = konfigCadangan();
  if (!k.repoLokal || !k.sandi) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      'Cadangan harian belum diatur (Pengaturan › Cadangan).',
      409,
    );
  }
  const kerja = path.join(os.tmpdir(), `bonsaiurip-harian-${Date.now()}`);
  await mkdir(kerja, { recursive: true });
  try {
    const o = opsiRestic(k, k.repoLokal);
    await wajib(k.restic, [...o.argumen, 'restore', snapshot, '--target', kerja], {
      env: o.env,
      batasMs: 60 * 60 * 1000,
    });
    const dump = await cariBerkas(kerja, (n, dir) => !dir && n.endsWith('.dump'));
    if (!dump)
      throw new AppError('STATUS_TIDAK_VALID', 'Snapshot ini tidak berisi dump database.', 409);
    const storage = await cariBerkas(
      kerja,
      (n, dir) => dir && n === path.basename(env.STORAGE_DIR),
    );
    const m = await siapkanDariDump(dump, storage, snapshot);
    await catatLog(db, {
      aksi: 'DATA_IMPOR',
      idPengguna: pelaku.id,
      entitas: 'pustaka_data',
      ringkasan: `Cadangan harian ${snapshot} disalin ke daftar data toko`,
      ip: asal.ip,
    });
    return m;
  } finally {
    await rm(kerja, { recursive: true, force: true });
  }
}

/** Dump mentah → data di Pustaka; ringkasan dibaca dari database sementara bila diizinkan. */
async function siapkanDariDump(
  dump: string,
  storage: string | null,
  snapshot: string,
): Promise<ManifestData> {
  const akar = akarPustaka();
  const u = new URL(env.DATABASE_URL);
  const namaUji = `${decodeURIComponent(u.pathname.slice(1))}_pustaka`;
  const urlUji = new URL(env.DATABASE_URL);
  urlUji.pathname = `/${namaUji}`;
  const admin = new pg.Client({ connectionString: env.DATABASE_URL });
  await admin.connect();
  let bisaUji = true;
  try {
    await admin.query(`drop database if exists "${namaUji}"`);
    await admin.query(`create database "${namaUji}"`);
  } catch {
    bisaUji = false;
  } finally {
    await admin.end();
  }
  const kerja = path.join(os.tmpdir(), `bonsaiurip-dump-${Date.now()}`);
  try {
    if (bisaUji) {
      await mkdir(path.join(kerja, 'x'), { recursive: true });
      await copyFile(dump, path.join(kerja, 'x', 'db.dump'));
      await pulihkanDari({
        pg: { url: urlUji.toString(), pgBin: env.CADANGAN_PG_BIN ?? null },
        folder: path.join(kerja, 'x'),
        storageDir: path.join(kerja, 'storage-kosong'),
      });
      return await simpanKePustaka({
        pg: { url: urlUji.toString(), pgBin: env.CADANGAN_PG_BIN ?? null },
        akar,
        storageDir: storage ?? path.join(kerja, 'storage-kosong'),
        jenis: 'CADANGAN_HARIAN',
        label: `Cadangan harian ${snapshot}`,
      });
    }
    throw new AppError(
      'STATUS_TIDAK_VALID',
      'User database tidak boleh membuat database sementara (CREATEDB), jadi isi snapshot tidak bisa dibaca.',
      409,
    );
  } finally {
    await rm(kerja, { recursive: true, force: true });
    if (bisaUji) {
      const bersih = new pg.Client({ connectionString: env.DATABASE_URL });
      await bersih.connect();
      try {
        await bersih.query(`drop database if exists "${namaUji}"`);
      } finally {
        await bersih.end();
      }
    }
  }
}

/** Sisa folder kerja (bila server mati di tengah proses) dibersihkan saat menyala. */
export async function bersihkanSisa(): Promise<void> {
  for (const e of existsSync(os.tmpdir()) ? await readdir(os.tmpdir()) : []) {
    if (/^bonsaiurip-(ekspor|harian|dump)-\d+$/.test(e)) {
      const p = path.join(os.tmpdir(), e);
      if (Date.now() - (await stat(p)).mtimeMs > 3600_000)
        await rm(p, { recursive: true, force: true });
    }
  }
}

// --- Setup awal: pakai data yang sudah ada (belum ada pengguna) ---

export async function pastikanBelumAdaPengguna(): Promise<void> {
  if ((await authRepo.jumlahPengguna(db)) > 0) {
    throw new AppError(
      'KONFLIK',
      'Setup awal sudah dikerjakan. Kelola data dari Pengaturan › Data toko.',
      409,
    );
  }
}
