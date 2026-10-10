import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah pelanggan/pemasok uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.

test('Staf menambah pelanggan tanpa mengatur tier; Admin mengatur tier, term, dan limit', async ({
  browser,
}) => {
  const nama = `Pelanggan E2E ${Date.now()}`;

  // 1. Staf: No. HP wajib; bagian harga & kredit hanya ringkasan.
  const staf = await browser.newPage();
  await masukCepat(staf, 'STAF_PENJUALAN');
  await menuUtama(staf).getByRole('link', { name: 'Data Pelanggan' }).click();
  await expect(staf.getByRole('heading', { name: 'Data Pelanggan' })).toBeVisible();

  await staf.getByRole('button', { name: 'Tambah pelanggan' }).click();
  let dialog = staf.getByRole('dialog', { name: 'Tambah pelanggan' });
  await dialog.getByLabel('Nama pelanggan').fill(nama);
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(dialog.getByText('No. HP wajib diisi.')).toBeVisible();
  await expect(dialog.getByText(/diatur Admin\/Owner/)).toBeVisible();
  await expect(dialog.getByLabel('Golongan pelanggan')).toHaveCount(0);

  await dialog.getByLabel('No. HP').fill('0812 3456 7890');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(staf.getByText(/ditambahkan \(PLG-\d{5}\)/)).toBeVisible();

  await staf.getByLabel('Cari pelanggan').fill(nama);
  const barisStaf = staf.getByRole('row').filter({ hasText: nama });
  await expect(barisStaf).toBeVisible();

  // 2. Admin membuat golongan (K-097), lalu mengatur golongan, term 30 hari, limit Rp 5.000.000.
  const golongan = `Kontraktor ${Date.now()}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  await admin.goto('/pelanggan');
  await admin.getByRole('button', { name: 'Golongan' }).click();
  const dGolongan = admin.getByRole('dialog', { name: 'Golongan pelanggan' });
  await dGolongan.getByPlaceholder('mis. Kontraktor').fill(golongan);
  await dGolongan.getByRole('button', { name: 'Simpan' }).click();
  await expect(dGolongan.getByRole('row').filter({ hasText: golongan })).toBeVisible();
  await admin.keyboard.press('Escape');
  await admin.getByLabel('Cari pelanggan').fill(nama);
  await admin.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await admin.getByRole('menuitem', { name: 'Ubah' }).click();
  dialog = admin.getByRole('dialog', { name: /Ubah pelanggan PLG-/ });
  await dialog.getByLabel('Golongan pelanggan').click();
  await admin.getByRole('option', { name: golongan }).click();
  await dialog.getByLabel('Term (hari)').fill('30');
  await dialog.getByLabel('Limit kredit').fill('5000000');
  await expect(dialog.getByLabel('Limit kredit')).toHaveValue('5.000.000');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(admin.getByText(`Data ${nama} disimpan.`)).toBeVisible();

  const barisAdmin = admin.getByRole('row').filter({ hasText: nama });
  await expect(barisAdmin).toContainText(golongan);
  await expect(barisAdmin).toContainText('30 hari');

  // 3. Staf melihat ringkasan kredit yang diatur Admin, lalu menonaktifkan pelanggan uji.
  await staf.reload();
  await staf.getByLabel('Cari pelanggan').fill(nama);
  await staf.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await staf.getByRole('menuitem', { name: 'Ubah' }).click();
  await expect(staf.getByText(`${golongan} · term 30 hari · limit Rp 5.000.000.`)).toBeVisible();
  await staf.keyboard.press('Escape');
  await staf.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await staf.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(barisStaf).toContainText('Nonaktif');
});

test('Admin menambah pemasok; Kasir tidak melihat menu Data Pemasok', async ({ page }) => {
  const nama = `Pemasok E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Data Pemasok' }).click();
  await expect(page.getByRole('heading', { name: 'Data Pemasok' })).toBeVisible();

  await page.getByRole('button', { name: 'Tambah pemasok' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah pemasok' });
  await dialog.getByLabel('Nama pemasok').fill(nama);
  await dialog.getByLabel('No. HP / telepon').fill('0321 861234');
  await dialog.getByLabel('Kontak person').fill('Pak Susanto');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(/ditambahkan \(PMS-\d{5}\)/)).toBeVisible();

  await page.getByLabel('Cari pemasok').fill(nama);
  const baris = page.getByRole('row').filter({ hasText: nama });
  await expect(baris).toContainText('Pak Susanto');
  await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await expect(baris).toContainText('Nonaktif');

  const kasir = await page.context().browser()!.newPage();
  await masukCepat(kasir, 'KASIR');
  await expect(menuUtama(kasir).getByRole('link', { name: 'Data Pemasok' })).toHaveCount(0);
});
