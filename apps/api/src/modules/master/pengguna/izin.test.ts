import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { logAktivitas, pengguna } from '../../../db/schema';

/*
 * K-243: izin per akun dan peran khusus. Hanya Owner yang mengatur; izin khusus Owner tidak bisa diberikan;
 * perubahan langsung berlaku pada sesi yang sedang berjalan (izin dihitung ulang tiap permintaan).
 */

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Saya = { data: { izin: string[]; namaPeranKustom: string | null } };
type Baris = {
  id: number;
  idPeranKustom: number | null;
  namaPeranKustom: string | null;
  izinTambah: string[];
  izinCabut: string[];
};

let owner: Awaited<ReturnType<typeof sesiUji>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  owner = await sesiUji('OWNER');
});

const SJ = 'penjualan.surat_jalan.kelola';

const aturIzin = (id: number, body: unknown, cookie = owner.cookie) =>
  minta(`/api/pengguna/${id}/izin`, { method: 'PUT', cookie, body });
const buatPeran = (body: unknown, cookie = owner.cookie) =>
  minta('/api/pengguna/peran-kustom', { method: 'POST', cookie, body });
const izinSaya = async (cookie: string) =>
  (await json<Saya>(await minta('/api/auth/saya', { cookie }))).data;
const daftarRit = (cookie: string) => minta('/api/perjalanan', { cookie }).then((r) => r.status);

async function barisPengguna(id: number): Promise<Baris | undefined> {
  const r = await minta('/api/pengguna?ukuran=100', { cookie: owner.cookie });
  return (await json<{ data: Baris[] }>(r)).data.find((p) => p.id === id);
}

