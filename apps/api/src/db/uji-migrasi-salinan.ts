import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { wajib } from '../modules/sistem/cadangan/alat';
import { konfigCadangan, koneksiPg, programPg } from '../modules/sistem/cadangan/service';
import { jalankanMigrasi } from './migrator';

/*
 * K-166: uji migrasi pada SALINAN database toko sebelum dipasang. Database asli di-dump, dipulihkan ke database
 * sementara `<nama>_ujimigrasi`, migrasi baru dijalankan di sana, lalu jumlah baris tiap tabel dibandingkan:
 * migrasi tidak boleh menghilangkan baris atau tabel berisi data. Database asli tidak disentuh. Butuh pg_dump /
 * pg_restore (PATH atau CADANGAN_PG_BIN) dan hak CREATEDB untuk user database.
 */

export type JumlahTabel = Record<string, number>;

export type HasilUjiMigrasi = {
  berhasil: boolean;
  pesan: string[];
  sebelum: JumlahTabel;
  sesudah: JumlahTabel;
};

/** Tabel yang hilang atau barisnya berkurang setelah migrasi (data lama rusak). Tabel baru boleh. */
export function bandingkanJumlah(sebelum: JumlahTabel, sesudah: JumlahTabel): string[] {
  const masalah: string[] = [];
  for (const [tabel, n] of Object.entries(sebelum)) {
    const m = sesudah[tabel];
    if (m === undefined) {
      if (n > 0) masalah.push(`Tabel ${tabel} (${n} baris) hilang setelah migrasi.`);
    } else if (m < n) {
      masalah.push(`Tabel ${tabel}: ${n} → ${m} baris (berkurang ${n - m}).`);
    }
  }
  return masalah;
}

async function hitungSemua(url: string): Promise<JumlahTabel> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const tabel = await c.query<{ nama: string }>(
      `select table_name nama from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    );
    const hasil: JumlahTabel = {};
    for (const { nama } of tabel.rows) {
      // Nama tabel dari katalog database sendiri, diapit tanda kutip identifier.
      const r = await c.query<{ n: string }>(
        `select count(*)::text n from "${nama.replace(/"/g, '""')}"`,
      );
      hasil[nama] = Number(r.rows[0]?.n ?? 0);
    }
    return hasil;
  } finally {
    await c.end();
  }
}

export async function ujiMigrasiSalinan(): Promise<HasilUjiMigrasi> {
  const k = konfigCadangan();
  const asal = koneksiPg(k.databaseUrl);
  const namaUji = `${asal.database}_ujimigrasi`;
  const folder = path.join(os.tmpdir(), 'bonsaiurip-uji-migrasi');
  const dump = path.join(folder, `${asal.database}.dump`);
  const urlUji = new URL(k.databaseUrl);
  urlUji.pathname = `/${namaUji}`;
  const admin = new pg.Client({ connectionString: k.databaseUrl });
  await mkdir(folder, { recursive: true });
  await admin.connect();
  try {
    await wajib(
      programPg(k, 'pg_dump'),
      [...asal.argumen, '--format=custom', '--file', dump, asal.database],
      { env: asal.env, batasMs: 60 * 60 * 1000 },
    );
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${namaUji}"`);
      await admin.query(`CREATE DATABASE "${namaUji}"`);
    } catch (err) {
      if ((err as { code?: string }).code === '42501') {
        throw new Error(
          `User database tidak punya hak CREATEDB untuk membuat salinan uji. Jalankan sebagai postgres: ` +
            `ALTER ROLE ${decodeURIComponent(new URL(k.databaseUrl).username)} CREATEDB;`,
          { cause: err },
        );
      }
      throw err;
    }
    await wajib(
      programPg(k, 'pg_restore'),
      [...asal.argumen, '--no-owner', '--no-privileges', '--dbname', namaUji, dump],
      { env: asal.env, batasMs: 60 * 60 * 1000 },
    );
    const sebelum = await hitungSemua(urlUji.toString());
    const pesan: string[] = [];
    try {
      await jalankanMigrasi(urlUji.toString());
    } catch (err) {
      pesan.push(`Migrasi gagal pada salinan: ${err instanceof Error ? err.message : String(err)}`);
      return { berhasil: false, pesan, sebelum, sesudah: {} };
    }
    const sesudah = await hitungSemua(urlUji.toString());
    pesan.push(...bandingkanJumlah(sebelum, sesudah));
    return { berhasil: pesan.length === 0, pesan, sebelum, sesudah };
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${namaUji}"`).catch(() => undefined);
    await admin.end();
    await rm(folder, { recursive: true, force: true });
  }
}
