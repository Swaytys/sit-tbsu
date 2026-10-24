import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-161: isi massal data muatan lewat Excel. Membuat satu barang uji (lalu dinonaktifkan) di database pengembangan.

test('Admin mengisi data muatan lewat Excel: unduh yang belum lengkap, unggah, pratinjau, simpan', async ({
  page,
}) => {
  const nama = `Muatan Excel E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const dibuat = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 8000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 10000 }],
  });
  try {
    const { kode } = await api<{ kode: string }>(page, `/barang/${dibuat.id}`);

    await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
    await page.getByRole('link', { name: 'Data muatan Excel' }).click();
    await expect(page.getByRole('heading', { name: 'Data muatan lewat Excel' })).toBeVisible();

    const unduhan = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Yang belum lengkap' }).click();
    const berkas = await unduhan;
    expect(berkas.suggestedFilename()).toMatch(
      /^data-muatan-belum-lengkap-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await berkas.path());
    const ws = wb.getWorksheet('Data muatan')!;
    const judul: string[] = [];
    ws.getRow(1).eachCell((c) => judul.push(c.text));
    let baris: ExcelJS.Row | undefined;
    ws.eachRow((r) => {
      if (r.getCell(1).text === kode) baris = r;
    });
    expect(baris, 'barang baru ada di daftar belum lengkap').toBeDefined();

    // Berkas yang diunggah cukup berisi barang uji: kolom data diisi dengan satuan bebas.
    const isi = new ExcelJS.Workbook();
    const lembar = isi.addWorksheet('Data muatan');
    lembar.addRow(judul);
    const nilai: Record<string, string | number> = {
      kode,
      nama_barang: nama,
      satuan_dasar: 'sak',
      berat_kg: '40000 g',
      panjang_cm: '650 mm',
      lebar_cm: 40,
      tinggi_cm: '0,1 m',
    };
    lembar.addRow(judul.map((k) => nilai[k] ?? null));
    lembar.addRow(judul.map((k) => (k === 'kode' ? 'TIDAK-ADA-E2E' : k === 'berat_kg' ? 5 : null)));
    await page.getByLabel('Berkas Excel data muatan').setInputFiles({
      name: 'muatan-e2e.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await isi.xlsx.writeBuffer()),
    });
    await expect(page.getByText('Berubah 1')).toBeVisible();
    await expect(page.getByText('Galat 1')).toBeVisible();
    await expect(page.getByText('berat (kosong) → 40 kg')).toBeVisible();
    await expect(page.getByText('panjang (kosong) → 65 cm')).toBeVisible();
    await expect(page.getByText('Barang dengan kode TIDAK-ADA-E2E tidak ditemukan.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simpan 1 perubahan' })).toBeDisabled();

    await page.getByRole('button', { name: 'Buang baris 3' }).click();
    await page.getByRole('button', { name: 'Simpan 1 perubahan' }).click();
    await expect(page.getByText('Data muatan 1 barang disimpan.')).toBeVisible();
    await expect(page).toHaveURL(/\/barang$/);
    const detail = await api<{ muatan: { beratKg: string; panjangCm: string; tinggiCm: string } }>(
      page,
      `/barang/${dibuat.id}`,
    );
    expect(detail.muatan).toMatchObject({ beratKg: '40', panjangCm: '65', tinggiCm: '10' });
  } finally {
    await api(page, `/barang/${dibuat.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
