import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InfoKodePersetujuan } from '@sit/shared';
import {
  aturKonfigurasi,
  beriEmail,
  json,
  kodeTerkirim,
  minta,
  pesanTerkirim,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { golonganPelanggan, logAktivitas, pelanggan, pemasok, tingkatHarga } from '../../db/schema';
import { adaMaster } from './hapus';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Baris = Record<string, unknown> & { id: number };
type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let staf: Sesi;
let golongan: { distributor: number; lama: number };

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(pelanggan, pemasok, golonganPelanggan, tingkatHarga);
  await aturKonfigurasi({ term_hari_default: '14' });
  await db.insert(tingkatHarga).values([
    { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
    {
      kode: 'GROSIR',
      nama: 'Grosir',
      markupDefaultPersen: '20',
      urutan: 2,
      minBelanja: 900_000_000,
    },
    { kode: 'LAMA', nama: 'Lama', urutan: 3, statusAktif: 'NONAKTIF' },
  ]);
  const baris = await db
    .insert(golonganPelanggan)
    .values([{ nama: 'Distributor' }, { nama: 'Lama', statusAktif: 'NONAKTIF' }])
    .returning({ id: golonganPelanggan.id });
  golongan = { distributor: baris[0]!.id, lama: baris[1]!.id };
  admin = await sesiUji('ADMIN');
  staf = await sesiUji('STAF_PENJUALAN');
});

