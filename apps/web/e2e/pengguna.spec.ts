import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu pengguna uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
test('Owner menambah kasir; kasir wajib ganti password; Owner menonaktifkannya', async ({
  browser,
}) => {
  const username = `e2e.${Date.now()}`;
  const nama = `Kasir E2E ${username.slice(-5)}`;

  // 1. Owner menambah pengguna.
  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  await menuUtama(owner).getByRole('link', { name: 'Data Pengguna' }).click();
  await expect(owner.getByRole('heading', { name: 'Data Pengguna' })).toBeVisible();

  await owner.getByRole('button', { name: 'Tambah pengguna' }).click();
  const dialog = owner.getByRole('dialog', { name: 'Tambah pengguna' });
  await dialog.getByLabel('Nama pengguna').fill(nama);
  await dialog.getByLabel('Username').fill(username);
  await dialog.getByLabel('Password awal').fill('awal-e2e-123');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(owner.getByText(/ditambahkan \(USR-\d{5}\)/)).toBeVisible();

  await owner.getByLabel('Cari pengguna').fill(username);
  const baris = owner.getByRole('row').filter({ hasText: username });
  await expect(baris).toContainText('Kasir');
  await expect(baris).toContainText('Wajib ganti password');

  // 2. Kasir login pertama kali → wajib ganti password.
  const kasir = await browser.newPage();
  await kasir.goto('/login');
  await kasir.getByLabel('Username').fill(username);
  await kasir.getByLabel('Password').fill('awal-e2e-123');
  await kasir.getByRole('button', { name: 'Masuk' }).click();
  await expect(kasir).toHaveURL(/\/ganti-password$/);

  await kasir.getByLabel('Password lama').fill('awal-e2e-123');
  await kasir.getByLabel('Password baru', { exact: true }).fill('baru-e2e-1234');
  await kasir.getByLabel('Ulangi password baru').fill('baru-e2e-1234');
  await kasir.getByRole('button', { name: 'Simpan password baru' }).click();
  await expect(kasir).toHaveURL(/\/dashboard$/);
  await expect(kasir.getByRole('heading', { name: `Selamat datang, ${nama}` })).toBeVisible();

  // 3. Owner menonaktifkan kasir → sesi kasir langsung berakhir.
  await owner.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await owner.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await owner.getByRole('alertdialog').getByRole('button', { name: 'Nonaktifkan' }).click();
  await expect(baris).toContainText('Nonaktif');

  await kasir.reload();
  await expect(kasir).toHaveURL(/\/login/);
});
