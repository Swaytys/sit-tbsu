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
  merk,
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
type Baca = {
  namaBerkas: string;
  kolom: { kunci: string; jenis: string; wajib: boolean }[];
  baris: { nomorBaris: number; nilai: Record<string, string> }[];
  peringatan: string[];
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
    merk,
  );
  await aturKonfigurasi({ pembulatan_harga: '100', stok_minimum_default: '5' });
  await db.insert(kategori).values([{ nama: 'Semen' }, { nama: 'Pipa' }]);
  await db.insert(merk).values([{ nama: 'Gresik' }, { nama: 'Maspion' }]);
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

async function unduh(path: string): Promise<ExcelJS.Workbook> {
  const res = await minta(path, { cookie: admin.cookie });
  expect(res.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

function kunciBaris1(ws: ExcelJS.Worksheet): string[] {
  const kunci: string[] = [];
  ws.getRow(1).eachCell((c) => kunci.push(c.text));
  return kunci;
}

/** Templat lengkap dari API diisi baris data mulai baris 3. */
async function berkas(baris: Record<string, string | number>[]): Promise<File> {
  const wb = await unduh('/api/import/barang/templat?jenis=lengkap');
  const ws = wb.getWorksheet('Barang')!;
  const kolom = new Map(kunciBaris1(ws).map((k, i) => [k, i + 1]));
  baris.forEach((isi, i) => {
    const row = ws.getRow(3 + i);
    for (const [k, v] of Object.entries(isi)) {
      const idx = kolom.get(k);
      if (idx === undefined) throw new Error(`kolom ${k} tidak ada di templat`);
      row.getCell(idx).value = v;
    }
  });
  return new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'barang.xlsx');
}

async function baca(f: File): Promise<Baca> {
  const form = new FormData();
  form.set('berkas', f);
  const res = await mintaForm('/api/import/barang/baca', form, admin.cookie);
  if (res.status !== 200) throw new Error(`baca gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: Baca }>(res)).data;
}

const proses = (path: string, body: unknown) =>
  minta(path, { method: 'POST', cookie: admin.cookie, body });

async function pratinjau(b: Baca, kodeLain: string[] = []): Promise<Hasil> {
  const res = await proses('/api/import/barang/pratinjau', { ...b, kodeLain });
  expect(res.status).toBe(200);
  return (await json<{ data: Hasil }>(res)).data;
}

const SEMEN = {
  nama_barang: 'Semen Gresik 40kg',
  kategori: 'semen',
  merk: 'Gresik',
  satuan_dasar: 'sak',
  harga_modal_awal: 41234,
  harga_normal: 55000,
};

describe('templat dan ekspor', () => {
  it('ringkas dan lengkap; kolom wajib ditandai; validasi sel; lembar Contoh vertikal', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/import/barang/templat', { cookie: kasir.cookie })).status).toBe(403);

    const ringkas = await unduh('/api/import/barang/templat');
    expect(kunciBaris1(ringkas.getWorksheet('Barang')!)).toEqual([
      'kode',
      'nama_barang',
      'kategori',
      'merk',
      'satuan_dasar',
      'stok_minimum',
      'harga_modal_awal',
      'harga_normal',
    ]);

    const wb = await unduh('/api/import/barang/templat?jenis=lengkap');
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Barang', 'Referensi', 'Contoh', 'Petunjuk']);
    const ws = wb.getWorksheet('Barang')!;
    const kunci = kunciBaris1(ws);
    expect(kunci).toEqual(
      expect.arrayContaining(['harga_normal', 'atribut_panjang', 'atribut_warna']),
    );
    expect(kunci).not.toContain('status');
    // K-098: harga tier lain selalu markup tier, tidak ada kolomnya.
    expect(kunci).not.toContain('harga_grosir');
    const kol = (k: string) => ws.getColumn(kunci.indexOf(k) + 1).letter;
    expect(ws.getCell(`${kol('harga_modal_awal')}3`).dataValidation.type).toBe('whole');
    expect(ws.getCell(`${kol('kategori')}3`).dataValidation.type).toBe('list');
    expect(ws.getCell(`${kol('merk')}3`).dataValidation.type).toBe('list');

    const contoh = wb.getWorksheet('Contoh')!;
    expect(contoh.getRow(1).values).toEqual(expect.arrayContaining(['Kolom', 'Contoh 1']));
    const barisContoh = contoh.getColumn(1).values.filter(Boolean);
    expect(barisContoh).toEqual(expect.arrayContaining(['nama_barang', 'harga_normal', 'status']));
  });

  it('ekspor data barang bisa dibaca ulang; semua kode sudah ada sehingga dilewati', async () => {
    const f = await berkas([
      { ...SEMEN, kode: 'SMN-1', atribut_panjang: '12,5 cm', atribut_warna: 'Abu' },
      {
        ...SEMEN,
        kode: 'PIPA-1',
        nama_barang: 'Pipa',
        kategori: 'Pipa',
        merk: 'Maspion',
        harga_normal: 60000,
      },
    ]);
    expect((await proses('/api/import/barang', await baca(f))).status).toBe(200);

    const wb = await unduh('/api/import/barang/ekspor');
    const ws = wb.getWorksheet('Barang')!;
    const kunci = kunciBaris1(ws);
    expect(kunci).toContain('status');
    const sel = (baris: number, k: string) => ws.getRow(baris).getCell(kunci.indexOf(k) + 1).value;
    expect(sel(3, 'kode')).toBe('PIPA-1');
    expect(sel(3, 'harga_normal')).toBe(60000);
    expect(kunci).not.toContain('harga_grosir');
    expect(sel(4, 'atribut_panjang')).toBe('12,5 cm');
    expect(sel(4, 'merk')).toBe('Gresik');

    const bolakBalik = await pratinjau(
      await baca(new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'ekspor.xlsx')),
    );
    expect(bolakBalik.ringkasan).toMatchObject({ total: 2, dilewati: 2, galat: 0 });

    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/import/barang/ekspor', { cookie: kasir.cookie })).status).toBe(403);
  });
});

describe('baca, pratinjau, sunting, simpan', () => {
  it('baca: baris petunjuk dan kosong dilewati; kolom tak dikenal diberi peringatan', async () => {
    const wb = await unduh('/api/import/barang/templat?jenis=lengkap');
    const ws = wb.getWorksheet('Barang')!;
    ws.getCell('A1').value = 'kode';
    const kosong = ws.columnCount + 1;
    ws.getRow(1).getCell(kosong).value = 'harga_member';
    // Templat lama: kolom harga tier selain tier dasar diabaikan dengan penjelasan (K-098).
    ws.getRow(1).getCell(kosong + 1).value = 'harga_grosir';
    const kunci = kunciBaris1(ws);
    ws.getRow(3).getCell(kunci.indexOf('nama_barang') + 1).value = 'Paku';
    ws.getRow(3).getCell(kunci.indexOf('stok_minimum') + 1).value = 2.5;
    ws.getRow(5).getCell(kunci.indexOf('nama_barang') + 1).value = 'Kawat';
    const hasil = await baca(new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'x.xlsx'));
    expect(hasil.baris.map((b) => b.nomorBaris)).toEqual([3, 5]);
    expect(hasil.baris[0]?.nilai).toEqual({ nama_barang: 'Paku', stok_minimum: '2,5' });
    expect(hasil.peringatan[0]).toContain('harga_member');
    expect(hasil.peringatan[1]).toBe(
      'Kolom "harga_grosir" diabaikan: harga Grosir dihitung otomatis dari markup tier untuk semua barang.',
    );
    expect(hasil.kolom.find((k) => k.kunci === 'kategori')).toMatchObject({
      jenis: 'KATEGORI',
      wajib: true,
    });
  });

  it('pratinjau melaporkan siap/dilewati/galat tanpa menyimpan; baris bergalat bisa disunting lalu diperiksa ulang', async () => {
    const lama = await baca(
      await berkas([{ ...SEMEN, kode: 'BRG-00001', nama_barang: 'Semen lama' }]),
    );
    expect((await proses('/api/import/barang', lama)).status).toBe(200);

    const b = await baca(
      await berkas([
        { ...SEMEN, atribut_panjang: '12,5 cm', atribut_warna: 'Abu' },
        { ...SEMEN, kode: 'BRG-00001', nama_barang: 'Semen baru' },
        { ...SEMEN, kategori: 'Keramik', merk: 'Tanpa' },
        { ...SEMEN, kode: 'X-1' },
        { ...SEMEN, kode: 'X-1', nama_barang: 'Kembar' },
        { ...SEMEN, harga_normal: '', harga_modal_awal: '' },
        { ...SEMEN, atribut_panjang: '6' },
        { ...SEMEN, harga_modal_awal: '1000,5' },
      ]),
    );
    const data = await pratinjau(b);
    expect(data.baris.map((x) => x.status)).toEqual([
      'SIAP',
      'DILEWATI',
      'GALAT',
      'SIAP',
      'GALAT',
      'SIAP', // K-095: harga Normal dan modal kosong = harga menunggu penerimaan pertama
      'GALAT',
      'GALAT',
    ]);
    const pesan = data.baris.map((x) => x.pesan.join(' '));
    expect(pesan[2]).toContain('Kategori "Keramik" tidak ditemukan');
    expect(pesan[2]).toContain('Merk "Tanpa" tidak ditemukan');
    expect(pesan[2]).not.toContain('wajib dipilih');
    expect(pesan[4]).toContain('Kode sama dengan baris 6');
    expect(pesan[6]).toContain('angka dan satuan');
    expect(pesan[7]).toContain('rupiah bulat');
    const [jumlah] = await db.select({ n: count() }).from(barang);
    expect(jumlah?.n).toBe(1);

    // Sunting baris kategori salah; periksa ulang hanya baris itu (kode baris lain dikirim untuk cek ganda).
    const disunting = {
      ...b.baris[2]!,
      nilai: { ...b.baris[2]!.nilai, kategori: 'Pipa', merk: '' },
    };
    const ulang = await pratinjau({ ...b, baris: [disunting] }, ['X-1']);
    expect(ulang.baris[0]).toMatchObject({ nomorBaris: 5, status: 'SIAP' });
    const kembar = await pratinjau({ ...b, baris: [b.baris[4]!] }, ['X-1']);
    expect(kembar.baris[0]?.pesan[0]).toContain('baris lain');

    // Penghitung kode tidak ikut naik oleh pratinjau.
    const baru = await proses('/api/import/barang', await baca(await berkas([SEMEN])));
    expect((await json<{ data: Hasil }>(baru)).data.baris[0]?.kode).toBe('BRG-00002');
  });

  it('simpan ditolak bila masih ada galat; tidak ada yang tersimpan', async () => {
    const b = await baca(await berkas([SEMEN, { ...SEMEN, satuan_dasar: 'kodi' }]));
    const res = await proses('/api/import/barang', b);
    expect(res.status).toBe(400);
    const galat = await json<{ error: { pesan: string; detail: { hasil: Hasil } } }>(res);
    expect(galat.error.pesan).toContain('1 baris bergalat');
    expect(galat.error.detail.hasil.baris[1]?.pesan[0]).toContain('Satuan "kodi"');
    expect(await db.select().from(barang)).toHaveLength(0);
  });

  it('20 barang tersimpan dalam satu transaksi dengan persediaan, harga, log; kode lama dilewati; status nonaktif', async () => {
    await proses('/api/import/barang', await baca(await berkas([{ ...SEMEN, kode: 'LAMA-1' }])));
    const isi = Array.from({ length: 20 }, (_, i) => ({
      ...SEMEN,
      nama_barang: `Pipa PVC ${i + 1}`,
      kategori: 'Pipa',
      merk: 'Maspion',
      satuan_dasar: 'batang',
      harga_modal_awal: 20000 + i,
      harga_normal: 30000,
      stok_minimum: '2,5',
      atribut_panjang: '4 m',
      ...(i === 19 ? { kode: 'PIPA-LAMA' } : {}),
    }));
    const b = await baca(
      await berkas([...isi, { ...SEMEN, kode: 'LAMA-1', nama_barang: 'Ganti?' }]),
    );
    // Kolom status tidak ada di templat; tambahkan lewat baris JSON (seperti berkas hasil ekspor).
    b.baris[19]!.nilai.status = 'NONAKTIF';
    const res = await proses('/api/import/barang', b);
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
    expect(harga.map((h) => h.hargaJual).sort()).toEqual([24000, 30000]);
    const [nonaktif] = await db.select().from(barang).where(eq(barang.kode, 'PIPA-LAMA'));
    expect(nonaktif?.statusAktif).toBe('NONAKTIF');
    const [lama] = await db.select().from(barang).where(eq(barang.kode, 'LAMA-1'));
    expect(lama?.namaBarang).toBe('Semen Gresik 40kg');
    const buat = await db.select().from(logAktivitas).where(eq(logAktivitas.aksi, 'BARANG_BUAT'));
    expect(buat).toHaveLength(21);
  });

  it('berkas bukan xlsx atau tanpa kolom wajib ditolak saat dibaca', async () => {
    const form = new FormData();
    form.set('berkas', new File(['kode,nama'], 'a.xlsx'));
    const teks = await mintaForm('/api/import/barang/baca', form, admin.cookie);
    expect(teks.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(teks)).error.pesan).toContain('.xlsx');

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Barang').getRow(1).values = ['kode', 'nama'];
    const form2 = new FormData();
    form2.set('berkas', new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'polos.xlsx'));
    const res = await mintaForm('/api/import/barang/baca', form2, admin.cookie);
    expect(res.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(res)).error.pesan).toContain('nama_barang');
  });
});

describe('ekspor harga jual', () => {
  it('menghasilkan Excel harga per tier untuk barang aktif', async () => {
    await proses('/api/import/barang', await baca(await berkas([SEMEN])));
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
