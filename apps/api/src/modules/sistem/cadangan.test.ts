import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StatusCadanganData } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { cadangan, logAktivitas } from '../../db/schema';
import { env } from '../../env';
import { jalankan } from './cadangan/alat';
import { berkasAturan } from './cadangan/aturan';
import {
  cekJadwalCadangan,
  jalankanCadangan,
  jalankanUjiPulih,
  pathDalamSnapshot,
  peringatanCadangan,
  type KonfigCadangan,
} from './cadangan/service';

/*
 * Cadangan data (K-084) dengan restic dan pg_dump sungguhan terhadap database uji. restic diambil dari
 * folder .alat/ di root repo (tidak di-commit); bila tidak ada, tes integrasi dilewati.
 */

const restic = fileURLToPath(new URL('../../../../../.alat/restic.exe', import.meta.url));
const adaRestic = existsSync(restic);
const akar = mkdtempSync(path.join(tmpdir(), 'uji-cadangan-'));
const konfig: KonfigCadangan = {
  repoLokal: path.join(akar, 'repo'),
  repoCloud: null,
  sandi: 'sandi-uji-cadangan',
  restic,
  rclone: null,
  pgBin: null,
  jam: 21,
  folderKerja: path.join(akar, 'kerja'),
  databaseUrl: env.DATABASE_URL,
  storageDir: path.join(akar, 'storage'),
};

beforeAll(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(cadangan);
  mkdirSync(path.join(konfig.storageDir, 'barang'), { recursive: true });
  writeFileSync(path.join(konfig.storageDir, 'barang', '1-abc.webp'), 'gambar uji');
});
afterAll(() => rmSync(akar, { recursive: true, force: true }));

it('path berkas Windows di dalam snapshot restic', () => {
  expect(pathDalamSnapshot('C:\\Windows\\Temp\\a\\tbsu.dump')).toBe('/C/Windows/Temp/a/tbsu.dump');
  expect(pathDalamSnapshot('/tmp/a/tbsu.dump')).toBe('/tmp/a/tbsu.dump');
});

describe.skipIf(!adaRestic)('cadangan restic + pg_dump (integrasi)', { timeout: 180_000 }, () => {
  it('cadangan lokal: snapshot terenkripsi, dump sementara dihapus, retensi harian, tercatat di log', async () => {
    const h1 = await jalankanCadangan({ pemicu: 'MANUAL', tunggu: true, konfig });
    const [b1] = await db.select().from(cadangan).where(eq(cadangan.id, h1.id));
    expect(b1).toMatchObject({
      jenis: 'CADANGAN',
      status: 'BERHASIL',
      statusLokal: 'BERHASIL',
      statusCloud: 'NONAKTIF',
      pesan: null,
    });
    expect(b1!.snapshotLokal).toMatch(/^[0-9a-f]{8}$/);
    expect(b1!.ukuranDump).toBeGreaterThan(1000);
    expect(existsSync(path.join(konfig.folderKerja, 'tbsu_test.dump'))).toBe(false);

    // Dua cadangan lagi di hari yang sama: retensi membuang snapshot tengah. restic menyimpan snapshot
    // terbaru per hari dan, selama riwayat masih pendek, juga snapshot tertua.
    await jalankanCadangan({ pemicu: 'MANUAL', tunggu: true, konfig });
    await jalankanCadangan({ pemicu: 'MANUAL', tunggu: true, konfig });
    const daftar = await jalankan(restic, ['-r', konfig.repoLokal!, 'snapshots', '--json'], {
      env: { RESTIC_PASSWORD: konfig.sandi! },
    });
    expect((JSON.parse(daftar.keluaran) as unknown[]).length).toBe(2);

    const log = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'CADANGAN_JALANKAN'));
    expect(log).toHaveLength(3);
    expect(await peringatanCadangan(konfig)).toEqual([]);
  });

  it('uji pulih: dump dari snapshot terbaru dibuka dan diperiksa isinya', async () => {
    const h = await jalankanUjiPulih({ pemicu: 'MANUAL', tunggu: true, konfig });
    const [b] = await db.select().from(cadangan).where(eq(cadangan.id, h.id));
    expect(b!.status, b!.pesan ?? '').toBe('BERHASIL');
    // Tanpa hak CREATEDB: arsip diverifikasi utuh; dengan hak itu: dipulihkan ke database uji sementara.
    expect(b!.pesan).toMatch(/tabel/);
    expect(existsSync(path.join(konfig.folderKerja, 'uji-pulih.dump'))).toBe(false);
  });

  it('sandi repositori salah → GAGAL dengan pesan, muncul peringatan, jadwal tidak mengulang < 1 jam', async () => {
    const salah = { ...konfig, sandi: 'sandi-yang-salah' };
    const h = await jalankanCadangan({ pemicu: 'JADWAL', tunggu: true, konfig: salah });
    const [b] = await db.select().from(cadangan).where(eq(cadangan.id, h.id));
    expect(b).toMatchObject({ status: 'GAGAL', statusLokal: 'GAGAL' });
    expect(b!.pesan).toMatch(/Lokal: .*restic/);
    expect((await peringatanCadangan(salah))[0]).toMatch(/^Cadangan terakhir gagal/);

    const sebelum = (await db.select().from(cadangan)).length;
    await cekJadwalCadangan({ ...salah, jam: 0 });
    expect((await db.select().from(cadangan)).length).toBe(sebelum);
  });
});

