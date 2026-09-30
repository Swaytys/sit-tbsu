import ExcelJS from 'exceljs';
import { count, eq } from 'drizzle-orm';
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
  pemasok,
  persediaan,
  satuan,
  tingkatHarga,
} from '../../db/schema';

type Hasil = {
  baris: { nomorBaris: number; kode: string | null; status: string; pesan: string[] }[];
  ringkasan: { total: number; siap: number; dilewati: number; galat: number; disimpan: number };
  disimpan: boolean;
};
type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;

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
  );
  await aturKonfigurasi({ pembulatan_harga: '100', stok_minimum_default: '5' });
  await db.insert(kategori).values([{ nama: 'Semen' }, { nama: 'Pipa' }]);
  await db.insert(satuan).values([
    { kode: 'm', nama: 'Meter', jenisDimensi: 'PANJANG', faktorKeBasis: '1', isBasis: true },
    { kode: 'cm', nama: 'Sentimeter', jenisDimensi: 'PANJANG', faktorKeBasis: '0.01' },
    { kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
    { kode: 'batang', nama: 'Batang', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
  ]);
  await db.insert(jenisAtribut).values([
    { kode: 'PANJANG', nama: 'Panjang', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
    { kode: 'WARNA', nama: 'Warna', tipeNilai: 'TEKS', jenisDimensi: null },
  ]);
  await db.insert(tingkatHarga).values([
    { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
    { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2 },
  ]);
  await db
    .insert(pemasok)
    .values({ kode: 'PMS-00001', namaPemasok: 'CV. Titip', noHp: '081234567890' });
  admin = await sesiUji('ADMIN');
});

async function templat(): Promise<ExcelJS.Workbook> {
  const res = await minta('/api/import/barang/templat', { cookie: admin.cookie });
  expect(res.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

/** Templat dari API diisi baris data mulai baris 3. */
async function berkas(baris: Record<string, string | number>[]): Promise<File> {
  const wb = await templat();
  const ws = wb.getWorksheet('Barang')!;
  const kolom = new Map<string, number>();
  ws.getRow(1).eachCell((c, i) => kolom.set(c.text, i));
  baris.forEach((isi, i) => {
    const row = ws.getRow(3 + i);
    for (const [k, v] of Object.entries(isi)) {
      const idx = kolom.get(k);
      if (idx === undefined) throw new Error(`kolom ${k} tidak ada di templat`);
      row.getCell(idx).value = v;
    }
  });
  const isi = await wb.xlsx.writeBuffer();
  return new File([new Uint8Array(isi)], 'barang.xlsx');
}

async function kirim(path: string, f: File) {
  const form = new FormData();
  form.set('berkas', f);
  return mintaForm(path, form, admin.cookie);
}

const SEMEN = {
  nama_barang: 'Semen Gresik 40kg',
  kategori: 'semen',
  satuan_dasar: 'sak',
  harga_modal_awal: 41234,
  harga_NORMAL: 55000,
};

describe('templat import', () => {
  it('berisi kolom tier dan atribut aktif, lembar referensi; hanya pemegang izin import', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/import/barang/templat', { cookie: kasir.cookie })).status).toBe(403);

    const wb = await templat();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Barang', 'Referensi', 'Petunjuk']);
    const kunci: string[] = [];
    wb.getWorksheet('Barang')!
      .getRow(1)
      .eachCell((c) => kunci.push(c.text));
    expect(kunci).toEqual(
      expect.arrayContaining(['nama_barang', 'harga_NORMAL', 'harga_GROSIR', 'atribut_PANJANG']),
    );
    expect(wb.getWorksheet('Referensi')!.getColumn(1).values).toEqual(
      expect.arrayContaining(['Kategori', 'Pipa', 'Semen']),
    );
  });
});

describe('pratinjau dan simpan import', () => {
  it('pratinjau melaporkan siap, dilewati, galat tanpa menyimpan apa pun', async () => {
    // Barang lama dengan kode BRG-00001.
    const lama = await kirim(
      '/api/import/barang',
      await berkas([{ ...SEMEN, kode: 'BRG-00001', nama_barang: 'Semen lama' }]),
    );
    expect(lama.status).toBe(200);

    const f = await berkas([
      { ...SEMEN, atribut_PANJANG: '12,5 cm', atribut_WARNA: 'Abu' },
      { ...SEMEN, kode: 'BRG-00001', nama_barang: 'Semen baru' },
      { ...SEMEN, kategori: 'Keramik' },
      { ...SEMEN, kode: 'X-1' },
      { ...SEMEN, kode: 'X-1', nama_barang: 'Kembar' },
      { ...SEMEN, harga_NORMAL: '' },
      { ...SEMEN, atribut_PANJANG: '6' },
      { ...SEMEN, harga_modal_awal: 1000.5 },
    ]);
    const res = await kirim('/api/import/barang/pratinjau', f);
    expect(res.status).toBe(200);
    const { data } = await json<{ data: Hasil }>(res);
    expect(data.disimpan).toBe(false);
    expect(data.baris.map((b) => b.status)).toEqual([
      'SIAP',
      'DILEWATI',
      'GALAT',
      'SIAP',
      'GALAT',
      'GALAT',
      'GALAT',
      'GALAT',
    ]);
    expect(data.baris[0]?.nomorBaris).toBe(3);
    const pesan = data.baris.map((b) => b.pesan.join(' '));
    expect(pesan[2]).toContain('Kategori "Keramik" tidak ditemukan');
    expect(pesan[4]).toContain('Kode sama dengan baris 6');
    expect(pesan[5]).toContain('tier default');
    expect(pesan[6]).toContain('angka dan satuan');
    expect(pesan[7]).toContain('rupiah bulat');
    expect(data.ringkasan).toMatchObject({ total: 8, siap: 2, dilewati: 1, galat: 5 });

    // Tidak ada yang tersimpan; penghitung kode tidak ikut naik.
    const [jumlah] = await db.select({ n: count() }).from(barang);
    expect(jumlah?.n).toBe(1);
    const baru = await kirim('/api/import/barang', await berkas([SEMEN]));
    expect((await json<{ data: Hasil }>(baru)).data.baris[0]?.kode).toBe('BRG-00002');
  });

  it('simpan ditolak bila masih ada galat; tidak ada yang tersimpan', async () => {
    const res = await kirim(
      '/api/import/barang',
      await berkas([SEMEN, { ...SEMEN, satuan_dasar: 'kodi' }]),
    );
    expect(res.status).toBe(400);
    const galat = await json<{ error: { pesan: string; detail: { hasil: Hasil } } }>(res);
    expect(galat.error.pesan).toContain('1 baris bergalat');
    expect(galat.error.detail.hasil.baris[1]?.pesan[0]).toContain('Satuan "kodi"');
    expect(await db.select().from(barang)).toHaveLength(0);
  });

  it('20 barang tersimpan dalam satu transaksi dengan persediaan, harga, dan log; kode lama dilewati', async () => {
    await kirim('/api/import/barang', await berkas([{ ...SEMEN, kode: 'LAMA-1' }]));
    const isi = Array.from({ length: 20 }, (_, i) => ({
      ...SEMEN,
      nama_barang: `Pipa PVC ${i + 1}`,
      kategori: 'Pipa',
      satuan_dasar: 'batang',
      harga_modal_awal: 20000 + i,
      harga_NORMAL: 30000,
      stok_minimum: '2,5',
      atribut_PANJANG: '4 m',
    }));
    const res = await kirim(
      '/api/import/barang',
      await berkas([...isi, { ...SEMEN, kode: 'LAMA-1', nama_barang: 'Ganti?' }]),
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: Hasil }>(res);
    expect(data.disimpan).toBe(true);
    expect(data.ringkasan).toMatchObject({ disimpan: 20, dilewati: 1, galat: 0 });
    expect(data.baris[0]?.kode).toBe('BRG-00001');

    expect(await db.select().from(barang)).toHaveLength(21);
    expect(await db.select().from(persediaan)).toHaveLength(21);
    const [pertama] = await db.select().from(barang).where(eq(barang.kode, 'BRG-00001'));
    expect(pertama).toMatchObject({ namaBarang: 'Pipa PVC 1', stokMinimum: '2.500' });
    const harga = await db.select().from(hargaBarang).where(eq(hargaBarang.idBarang, pertama!.id));
    expect(harga.map((h) => h.hargaJual).sort()).toEqual([24000, 30000]); // ceil100(20.000 × 1,2)
    const [lama] = await db.select().from(barang).where(eq(barang.kode, 'LAMA-1'));
    expect(lama?.namaBarang).toBe('Semen Gresik 40kg');

    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'IMPORT_BARANG'))
      .orderBy(logAktivitas.id);
    expect(log?.ringkasan).toContain('1 ditambahkan'); // import pertama (LAMA-1)
    const buat = await db.select().from(logAktivitas).where(eq(logAktivitas.aksi, 'BARANG_BUAT'));
    expect(buat).toHaveLength(21);
  });

  it('berkas bukan xlsx atau tanpa kolom wajib ditolak', async () => {
    const teks = await kirim('/api/import/barang/pratinjau', new File(['kode,nama'], 'a.xlsx'));
    expect(teks.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(teks)).error.pesan).toContain('.xlsx');

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Barang').getRow(1).values = ['kode', 'nama'];
    const polos = new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'polos.xlsx');
    const res = await kirim('/api/import/barang/pratinjau', polos);
    expect(res.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(res)).error.pesan).toContain('nama_barang');
  });
});

describe('ekspor harga jual', () => {
  it('menghasilkan Excel harga per tier untuk barang aktif', async () => {
    await kirim('/api/import/barang', await berkas([SEMEN]));
    const res = await minta('/api/harga-barang/ekspor', { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/harga-jual-\d{4}-\d{2}-\d{2}\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(1).values).toEqual(
      expect.arrayContaining(['Kode', 'Dasar markup', 'Harga Normal', 'Metode Grosir']),
    );
    expect(ws.getRow(2).values).toEqual(
      expect.arrayContaining(['BRG-00001', 41234, 55000, 'Tetap', 49500, 'Ikut tier']),
    );
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/harga-barang/ekspor', { cookie: kasir.cookie })).status).toBe(403);
  });
});
