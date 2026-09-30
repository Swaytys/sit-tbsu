import { and, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aturKonfigurasi,
  json,
  minta,
  mintaForm,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  barangAtribut,
  hargaBarang,
  jenisAtribut,
  kategori,
  logAktivitas,
  merk,
  pemasok,
  persediaan,
  satuan,
  tingkatHarga,
} from '../../db/schema';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Baris = Record<string, unknown> & { id: number };
type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let kasir: Sesi;
let ref: {
  kategori: number;
  m: number;
  cm: number;
  kg: number;
  sak: number;
  panjang: number;
  warna: number;
  normal: number;
  grosir: number;
  distributor: number;
  pemasok: number;
  gresik: number;
  maspion: number;
  merkLama: number;
};

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(
    barangAtribut,
    hargaBarang,
    persediaan,
    barang,
    kategori,
    satuan,
    jenisAtribut,
    tingkatHarga,
    pemasok,
    merk,
  );
  await aturKonfigurasi({
    pembulatan_harga: '100',
    dasar_markup: 'HARGA_BELI_TERAKHIR',
    stok_minimum_default: '5',
  });
  const [kat] = await db.insert(kategori).values({ nama: 'Semen' }).returning();
  const s = await db
    .insert(satuan)
    .values([
      { kode: 'm', nama: 'Meter', jenisDimensi: 'PANJANG', faktorKeBasis: '1', isBasis: true },
      { kode: 'cm', nama: 'Sentimeter', jenisDimensi: 'PANJANG', faktorKeBasis: '0.01' },
      { kode: 'kg', nama: 'Kilogram', jenisDimensi: 'BERAT', faktorKeBasis: '1', isBasis: true },
      { kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
    ])
    .returning();
  const j = await db
    .insert(jenisAtribut)
    .values([
      { kode: 'PANJANG', nama: 'Panjang', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
      { kode: 'WARNA', nama: 'Warna', tipeNilai: 'TEKS', jenisDimensi: null },
    ])
    .returning();
  const t = await db
    .insert(tingkatHarga)
    .values([
      { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2 },
      { kode: 'DISTRIBUTOR', nama: 'Distributor', markupDefaultPersen: '15', urutan: 3 },
    ])
    .returning();
  const mk = await db
    .insert(merk)
    .values([{ nama: 'Gresik' }, { nama: 'Maspion' }, { nama: 'Lama', statusAktif: 'NONAKTIF' }])
    .returning();
  const [p] = await db
    .insert(pemasok)
    .values({ kode: 'PMS-00001', namaPemasok: 'CV. Titip', noHp: '081234567890' })
    .returning();
  ref = {
    kategori: kat!.id,
    m: s[0]!.id,
    cm: s[1]!.id,
    kg: s[2]!.id,
    sak: s[3]!.id,
    panjang: j[0]!.id,
    warna: j[1]!.id,
    normal: t[0]!.id,
    grosir: t[1]!.id,
    distributor: t[2]!.id,
    pemasok: p!.id,
    gresik: mk[0]!.id,
    maspion: mk[1]!.id,
    merkLama: mk[2]!.id,
  };
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
});

