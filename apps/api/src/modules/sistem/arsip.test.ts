import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HasilPeriksaArsip, Kendaraan, TahunArsip } from '@sit/shared';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { catatanBbm, kendaraan, shiftKasir, tutupTahun } from '../../db/schema';
import { tanggalOperasional } from '../../lib/waktu';
import { folderArsip } from './arsip/service';

// K-165: tutup tahun / arsip tahunan (docs/05 §18).

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let owner: Sesi;
let kasir: Sesi;
let truk: Kendaraan;
const tahunLalu = Number(tanggalOperasional().slice(0, 4)) - 1;
const tglLalu = `${tahunLalu}-06-15`;

const kirim = (s: Sesi, p: string, body?: unknown) =>
  minta(p, { method: 'POST', cookie: s.cookie, body });

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(tutupTahun, kendaraan, shiftKasir);
  owner = await sesiUji('OWNER');
  kasir = await sesiUji('KASIR');
  truk = (
    await json<{ data: Kendaraan }>(
      await kirim(owner, '/api/kendaraan', { plat: 'S 1 AR', jenis: 'Truk' }),
    )
  ).data;
});

const bbm = (tanggal: string, odometerKm: number | null = null) =>
  kirim(kasir, '/api/armada/bbm', {
    idKendaraan: truk.id,
    tanggal,
    liter: '10',
    totalRp: 100_000,
    odometerKm,
  });

describe('tutup tahun dan arsip tahunan (K-165)', () => {
  it('penghalang, tutup, kunci tahun, berkas utuh, periksa, buka kembali, tutup ulang', async () => {
    expect((await bbm(tglLalu)).status).toBe(201);

    // Penghalang: shift tahun lalu belum ditutup; tahun berjalan tidak bisa ditutup.
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    await db.update(shiftKasir).set({ tanggalOperasional: tglLalu });
    const halang = await kirim(owner, `/api/arsip/${tahunLalu}/tutup`);
    expect(halang.status).toBe(409);
    expect((await json<{ error: { pesan: string } }>(halang)).error.pesan).toContain(
      '1 shift belum ditutup',
    );
    expect((await kirim(owner, `/api/arsip/${tahunLalu + 1}/tutup`)).status).toBe(409);
    await db.update(shiftKasir).set({ tanggalOperasional: tanggalOperasional() });

    expect((await kirim(kasir, `/api/arsip/${tahunLalu}/tutup`)).status).toBe(403);
    const res = await kirim(owner, `/api/arsip/${tahunLalu}/tutup`);
    expect(res.status).toBe(200);
    const t = (await json<{ data: TahunArsip }>(res)).data;
    expect(t).toMatchObject({ tahun: tahunLalu, status: 'DITUTUP', penghalang: [] });
    expect(t.ringkasan.tabel.catatan_bbm).toBe(1);
    expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await kirim(owner, `/api/arsip/${tahunLalu}/tutup`)).status).toBe(409);

    // Berkas: transaksi tahun itu + potret master, tanpa hash password.
    const isi = JSON.parse(
      gunzipSync(await readFile(path.join(folderArsip(), t.berkas!))).toString('utf8'),
    ) as {
      format: string;
      transaksi: Record<string, unknown[]>;
      master: Record<string, unknown[]>;
    };
    expect(isi.format).toBe('bonsaiurip-arsip-tahunan');
    expect(isi.transaksi.catatan_bbm).toHaveLength(1);
    expect(isi.master.kendaraan?.length).toBeGreaterThan(0);
    expect(JSON.stringify(isi.master.pengguna)).not.toContain('password');
    const unduh = await minta(`/api/arsip/${tahunLalu}/berkas`, { cookie: owner.cookie });
    expect(unduh.status).toBe(200);
    expect(unduh.headers.get('content-type')).toBe('application/gzip');

    // Tahun dikunci: catatan bertanggal tahun itu ditolak; tahun berjalan tetap boleh.
    const kunci = await bbm(`${tahunLalu}-07-01`);
    expect(kunci.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(kunci)).error.pesan).toContain(
      'sudah ditutup',
    );
    expect((await bbm(tanggalOperasional())).status).toBe(201);

    // Periksa: cocok; lalu baris disisipkan langsung ke DB → terdeteksi berbeda.
    const periksa = async () =>
      (
        await json<{ data: HasilPeriksaArsip }>(
          await kirim(owner, `/api/arsip/${tahunLalu}/periksa`),
        )
      ).data;
    expect(await periksa()).toMatchObject({ berkasAda: true, checksumCocok: true, selisih: [] });
    const [contoh] = await db.select().from(catatanBbm).where(eq(catatanBbm.tanggal, tglLalu));
    await db.insert(catatanBbm).values({ ...contoh!, id: undefined });
    expect((await periksa()).selisih).toEqual([{ tabel: 'catatan_bbm', berkas: 1, database: 2 }]);

    // Buka kembali (alasan wajib) → boleh mencatat; tutup ulang menulis berkas baru.
    expect((await kirim(owner, `/api/arsip/${tahunLalu}/buka`, { alasan: 'x' })).status).toBe(400);
    expect(
      (await kirim(owner, `/api/arsip/${tahunLalu}/buka`, { alasan: 'Koreksi catatan BBM ganda' }))
        .status,
    ).toBe(200);
    expect((await bbm(`${tahunLalu}-07-01`)).status).toBe(201);
    const ulang = (
      await json<{ data: TahunArsip }>(await kirim(owner, `/api/arsip/${tahunLalu}/tutup`))
    ).data;
    expect(ulang.ringkasan.tabel.catatan_bbm).toBe(3);
    expect(ulang.berkas).not.toBe(t.berkas);

    const daftar = (
      await json<{ data: TahunArsip[] }>(await minta('/api/arsip', { cookie: owner.cookie }))
    ).data;
    expect(daftar.find((x) => x.tahun === tahunLalu)?.status).toBe('DITUTUP');
  });
});