const kirim = (sesi: Sesi, path: string, body: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

async function buat(sesi: Sesi, path: string, body: unknown): Promise<Baris> {
  const res = await kirim(sesi, path, body);
  if (res.status !== 201) throw new Error(`${path} gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: Baris }>(res)).data;
}

async function logTerakhir(aksi: string) {
  const [baris] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return baris;
}

// Fixtur sengaja memakai No. HP berulang; pencegah data ganda (K-137) diuji terpisah di bawah.
const PLG = { namaPelanggan: 'CV. Maju Jaya', noHp: '0812-3456-7890', abaikanMirip: true };

describe('pelanggan', () => {
  it('semua peran boleh melihat dan menambah; kode PLG berurutan dan tidak bisa diubah', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/pelanggan', { cookie: kasir.cookie })).status).toBe(200);

    const a = await buat(staf, '/api/pelanggan', PLG);
    const b = await buat(admin, '/api/pelanggan', { ...PLG, namaPelanggan: 'Bp. Haryanto' });
    expect(a.kode).toBe('PLG-00001');
    expect(b.kode).toBe('PLG-00002');

    // `kode` bukan bagian skema: diabaikan, kode tetap.
    const res = await kirim(admin, `/api/pelanggan/${a.id}`, { ...PLG, kode: 'X-1' }, 'PATCH');
    expect(res.status).toBe(200);
    expect((await json<{ data: Baris }>(res)).data.kode).toBe('PLG-00001');
  });

  it('pelanggan baru memakai bawaan toko: tanpa golongan, term dari konfigurasi, tanpa limit', async () => {
    const p = await buat(staf, '/api/pelanggan', PLG);
    expect(p).toMatchObject({
      idGolongan: null,
      namaGolongan: null,
      termHari: 14,
      limitKredit: null,
      email: null,
      statusAktif: 'AKTIF',
    });
    const log = await logTerakhir('PELANGGAN_BUAT');
    expect(log?.idEntitas).toBe(p.id);
    expect(log?.ringkasan).toContain('PLG-00001');
  });

  it('K-104: limit kredit bawaan diatur dari form tambah pelanggan dan dipakai pelanggan berikutnya', async () => {
    const bawaan = async (sesi: Sesi) =>
      (await json<{ data: unknown }>(await minta('/api/pelanggan/bawaan', { cookie: sesi.cookie })))
        .data;
    expect(await bawaan(staf)).toEqual({ termHari: 14, limitKredit: null });

    // Staf tidak bisa mengubah bawaan (limit berbeda dari bawaan = mengatur kredit).
    const tolak = await kirim(staf, '/api/pelanggan', {
      namaPelanggan: 'Toko Coba',
      noHp: '081234567890',
      limitKredit: 2_000_000,
      jadikanLimitBawaan: true,
    });
    expect(tolak.status).toBe(403);
    expect(await bawaan(admin)).toMatchObject({ limitKredit: null });

    // Admin menambah pelanggan dengan limit Rp 2.000.000 dan mencentang "jadikan bawaan".
    const a = await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'Toko Satu',
      noHp: '081234567891',
      limitKredit: 2_000_000,
      jadikanLimitBawaan: true,
    });
    expect(a.limitKredit).toBe(2_000_000);
    expect(await bawaan(staf)).toEqual({ termHari: 14, limitKredit: 2_000_000 });
    expect((await logTerakhir('PENGATURAN_UBAH'))?.ringkasan).toContain('limit_kredit_default');

    // Pelanggan berikutnya dari Staf (tidak mengirim limit) memakai bawaan baru.
    const b = await buat(staf, '/api/pelanggan', {
      namaPelanggan: 'Toko Dua',
      noHp: '081234567892',
    });
    expect(b.limitKredit).toBe(2_000_000);
    // Tanpa centang, limit lain tidak mengubah bawaan.
    await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'Toko Tiga',
      noHp: '081234567893',
      limitKredit: 500_000,
    });
    expect(await bawaan(admin)).toMatchObject({ limitKredit: 2_000_000 });
    // Kosong + centang = kembali tanpa limit.
    await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'Toko Empat',
      noHp: '081234567894',
      limitKredit: null,
      jadikanLimitBawaan: true,
    });
    expect(await bawaan(admin)).toMatchObject({ limitKredit: null });
  });

  it('No. HP wajib dan formatnya diperiksa (K-056)', async () => {
    for (const [noHp, pesan] of [
      [undefined, 'wajib'],
      ['', 'wajib'],
      ['0812abc', 'hanya boleh angka'],
      ['0812', 'minimal 8 angka'],
    ] as const) {
      const res = await kirim(admin, '/api/pelanggan', { namaPelanggan: 'X', noHp });
      expect(res.status).toBe(400);
      const galat = await json<Galat>(res);
      expect(galat.error.detail?.kolom?.noHp?.[0]).toContain(pesan);
    }
    const res = await kirim(admin, '/api/pelanggan', { ...PLG, email: 'bukan-email' });
    expect((await json<Galat>(res)).error.detail?.kolom?.email?.[0]).toBe(
      'Format email tidak valid.',
    );
  });

  it('Admin mengatur golongan (K-097), term, limit; golongan nonaktif ditolak', async () => {
    const p = await buat(admin, '/api/pelanggan', {
      ...PLG,
      idGolongan: golongan.distributor,
      termHari: 30,
      limitKredit: 5_000_000,
    });
    expect(p).toMatchObject({
      idGolongan: golongan.distributor,
      namaGolongan: 'Distributor',
      termHari: 30,
      limitKredit: 5_000_000,
    });

    const res = await kirim(admin, '/api/pelanggan', { ...PLG, idGolongan: golongan.lama });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.detail?.kolom?.idGolongan).toBeDefined();

    // Limit kosong dari form = tanpa limit; rupiah pecahan ditolak.
    const ubah = await kirim(admin, `/api/pelanggan/${p.id}`, { ...PLG, limitKredit: '' }, 'PATCH');
    expect((await json<{ data: Baris }>(ubah)).data.limitKredit).toBeNull();
    const pecahan = await kirim(admin, '/api/pelanggan', { ...PLG, limitKredit: 1000.5 });
    expect(pecahan.status).toBe(400);
  });

  it('Staf tidak bisa mengatur golongan, term, atau limit kredit (K-059)', async () => {
    for (const isian of [
      { idGolongan: golongan.distributor },
      { termHari: 30 },
      { limitKredit: 1_000_000 },
    ]) {
      const res = await kirim(staf, '/api/pelanggan', { ...PLG, ...isian });
      expect(res.status).toBe(403);
      expect((await json<Galat>(res)).error.kode).toBe('TIDAK_BERIZIN');
    }
    // Nilai yang sama dengan bawaan toko tetap diterima.
    expect(
      (
        await kirim(staf, '/api/pelanggan', {
          ...PLG,
          namaPelanggan: `${PLG.namaPelanggan} Cabang`,
          termHari: 14,
        })
      ).status,
    ).toBe(201);

    // Pelanggan yang diatur Admin: Staf mengubah kontak tanpa menyentuh golongan/term/limit.
    const p = await buat(admin, '/api/pelanggan', {
      ...PLG,
      idGolongan: golongan.distributor,
      termHari: 30,
      limitKredit: 2_000_000,
    });
    // K-107: perubahan data pelanggan yang sudah ada oleh Staf butuh kode atasan.
    const ubah = { ...PLG, alamat: 'Jombang' };
    const tanpaKode = await kirim(staf, `/api/pelanggan/${p.id}`, ubah, 'PATCH');
    expect(tanpaKode.status).toBe(403);
    expect((await json<Galat>(tanpaKode)).error.pesan).toContain('kode persetujuan');
    // Simpan tanpa perubahan tidak butuh kode (dan tidak mengubah apa pun).
    expect((await kirim(staf, `/api/pelanggan/${p.id}`, PLG, 'PATCH')).status).toBe(200);

    await beriEmail(admin.pengguna.id);
    const minta1 = await kirim(staf, `/api/pelanggan/${p.id}/minta-kode`, {
      aksi: 'UBAH',
      data: ubah,
    });
    expect(minta1.status).toBe(200);
    const info = (await json<{ data: InfoKodePersetujuan }>(minta1)).data;
    // Atasan membaca apa yang berubah, dari data tersimpan dan isian yang akan disimpan.
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toContain('Alamat: (kosong) -> Jombang');
    const kodeAtasan = {
      idPermintaan: info.idPermintaan,
      kode: kodeTerkirim(admin.pengguna.namaPengguna),
    };
    // Kode hanya berlaku untuk isian yang tertulis di pesan: isian lain ditolak dan kodenya tetap utuh.
    const lain = await kirim(
      staf,
      `/api/pelanggan/${p.id}`,
      { ...PLG, alamat: 'Surabaya', kodeAtasan },
      'PATCH',
    );
    expect(lain.status).toBe(400);
    const res = await kirim(staf, `/api/pelanggan/${p.id}`, { ...ubah, kodeAtasan }, 'PATCH');
    expect(res.status).toBe(200);
    expect((await json<{ data: Baris }>(res)).data).toMatchObject({
      alamat: 'Jombang',
      idGolongan: golongan.distributor,
      termHari: 30,
      limitKredit: 2_000_000,
    });
    expect((await logTerakhir('PELANGGAN_UBAH'))?.ringkasan).toContain(
      `disetujui ${admin.pengguna.namaPengguna} lewat kode`,
    );
    // Sekali pakai: kode yang sama tidak bisa dipakai untuk perubahan berikutnya.
    const ulang = await kirim(
      staf,
      `/api/pelanggan/${p.id}`,
      { ...PLG, alamat: 'Jombang kota', kodeAtasan },
      'PATCH',
    );
    expect(ulang.status).toBe(400);
    // Tidak ada yang berubah → tidak ada kode yang dikirim.
    expect(
      (await kirim(staf, `/api/pelanggan/${p.id}/minta-kode`, { aksi: 'UBAH', data: ubah })).status,
    ).toBe(400);
    const tolak = await kirim(staf, `/api/pelanggan/${p.id}`, { ...PLG, termHari: 0 }, 'PATCH');
    expect(tolak.status).toBe(403);
  });

  it('K-097: golongan pelanggan dikelola Admin; nama unik; Staf hanya melihat', async () => {
    const g = await buat(admin, '/api/golongan-pelanggan', { nama: 'Kontraktor' });
    expect(g).toMatchObject({ nama: 'Kontraktor', statusAktif: 'AKTIF', jumlahPelanggan: 0 });
    expect((await kirim(admin, '/api/golongan-pelanggan', { nama: 'kontraktor' })).status).toBe(
      409,
    );
    expect((await kirim(staf, '/api/golongan-pelanggan', { nama: 'Tukang' })).status).toBe(403);
    const daftar = await minta('/api/golongan-pelanggan?status=AKTIF', { cookie: staf.cookie });
    expect(daftar.status).toBe(200);
    await buat(admin, '/api/pelanggan', { ...PLG, idGolongan: g.id });
    const [isi] = (
      await json<{ data: Baris[] }>(
        await minta('/api/golongan-pelanggan?status=AKTIF', { cookie: admin.cookie }),
      )
    ).data.filter((x) => x.id === g.id);
    expect(isi).toMatchObject({ jumlahPelanggan: 1 });
    expect((await logTerakhir('GOLONGAN_PELANGGAN_BUAT'))?.ringkasan).toContain('Kontraktor');
  });

  it('log ubah hanya mencatat kolom yang berubah; simpan tanpa perubahan tidak dicatat', async () => {
    const p = await buat(admin, '/api/pelanggan', PLG);
    await kirim(admin, `/api/pelanggan/${p.id}`, { ...PLG, noHp: '081299998888' }, 'PATCH');
    const log = await logTerakhir('PELANGGAN_UBAH');
    expect(log?.dataLama).toEqual({ noHp: '+6281234567890' });
    expect(log?.dataBaru).toEqual({ noHp: '+6281299998888' });

    await kirim(admin, `/api/pelanggan/${p.id}`, { ...PLG, noHp: '081299998888' }, 'PATCH');
    expect((await logTerakhir('PELANGGAN_UBAH'))?.id).toBe(log?.id);
  });

  it('cari nama/kode/No. HP, saring status, berhalaman', async () => {
    await buat(admin, '/api/pelanggan', PLG);
    const b = await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'UD. Karya',
      noHp: '089987654321',
    });
    await buat(admin, '/api/pelanggan', { namaPelanggan: 'Toko Sejahtera', noHp: '085712345678' });
    await kirim(admin, `/api/pelanggan/${b.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');

    const cari = async (q: string) =>
      await json<{ data: Baris[]; meta: { total: number } }>(
        await minta(`/api/pelanggan?${q}`, { cookie: staf.cookie }),
      );
    expect((await cari('cari=99876')).data.map((p) => p.namaPelanggan)).toEqual(['UD. Karya']);
    expect((await cari('cari=plg-00003')).data.map((p) => p.namaPelanggan)).toEqual([
      'Toko Sejahtera',
    ]);
    expect((await cari('status=AKTIF')).meta.total).toBe(2);
    const hal = await cari('perHalaman=2&halaman=2');
    expect(hal.meta).toEqual({ total: 3, halaman: 2, perHalaman: 2 });
    expect(hal.data).toHaveLength(1);
    // Karakter khusus ILIKE dicari apa adanya.
    expect((await cari('cari=%25')).meta.total).toBe(0);
  });

  it('nonaktifkan dan aktifkan kembali tercatat di log; data tidak dihapus', async () => {
    const p = await buat(staf, '/api/pelanggan', PLG);
    const res = await kirim(
      admin,
      `/api/pelanggan/${p.id}/status`,
      { statusAktif: 'NONAKTIF' },
      'PATCH',
    );
    expect((await json<{ data: Baris }>(res)).data.statusAktif).toBe('NONAKTIF');
    expect((await logTerakhir('PELANGGAN_NONAKTIF'))?.idEntitas).toBe(p.id);
    await kirim(admin, `/api/pelanggan/${p.id}/status`, { statusAktif: 'AKTIF' }, 'PATCH');
    expect((await logTerakhir('PELANGGAN_AKTIFKAN'))?.idEntitas).toBe(p.id);
    expect(await db.select().from(pelanggan)).toHaveLength(1);
  });

  it('K-107: Staf/Kasir menonaktifkan atau mengaktifkan pelanggan hanya dengan kode atasan', async () => {
    const p = await buat(staf, '/api/pelanggan', PLG);
    const status = (statusAktif: string, kodeAtasan?: unknown) =>
      kirim(staf, `/api/pelanggan/${p.id}/status`, { statusAktif, kodeAtasan }, 'PATCH');
    expect((await status('NONAKTIF')).status).toBe(403);
    // Belum ada atasan yang bisa menerima kode → permintaan ditolak dengan petunjuk.
    const belumAda = await kirim(staf, `/api/pelanggan/${p.id}/minta-kode`, {
      aksi: 'STATUS',
      statusAktif: 'NONAKTIF',
    });
    expect(belumAda.status).toBe(409);

    await beriEmail(admin.pengguna.id);
    const info = (
      await json<{ data: InfoKodePersetujuan }>(
        await kirim(staf, `/api/pelanggan/${p.id}/minta-kode`, {
          aksi: 'STATUS',
          statusAktif: 'NONAKTIF',
        }),
      )
    ).data;
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toContain('Nonaktifkan pelanggan');
    const kodeAtasan = {
      idPermintaan: info.idPermintaan,
      kode: kodeTerkirim(admin.pengguna.namaPengguna),
    };
    // Kode "nonaktifkan" tidak bisa dipakai untuk mengubah data pelanggan itu.
    expect(
      (
        await kirim(
          staf,
          `/api/pelanggan/${p.id}`,
          { ...PLG, alamat: 'Jombang', kodeAtasan },
          'PATCH',
        )
      ).status,
    ).toBe(400);
    const res = await status('NONAKTIF', kodeAtasan);
    expect(res.status).toBe(200);
    expect((await json<{ data: Baris }>(res)).data.statusAktif).toBe('NONAKTIF');
    expect((await logTerakhir('PELANGGAN_NONAKTIF'))?.ringkasan).toContain('lewat kode');
    // Mengaktifkan kembali juga butuh kode baru.
    expect((await status('AKTIF', kodeAtasan)).status).toBe(400);
    expect((await status('AKTIF')).status).toBe(403);
  });
});

