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

/** PNG 1×1 piksel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('Admin mengunggah logo toko; logo tampil di sidebar; logo dihapus lagi', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/pengaturan');
  await page.getByLabel('Berkas logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByText('Logo toko disimpan.')).toBeVisible();
  await expect(page.getByRole('complementary').getByAltText('Logo toko')).toBeVisible();

  await page.getByRole('button', { name: 'Hapus' }).click();
  await expect(page.getByText('Logo toko dihapus.')).toBeVisible();
  await expect(page.getByRole('complementary').getByAltText('Logo toko')).toHaveCount(0);
});

test('jumlah baris per halaman mengikuti pengaturan (lalu dikembalikan)', async ({
  page,
  browser,
}) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/pengaturan');
  await page.getByRole('tab', { name: 'Operasional' }).click();
  const asli =
    (await page.getByLabel('Baris per halaman tabel').textContent())?.trim() ?? '25 baris';

  async function aturBaris(label: string) {
    await page.getByLabel('Baris per halaman tabel').click();
    await page.getByRole('option', { name: label }).click();
    await page.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Pengaturan disimpan.').first()).toBeVisible();
  }

  await aturBaris('10 baris');
  try {
    // Log aktivitas punya banyak baris; halaman pertama hanya 10 (+1 baris judul).
    const owner = await browser.newPage();
    await masukCepat(owner, 'OWNER');
    await owner.goto('/pengaturan');
    await owner.getByRole('tab', { name: 'Log aktivitas' }).click();
    await expect(owner.getByRole('table').getByRole('row')).toHaveCount(11);
    await owner.close();
  } finally {
    if (asli !== '10 baris') await aturBaris(asli);
  }
});

test('Owner melihat tab Cadangan (status & petunjuk); Admin tidak', async ({ browser }) => {
  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  await owner.goto('/pengaturan?tab=cadangan');
  await expect(owner.getByRole('tab', { name: 'Cadangan' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // Database pengembangan tanpa repositori cadangan → petunjuk pengaturan; tombol nonaktif.
  await expect(owner.getByRole('button', { name: /Cadangkan sekarang/ })).toBeVisible();

  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  await admin.goto('/pengaturan');
  await expect(admin.getByRole('tab', { name: 'Profil toko' })).toBeVisible();
  await expect(admin.getByRole('tab', { name: 'Cadangan' })).toHaveCount(0);
});
