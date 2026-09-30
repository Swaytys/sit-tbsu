import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah dua barang uji lewat import (lalu menonaktifkannya) di database pengembangan.
// Mengandalkan data seed: kategori Semen, satuan sak, tier NORMAL.

async function berkasXlsx(baris: Record<string, string | number>[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Barang');
  const kolom = [
    'kode',
    'nama_barang',
    'kategori',
    'satuan_dasar',
    'harga_modal_awal',
    'harga_NORMAL',
  ];
  ws.addRow(kolom);
  for (const b of baris) ws.addRow(kolom.map((k) => b[k] ?? null));
  return {
    name: 'import-e2e.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  };
}

test('Admin mengimpor barang dari Excel: pratinjau galat, perbaiki, simpan; ekspor harga jual', async ({
  page,
}) => {
  const awalan = `Import E2E ${Date.now()}`;
  const baris = (akhir: string) => ({
    nama_barang: `${awalan} ${akhir}`,
    kategori: 'Semen',
    satuan_dasar: 'sak',
    harga_modal_awal: 40000,
    harga_NORMAL: 52000,
  });

  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByRole('link', { name: 'Import Excel' }).click();
  await expect(page.getByRole('heading', { name: 'Import barang dari Excel' })).toBeVisible();

  const unduh = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Unduh templat Excel' }).click();
  expect((await unduh).suggestedFilename()).toBe('templat-import-barang.xlsx');

  // Berkas dengan satu baris bergalat: tidak bisa disimpan.
  await page
    .getByLabel('Berkas Excel')
    .setInputFiles(await berkasXlsx([baris('A'), { ...baris('B'), kategori: 'Tidak Ada' }]));
  await expect(page.getByText('Galat 1')).toBeVisible();
  await expect(page.getByText('Kategori "Tidak Ada" tidak ditemukan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan 1 barang' })).toBeDisabled();

  // Berkas diperbaiki → simpan.
  await page.getByLabel('Berkas Excel').setInputFiles(await berkasXlsx([baris('A'), baris('B')]));
  await expect(page.getByText('Siap 2')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan 2 barang' }).click();
  await expect(page.getByText('2 barang ditambahkan.')).toBeVisible();
  await expect(page).toHaveURL(/\/barang$/);

  await page.getByLabel('Cari barang').fill(awalan);
  await expect(page.getByRole('row').filter({ hasText: awalan })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: `${awalan} A` })).toContainText('Rp 52.000');

  // Ekspor harga jual.
  await menuUtama(page).getByRole('link', { name: 'Harga Jual' }).click();
  const ekspor = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Ekspor Excel' }).click();
  expect((await ekspor).suggestedFilename()).toMatch(/^harga-jual-\d{4}-\d{2}-\d{2}\.xlsx$/);

  // Bersihkan: nonaktifkan barang hasil import.
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByLabel('Cari barang').fill(awalan);
  for (const akhir of ['A', 'B']) {
    const nama = `${awalan} ${akhir}`;
    await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
    await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
    await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('Nonaktif');
  }
});
