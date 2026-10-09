import { and, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aturKonfigurasi,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  barangAtribut,
  hargaBarang,
  kategori,
  logAktivitas,
  mutasiPersediaan,
  pembayaranPemasok,
  pemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  persediaan,
  satuan,
  tingkatHarga,
} from '../../db/schema';

/*
 * Harga jual Fase 9 (docs/06 H3–H7, H12; K-086): metode MARKUP per barang, hitung ulang saat simpan,
 * pemicu perubahan dasar, harga otomatis (naik langsung, turun ditinjau), dan Tinjau Harga.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Baris = Record<string, unknown> & { id: number };

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let ref: { kategori: number; sak: number; normal: number; grosir: number; distributor: number };
let idPemasok: number;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(
    mutasiPersediaan,
    pembayaranPemasok,
    penerimaanBarangDetail,
    penerimaanBarang,
    barangAtribut,
    hargaBarang,
    persediaan,
    barang,
    kategori,
    satuan,
    tingkatHarga,
    pemasok,
  );
  await aturKonfigurasi({ pembulatan_harga: '100', dasar_markup: 'HARGA_BELI_TERAKHIR' });
  const [kat] = await db.insert(kategori).values({ nama: 'Semen' }).returning();
  const [sak] = await db
    .insert(satuan)
    .values({ kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true })
    .returning();
  const t = await db
    .insert(tingkatHarga)
    .values([
      { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
      { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2 },
      { kode: 'DISTRIBUTOR', nama: 'Distributor', markupDefaultPersen: '15', urutan: 3 },
    ])
    .returning();
  const [p] = await db
    .insert(pemasok)
    .values({ kode: 'PMS-00001', namaPemasok: 'CV. Semen Jaya', noHp: '081234567890' })
    .returning();
  idPemasok = p!.id;
  ref = {
    kategori: kat!.id,
    sak: sak!.id,
    normal: t[0]!.id,
    grosir: t[1]!.id,
    distributor: t[2]!.id,
  };
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
});

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

let nomorBarang = 0;
function barangBaru(ubah: Record<string, unknown> = {}) {
  return {
    namaBarang: `Barang uji ${++nomorBarang}`,
    idKategori: ref.kategori,
    idSatuanDasar: ref.sak,
    hargaModalAwal: 10_000,
    hargaTier: [{ idTingkatHarga: ref.normal, hargaTetap: 15_000 }],
    // Barang uji "biasa" (ditinjau dulu); K-094 menjadikan barang baru otomatis bila tidak dikirim.
    hargaOtomatis: false,
    ...ubah,
  };
}

async function buat(ubah: Record<string, unknown> = {}): Promise<Baris> {
  const res = await kirim(admin, '/api/barang', barangBaru(ubah));
  if (res.status !== 201) throw new Error(`buat barang gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: Baris }>(res)).data;
}

async function ubahBarang(b: Baris, ubah: Record<string, unknown>) {
  const res = await kirim(
    admin,
    `/api/barang/${b.id}`,
    {
      ...barangBaru({ namaBarang: b.namaBarang, hargaTier: undefined, hargaOtomatis: undefined }),
      ...ubah,
    },
    'PATCH',
  );
  if (res.status !== 200) throw new Error(`ubah barang gagal (${res.status}): ${await res.text()}`);
}

async function terima(baris: { idBarang: number; harga: number }[], ubah = {}) {
  return kirim(admin, '/api/penerimaan', {
    idPemasok,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TUNAI',
    baris: baris.map((b) => ({ idBarang: b.idBarang, qtyMasuk: '10', hargaModalMasuk: b.harga })),
    ...ubah,
  });
}

async function terimaBerhasil(baris: { idBarang: number; harga: number }[]): Promise<string> {
  const res = await terima(baris);
  if (res.status !== 201) throw new Error(`penerimaan gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: { nomor: string } }>(res)).data.nomor;
}

const putHarga = (perubahan: unknown[], sesi = admin) =>
  kirim(sesi, '/api/harga-barang', { perubahan }, 'PUT');

async function harga(idBarang: number, idTier: number) {
  const [h] = await db
    .select()
    .from(hargaBarang)
    .where(and(eq(hargaBarang.idBarang, idBarang), eq(hargaBarang.idTingkatHarga, idTier)));
  return h!;
}

async function tanda(idBarang: number): Promise<boolean> {
  const [b] = await db.select().from(barang).where(eq(barang.id, idBarang));
  return b!.perluTinjauHarga;
}

async function logTerakhir(aksi: string, idEntitas?: number) {
  const [baris] = await db
    .select()
    .from(logAktivitas)
    .where(
      and(
        eq(logAktivitas.aksi, aksi),
        idEntitas === undefined ? undefined : eq(logAktivitas.idEntitas, idEntitas),
      ),
    )
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return baris;
}

describe('metode harga (H4, H12)', () => {
  it('MARKUP per barang dihitung dari D; markup dan margin hanya untuk lihat_hpp', async () => {
    const b = await buat({
      hargaModalAwal: 41_234,
      hargaTier: [{ idTingkatHarga: ref.normal, hargaTetap: 55_000 }],
    });
    const res = await putHarga([
      { idBarang: b.id, idTingkatHarga: ref.grosir, hargaTetap: null, markupPersen: '18,5' },
    ]);
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 1,
    });
    expect(await harga(b.id, ref.grosir)).toMatchObject({
      metode: 'MARKUP',
      markupPersen: '18.50',
      hargaTetap: null,
      hargaJual: 48_900, // 41.234 × 1,185 = 48.862,29 → ke atas kelipatan 100
      dasarMarkupSaatHitung: 41_234,
    });
    expect((await logTerakhir('HARGA_UBAH'))?.ringkasan).toContain(
      'Grosir Rp 49.500 → Rp 48.900 (markup 18,5%)',
    );

    type Detail = { harga: Record<string, unknown>[] };
    const lihat = async (sesi: Sesi) =>
      (await json<{ data: Detail }>(await minta(`/api/barang/${b.id}`, { cookie: sesi.cookie })))
        .data.harga;
    const hargaAdmin = await lihat(admin);
    expect(hargaAdmin.find((h) => h.idTingkatHarga === ref.grosir)).toMatchObject({
      metode: 'MARKUP',
      markupPersen: '18.50',
      margin: 15.68, // (48.900 − 41.234) ÷ 48.900
    });
    expect(hargaAdmin.find((h) => h.idTingkatHarga === ref.normal)?.margin).toBe(25.03);
    for (const h of await lihat(kasir)) {
      expect(h).not.toHaveProperty('markupPersen');
      expect(h).not.toHaveProperty('margin');
    }
  });

  it('harga tetap dan markup sekaligus ditolak; tier default boleh markup, tetapi tidak Rp 0 (K-094)', async () => {
    const b = await buat();
    expect(
      (
        await putHarga([
          { idBarang: b.id, idTingkatHarga: ref.grosir, hargaTetap: 50_000, markupPersen: '10' },
        ])
      ).status,
    ).toBe(400);
    // Normal ikut markup sendiri 30% dari modal 10.000.
    const res = await putHarga([
      { idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: null, markupPersen: '30' },
    ]);
    expect(res.status).toBe(200);
    expect(await harga(b.id, ref.normal)).toMatchObject({ metode: 'MARKUP', hargaJual: 13_000 });

    // Tanpa harga modal, Normal ikut tier akan Rp 0: ditolak dengan pesan yang menunjuk modal.
    const tanpaModal = await kirim(
      admin,
      '/api/barang',
      barangBaru({ hargaModalAwal: 0, hargaTier: [] }),
    );
    expect(tanpaModal.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(tanpaModal)).error.pesan).toContain(
      'harga modal belum diisi',
    );
  });

  it('simpan manual menghitung ulang SEMUA baris markup barang itu dengan D terkini (K-060 #4)', async () => {
    const b = await buat({
      hargaModalAwal: 41_234,
      hargaTier: [
        { idTingkatHarga: ref.normal, hargaTetap: 55_000 },
        { idTingkatHarga: ref.grosir, hargaTetap: null, markupPersen: '18.5' },
      ],
    });
    await ubahBarang(b, { hargaModalAwal: 45_000 });
    expect(await tanda(b.id)).toBe(true);
    expect((await harga(b.id, ref.distributor)).hargaJual).toBe(47_500); // belum dihitung ulang

    const res = await putHarga([
      { idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: 56_000 },
    ]);
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 3,
    });
    expect(await harga(b.id, ref.grosir)).toMatchObject({ hargaJual: 53_400 }); // 45.000 × 1,185
    expect(await harga(b.id, ref.distributor)).toMatchObject({
      metode: 'IKUT_TIER',
      hargaJual: 51_800, // 45.000 × 1,15 = 51.750
      dasarMarkupSaatHitung: 45_000,
    });
    expect(await tanda(b.id)).toBe(false);
  });

  it('dasar saat hitung diperbarui walau harga hasil pembulatan sama', async () => {
    const b = await buat({
      hargaModalAwal: 41_234,
      hargaTier: [{ idTingkatHarga: ref.normal, hargaTetap: 55_000 }],
    });
    await ubahBarang(b, { hargaModalAwal: 41_250 });
    const res = await putHarga([
      { idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: 55_000 },
    ]);
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 0,
    });
    expect(await harga(b.id, ref.distributor)).toMatchObject({
      hargaJual: 47_500, // 41.250 × 1,15 = 47.437,5 → tetap 47.500
      dasarMarkupSaatHitung: 41_250,
    });
    expect(await tanda(b.id)).toBe(false);
  });

  it('H3 dasar HPP rata-rata dan pembulatan kelipatan 500', async () => {
    await aturKonfigurasi({ dasar_markup: 'HPP_RATA2', pembulatan_harga: '500' });
    const b = await buat();
    expect((await harga(b.id, ref.grosir)).hargaJual).toBe(12_000);
    expect((await harga(b.id, ref.distributor)).hargaJual).toBe(11_500);

    await terimaBerhasil([{ idBarang: b.id, harga: 12_000 }]);
    expect(await tanda(b.id)).toBe(true); // D 10.000 (modal awal) → 12.000
    await terimaBerhasil([{ idBarang: b.id, harga: 13_000 }]);
    const detail = (
      await json<{ data: Baris }>(await minta(`/api/barang/${b.id}`, { cookie: admin.cookie }))
    ).data;
    expect(detail).toMatchObject({
      hppRata2: 12_500,
      hargaBeliTerakhir: 13_000,
      dasarMarkup: 12_500,
    });

    await putHarga([{ idBarang: b.id, idTingkatHarga: ref.normal, hargaTetap: 15_000 }]);
    expect((await harga(b.id, ref.grosir)).hargaJual).toBe(15_000); // 12.500 × 1,2
    expect((await harga(b.id, ref.distributor)).hargaJual).toBe(14_500); // 14.375 → kelipatan 500
  });
});

describe('pemicu dasar dan harga otomatis (H5, H7, K-086)', () => {
  it('penerimaan: barang biasa ditandai; barang otomatis naik langsung, harga tetap tidak berubah', async () => {
    const biasa = await buat();
    const oto = await buat({ hargaOtomatis: true });
    expect(oto).toMatchObject({ hargaOtomatis: true });
    const nomor = await terimaBerhasil([
      { idBarang: biasa.id, harga: 11_000 },
      { idBarang: oto.id, harga: 11_000 },
    ]);

    expect(await tanda(biasa.id)).toBe(true);
    expect((await harga(biasa.id, ref.grosir)).hargaJual).toBe(12_000);

    expect(await tanda(oto.id)).toBe(false);
    expect(await harga(oto.id, ref.grosir)).toMatchObject({
      hargaJual: 13_200,
      dasarMarkupSaatHitung: 11_000,
    });
    expect((await harga(oto.id, ref.distributor)).hargaJual).toBe(12_700); // 12.650
    expect((await harga(oto.id, ref.normal)).hargaJual).toBe(15_000); // tetap tidak pernah otomatis
    const log = await logTerakhir('HARGA_UBAH', oto.id);
    expect(log).toMatchObject({ nomorDokumen: nomor });
    expect(log?.ringkasan).toContain(
      `Harga otomatis ${String(oto.namaBarang)} (penerimaan ${nomor})`,
    );
    expect(log?.ringkasan).toContain('Grosir Rp 12.000 → Rp 13.200 (ikut tier)');
  });

  it('barang otomatis: harga turun tidak diterapkan dan ditandai; harga Normal di bawah usulan ditandai', async () => {
    const turun = await buat({ hargaOtomatis: true });
    await terimaBerhasil([{ idBarang: turun.id, harga: 9_000 }]);
    expect((await harga(turun.id, ref.grosir)).hargaJual).toBe(12_000);
    expect(await tanda(turun.id)).toBe(true);

    const normalRendah = await buat({
      hargaOtomatis: true,
      hargaTier: [{ idTingkatHarga: ref.normal, hargaTetap: 12_600 }],
    });
    await terimaBerhasil([{ idBarang: normalRendah.id, harga: 11_000 }]);
    expect((await harga(normalRendah.id, ref.grosir)).hargaJual).toBe(13_200); // naik diterapkan
    expect((await harga(normalRendah.id, ref.normal)).hargaJual).toBe(12_600); // usulan 13.800
    expect(await tanda(normalRendah.id)).toBe(true);
  });

  it('markup tier berubah: barang biasa ditandai, barang otomatis naik; turun ditandai', async () => {
    const biasa = await buat();
    const oto = await buat({ hargaOtomatis: true });
    const ubahTier = (markup: string) =>
      kirim(
        admin,
        `/api/tingkat-harga/${ref.grosir}`,
        { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: markup, urutan: 2 },
        'PATCH',
      );

    expect((await ubahTier('25')).status).toBe(200);
    expect(await tanda(biasa.id)).toBe(true);
    expect((await harga(biasa.id, ref.grosir)).hargaJual).toBe(12_000);
    expect((await harga(oto.id, ref.grosir)).hargaJual).toBe(12_500);
    expect(await tanda(oto.id)).toBe(false);
    expect((await logTerakhir('TIER_UBAH'))?.ringkasan).toContain(
      '1 barang ditandai perlu tinjau harga; harga otomatis 1 barang naik',
    );

    await ubahTier('22');
    expect((await harga(oto.id, ref.grosir)).hargaJual).toBe(12_500); // usulan 12.200 tidak diterapkan
    expect(await tanda(oto.id)).toBe(true);
  });

  it('menyalakan harga otomatis langsung menerapkan kenaikan dan melepas tanda', async () => {
    const b = await buat();
    await ubahBarang(b, { hargaModalAwal: 11_000 });
    expect(await tanda(b.id)).toBe(true);
    expect((await harga(b.id, ref.grosir)).hargaJual).toBe(12_000);

    await ubahBarang(b, { hargaModalAwal: 11_000, hargaOtomatis: true });
    expect((await harga(b.id, ref.grosir)).hargaJual).toBe(13_200);
    expect((await harga(b.id, ref.distributor)).hargaJual).toBe(12_700);
    expect(await tanda(b.id)).toBe(false);
    expect((await logTerakhir('BARANG_UBAH'))?.dataBaru).toMatchObject({ hargaOtomatis: true });
    expect((await logTerakhir('HARGA_UBAH', b.id))?.ringkasan).toContain(
      'harga otomatis dinyalakan',
    );
  });

  it('K-094: barang baru otomatis dan Normal ikut markup; sakelar dari halaman Harga Jual', async () => {
    // Tanpa hargaOtomatis dan tanpa harga tier: semua tier ikut markup, harga otomatis nyala.
    const b = await buat({ hargaTier: undefined, hargaOtomatis: undefined });
    const [baru] = await db.select().from(barang).where(eq(barang.id, b.id));
    expect(baru!.hargaOtomatis).toBe(true);
    expect(await harga(b.id, ref.normal)).toMatchObject({
      metode: 'IKUT_TIER',
      hargaJual: 12_500,
    });

    // Harga beli naik: Normal ikut naik langsung (25% dari 12.000 = 15.000).
    await terimaBerhasil([{ idBarang: b.id, harga: 12_000 }]);
    expect((await harga(b.id, ref.normal)).hargaJual).toBe(15_000);

    // Matikan dari halaman Harga Jual: kenaikan berikutnya hanya menandai.
    const otomatis = (idBarang: number[], hargaOtomatis: boolean, sesi = admin) =>
      kirim(sesi, '/api/harga-barang/otomatis', { idBarang, hargaOtomatis }, 'PUT');
    expect((await otomatis([b.id], false, kasir)).status).toBe(403);
    expect((await otomatis([b.id], false)).status).toBe(200);
    expect((await logTerakhir('BARANG_UBAH', b.id))?.ringkasan).toContain('dimatikan');
    await terimaBerhasil([{ idBarang: b.id, harga: 14_000 }]);
    expect((await harga(b.id, ref.normal)).hargaJual).toBe(15_000);
    expect(await tanda(b.id)).toBe(true);

    // Nyalakan lagi: kenaikan langsung diterapkan dan tanda lepas.
    const res = await otomatis([b.id], true);
    expect((await json<{ data: { jumlahBarang: number } }>(res)).data.jumlahBarang).toBe(1);
    expect((await harga(b.id, ref.normal)).hargaJual).toBe(17_500);
    expect(await tanda(b.id)).toBe(false);
  });

  it('tier diaktifkan kembali: baris markup lama dihitung ulang dengan D terkini', async () => {
    const b = await buat();
    const status = (s: string) =>
      kirim(admin, `/api/tingkat-harga/${ref.distributor}/status`, { statusAktif: s }, 'PATCH');
    expect((await status('NONAKTIF')).status).toBe(200);
    await ubahBarang(b, { hargaModalAwal: 20_000 });
    expect((await harga(b.id, ref.distributor)).hargaJual).toBe(11_500); // baris tier nonaktif tetap ada

    expect((await status('AKTIF')).status).toBe(200);
    expect(await harga(b.id, ref.distributor)).toMatchObject({
      hargaJual: 23_000,
      dasarMarkupSaatHitung: 20_000,
    });
    expect((await logTerakhir('TIER_AKTIFKAN'))?.ringkasan).toContain('1 harga dihitung ulang');
  });

  it('pembulatan di Pengaturan berubah: barang berformula ditandai, otomatis dihitung ulang', async () => {
    const biasa = await buat({ hargaModalAwal: 10_100 }); // Grosir 12.200, Distributor 11.700
    const oto = await buat({ hargaModalAwal: 10_100, hargaOtomatis: true });
    const tetap = await buat({
      hargaModalAwal: 10_100,
      hargaTier: [
        { idTingkatHarga: ref.normal, hargaTetap: 15_000 },
        { idTingkatHarga: ref.grosir, hargaTetap: 13_000 },
        { idTingkatHarga: ref.distributor, hargaTetap: 12_500 },
      ],
    });
    type Pengaturan = { harga: Record<string, unknown> };
    const p = (
      await json<{ data: Pengaturan }>(await minta('/api/pengaturan', { cookie: admin.cookie }))
    ).data;
    const res = await kirim(
      admin,
      '/api/pengaturan',
      { harga: { ...p.harga, pembulatanHarga: 500 } },
      'PATCH',
    );
    expect(res.status).toBe(200);

    expect(await tanda(biasa.id)).toBe(true);
    expect((await harga(biasa.id, ref.grosir)).hargaJual).toBe(12_200);
    expect(await tanda(tetap.id)).toBe(false);
    expect((await harga(oto.id, ref.grosir)).hargaJual).toBe(12_500); // 12.120 → kelipatan 500
    expect((await harga(oto.id, ref.distributor)).hargaJual).toBe(12_000);
    expect(await tanda(oto.id)).toBe(false);
    expect((await logTerakhir('PENGATURAN_UBAH'))?.ringkasan).toContain(
      '1 barang perlu tinjau harga; harga otomatis 1 barang naik',
    );
  });

  it('penerimaan gagal setelah harga otomatis dihitung: semuanya batal (satu transaksi)', async () => {
    const oto = await buat({ hargaOtomatis: true });
    // Bayar tunai dari laci tanpa shift terbuka ditolak SETELAH mutasi dan harga diproses.
    const res = await terima([{ idBarang: oto.id, harga: 11_000 }], { metodeBayar: 'TUNAI' });
    expect(res.status).toBe(409);
    expect((await harga(oto.id, ref.grosir)).hargaJual).toBe(12_000);
    expect(await logTerakhir('HARGA_UBAH', oto.id)).toBeUndefined();
  });
});

describe('Tinjau Harga (H6, K-086)', () => {
  type BarisTinjau = {
    id: number;
    dasarBaru: number;
    tier: (Record<string, unknown> & { idTingkatHarga: number })[];
  };
  const daftar = async (sesi = admin) => minta('/api/harga-barang/tinjau', { cookie: sesi.cookie });

  async function siapkan() {
    const a = await buat({
      hargaTier: [
        { idTingkatHarga: ref.normal, hargaTetap: 15_000 },
        { idTingkatHarga: ref.distributor, hargaTetap: null, markupPersen: '10' },
      ],
    });
    const tetapGrosir = await buat({
      hargaTier: [
        { idTingkatHarga: ref.normal, hargaTetap: 15_000 },
        { idTingkatHarga: ref.grosir, hargaTetap: 13_000 },
      ],
    });
    const tenang = await buat();
    const nonaktif = await buat();
    await terimaBerhasil([
      { idBarang: a.id, harga: 12_500 },
      { idBarang: tetapGrosir.id, harga: 12_500 },
      { idBarang: nonaktif.id, harga: 12_500 },
    ]);
    await kirim(admin, `/api/barang/${nonaktif.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH');
    return { a, tetapGrosir, tenang, nonaktif };
  }

  it('daftar hanya barang aktif bertanda; usulan per metode, Normal diusulkan, tetap lain tidak', async () => {
    const { a, tetapGrosir } = await siapkan();
    const res = await daftar();
    expect(res.status).toBe(200);
    const { data, meta } = await json<{ data: BarisTinjau[]; meta: { total: number } }>(res);
    expect(meta.total).toBe(2);
    expect(data.map((b) => b.id).sort()).toEqual([a.id, tetapGrosir.id].sort());

    const barisA = data.find((b) => b.id === a.id)!;
    expect(barisA.dasarBaru).toBe(12_500);
    const tierA = (id: number) => barisA.tier.find((t) => t.idTingkatHarga === id);
    expect(tierA(ref.normal)).toMatchObject({
      metode: 'TETAP',
      markupPersen: '25.00',
      hargaSekarang: 15_000,
      dasarLama: null,
      hargaUsulan: 15_700, // 12.500 × 1,25 = 15.625
      marginSekarang: 16.67, // (15.000 − 12.500) ÷ 15.000
      marginUsulan: 20.38,
    });
    expect(tierA(ref.grosir)).toMatchObject({
      metode: 'IKUT_TIER',
      hargaSekarang: 12_000,
      dasarLama: 10_000,
      hargaUsulan: 15_000,
    });
    expect(tierA(ref.distributor)).toMatchObject({
      metode: 'MARKUP',
      markupPersen: '10.00',
      hargaSekarang: 11_000,
      hargaUsulan: 13_800, // 13.750
    });
    const barisTetap = data.find((b) => b.id === tetapGrosir.id)!;
    expect(barisTetap.tier.find((t) => t.idTingkatHarga === ref.grosir)).toMatchObject({
      metode: 'TETAP',
      hargaSekarang: 13_000,
      hargaUsulan: null,
    });
  });

  it('terapkan: harga dan dasar diperbarui, tanda lepas, log; tier default opsional', async () => {
    const { a, tetapGrosir } = await siapkan();
    const terapkan = (body: unknown) => kirim(admin, '/api/harga-barang/tinjau/terapkan', body);

    let res = await terapkan({
      barang: [{ idBarang: a.id, dasar: 12_500 }],
      termasukTierDefault: false,
    });
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 2,
    });
    expect((await harga(a.id, ref.normal)).hargaJual).toBe(15_000);
    expect(await harga(a.id, ref.grosir)).toMatchObject({
      hargaJual: 15_000,
      dasarMarkupSaatHitung: 12_500,
    });
    expect((await harga(a.id, ref.distributor)).hargaJual).toBe(13_800);
    expect(await tanda(a.id)).toBe(false);
    expect((await logTerakhir('HARGA_TINJAU_TERAPKAN', a.id))?.ringkasan).toContain(
      'Grosir Rp 12.000 → Rp 15.000 (ikut tier)',
    );

    res = await terapkan({ barang: [{ idBarang: tetapGrosir.id, dasar: 12_500 }] });
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 2,
    });
    expect(await harga(tetapGrosir.id, ref.normal)).toMatchObject({
      metode: 'TETAP',
      hargaTetap: 15_700,
      hargaJual: 15_700,
    });
    expect((await harga(tetapGrosir.id, ref.grosir)).hargaJual).toBe(13_000); // tetap tanpa usulan
  });

  it('dasar berubah sejak halaman dimuat → 409 tanpa perubahan', async () => {
    const { a } = await siapkan();
    const res = await kirim(admin, '/api/harga-barang/tinjau/terapkan', {
      barang: [{ idBarang: a.id, dasar: 12_000 }],
    });
    expect(res.status).toBe(409);
    expect((await harga(a.id, ref.grosir)).hargaJual).toBe(12_000);
    expect(await tanda(a.id)).toBe(true);
  });

  it('abaikan: tanda lepas tanpa mengubah harga; log', async () => {
    const { a } = await siapkan();
    const res = await kirim(admin, '/api/harga-barang/tinjau/abaikan', { idBarang: [a.id] });
    expect((await json<{ data: unknown }>(res)).data).toEqual({
      jumlahBarang: 1,
      jumlahPerubahan: 0,
    });
    expect(await tanda(a.id)).toBe(false);
    expect((await harga(a.id, ref.grosir)).hargaJual).toBe(12_000);
    expect(await logTerakhir('HARGA_TINJAU_ABAIKAN', a.id)).toBeDefined();
  });

  it('Staf dan Kasir ditolak (403) di daftar, terapkan, dan abaikan', async () => {
    const { a } = await siapkan();
    for (const sesi of [staf, kasir]) {
      expect((await daftar(sesi)).status).toBe(403);
      expect(
        (
          await kirim(sesi, '/api/harga-barang/tinjau/terapkan', {
            barang: [{ idBarang: a.id, dasar: 12_500 }],
          })
        ).status,
      ).toBe(403);
      expect(
        (await kirim(sesi, '/api/harga-barang/tinjau/abaikan', { idBarang: [a.id] })).status,
      ).toBe(403);
    }
    expect(await tanda(a.id)).toBe(true);
  });
});
