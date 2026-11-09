import { desc, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, mintaForm, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  logAktivitas,
  mutasiPersediaan,
  penjualan,
  penjualanDetail,
  persediaan,
} from '../../db/schema';
import { dalamTransaksi } from '../../lib/transaksi';
import { tanggalOperasional } from '../../lib/waktu';
import { catatMutasi, hitungUlangCache } from './ledger';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Detail = {
  id: number;
  nomor: string;
  status: string;
  jenis: string;
  baris: Record<string, unknown>[];
};
type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(penjualanDetail, penjualan);
  m = await siapkanMasterPersediaan();
  admin = await sesiUji('ADMIN');
});

const kirim = (path: string, body?: unknown, method = 'POST', sesi = admin) =>
  minta(`/api/penyesuaian${path}`, { method, cookie: sesi.cookie, body });

async function ok(res: Response | Promise<Response>): Promise<Detail> {
  const r = await res;
  if (r.status >= 300) throw new Error(`gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: Detail }>(r)).data;
}

const baris = (idBarang: number, isi: Record<string, unknown>) => ({ idBarang, ...isi });

async function draf(jenis: string, rows: unknown[], ubah: Record<string, unknown> = {}) {
  return ok(kirim('', { jenis, baris: rows, ...ubah }));
}

async function selesai(id: number) {
  return ok(kirim(`/${id}/selesai`));
}

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return p!;
}

async function saldoAwal(idBarang: number, qty: string, hpp: number) {
  const d = await draf('SALDO_AWAL', [baris(idBarang, { qtyFisik: qty, hppSatuan: hpp })]);
  return selesai(d.id);
}

describe('penyesuaian stok (docs/05 §12)', () => {
  it('A1 draf tidak mengubah stok; bisa diubah selama DRAFT; selesai/batal final', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await kirim('', { jenis: 'KOREKSI', baris: [] }, 'POST', kasir)).status).toBe(403);

    const tanpaAlasan = await kirim('', {
      jenis: 'KOREKSI',
      baris: [baris(m.semen, { qtySelisih: '5' })],
    });
    expect((await json<Galat>(tanpaAlasan)).error.detail?.kolom?.alasan).toBeDefined();

    const d = await draf('KOREKSI', [baris(m.semen, { qtySelisih: '5' })], {
      alasan: 'Salah hitung',
    });
    expect(d.nomor).toMatch(/^ADJ-\d{6}-001$/);
    expect(d.status).toBe('DRAFT');
    expect((await stok(m.semen)).stokFisik).toBe('0.000');

    const ubah = await ok(
      kirim(
        `/${d.id}`,
        { jenis: 'KOREKSI', alasan: 'Salah hitung', baris: [baris(m.pasir, { qtySelisih: '2' })] },
        'PUT',
      ),
    );
    expect(ubah.baris).toHaveLength(1);
    expect(ubah.baris[0]).toMatchObject({ namaBarang: 'Pasir', qtySelisih: '2.000' });
    const gantiJenis = await kirim(`/${d.id}`, { jenis: 'RUSAK', baris: [] }, 'PUT');
    expect(gantiJenis.status).toBe(400);

    await selesai(d.id);
    expect((await stok(m.pasir)).stokFisik).toBe('2.000');
    const lagi = await kirim(`/${d.id}/selesai`);
    expect((await json<Galat>(lagi)).error.kode).toBe('STATUS_TIDAK_VALID');
    expect((await kirim(`/${d.id}/batal`)).status).toBe(409);

    const dibatal = await draf('KOREKSI', [baris(m.semen, { qtySelisih: '9' })], { alasan: 'x' });
    expect((await ok(kirim(`/${dibatal.id}/batal`))).status).toBe('BATAL');
    expect((await stok(m.semen)).stokFisik).toBe('0.000');
  });

  it('A2/A7 saldo awal: mutasi SALDO_AWAL, HPP rata-rata dari nilai input, boleh menambah; konsinyasi = harga titip', async () => {
    await saldoAwal(m.semen, '10', 9500);
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '10.000', hppRata2: 9500 });
    await saldoAwal(m.semen, '10', 10500);
    // A7: saldo awal mengubah HPP lewat L4, tidak mengubah harga beli terakhir.
    expect(await stok(m.semen)).toMatchObject({
      stokFisik: '20.000',
      hppRata2: 10000,
      hargaBeliTerakhir: 9000,
    });
    const titip = await saldoAwal(m.titip, '3', 1);
    expect(titip.baris[0]).toMatchObject({ hppSatuan: 30000 });
    expect((await stok(m.titip)).hppRata2).toBe(30000);

    const salah = await kirim('', {
      jenis: 'SALDO_AWAL',
      baris: [baris(m.pasir, { qtyFisik: '0' })],
    });
    const kolom = (await json<Galat>(salah)).error.detail?.kolom;
    expect(kolom?.baris).toBeDefined();
    const mati = await kirim('', {
      jenis: 'SALDO_AWAL',
      baris: [baris(m.mati, { qtyFisik: '1', hppSatuan: 1 })],
    });
    expect((await json<Galat>(mati)).error.pesan).toContain('nonaktif');
  });

  it('A3/K-227 opname: stok sistem dan barang belum diambil pada waktu hitung; konfirmasi dua penghitung', async () => {
    await saldoAwal(m.semen, '10', 10000);
    // Terjual 2 sak tetapi belum diambil: stok sistem 8, fisik di toko masih 10.
    const [jual] = await db
      .insert(penjualan)
      .values({
        nomor: 'STR-UJI-1',
        tanggalOperasional: tanggalOperasional(),
        jenisPenjualan: 'LANGSUNG',
        idKasir: admin.pengguna.id,
        totalBruto: 0,
        totalNeto: 0,
        statusPengambilan: 'BELUM_DIAMBIL',
      })
      .returning();
    const [det] = await db
      .insert(penjualanDetail)
      .values({
        idPenjualan: jual!.id,
        idBarang: m.semen,
        qty: '2',
        qtyDasar: '2',
        hargaManual: true,
        hargaSatuan: 0,
        subtotal: 0,
        hppSaatTransaksi: 10000,
      })
      .returning();
    await dalamTransaksi((tx) =>
      catatMutasi(tx, {
        idBarang: m.semen,
        jenis: 'PENJUALAN',
        qtyKeluar: '2',
        idPengguna: admin.pengguna.id,
        tanggalOperasional: tanggalOperasional(),
        keterangan: 'Jual uji',
        sumber: { idPenjualanDetail: det!.id },
      }),
    );
    // Penghitung pertama (Kepala Toko) menemukan 9 sak: hilang 1 (9 − 8 − 2 = −1).
    const d = await draf('OPNAME', [baris(m.semen, { qtyFisik: '9' })]);
    // Sesudah dihitung: 5 sak masuk dan 2 sak diambil pembeli → sistem 13, fisik 12.
    await saldoAwal(m.semen, '5', 10000);
    const ambil = await minta(`/api/penjualan/${jual!.id}/diambil`, {
      method: 'POST',
      cookie: admin.cookie,
    });
    expect(ambil.status).toBe(200);
    let isi = await ok(minta(`/api/penyesuaian/${d.id}`, { cookie: admin.cookie }));
    // Stok sistem dan belum diambil pada waktu hitung (8 dan 2), bukan saat ini (13 dan 0).
    expect(isi.baris[0]).toMatchObject({
      qtySistem: '8.000',
      qtyBelumDiambil: '2.000',
      perluHitungUlang: true,
      terkonfirmasi: false,
    });

    // Belum dikonfirmasi hitungan orang lain: Kepala Toko lain belum bisa menyelesaikan.
    const kepala2 = await sesiUji('ADMIN');
    const sebab = {
      jenis: 'OPNAME',
      baris: [baris(m.semen, { qtyFisik: null, sebabSelisih: 'HILANG' })],
    };
    await ok(kirim(`/${d.id}`, sebab, 'PUT', kepala2));
    const belumUlang = await kirim(`/${d.id}/selesai`, undefined, 'POST', kepala2);
    expect(belumUlang.status).toBe(400);
    expect((await json<Galat>(belumUlang)).error.pesan).toContain('dihitung ulang oleh orang lain');

    // Hitung ulang oleh Admin Persediaan: 12 sak (selisih pada waktunya tetap −1) → terkonfirmasi.
    const persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
    const ulang = await minta(`/api/opname/${d.id}/hitung`, {
      method: 'POST',
      cookie: persediaanSesi.cookie,
      body: { idBarang: m.semen, qty: '12' },
    });
    expect(ulang.status).toBe(200);
    isi = await ok(minta(`/api/penyesuaian/${d.id}`, { cookie: kepala2.cookie }));
    expect(isi.baris[0]).toMatchObject({
      qtyFisik: '12.000',
      qtySistem: '13.000',
      qtyBelumDiambil: '0.000',
      terkonfirmasi: true,
    });

    // Penghitung pertama tidak boleh menyetujui selisih yang ikut ia hitung.
    const sendiri = await kirim(`/${d.id}/selesai`);
    expect(sendiri.status).toBe(403);
    const hasil = await ok(kirim(`/${d.id}/selesai`, undefined, 'POST', kepala2));
    expect(hasil.baris[0]).toMatchObject({
      qtySistem: '13.000',
      qtySelisih: '-1.000',
      qtyBelumDiambil: '0.000',
      sebabSelisih: 'HILANG',
    });
    expect((await stok(m.semen)).stokFisik).toBe('12.000');
  });

  it('A3 lembar opname berisi barang aktif; selesai ditolak bila ada yang belum dihitung', async () => {
    const lembar = await ok(kirim('/lembar-opname', { idKategori: null }));
    expect(lembar.jenis).toBe('OPNAME');
    expect(lembar.baris.map((b) => b.namaBarang)).toEqual(
      expect.arrayContaining(['Semen Gresik 40 kg', 'Pasir', 'Cat titipan']),
    );
    expect(lembar.baris.map((b) => b.namaBarang)).not.toContain('Barang lama');
    const res = await kirim(`/${lembar.id}/selesai`);
    expect((await json<Galat>(res)).error.pesan).toContain('Qty fisik belum diisi untuk 3 barang');
  });

  it('K-069 barang di lembar opname tidak bisa dihapus; dikecualikan wajib alasan, tercatat & masuk log', async () => {
    await saldoAwal(m.pasir, '7', 3000);
    const lembar = await ok(kirim('/lembar-opname', { idKategori: null }));
    const isi = (ubah: Record<number, Record<string, unknown>>) =>
      lembar.baris.map((b) => {
        const idBarang = b.idBarang as number;
        return {
          idBarang,
          qtyFisik: '1',
          keterangan: 'Hitung ulang',
          sebabSelisih: 'BELUM_TERCATAT',
          ...ubah[idBarang],
        };
      });

    // Menghapus baris pasir dari lembar ditolak.
    const hapus = await kirim(
      `/${lembar.id}`,
      { jenis: 'OPNAME', baris: isi({}).filter((b) => b.idBarang !== m.pasir) },
      'PUT',
    );
    expect(hapus.status).toBe(400);
    expect((await json<Galat>(hapus)).error.pesan).toContain('tidak bisa dihapus: Pasir');

    // Dikecualikan tanpa alasan ditolak.
    const tanpaAlasan = await kirim(
      `/${lembar.id}`,
      { jenis: 'OPNAME', baris: isi({ [m.pasir]: { qtyFisik: null, dikecualikan: true } }) },
      'PUT',
    );
    expect(tanpaAlasan.status).toBe(400);

    const alasan = 'Gudang belakang terkunci';
    const d = await ok(
      kirim(
        `/${lembar.id}`,
        {
          jenis: 'OPNAME',
          baris: isi({ [m.pasir]: { qtyFisik: null, dikecualikan: true, alasanKecuali: alasan } }),
        },
        'PUT',
      ),
    );
    const pasir = d.baris.find((b) => b.idBarang === m.pasir)!;
    expect(pasir).toMatchObject({
      dikecualikan: true,
      alasanKecuali: alasan,
      namaPenggunaKecuali: admin.pengguna.namaPengguna,
    });

    // Disimpan ulang oleh pengguna lain dengan alasan sama: pencatat awal tetap.
    const owner = await sesiUji('OWNER');
    const d2 = await ok(
      kirim(
        `/${lembar.id}`,
        {
          jenis: 'OPNAME',
          baris: isi({ [m.pasir]: { qtyFisik: null, dikecualikan: true, alasanKecuali: alasan } }),
        },
        'PUT',
        owner,
      ),
    );
    expect(d2.baris.find((b) => b.idBarang === m.pasir)?.namaPenggunaKecuali).toBe(
      admin.pengguna.namaPengguna,
    );

    // K-227: selisih yang dihitung Kepala Toko diselesaikan Owner (tanpa hitung ulang, tercatat di log).
    await ok(kirim(`/${lembar.id}/selesai`, undefined, 'POST', owner));
    expect((await stok(m.pasir)).stokFisik).toBe('7.000'); // tidak dihitung → tidak berubah
    expect((await stok(m.semen)).stokFisik).toBe('1.000');
    const mutasiPasir = await db
      .select()
      .from(mutasiPersediaan)
      .where(eq(mutasiPersediaan.idBarang, m.pasir));
    expect(mutasiPasir).toHaveLength(1); // hanya saldo awal

    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENYESUAIAN_SELESAI'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('dikecualikan 1 (Pasir: Gudang belakang terkunci)');
    expect(log?.ringkasan).toContain('barang aktif di luar dokumen 0');
    expect(log?.ringkasan).toContain('Owner menyetujui tanpa hitung ulang');

    // Pengecualian hanya untuk opname.
    const koreksi = await kirim('', {
      jenis: 'KOREKSI',
      alasan: 'uji',
      baris: [{ idBarang: m.semen, qtySelisih: '1', dikecualikan: true, alasanKecuali: 'xyz' }],
    });
    expect(koreksi.status).toBe(400);
  });

  it('A4/A5 koreksi ± dan pindah ke stok rusak (dua mutasi PINDAH_KONDISI); HPP tetap', async () => {
    await saldoAwal(m.semen, '10', 10000);
    await selesai(
      (
        await draf(
          'KOREKSI',
          [baris(m.semen, { qtySelisih: '2' }), baris(m.pasir, { qtySelisih: '1,5' })],
          { alasan: 'Hitung ulang gudang' },
        )
      ).id,
    );
    await selesai(
      (await draf('KOREKSI', [baris(m.semen, { qtySelisih: '-1' })], { alasan: 'Bocor' })).id,
    );
    expect(await stok(m.semen)).toMatchObject({ stokFisik: '11.000', hppRata2: 10000 });

    const rusak = await selesai((await draf('RUSAK', [baris(m.semen, { qtySelisih: '3' })])).id);
    expect(rusak.baris[0]).toMatchObject({ qtySelisih: '-3.000' });
    expect(await stok(m.semen)).toMatchObject({
      stokFisik: '8.000',
      stokRusak: '3.000',
      hppRata2: 10000,
    });
    const pindah = await db
      .select()
      .from(mutasiPersediaan)
      .where(eq(mutasiPersediaan.jenisMutasi, 'PINDAH_KONDISI'));
    expect(pindah.map((x) => [x.kondisi, x.qtyMasuk, x.qtyKeluar])).toEqual([
      ['BAIK', '0.000', '3.000'],
      ['RUSAK', '3.000', '0.000'],
    ]);
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('A6/L2 pengurangan melebihi stok atau di bawah stok dipesan ditolak; seluruh dokumen batal', async () => {
    await saldoAwal(m.semen, '5', 10000);
    await saldoAwal(m.pasir, '5', 3000);
    const d = await draf(
      'KOREKSI',
      [baris(m.pasir, { qtySelisih: '-1' }), baris(m.semen, { qtySelisih: '-6' })],
      { alasan: 'uji' },
    );
    const res = await kirim(`/${d.id}/selesai`);
    expect((await json<Galat>(res)).error.kode).toBe('STOK_TIDAK_CUKUP');
    expect((await stok(m.pasir)).stokFisik).toBe('5.000'); // baris pertama ikut dibatalkan

    await db.update(persediaan).set({ stokDipesan: '4' }).where(eq(persediaan.idBarang, m.semen));
    const d2 = await draf('RUSAK', [baris(m.semen, { qtySelisih: '2' })]);
    const res2 = await kirim(`/${d2.id}/selesai`);
    expect((await json<Galat>(res2)).error.pesan).toContain('di bawah stok yang dipesan');
  });

  it('daftar menyaring jenis dan status', async () => {
    await saldoAwal(m.semen, '1', 1);
    await draf('KOREKSI', [baris(m.semen, { qtySelisih: '1' })], { alasan: 'x' });
    const cari = async (q: string) =>
      json<{ meta: { total: number } }>(
        await minta(`/api/penyesuaian?${q}`, { cookie: admin.cookie }),
      );
    expect((await cari('')).meta.total).toBe(2);
    expect((await cari('status=DRAFT')).meta.total).toBe(1);
    expect((await cari('jenis=SALDO_AWAL&status=SELESAI')).meta.total).toBe(1);
  });
});

describe('import saldo awal (Excel)', () => {
  async function templat(): Promise<ExcelJS.Workbook> {
    const res = await minta('/api/penyesuaian/saldo-awal/templat', { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    return wb;
  }

  async function unggah(wb: ExcelJS.Workbook) {
    const form = new FormData();
    form.set('berkas', new File([new Uint8Array(await wb.xlsx.writeBuffer())], 'saldo.xlsx'));
    return mintaForm('/api/penyesuaian/saldo-awal/impor', form, admin.cookie);
  }

  it('templat berisi barang aktif; qty diisi → satu draf SALDO_AWAL; kode salah ditolak', async () => {
    const wb = await templat();
    const ws = wb.getWorksheet('Persediaan Awal')!;
    const baris = new Map<string, number>();
    ws.eachRow((row, i) => {
      if (i > 1) baris.set(row.getCell(2).text, i);
    });
    expect([...baris.keys()]).toEqual(['Cat titipan', 'Pasir', 'Semen Gresik 40 kg']);
    expect(ws.getRow(baris.get('Semen Gresik 40 kg')!).getCell(5).value).toBe(9000);
    ws.getRow(baris.get('Semen Gresik 40 kg')!).getCell(4).value = 10;
    ws.getRow(baris.get('Cat titipan')!).getCell(4).value = 2;

    const res = await unggah(wb);
    expect(res.status).toBe(201);
    const d = (await json<{ data: Detail }>(res)).data;
    expect(d).toMatchObject({ jenis: 'SALDO_AWAL', status: 'DRAFT' });
    expect(d.baris.map((b) => [b.namaBarang, b.qtyFisik, b.hppSatuan])).toEqual([
      ['Cat titipan', '2.000', 30000],
      ['Semen Gresik 40 kg', '10.000', 9000],
    ]);
    expect((await stok(m.semen)).stokFisik).toBe('0.000'); // belum diselesaikan
    await selesai(d.id);
    expect((await stok(m.semen)).stokFisik).toBe('10.000');

    ws.getRow(baris.get('Pasir')!).getCell(1).value = 'TIDAK-ADA';
    ws.getRow(baris.get('Pasir')!).getCell(4).value = 1;
    const salah = await unggah(wb);
    expect(salah.status).toBe(400);
    expect((await json<Galat>(salah)).error.pesan).toContain('kode "TIDAK-ADA" tidak ditemukan');
  });
});
