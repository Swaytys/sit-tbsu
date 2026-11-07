import { expect, test } from '@playwright/test';
import { buangDrafSaya, masukCepat } from './pembantu';

// K-228: setiap pintasan keyboard juga berupa tombol yang bisa diklik/disentuh (HP/tablet tanpa tombol F).

test('Order Penjualan: jenis order dan bilah pintasan bisa diklik tanpa keyboard', async ({
  page,
}) => {
  await masukCepat(page, 'STAF_PENJUALAN');
  await buangDrafSaya(page);
  await page.goto('/order');
  const jenis = page.getByTestId('jenis-order');
  await expect(jenis).toContainText('LANGSUNG');
  await jenis.click();
  await expect(jenis).toContainText('PENGANTARAN');

  // Bilah pintasan: buka bila tertutup, lalu klik F3 untuk kembali ke langsung.
  const buka = page.getByRole('button', { name: /Pintasan/ });
  if (await buka.isVisible()) await buka.click();
  await page.getByRole('button', { name: /Ubah ke langsung \(F3\)/ }).click();
  await expect(jenis).toContainText('LANGSUNG');

  // F4 lewat klik membuka kotak cari pelanggan.
  await page.getByRole('button', { name: 'Pelanggan (F4)' }).click();
  await expect(page.locator('#order-cari-pelanggan')).toBeVisible();
});

test('Penjualan Langsung: bilah pintasan F2/F8 bisa diklik', async ({ page }) => {
  await masukCepat(page, 'KASIR');
  await page.goto('/penjualan-langsung');
  const buka = page.getByRole('button', { name: /Pintasan/ });
  if (await buka.isVisible()) await buka.click();
  await page.getByRole('button', { name: 'Cari barang (F2)' }).click();
  await expect(page.locator('input:focus')).toHaveCount(1);
  await page.getByRole('button', { name: /Antrean langsung/ }).click();
});

test('K-145: kasir mengganti tombol cari barang ke F6; layar kasir mengikutinya', async ({
  page,
}) => {
  await masukCepat(page, 'KASIR');
  try {
    await page.goto('/akun/pintasan');
    await page.getByLabel('Cari barang').first().selectOption('F6');
    await page.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Pintasan keyboard disimpan.')).toBeVisible();
    await page.goto('/penjualan-langsung');
    const buka = page.getByRole('button', { name: /Pintasan/ });
    if (await buka.isVisible()) await buka.click();
    await expect(page.getByRole('button', { name: 'Cari barang (F6)' })).toBeVisible();
    await page.locator('body').click();
    await page.keyboard.press('F6');
    await expect(page.locator('input:focus')).toHaveCount(1);
  } finally {
    await page.request.fetch('/api/auth/pintasan', {
      method: 'PUT',
      data: {},
      headers: { origin: new URL(page.url()).origin },
    });
  }
});
