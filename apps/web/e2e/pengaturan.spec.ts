import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

/** Ubah footer struk lalu kembalikan nilai asli (database pengembangan tidak berubah). */
async function ubahFooterLaluKembalikan(page: Page) {
  const footer = page.getByLabel('Teks penutup struk');
  const asli = await footer.inputValue();
  const baru = `Terima kasih (uji ${Date.now()})`;

  await footer.fill(baru);
  // Pratinjau struk ikut berubah.
  await expect(page.locator('p').filter({ hasText: baru })).toBeVisible();
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Pengaturan disimpan.').first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Teks penutup struk')).toHaveValue(baru);

  await page.getByLabel('Teks penutup struk').fill(asli);
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  await expect(page.getByLabel('Teks penutup struk')).toHaveValue(asli);
}

test('Admin mengubah footer struk; tersimpan; Admin tidak melihat tab Log', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Pengaturan' }).click();
  await expect(page.getByRole('heading', { name: 'Pengaturan sistem' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Log aktivitas' })).toHaveCount(0);
  await ubahFooterLaluKembalikan(page);
});

test('prefix ganda ditolak di form penomoran', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/pengaturan');
  await page.getByRole('tab', { name: 'Penomoran' }).click();
  await page.getByLabel('Invoice pengantaran').fill('STR');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Prefix STR sudah dipakai STR.')).toBeVisible();
});

test('Owner melihat perubahan pengaturan di tab Log aktivitas', async ({ page }) => {
  await masukCepat(page, 'OWNER');
  await page.goto('/pengaturan');
  await ubahFooterLaluKembalikan(page);

  await page.getByRole('tab', { name: 'Log aktivitas' }).click();
  await page.getByLabel('Cari log').fill('footer_struk');
  const baris = page.getByRole('row').filter({ hasText: 'Ubah pengaturan' }).first();
  await expect(baris).toContainText('Demo Owner');
  await expect(baris).toContainText('footer_struk');
});