const kirim = (sesi: Sesi, path: string, body: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

function barangBaru(ubah: Record<string, unknown> = {}) {
  return {
    namaBarang: 'Semen Gresik 40kg',
    idKategori: ref.kategori,
    idSatuanDasar: ref.sak,
    hargaModalAwal: 41_234,
    hargaTier: [{ idTingkatHarga: ref.normal, hargaTetap: 55_000 }],
    ...ubah,
  };
}

async function buat(body: unknown): Promise<Baris> {
  const res = await kirim(admin, '/api/barang', body);
  if (res.status !== 201) throw new Error(`buat barang gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: Baris }>(res)).data;
}

async function galat(res: Response) {
  return json<Galat>(res);
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

async function hargaTier(idBarang: number, idTier: number) {
  const [h] = await db
    .select()
    .from(hargaBarang)
    .where(and(eq(hargaBarang.idBarang, idBarang), eq(hargaBarang.idTingkatHarga, idTier)));
  return h;
}

async function stokPersediaan(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return p;
}

describe('tambah barang', () => {
  it('kode otomatis, persediaan awal (L10), stok minimum bawaan, harga semua tier (K-047, H4)', async () => {
    const b = await buat(barangBaru());
    expect(b).toMatchObject({ kode: 'BRG-00001', stokMinimum: '5.000', stokFisik: '0.000' });

    const p = await stokPersediaan(b.id);
    expect(p).toMatchObject({ stokFisik: '0.000', hppRata2: 41_234, hargaBeliTerakhir: 41_234 });

    // Normal TETAP; tier lain IKUT_TIER = ceil100(41.234 × (1 + markup)).
    expect(await hargaTier(b.id, ref.normal)).toMatchObject({ metode: 'TETAP', hargaJual: 55_000 });
    expect(await hargaTier(b.id, ref.grosir)).toMatchObject({
      metode: 'IKUT_TIER',
      hargaJual: 49_500, // 49.480,8
      dasarMarkupSaatHitung: 41_234,
    });
    expect(await hargaTier(b.id, ref.distributor)).toMatchObject({ hargaJual: 47_500 }); // 47.419,1

    expect((await logTerakhir('BARANG_BUAT'))?.idEntitas).toBe(b.id);
    expect((await buat(barangBaru({ namaBarang: 'Kedua' }))).kode).toBe('BRG-00002');
  });

  it('harga tier default wajib diisi harga tetap', async () => {
    let res = await kirim(admin, '/api/barang', barangBaru({ hargaTier: undefined }));
    expect(res.status).toBe(400);
    expect((await galat(res)).error.detail?.kolom?.hargaTier).toBeDefined();

    res = await kirim(
      admin,
      '/api/barang',
      barangBaru({ hargaTier: [{ idTingkatHarga: ref.grosir, hargaTetap: 50_000 }] }),
    );
    expect(res.status).toBe(400);
    expect((await galat(res)).error.pesan).toContain('Normal');
    expect(await db.select().from(barang)).toHaveLength(0);
  });

  it('kode sendiri boleh selama unik (N5); kode BRG-nnnnn menaikkan penghitung', async () => {
    const a = await buat(barangBaru({ kode: 'smn-40' }));
    expect(a.kode).toBe('SMN-40');
    const res = await kirim(admin, '/api/barang', barangBaru({ kode: 'SMN-40' }));
    expect(res.status).toBe(409);
    expect((await galat(res)).error.detail?.kolom?.kode?.[0]).toContain('sudah dipakai');

    await buat(barangBaru({ kode: 'BRG-00050' }));
    expect((await buat(barangBaru())).kode).toBe('BRG-00051');
  });

  it('barcode unik; kategori dan satuan nonaktif tidak bisa dipilih', async () => {
    await buat(barangBaru({ barcode: '8991234567890' }));
    const res = await kirim(admin, '/api/barang', barangBaru({ barcode: '8991234567890' }));
    expect(res.status).toBe(409);
    expect((await galat(res)).error.detail?.kolom?.barcode).toBeDefined();

    await db.update(kategori).set({ statusAktif: 'NONAKTIF' }).where(eq(kategori.id, ref.kategori));
    const res2 = await kirim(admin, '/api/barang', barangBaru());
    expect(res2.status).toBe(400);
    expect((await galat(res2)).error.detail?.kolom?.idKategori).toBeDefined();
  });

  it('atribut: satuan harus sesama dimensi, teks tanpa satuan', async () => {
    const tolak = async (atribut: unknown[], kolom: string, pesan: string) => {
      const res = await kirim(admin, '/api/barang', barangBaru({ atribut }));
      expect(res.status).toBe(400);
      expect((await galat(res)).error.detail?.kolom?.[kolom]?.[0]).toContain(pesan);
    };
    await tolak(
      [{ idJenisAtribut: ref.panjang, nilai: '6', idSatuan: ref.kg }],
      'atribut.0.idSatuan',
      'bukan satuan panjang',
    );
    await tolak([{ idJenisAtribut: ref.panjang, nilai: '6' }], 'atribut.0.idSatuan', 'wajib');
    await tolak(
      [{ idJenisAtribut: ref.panjang, nilai: 'enam', idSatuan: ref.m }],
      'atribut.0.nilai',
      'harus angka',
    );
    await tolak(
      [{ idJenisAtribut: ref.warna, nilai: 'Abu', idSatuan: ref.m }],
      'atribut.0.idSatuan',
      'tanpa satuan',
    );

    const b = await buat(
      barangBaru({
        atribut: [
          { idJenisAtribut: ref.panjang, nilai: '12,5', idSatuan: ref.cm },
          { idJenisAtribut: ref.warna, nilai: 'Abu-abu' },
        ],
      }),
    );
    const detail = await json<{ data: { atribut: Baris[] } }>(
      await minta(`/api/barang/${b.id}`, { cookie: admin.cookie }),
    );
    expect(detail.data.atribut).toMatchObject([
      { kodeJenis: 'PANJANG', nilai: '12.5', kodeSatuan: 'cm' },
      { kodeJenis: 'WARNA', nilai: 'Abu-abu', kodeSatuan: null },
    ]);
  });

  it('konsinyasi: pemasok dan harga titip wajib; HPP = harga titip; D = harga titip (KS1, L10, H3)', async () => {
    const res = await kirim(admin, '/api/barang', barangBaru({ kepemilikan: 'KONSINYASI' }));
    expect(res.status).toBe(400);
    const kolom = (await galat(res)).error.detail?.kolom;
    expect(kolom?.idPemasokKonsinyasi).toBeDefined();
    expect(kolom?.hargaTitip).toBeDefined();

    const b = await buat(
      barangBaru({
        kepemilikan: 'KONSINYASI',
        idPemasokKonsinyasi: ref.pemasok,
        hargaTitip: 30_000,
      }),
    );
    expect(await stokPersediaan(b.id)).toMatchObject({ hppRata2: 30_000, hargaBeliTerakhir: 0 });
    expect(await hargaTier(b.id, ref.grosir)).toMatchObject({ hargaJual: 36_000 });
  });
});

describe('data sensitif', () => {
  it('Kasir tidak menerima harga modal, HPP, harga titip, dasar markup (aturan 6)', async () => {
    const b = await buat(
      barangBaru({
        kepemilikan: 'KONSINYASI',
        idPemasokKonsinyasi: ref.pemasok,
        hargaTitip: 30_000,
      }),
    );
    const sensitif = [
      'hargaModalAwal',
      'hargaTitip',
      'hppRata2',
      'hargaBeliTerakhir',
      'dasarMarkup',
    ];

    const daftar = await json<{ data: Baris[] }>(
      await minta('/api/barang', { cookie: kasir.cookie }),
    );
    const detail = await json<{ data: Baris }>(
      await minta(`/api/barang/${b.id}`, { cookie: kasir.cookie }),
    );
    for (const baris of [daftar.data[0]!, detail.data]) {
      for (const k of sensitif) expect(baris).not.toHaveProperty(k);
      expect(baris).toHaveProperty('harga');
    }
    const untukAdmin = await json<{ data: Baris }>(
      await minta(`/api/barang/${b.id}`, { cookie: admin.cookie }),
    );
    expect(untukAdmin.data).toMatchObject({
      hargaTitip: 30_000,
      hppRata2: 30_000,
      dasarMarkup: 30_000,
    });
  });

  it('Kasir tidak bisa menambah atau mengubah barang (403)', async () => {
    expect((await kirim(kasir, '/api/barang', barangBaru())).status).toBe(403);
    const b = await buat(barangBaru());
    expect((await kirim(kasir, `/api/barang/${b.id}`, barangBaru(), 'PATCH')).status).toBe(403);
    expect(
      (await kirim(kasir, `/api/barang/${b.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH'))
        .status,
    ).toBe(403);
  });
});

