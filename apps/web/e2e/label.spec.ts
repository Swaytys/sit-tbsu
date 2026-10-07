import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Fase 12 (K-090): cetak label barang dan laporan Daftar Harga. Tidak mengubah data.

test('Admin menyusun label barang dengan barcode; Daftar Harga tampil di Laporan', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByRole('link', { name: 'Cetak label' }).click();
  await expect(page.getByRole('heading', { name: 'Cetak label barang' })).toBeVisible();

  await page.getByLabel('Cari barang').fill('a');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.getByLabel('Cari barang').press('Enter');
  await page
    .getByLabel(/^Tambah label/)
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Cetak 2 label' })).toBeVisible();
  // Pratinjau memuat dua label dengan barcode Code 128.
  await expect(page.getByRole('img', { name: /^Barcode / })).toHaveCount(2);

  await page.getByLabel('Jenis label').click();
  await page.getByRole('option', { name: /Stiker barcode/ }).click();
  await page.getByLabel('Tampilkan harga').click();
  await expect(page.getByRole('img', { name: /^Barcode / })).toHaveCount(2);

  await menuUtama(page).getByRole('link', { name: 'Laporan' }).click();
  await page
    .getByRole('navigation', { name: 'Daftar laporan' })
    .getByRole('button', { name: 'Daftar Harga' })
    .click();
  await expect(page.getByRole('heading', { name: 'Daftar Harga Barang' }).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nama Barang' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
});
