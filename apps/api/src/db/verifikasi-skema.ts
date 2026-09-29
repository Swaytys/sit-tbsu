/*
 * Skrip `pnpm --filter @sit/api db:verifikasi` (K-052).
 *
 * Membuktikan skema Drizzle (TypeScript) identik dengan migrasi SQL:
 *   A = database dari migrasi SQL (drizzle/migrations, termasuk 0000 = DDL v3.1)
 *   B = database dari skema Drizzle (SQL yang akan dibuat drizzle-kit dari skema/*.ts)
 * lalu membandingkan `pg_dump --schema-only` keduanya. Perbedaan apa pun = skema Drizzle
 * harus diperbaiki sebelum migrasi baru dibuat.
 *
 * HANYA memakai database uji (DATABASE_URL_TEST, nama wajib berakhiran `_test`). Skema
 * `public` database itu dikosongkan sebelum, di antara, dan sesudah pemeriksaan.
 * `tbsu_dev` tidak disentuh.
 */
import { execFileSync } from 'node:child_process';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import pg from 'pg';
import { muatEnvFile, namaDatabase } from '../lib/env-file';
import { logger } from '../lib/logger';
import { jalankanMigrasi } from './migrator';
import * as schema from './schema';

muatEnvFile();

const url = process.env.DATABASE_URL_TEST ?? '';
if (!namaDatabase(url).endsWith('_test')) {
  throw new Error('DATABASE_URL_TEST wajib menunjuk database yang namanya berakhiran _test.');
}

async function jalankanSql(perintah: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const p of perintah) await client.query(p);
  } finally {
    await client.end();
  }
}

async function kosongkan(): Promise<void> {
  await jalankanSql([
    'drop schema if exists drizzle cascade',
    'drop schema public cascade',
    'create schema public',
  ]);
}

/** Dump struktur skema public, tanpa baris yang berbeda-beda tiap dump (komentar, SET, token). */
function dumpSkema(): string[] {
  const keluaran = execFileSync(
    'pg_dump',
    ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--no-comments', url],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return keluaran
    .split(/\r?\n/)
    .map((baris) => baris.trimEnd())
    .filter(
      (baris) =>
        baris !== '' &&
        !baris.startsWith('--') &&
        !baris.startsWith('SET ') &&
        !baris.startsWith('SELECT pg_catalog.') &&
        !baris.startsWith('\\restrict') &&
        !baris.startsWith('\\unrestrict'),
    );
}

function selisihMultiset(a: string[], b: string[]): string[] {
  const hitung = new Map<string, number>();
  for (const baris of b) hitung.set(baris, (hitung.get(baris) ?? 0) + 1);
  const hanyaDiA: string[] = [];
  for (const baris of a) {
    const n = hitung.get(baris) ?? 0;
    if (n > 0) hitung.set(baris, n - 1);
    else hanyaDiA.push(baris);
  }
  return hanyaDiA;
}

try {
  logger.info(`Verifikasi skema memakai database ${namaDatabase(url)}.`);

  await kosongkan();
  await jalankanMigrasi(url);
  const dariMigrasi = dumpSkema();

  await kosongkan();
  const perintahDrizzle = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema),
  );
  await jalankanSql(perintahDrizzle);
  const dariDrizzle = dumpSkema();

  const hanyaMigrasi = selisihMultiset(dariMigrasi, dariDrizzle);
  const hanyaDrizzle = selisihMultiset(dariDrizzle, dariMigrasi);
  const urutanSama = dariMigrasi.join('\n') === dariDrizzle.join('\n');

  if (hanyaMigrasi.length === 0 && hanyaDrizzle.length === 0 && urutanSama) {
    logger.info(`IDENTIK: ${dariMigrasi.length} baris struktur sama persis.`);
  } else {
    process.exitCode = 1;
    const tulis = (judul: string, baris: string[]) =>
      process.stdout.write(
        `\n${judul} (${baris.length}):\n${baris.map((b) => `  ${b}`).join('\n')}\n`,
      );
    tulis('Hanya di migrasi SQL', hanyaMigrasi);
    tulis('Hanya di skema Drizzle', hanyaDrizzle);
    if (hanyaMigrasi.length === 0 && hanyaDrizzle.length === 0) {
      logger.error('Isi sama tetapi urutan berbeda (mis. urutan kolom).');
    }
    logger.error('BERBEDA: perbaiki skema Drizzle di apps/api/src/db/schema.');
  }
} finally {
  await kosongkan();
}
