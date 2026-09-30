import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

test('belum login diarahkan ke halaman login, lalu kembali ke halaman tujuan', async ({ page }) => {
  const password = process.env.SEED_OWNER_PASSWORD;
  test.skip(!password, 'SEED_OWNER_PASSWORD tidak ada di .env');

  await page.goto('/kategori-satuan');
  await expect(page).toHaveURL(/\/login\?kembali=%2Fkategori-satuan$/);

  await page.getByLabel('Username').fill('demo.admin');
  await page.getByLabel('Password').fill(password ?? '');
  await page.getByRole('button', { name: 'Masuk' }).click();

  await expect(page).toHaveURL(/\/kategori-satuan$/);
});

test('password salah menampilkan pesan dan tetap di halaman login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('demo.kasir');
  await page.getByLabel('Password').fill('bukan-password-ini');
  await page.getByRole('button', { name: 'Masuk' }).click();

  await expect(page.getByRole('alert')).toHaveText('Username atau password salah.');
  await expect(page).toHaveURL(/\/login$/);
});

test('validasi form login dalam Bahasa Indonesia', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByText('Username wajib diisi.')).toBeVisible();
  await expect(page.getByText('Password wajib diisi.')).toBeVisible();
});

// Menu sesuai docs/04 §4. `ada` harus tampil, `tidak` harus tersembunyi.
const MENU_PER_PERAN = {
  STAF_PENJUALAN: {
    ada: ['Dashboard', 'Data Pelanggan', 'Order Penjualan'],
    tidak: ['Data Barang', 'Penjualan Langsung', 'Laporan', 'Pengaturan', 'Data Pengguna'],
  },
  KASIR: {
    ada: ['Penjualan Langsung', 'Piutang', 'Retur Penjualan', 'Shift & Clerical Check', 'Laporan'],
    tidak: ['Data Barang', 'Stok Persediaan', 'Pengaturan', 'Data Pengguna'],
  },
  ADMIN: {
    ada: ['Data Barang', 'Data Pemasok', 'Stok Persediaan', 'Pengaturan'],
    tidak: ['Data Pengguna'],
  },
  OWNER: { ada: ['Data Pengguna', 'Pengaturan', 'Harga Jual'], tidak: [] },
} as const;

for (const [peran, { ada, tidak }] of Object.entries(MENU_PER_PERAN)) {
  test(`menu ${peran} sesuai izin`, async ({ page }) => {
    await masukCepat(page, peran as keyof typeof MENU_PER_PERAN);
    const menu = menuUtama(page);
    for (const label of ada) await expect(menu.getByRole('link', { name: label })).toBeVisible();
    for (const label of tidak) await expect(menu.getByRole('link', { name: label })).toHaveCount(0);
  });
}

test('halaman di luar izin menampilkan "Tidak memiliki izin"', async ({ page }) => {
  await masukCepat(page, 'STAF_PENJUALAN');
  await page.goto('/pengaturan');
  await expect(page.getByRole('heading', { name: 'Tidak memiliki izin' })).toBeVisible();
});

test('keluar mengakhiri sesi', async ({ page }) => {
  await masukCepat(page, 'KASIR');
  await page.getByRole('button', { name: 'Menu pengguna' }).click();
  await page.getByRole('menuitem', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?kembali=%2Fdashboard$/);
});