describe('ubah barang', () => {
  it('harga modal awal berubah sebelum ada mutasi: HPP awal ikut, tanda perlu tinjau (H5, K-060)', async () => {
    const b = await buat(barangBaru());
    const res = await kirim(
      admin,
      `/api/barang/${b.id}`,
      barangBaru({ hargaModalAwal: 45_000, hargaTier: undefined }),
      'PATCH',
    );
    expect(res.status).toBe(200);
    expect((await json<{ data: Baris }>(res)).data.perluTinjauHarga).toBe(true);
    expect(await stokPersediaan(b.id)).toMatchObject({
      hppRata2: 45_000,
      hargaBeliTerakhir: 45_000,
    });
    // Harga IKUT_TIER belum dihitung ulang (menunggu tinjau / simpan manual).
    expect(await hargaTier(b.id, ref.grosir)).toMatchObject({ hargaJual: 49_500 });

    // Simpan harga manual dari halaman Harga Jual: IKUT_TIER dihitung ulang, tanda lepas.
    const simpan = await kirim(
      admin,
      '/api/harga-barang',
      { perubahan: [{ idBarang: b.id, idTingkatHarga: ref.grosir, hargaTetap: null }] },
      'PUT',
    );
    expect(simpan.status).toBe(200);
    expect(await hargaTier(b.id, ref.grosir)).toMatchObject({ hargaJual: 54_000 }); // 45.000 × 1,2
    const [setelah] = await db.select().from(barang).where(eq(barang.id, b.id));
    expect(setelah?.perluTinjauHarga).toBe(false);
    expect((await logTerakhir('HARGA_UBAH'))?.ringkasan).toContain('Grosir Rp 49.500 → Rp 54.000');
  });

  it('harga titip berubah memperbarui HPP konsinyasi (L7) dan menandai tinjau', async () => {
    const b = await buat(
      barangBaru({
        kepemilikan: 'KONSINYASI',
        idPemasokKonsinyasi: ref.pemasok,
        hargaTitip: 30_000,
      }),
    );
    await kirim(
      admin,
      `/api/barang/${b.id}`,
      barangBaru({
        kepemilikan: 'KONSINYASI',
        idPemasokKonsinyasi: ref.pemasok,
        hargaTitip: 32_000,
        hargaTier: undefined,
      }),
      'PATCH',
    );
    expect((await stokPersediaan(b.id))?.hppRata2).toBe(32_000);
    const log = await logTerakhir('BARANG_UBAH');
    expect(log?.dataBaru).toMatchObject({ hargaTitip: 32_000, persediaan: { hppRata2: 32_000 } });
  });

  it('kepemilikan dikunci selama ada stok (KS1); satuan dasar & modal awal dikunci setelah mutasi', async () => {
    const b = await buat(barangBaru());
    // Susun keadaan: barang sudah punya stok dari mutasi (ledger dibangun Fase 4).
    await db
      .update(persediaan)
      .set({ stokFisik: '10.000', terakhirMutasi: new Date() })
      .where(eq(persediaan.idBarang, b.id));

    const cek = async (ubah: Record<string, unknown>, kolom: string) => {
      const res = await kirim(
        admin,
        `/api/barang/${b.id}`,
        barangBaru({ hargaTier: undefined, ...ubah }),
        'PATCH',
      );
      expect(res.status).toBe(409);
      expect((await galat(res)).error.detail?.kolom?.[kolom]).toBeDefined();
    };
    await cek(
      { kepemilikan: 'KONSINYASI', idPemasokKonsinyasi: ref.pemasok, hargaTitip: 1 },
      'kepemilikan',
    );
    await cek({ idSatuanDasar: ref.kg }, 'idSatuanDasar');
    await cek({ hargaModalAwal: 1 }, 'hargaModalAwal');

    // Data lain tetap bisa diubah.
    const res = await kirim(
      admin,
      `/api/barang/${b.id}`,
      barangBaru({ hargaTier: undefined, namaBarang: 'Semen Gresik 50kg' }),
      'PATCH',
    );
    expect(res.status).toBe(200);
  });

  it('log ubah hanya mencatat kolom berubah; nonaktif bukan hapus', async () => {
    const b = await buat(barangBaru());
    await kirim(
      admin,
      `/api/barang/${b.id}`,
      barangBaru({ idMerk: ref.gresik, hargaTier: undefined }),
      'PATCH',
    );
    const log = await logTerakhir('BARANG_UBAH');
    expect(log?.dataLama).toEqual({ idMerk: null });
    expect(log?.dataBaru).toEqual({ idMerk: ref.gresik });

    await kirim(admin, `/api/barang/${b.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    expect((await logTerakhir('BARANG_NONAKTIF'))?.idEntitas).toBe(b.id);
    const aktif = await json<{ meta: { total: number } }>(
      await minta('/api/barang?status=AKTIF', { cookie: admin.cookie }),
    );
    expect(aktif.meta.total).toBe(0);
    expect(await db.select().from(barang)).toHaveLength(1);
  });

  it('cari kode/nama/barcode/merk, saring kategori, merk, dan perlu tinjau', async () => {
    await buat(barangBaru({ idMerk: ref.gresik, barcode: '899111' }));
    const b = await buat(barangBaru({ namaBarang: 'Pipa PVC 3/4', idMerk: ref.maspion }));
    await db.update(barang).set({ perluTinjauHarga: true }).where(eq(barang.id, b.id));
    const cari = async (q: string) =>
      json<{ data: Baris[]; meta: { total: number } }>(
        await minta(`/api/barang?${q}`, { cookie: kasir.cookie }),
      );
    expect((await cari('cari=maspion')).data.map((x) => x.namaBarang)).toEqual(['Pipa PVC 3/4']);
    expect((await cari('cari=899111')).meta.total).toBe(1);
    expect((await cari('cari=brg-00002')).meta.total).toBe(1);
    expect((await cari(`idKategori=${ref.kategori}`)).meta.total).toBe(2);
    expect((await cari('perluTinjau=true')).data.map((x) => x.id)).toEqual([b.id]);
    expect((await cari(`idMerk=${ref.maspion}`)).data.map((x) => x.namaMerk)).toEqual(['Maspion']);

    // Merk nonaktif tidak bisa dipilih untuk barang.
    const res = await kirim(admin, '/api/barang', barangBaru({ idMerk: ref.merkLama }));
    expect(res.status).toBe(400);
    expect((await galat(res)).error.detail?.kolom?.idMerk).toBeDefined();
  });
});

describe('harga jual dan tier', () => {
  it('simpan massal: tier default tidak boleh ikut tier; Kasir ditolak; log HARGA_UBAH', async () => {
    const b = await buat(barangBaru());
    const put = (sesi: Sesi, perubahan: unknown[]) =>
      kirim(sesi, '/api/harga-barang', { perubahan }, 'PUT');

    expect(
      (await put(kasir, [{ idBarang: b.id, idTingkatHarga: ref.grosir, hargaTetap: 1 }])).status,
    ).toBe(403);
    const tolak = await put(admin, [
      { idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: null },
    ]);
    expect(tolak.status).toBe(400);

    const res = await put(admin, [
      { idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: 56_000 },
      { idBarang: b.id, idTingkatHarga: ref.grosir, hargaTetap: 52_000 },
    ]);
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 2,
    });
    expect(await hargaTier(b.id, ref.grosir)).toMatchObject({ metode: 'TETAP', hargaJual: 52_000 });
    expect((await logTerakhir('HARGA_UBAH'))?.ringkasan).toContain('Normal Rp 55.000 → Rp 56.000');
  });

  it('tier baru mendapat harga IKUT_TIER untuk semua barang (H2)', async () => {
    const b = await buat(barangBaru());
    const res = await kirim(admin, '/api/tingkat-harga', {
      kode: 'member',
      nama: 'Member',
      markupDefaultPersen: '10',
      urutan: 4,
    });
    expect(res.status).toBe(201);
    const tier = (await json<{ data: Baris }>(res)).data;
    expect(tier).toMatchObject({ kode: 'MEMBER', markupDefaultPersen: '10.00' });
    expect(await hargaTier(b.id, tier.id)).toMatchObject({
      metode: 'IKUT_TIER',
      hargaJual: 45_400,
    });
    expect(
      (await kirim(kasir, '/api/tingkat-harga', { kode: 'X', nama: 'X', markupDefaultPersen: '1' }))
        .status,
    ).toBe(403);
  });

  it('markup tier berubah menandai barang IKUT_TIER di tier itu (H5); tier default tidak bisa nonaktif (H1)', async () => {
    const ikut = await buat(barangBaru());
    const tetap = await buat(
      barangBaru({
        namaBarang: 'Harga tetap semua',
        hargaTier: [
          { idTingkatHarga: ref.normal, hargaTetap: 55_000 },
          { idTingkatHarga: ref.grosir, hargaTetap: 53_000 },
        ],
      }),
    );
    const res = await kirim(
      admin,
      `/api/tingkat-harga/${ref.grosir}`,
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '22,5', urutan: 2 },
      'PATCH',
    );
    expect(res.status).toBe(200);
    const tanda = await db.select({ id: barang.id, t: barang.perluTinjauHarga }).from(barang);
    expect(tanda.find((x) => x.id === ikut.id)?.t).toBe(true);
    expect(tanda.find((x) => x.id === tetap.id)?.t).toBe(false);
    expect((await logTerakhir('TIER_UBAH'))?.ringkasan).toContain('1 barang ditandai');

    const nonaktif = await kirim(
      admin,
      `/api/tingkat-harga/${ref.normal}/status`,
      { statusAktif: 'NONAKTIF' },
      'PATCH',
    );
    expect(nonaktif.status).toBe(409);
  });
});

describe('gambar barang', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it('unggah PNG, dilayani untuk semua peran; berkas bukan gambar ditolak; hapus gambar', async () => {
    const b = await buat(barangBaru());
    const form = new FormData();
    form.set('berkas', new File([PNG], 'semen.png', { type: 'image/png' }));
    const res = await mintaForm(`/api/barang/${b.id}/gambar`, form, admin.cookie);
    expect(res.status).toBe(200);
    const url = (await json<{ data: { gambar: string } }>(res)).data.gambar;
    expect(url).toMatch(new RegExp(`^/api/barang/${b.id}/gambar\\?v=`));

    const ambil = await minta(url, { cookie: kasir.cookie });
    expect(ambil.status).toBe(200);
    expect(ambil.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await ambil.arrayBuffer())).toEqual(PNG);

    const palsu = new FormData();
    palsu.set('berkas', new File(['<script>'], 'gambar.png', { type: 'image/png' }));
    const tolak = await mintaForm(`/api/barang/${b.id}/gambar`, palsu, admin.cookie);
    expect(tolak.status).toBe(400);
    expect((await galat(tolak)).error.pesan).toContain('JPG, PNG, atau WebP');
    expect((await mintaForm(`/api/barang/${b.id}/gambar`, form, kasir.cookie)).status).toBe(403);

    const hapus = await minta(`/api/barang/${b.id}/gambar`, {
      method: 'DELETE',
      cookie: admin.cookie,
    });
    expect((await json<{ data: Baris }>(hapus)).data.gambar).toBeNull();
    expect((await minta(url, { cookie: admin.cookie })).status).toBe(404);
  });
});
