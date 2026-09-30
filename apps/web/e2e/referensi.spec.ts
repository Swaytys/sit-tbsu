import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

test('tab Satuan menampilkan satuan dari database', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Referensi Barang' }).click();

  await expect(page).toHaveURL(/\/referensi$/);
  await expect(page).toHaveTitle('Referensi Barang · BonsaiUrip');
  await expect(page.getByRole('heading', { name: 'Referensi Barang' })).toBeVisible();

  await page.getByRole('tab', { name: 'Satuan' }).click();
  // Data seed: satuan basis panjang "m" dengan faktor 1.
  const barisMeter = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'm', exact: true }) });
  await expect(barisMeter).toContainText('Meter');
  await expect(barisMeter).toContainText('Basis');
  await expect(page.getByRole('row').filter({ hasText: 'Sentimeter' })).toContainText('0,01 m');

  const tautan = menuUtama(page).getByRole('link', { name: 'Referensi Barang' });
  await expect(tautan).toHaveAttribute('aria-current', 'page');
});

// Tes ini menambah satu kategori uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
test('Admin menambah kategori, nama kembar ditolak, lalu kategori dinonaktifkan', async ({
  page,
}) => {
  const nama = `Kategori E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  await page.goto('/referensi');

  await page.getByRole('button', { name: 'Tambah kategori' }).click();
  let dialog = page.getByRole('dialog', { name: 'Tambah kategori' });
  await dialog.getByLabel('Nama kategori').fill(nama);
  await dialog.getByLabel('Keterangan').fill('Dibuat oleh tes e2e');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(`Kategori ${nama} disimpan.`)).toBeVisible();

  const baris = page.getByRole('row').filter({ hasText: nama });
  await expect(baris).toContainText('Aktif');

  // Nama sama (beda huruf besar/kecil) ditolak API; pesan tampil di bawah field.
  await page.getByRole('button', { name: 'Tambah kategori' }).click();
  dialog = page.getByRole('dialog', { name: 'Tambah kategori' });
  await dialog.getByLabel('Nama kategori').fill(nama.toUpperCase());
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(dialog.getByText(/sudah (ada|dipakai)/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Batal' }).click();

  await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(baris).toContainText('Nonaktif');
});

test('Kasir tidak melihat menu Referensi Barang', async ({ page }) => {
  await masukCepat(page, 'KASIR');
  await expect(menuUtama(page).getByRole('link', { name: 'Referensi Barang' })).toHaveCount(0);
});

// Tes ini menambah satu merk uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
test('Admin menambah merk lalu memakainya di form barang', async ({ page }) => {
  const nama = `Merk E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  await page.goto('/referensi');
  await page.getByRole('tab', { name: 'Merk' }).click();
  await page.getByRole('button', { name: 'Tambah merk' }).click();
  await page.getByRole('dialog', { name: 'Tambah merk' }).getByLabel('Nama merk').fill(nama);
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(`Merk ${nama} disimpan.`)).toBeVisible();

  await page.goto('/barang/baru');
  await page.getByLabel('Merk', { exact: true }).click();
  await expect(page.getByRole('option', { name: nama })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/referensi');
  await page.getByRole('tab', { name: 'Merk' }).click();
  await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('Nonaktif');
});
