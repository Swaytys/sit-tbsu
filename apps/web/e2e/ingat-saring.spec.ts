import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// K-202: kata cari daftar diingat saat kembali dari halaman ubah; klik menu = mulai dari awal.
test('Data Barang: cari diingat setelah membuka dan kembali dari halaman ubah; menu menghapusnya', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  const cari = page.getByRole('textbox', { name: /^Cari barang/ });
  await cari.fill('Semen');
  await expect(page.getByRole('row').nth(1)).toContainText(/semen/i);
  await page.waitForLoadState('networkidle'); // tabel selesai dimuat ulang setelah jeda ketik
  await page
    .getByRole('row')
    .nth(1)
    .getByRole('button', { name: /^Aksi untuk / })
    .click();
  await page.getByRole('menuitem', { name: 'Ubah' }).click();
  await expect(page).toHaveURL(/\/barang\/\d+/);
  await page.getByRole('link', { name: 'Kembali ke daftar barang' }).click();
  await expect(page).toHaveURL(/\/barang$/);
  await expect(cari).toHaveValue('Semen');
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await expect(cari).toHaveValue('');
});
