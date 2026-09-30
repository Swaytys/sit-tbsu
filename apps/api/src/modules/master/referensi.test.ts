import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  barangAtribut,
  jenisAtribut,
  kategori,
  logAktivitas,
  merk,
  satuan,
} from '../../db/schema';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Baris = Record<string, unknown> & { id: number };

let admin: Awaited<ReturnType<typeof sesiUji>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(kategori, satuan, jenisAtribut, barang, merk);
  admin = await sesiUji('ADMIN');
});

const kirim = (path: string, body: unknown, method = 'POST') =>
  minta(path, { method, cookie: admin.cookie, body });

async function buat(path: string, body: unknown): Promise<Baris> {
  const res = await kirim(path, body);
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

/** Barang minimal langsung di database, untuk menguji aturan "sudah dipakai". */
async function barangUji(idKategori: number, idSatuan: number) {
  const [b] = await db
    .insert(barang)
    .values({ kode: 'BRG-90001', namaBarang: 'Uji', idKategori, idSatuanDasar: idSatuan })
    .returning({ id: barang.id });
  if (!b) throw new Error('barang uji gagal');
  return b.id;
}

describe('merk', () => {
  it('semua peran membaca; Admin mengelola; nama unik tanpa beda huruf besar/kecil; nonaktif tercatat', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/merk', { cookie: kasir.cookie })).status).toBe(200);
    expect(
      (await minta('/api/merk', { method: 'POST', cookie: kasir.cookie, body: { nama: 'X' } }))
        .status,
    ).toBe(403);

    const m = await buat('/api/merk', { nama: 'Gresik', keterangan: 'Semen' });
    expect(m).toMatchObject({ nama: 'Gresik', statusAktif: 'AKTIF', jumlahBarang: 0 });
    const kembar = await kirim('/api/merk', { nama: 'GRESIK' });
    expect(kembar.status).toBe(409);
    expect((await json<Galat>(kembar)).error.detail?.kolom?.nama?.[0]).toContain('sudah ada');

    await kirim(`/api/merk/${m.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    expect((await logTerakhir('MERK_NONAKTIF'))?.idEntitas).toBe(m.id);
    const aktif = await json<{ data: Baris[] }>(
      await minta('/api/merk?status=AKTIF', { cookie: admin.cookie }),
    );
    expect(aktif.data).toHaveLength(0);
  });
});

describe('kategori', () => {
  it('semua peran boleh membaca; hanya Admin/Owner yang boleh mengelola', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/kategori', { cookie: kasir.cookie })).status).toBe(200);
    const res = await minta('/api/kategori', {
      method: 'POST',
      cookie: kasir.cookie,
      body: { nama: 'X' },
    });
    expect(res.status).toBe(403);
  });

  it('nama unik tanpa membedakan huruf besar/kecil', async () => {
    await buat('/api/kategori', { nama: 'Semen' });
    const res = await kirim('/api/kategori', { nama: 'semen' });
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.detail?.kolom?.nama?.[0]).toBe(
      'Kategori "semen" sudah ada.',
    );
  });

  it('ubah tercatat di log (lama → baru); nonaktif bukan hapus', async () => {
    const k = await buat('/api/kategori', { nama: 'Cat', urutan: 1 });
    await kirim(`/api/kategori/${k.id}`, { nama: 'Cat & Pelapis', urutan: 1 }, 'PATCH');
    const log = await logTerakhir('KATEGORI_UBAH');
    expect(log?.dataLama).toEqual({ nama: 'Cat' });
    expect(log?.dataBaru).toEqual({ nama: 'Cat & Pelapis' });

    const res = await kirim(`/api/kategori/${k.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    expect((await json<{ data: Baris }>(res)).data.statusAktif).toBe('NONAKTIF');
    expect(await db.select().from(kategori).where(eq(kategori.id, k.id))).toHaveLength(1);
    expect(
      (await minta(`/api/kategori/${k.id}`, { method: 'DELETE', cookie: admin.cookie })).status,
    ).toBe(404);

    const aktif = await json<{ data: Baris[] }>(
      await minta('/api/kategori?status=AKTIF', { cookie: admin.cookie }),
    );
    expect(aktif.data).toHaveLength(0);
  });
});

describe('satuan (K-014)', () => {
  const meter = {
    kode: 'm',
    nama: 'Meter',
    jenisDimensi: 'PANJANG',
    faktorKeBasis: '1',
    isBasis: true,
  };

  it('dimensi fisik hanya satu satuan basis', async () => {
    await buat('/api/satuan', meter);
    const res = await kirim('/api/satuan', { ...meter, kode: 'yd', nama: 'Yard' });
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.pesan).toBe(
      'Dimensi panjang sudah punya satuan basis (m).',
    );
  });

  it('satuan turunan butuh satuan basis lebih dulu', async () => {
    const res = await kirim('/api/satuan', {
      kode: 'kW',
      nama: 'Kilowatt',
      jenisDimensi: 'DAYA',
      faktorKeBasis: '1000',
      isBasis: false,
    });
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.pesan).toMatch(/belum punya satuan basis/);
  });

  it('faktor boleh ditulis dengan koma; satuan basis wajib berfaktor 1', async () => {
    await buat('/api/satuan', meter);
    const cm = await buat('/api/satuan', {
      kode: 'cm',
      nama: 'Sentimeter',
      jenisDimensi: 'PANJANG',
      faktorKeBasis: '0,01',
      isBasis: false,
    });
    expect(cm.faktorKeBasis).toBe('0.010000');

    const res = await kirim('/api/satuan', {
      ...meter,
      kode: 'kg',
      jenisDimensi: 'BERAT',
      faktorKeBasis: '2',
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Satuan basis harus berfaktor 1.');
  });

  it('satuan hitung selalu basis berfaktor 1', async () => {
    const sak = await buat('/api/satuan', {
      kode: 'sak',
      nama: 'Sak',
      jenisDimensi: 'JUMLAH',
      faktorKeBasis: '1',
      isBasis: false,
    });
    expect(sak).toMatchObject({ isBasis: true, faktorKeBasis: '1.000000' });
    const res = await kirim('/api/satuan', {
      kode: 'dus',
      nama: 'Dus',
      jenisDimensi: 'JUMLAH',
      faktorKeBasis: '12',
      isBasis: true,
    });
    expect(res.status).toBe(400);
  });

  it('satuan yang dipakai barang: nama boleh diubah, dimensi/faktor tidak', async () => {
    const m = await buat('/api/satuan', meter);
    const k = await buat('/api/kategori', { nama: 'Kabel' });
    await barangUji(k.id, m.id);

    const namaOk = await kirim(`/api/satuan/${m.id}`, { ...meter, nama: 'Meter (m)' }, 'PATCH');
    expect(namaOk.status).toBe(200);
    expect((await json<{ data: Baris }>(namaOk)).data.jumlahDipakai).toBe(1);
    expect((await logTerakhir('SATUAN_UBAH'))?.dataBaru).toEqual({ nama: 'Meter (m)' });

    const ditolak = await kirim(
      `/api/satuan/${m.id}`,
      { ...meter, nama: 'Meter (m)', jenisDimensi: 'LUAS' },
      'PATCH',
    );
    expect(ditolak.status).toBe(409);
    expect((await json<Galat>(ditolak)).error.pesan).toMatch(/sudah dipakai 1 kali/);
  });
});

describe('jenis atribut', () => {
  it('kode huruf besar; atribut teks tidak boleh berdimensi', async () => {
    const warna = await buat('/api/jenis-atribut', {
      kode: 'warna',
      nama: 'Warna',
      tipeNilai: 'TEKS',
      jenisDimensi: null,
    });
    expect(warna.kode).toBe('WARNA');

    const res = await kirim('/api/jenis-atribut', {
      kode: 'MOTIF',
      nama: 'Motif',
      tipeNilai: 'TEKS',
      jenisDimensi: 'PANJANG',
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Atribut bertipe teks tidak punya dimensi.');
  });

  it('atribut yang dipakai barang: tipe dan dimensi dikunci', async () => {
    const m = await buat('/api/satuan', {
      kode: 'm',
      nama: 'Meter',
      jenisDimensi: 'PANJANG',
      faktorKeBasis: '1',
      isBasis: true,
    });
    const k = await buat('/api/kategori', { nama: 'Pipa' });
    const idBarang = await barangUji(k.id, m.id);
    const panjang = await buat('/api/jenis-atribut', {
      kode: 'PANJANG',
      nama: 'Panjang',
      tipeNilai: 'ANGKA',
      jenisDimensi: 'PANJANG',
    });
    await db
      .insert(barangAtribut)
      .values({ idBarang, idJenisAtribut: panjang.id, nilaiAngka: '4', idSatuan: m.id });

    const res = await kirim(
      `/api/jenis-atribut/${panjang.id}`,
      { kode: 'PANJANG', nama: 'Panjang', tipeNilai: 'ANGKA', jenisDimensi: 'BERAT' },
      'PATCH',
    );
    expect(res.status).toBe(409);
    expect((await json<Galat>(res)).error.pesan).toMatch(/sudah dipakai 1 barang/);
  });
});