describe('izin per akun (K-243)', () => {
  it('kasir bawaan tanpa pengantaran; Owner memberi lalu mencabut, berlaku pada sesi yang sama', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await izinSaya(kasir.cookie)).izin).not.toContain(SJ);
    expect(await daftarRit(kasir.cookie)).toBe(403);

    expect((await aturIzin(kasir.pengguna.id, { izinTambah: [SJ], izinCabut: [] })).status).toBe(
      200,
    );
    expect((await izinSaya(kasir.cookie)).izin).toContain(SJ);
    expect(await daftarRit(kasir.cookie)).toBe(200);

    // Cabut izin bawaan: kasir tidak lagi bisa melihat piutang.
    expect(
      (
        await aturIzin(kasir.pengguna.id, {
          izinTambah: [],
          izinCabut: ['penjualan.piutang.lihat'],
        })
      ).status,
    ).toBe(200);
    const saya = await izinSaya(kasir.cookie);
    expect(saya.izin).not.toContain(SJ);
    expect(saya.izin).not.toContain('penjualan.piutang.lihat');
    expect((await minta('/api/piutang', { cookie: kasir.cookie })).status).toBe(403);

    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGGUNA_IZIN_UBAH'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('dicabut: penjualan.piutang.lihat');
    expect(log?.idPengguna).toBe(owner.pengguna.id);
  });

  it('penyesuaian dirapikan: tambah yang sudah dimiliki dan cabut yang tidak dimiliki diabaikan', async () => {
    const kasir = await sesiUji('KASIR');
    await aturIzin(kasir.pengguna.id, {
      izinTambah: ['penjualan.checkout', SJ],
      izinCabut: ['master.barang.kelola'],
    });
    const b = await barisPengguna(kasir.pengguna.id);
    expect(b?.izinTambah).toEqual([SJ]);
    expect(b?.izinCabut).toEqual([]);
  });

  it('izin khusus Owner dan izin tak dikenal ditolak; akun Owner tidak diatur', async () => {
    const kepala = await sesiUji('ADMIN');
    for (const i of ['sistem.izin.atur', 'sistem.data.kelola', 'pembelian.setujui_semua']) {
      const r = await aturIzin(kepala.pengguna.id, { izinTambah: [i], izinCabut: [] });
      expect(r.status).toBe(400);
      expect((await json<Galat>(r)).error.detail?.kolom?.izinTambah?.[0]).toContain(
        'Izin khusus Owner',
      );
    }
    const asing = await aturIzin(kepala.pengguna.id, { izinTambah: ['apa.saja'], izinCabut: [] });
    expect(asing.status).toBe(400);
    expect((await json<Galat>(asing)).error.pesan).toContain('tidak dikenal');

    const owner2 = await sesiUji('OWNER');
    expect((await aturIzin(owner2.pengguna.id, { izinTambah: [], izinCabut: [] })).status).toBe(
      409,
    );
  });

  it('hanya Owner: Administrator Sistem dan Kepala Toko ditolak 403 (lihat daftar peran khusus boleh bagi pengelola akun)', async () => {
    const kasir = await sesiUji('KASIR');
    for (const peran of ['ADMIN_SISTEM', 'ADMIN'] as const) {
      const s = await sesiUji(peran);
      expect(
        (await aturIzin(kasir.pengguna.id, { izinTambah: [SJ], izinCabut: [] }, s.cookie)).status,
      ).toBe(403);
      expect(
        (
          await buatPeran(
            { nama: 'Kasir Antar', peranDasar: 'KASIR', izinTambah: [], izinCabut: [] },
            s.cookie,
          )
        ).status,
      ).toBe(403);
    }
    const sistem = await sesiUji('ADMIN_SISTEM');
    expect((await minta('/api/pengguna/peran-kustom', { cookie: sistem.cookie })).status).toBe(200);
    expect((await minta('/api/pengguna/peran-kustom', { cookie: kasir.cookie })).status).toBe(403);
  });

  it('peran diganti: peran khusus dan penyesuaian izin dikosongkan', async () => {
    const kasir = await sesiUji('KASIR');
    await aturIzin(kasir.pengguna.id, { izinTambah: [SJ], izinCabut: ['laporan.ekspor'] });
    const r = await minta(`/api/pengguna/${kasir.pengguna.id}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: {
        namaPengguna: kasir.pengguna.namaPengguna,
        username: kasir.pengguna.username,
        peran: 'STAF_PENJUALAN',
      },
    });
    expect(r.status).toBe(200);
    const [b] = await db.select().from(pengguna).where(eq(pengguna.id, kasir.pengguna.id));
    expect(b?.izinTambah).toEqual([]);
    expect(b?.izinCabut).toEqual([]);
    expect(b?.idPeranKustom).toBeNull();
  });
});

describe('peran khusus (K-243)', () => {
  it('buat, pasang ke akun berperan dasar sama, nonaktif mengembalikan izin bawaan', async () => {
    const r = await buatPeran({
      nama: 'Kasir Pengantaran',
      peranDasar: 'KASIR',
      keterangan: 'Kasir yang juga mengatur rit',
      izinTambah: [SJ, 'penjualan.checkout'],
      izinCabut: ['laporan.ekspor'],
    });
    expect(r.status).toBe(201);
    const peran = (await json<{ data: { id: number; izinTambah: string[] } }>(r)).data;
    expect(peran.izinTambah).toEqual([SJ]);

    const ganda = await buatPeran({
      nama: 'kasir pengantaran',
      peranDasar: 'KASIR',
      izinTambah: [],
      izinCabut: [],
    });
    expect(ganda.status).toBe(409);

    const kasir = await sesiUji('KASIR');
    const staf = await sesiUji('STAF_PENJUALAN');
    const beda = await aturIzin(staf.pengguna.id, {
      idPeranKustom: peran.id,
      izinTambah: [],
      izinCabut: [],
    });
    expect(beda.status).toBe(400);
    expect((await json<Galat>(beda)).error.pesan).toContain('berdasar Kasir');

    expect(
      (
        await aturIzin(kasir.pengguna.id, {
          idPeranKustom: peran.id,
          izinTambah: [],
          izinCabut: [],
        })
      ).status,
    ).toBe(200);
    let saya = await izinSaya(kasir.cookie);
    expect(saya.namaPeranKustom).toBe('Kasir Pengantaran');
    expect(saya.izin).toContain(SJ);
    expect(saya.izin).not.toContain('laporan.ekspor');
    expect(await daftarRit(kasir.cookie)).toBe(200);
    expect((await barisPengguna(kasir.pengguna.id))?.namaPeranKustom).toBe('Kasir Pengantaran');

    // Peran dasar tidak bisa diganti selama dipakai.
    const ubahDasar = await minta(`/api/pengguna/peran-kustom/${peran.id}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: {
        nama: 'Kasir Pengantaran',
        peranDasar: 'STAF_PENJUALAN',
        izinTambah: [],
        izinCabut: [],
      },
    });
    expect(ubahDasar.status).toBe(400);

    // Nonaktif: akun kembali ke izin bawaan Kasir.
    const nonaktif = await minta(`/api/pengguna/peran-kustom/${peran.id}/status`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: { statusAktif: 'NONAKTIF' },
    });
    expect(nonaktif.status).toBe(200);
    saya = await izinSaya(kasir.cookie);
    expect(saya.namaPeranKustom).toBeNull();
    expect(saya.izin).not.toContain(SJ);
    expect(saya.izin).toContain('laporan.ekspor');
    expect(await daftarRit(kasir.cookie)).toBe(403);

    // Peran nonaktif tidak bisa dipasang ke akun baru.
    const kasir2 = await sesiUji('KASIR');
    expect(
      (
        await aturIzin(kasir2.pengguna.id, {
          idPeranKustom: peran.id,
          izinTambah: [],
          izinCabut: [],
        })
      ).status,
    ).toBe(400);
  });

  it('peran khusus tidak bisa berdasar Owner dan tidak bisa memuat izin khusus Owner', async () => {
    expect(
      (await buatPeran({ nama: 'Wakil Owner', peranDasar: 'OWNER', izinTambah: [], izinCabut: [] }))
        .status,
    ).toBe(400);
    const r = await buatPeran({
      nama: 'Kepala Plus',
      peranDasar: 'ADMIN',
      izinTambah: ['sistem.data.kelola'],
      izinCabut: [],
    });
    expect(r.status).toBe(400);
    expect((await json<Galat>(r)).error.pesan).toContain('Izin khusus Owner');
  });
});