describe('pemasok', () => {
  it('hanya Admin/Owner yang boleh melihat dan mengelola (K-019)', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/pemasok', { cookie: kasir.cookie })).status).toBe(403);
    expect((await minta('/api/pemasok', { cookie: staf.cookie })).status).toBe(403);
    const res = await kirim(kasir, '/api/pemasok', { namaPemasok: 'X', noHp: '0321123456' });
    expect(res.status).toBe(403);
    expect((await minta('/api/pemasok', { cookie: admin.cookie })).status).toBe(200);
  });

  it('kode PMS, No. HP wajib, kontak person, log', async () => {
    const p = await buat(admin, '/api/pemasok', {
      namaPemasok: 'UD. Besi Baja Nusantara',
      noHp: '031 5678 9012',
      kontakPerson: 'Pak Susanto',
    });
    expect(p).toMatchObject({ kode: 'PMS-00001', kontakPerson: 'Pak Susanto', alamat: null });
    expect((await logTerakhir('PEMASOK_BUAT'))?.idEntitas).toBe(p.id);

    const res = await kirim(admin, '/api/pemasok', { namaPemasok: 'Tanpa HP' });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.detail?.kolom?.noHp).toBeDefined();

    const ubah = await kirim(
      admin,
      `/api/pemasok/${p.id}`,
      { namaPemasok: 'UD. Besi Baja Nusantara', noHp: '031 5678 9012', kontakPerson: 'Bu Rina' },
      'PATCH',
    );
    expect((await json<{ data: Baris }>(ubah)).data.kontakPerson).toBe('Bu Rina');
    expect((await logTerakhir('PEMASOK_UBAH'))?.dataBaru).toEqual({ kontakPerson: 'Bu Rina' });

    await kirim(admin, `/api/pemasok/${p.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    expect((await logTerakhir('PEMASOK_NONAKTIF'))?.idEntitas).toBe(p.id);
    const cari = await minta('/api/pemasok?cari=susanto&status=NONAKTIF', { cookie: admin.cookie });
    expect((await json<{ meta: { total: number } }>(cari)).meta.total).toBe(0);
    const cari2 = await minta('/api/pemasok?cari=rina&status=NONAKTIF', { cookie: admin.cookie });
    expect((await json<{ meta: { total: number } }>(cari2)).meta.total).toBe(1);
  });
});

describe('tingkat harga', () => {
  it('dibaca semua peran; markup default hanya untuk pemegang lihat_hpp', async () => {
    const kasir = await sesiUji('KASIR');
    const untukKasir = await json<{ data: Baris[] }>(
      await minta('/api/tingkat-harga', { cookie: kasir.cookie }),
    );
    expect(untukKasir.data.map((t) => t.kode)).toEqual(['NORMAL', 'GROSIR', 'LAMA']);
    expect(untukKasir.data.every((t) => !('markupDefaultPersen' in t))).toBe(true);

    const untukAdmin = await json<{ data: Baris[] }>(
      await minta('/api/tingkat-harga', { cookie: admin.cookie }),
    );
    expect(untukAdmin.data[0]).toMatchObject({ kode: 'NORMAL', markupDefaultPersen: '25.00' });
  });
});

describe('cegah data ganda dan No. HP rapi (K-137)', () => {
  it('No. HP dirapikan ke +62; nama/No. HP sama ditolak 409 dengan daftar mirip; abaikanMirip menyimpan', async () => {
    const a = await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'Toko  Sumber   Jaya',
      noHp: '0857 1111 2222',
    });
    expect(a).toMatchObject({ namaPelanggan: 'Toko Sumber Jaya', noHp: '+6285711112222' });

    const samaNama = await kirim(admin, '/api/pelanggan', {
      namaPelanggan: 'sumber-jaya',
      noHp: '081399990000',
    });
    expect(samaNama.status).toBe(409);
    const g = await json<{
      error: { pesan: string; detail: { mirip: { id: number; alasan: string }[] } };
    }>(samaNama);
    expect(g.error.detail.mirip).toEqual([
      expect.objectContaining({ id: a.id, alasan: 'nama sama' }),
    ]);

    const samaHp = await kirim(admin, '/api/pelanggan', {
      namaPelanggan: 'Pak Bambang',
      noHp: '+62 857-1111-2222',
    });
    expect(samaHp.status).toBe(409);
    expect((await json<{ error: { pesan: string } }>(samaHp)).error.pesan).toContain('No. HP sama');

    const tegas = await kirim(admin, '/api/pelanggan', {
      namaPelanggan: 'Sumber Jaya',
      noHp: '081399990000',
      abaikanMirip: true,
    });
    expect(tegas.status).toBe(201);

    // Format salah ditolak dengan pesan yang mengajari.
    const pendek = await kirim(admin, '/api/pelanggan', { namaPelanggan: 'X Y', noHp: '0812' });
    expect(pendek.status).toBe(400);
    const panjang = await kirim(admin, '/api/pelanggan', {
      namaPelanggan: 'X Z',
      noHp: '0812345678901234567',
    });
    expect((await json<{ error: { pesan: string } }>(panjang)).error.pesan).toContain(
      'paling banyak 15',
    );

    // Pemasok: nama sama setelah awalan CV dibuang.
    await buat(admin, '/api/pemasok', { namaPemasok: 'CV Semen Abadi', noHp: '0321123456' });
    const p2 = await kirim(admin, '/api/pemasok', {
      namaPemasok: 'Semen Abadi',
      noHp: '0321999888',
    });
    expect(p2.status).toBe(409);
  });

  it('K-199: nama dan No. HP sama persis ditolak walau ditegaskan; yang belum dipakai bisa dihapus permanen (log)', async () => {
    const lama = await buat(admin, '/api/pelanggan', {
      namaPelanggan: 'Bu Siti Aminah',
      noHp: '081233334444',
    });
    await kirim(admin, `/api/pelanggan/${lama.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    const ganda = await kirim(admin, '/api/pelanggan', {
      namaPelanggan: 'Bu Siti Aminah',
      noHp: '0812-3333-4444',
      abaikanMirip: true,
    });
    expect(ganda.status).toBe(409);
    const g = await json<{
      error: { pesan: string; detail: { mirip: { id: number; persis: boolean }[] } };
    }>(ganda);
    expect(g.error.pesan).toContain('sama persis');
    expect(g.error.detail.mirip).toEqual([expect.objectContaining({ id: lama.id, persis: true })]);

    // Staf tidak boleh menghapus; Admin boleh karena belum pernah dipakai.
    expect((await kirim(staf, `/api/pelanggan/${lama.id}`, undefined, 'DELETE')).status).toBe(403);
    expect((await kirim(admin, `/api/pelanggan/${lama.id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await adaMaster('pelanggan', lama.id)).toBe(false);
    const log = await logTerakhir('PELANGGAN_HAPUS');
    expect(log?.ringkasan).toContain('Bu Siti Aminah');
    expect(log?.dataLama).toMatchObject({ nama_pelanggan: 'Bu Siti Aminah' });
    // Sekarang tidak ganda lagi.
    expect(
      (
        await kirim(admin, '/api/pelanggan', {
          namaPelanggan: 'Bu Siti Aminah',
          noHp: '081233334444',
        })
      ).status,
    ).toBe(201);
  });
});