describe('API cadangan', () => {
  it('hanya Owner; belum diatur → 409 dengan petunjuk', async () => {
    const admin = await sesiUji('ADMIN');
    const owner = await sesiUji('OWNER');
    expect((await minta('/api/cadangan', { cookie: admin.cookie })).status).toBe(403);
    const r = await minta('/api/cadangan', { cookie: owner.cookie });
    expect(r.status).toBe(200);
    const s = (await json<{ data: StatusCadanganData }>(r)).data;
    expect(s.aktif).toBe(env.CADANGAN_REPO_LOKAL !== undefined);
    if (!s.aktif) {
      const j = await minta('/api/cadangan/jalankan', {
        method: 'POST',
        cookie: owner.cookie,
        body: {},
      });
      expect(j.status).toBe(409);
      expect((await json<{ error: { pesan: string } }>(j)).error.pesan).toMatch(
        /Pengaturan › Cadangan/,
      );
    }
  });
});

describe('atur cadangan dari layar (K-198)', () => {
  it('Owner mengisi folder + sandi; isian salah ditolak; sandi tidak pernah dikembalikan/dilog', async () => {
    const admin = await sesiUji('ADMIN');
    const owner = await sesiUji('OWNER');
    const folder = mkdtempSync(path.join(tmpdir(), 'cadangan-layar-'));
    const isi = {
      repoLokal: folder,
      sandi: 'sandi-rahasia-123',
      sandiUlang: 'sandi-rahasia-123',
      sudahDicatat: true,
    };
    const put = (sesi: { cookie: string }, body: unknown) =>
      minta('/api/cadangan/aturan', { method: 'PUT', cookie: sesi.cookie, body });
    try {
      expect((await put(admin, isi)).status).toBe(403);
      for (const salah of [
        { repoLokal: 'cadangan' },
        { sandiUlang: 'beda-sandi-1234' },
        { sudahDicatat: false },
        { sandi: 'pendek', sandiUlang: 'pendek' },
      ]) {
        expect((await put(owner, { ...isi, ...salah })).status).toBe(400);
      }
      const r = await put(owner, isi);
      expect(r.status).toBe(200);
      const teks = await r.text();
      expect(teks).not.toContain('sandi-rahasia-123');
      const s = (JSON.parse(teks) as { data: StatusCadanganData }).data;
      expect(s).toMatchObject({ aktif: true, sumberAturan: 'LAYAR', repoLokal: folder });
      const [log] = await db
        .select()
        .from(logAktivitas)
        .where(eq(logAktivitas.aksi, 'CADANGAN_ATUR'));
      expect(log?.ringkasan).toContain(folder);
      expect(JSON.stringify(log)).not.toContain('sandi-rahasia-123');
    } finally {
      rmSync(berkasAturan(), { force: true });
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
