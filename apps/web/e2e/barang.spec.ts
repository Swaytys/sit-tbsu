import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
// Mengandalkan data seed: kategori Semen, satuan sak/m, atribut Warna/Panjang, tier Normal/Grosir (20%),
// pembulatan harga 100.

/** PNG 1×1 piksel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function pilih(page: Page, label: string, opsi: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: opsi, exact: true }).click();
}

test('Admin menambah barang dengan atribut dan harga; tinjau harga lalu simpan di Harga Jual', async ({
  page,
}) => {
  const nama = `Barang E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByRole('link', { name: 'Tambah barang' }).click();
  await expect(page.getByRole('heading', { name: 'Tambah barang' })).toBeVisible();

  // Validasi klien: tier default wajib, nama wajib.
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText('Nama barang wajib diisi.')).toBeVisible();

  await page.getByLabel('Nama barang').fill(nama);
  await pilih(page, 'Kategori', 'Semen');
  await pilih(page, 'Satuan dasar', 'sak — Sak');
  await page.getByLabel('Harga modal awal').fill('41234');
  await expect(page.getByLabel('Harga modal awal')).toHaveValue('41.234');

  await page.getByRole('button', { name: 'Tambah atribut' }).click();
  await pilih(page, 'Jenis atribut 1', 'Warna');
  await page.getByLabel('Nilai atribut 1').fill('Abu-abu');
  await page.getByRole('button', { name: 'Tambah atribut' }).click();
  await pilih(page, 'Jenis atribut 2', 'Panjang');
  await page.getByLabel('Nilai atribut 2').fill('6');
  await pilih(page, 'Satuan atribut 2', 'm');

  await page.getByLabel('Harga Normal').fill('55000');
  await page.getByLabel('Berkas gambar').setInputFiles({
    name: 'semen.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText(/ditambahkan \(BRG-\d{5}\)/)).toBeVisible();
  await expect(page).toHaveURL(/\/barang$/);

  // Daftar: harga Normal tetap, Grosir ikut tier = ceil100(41.234 × 1,2) = 49.500; gambar tampil.
  await page.getByLabel('Cari barang').fill(nama);
  const baris = page.getByRole('row').filter({ hasText: nama });
  await expect(baris).toContainText('Rp 55.000');
  await expect(baris).toContainText('Rp 49.500');
  await expect(baris.locator('img')).toBeVisible();

  // Ubah harga modal awal → barang ditandai perlu tinjau harga (H5).
  await baris.getByRole('link', { name: nama }).click();
  await expect(page.getByLabel('Nilai atribut 2')).toHaveValue('6');
  await page.getByLabel('Harga modal awal').fill('45000');
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText(`Barang ${nama} disimpan.`)).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  await expect(baris).toContainText('Perlu tinjau harga');

  // Harga Jual: ubah Grosir menjadi harga tetap, simpan → tanda lepas.
  await menuUtama(page).getByRole('link', { name: 'Harga Jual' }).click();
  await expect(page.getByRole('heading', { name: 'Harga Jual' })).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  const barisHarga = page.getByRole('row').filter({ hasText: nama });
  await expect(barisHarga).toContainText('Perlu tinjau');
  await page.getByLabel(`Harga Grosir ${nama}`).fill('50000');
  await page.getByRole('button', { name: 'Simpan perubahan (1)' }).click();
  await expect(page.getByText('Harga 1 barang disimpan (1 harga berubah).')).toBeVisible();
  await expect(barisHarga).not.toContainText('Perlu tinjau');
  await expect(page.getByLabel(`Harga Grosir ${nama}`)).toHaveValue('50.000');

  // Kelola tier: tier default ditandai.
  await page.getByRole('button', { name: 'Kelola tier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kelola tier harga' });
  await expect(dialog.getByRole('row').filter({ hasText: 'Normal' })).toContainText('Default');
  await dialog.getByRole('button', { name: 'Tutup' }).first().click();

  // Bersihkan: nonaktifkan barang uji.
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('Nonaktif');
});

test('halaman form barang tidak membuat seluruh halaman ikut bergulir melewati tata letak', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/barang/baru');
  await expect(page.getByRole('heading', { name: 'Tambah barang' })).toBeVisible();
  // Dokumen tidak boleh lebih tinggi dari layar; yang bergulir hanya area konten.
  const tinggi = await page.evaluate(() => ({
    dokumen: document.documentElement.scrollHeight,
    layar: window.innerHeight,
  }));
  expect(tinggi.dokumen).toBeLessThanOrEqual(tinggi.layar);
});
