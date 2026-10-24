import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// K-126: halaman Hasil Penjualan di menu Transaksi. Hanya membaca data (database pengembangan tidak berubah).

for (const [lebar, tinggi] of [
  [1280, 800],
  [1024, 768],
] as const) {
  test(`Owner membuka Hasil Penjualan: ringkasan, laba, ABC, periode cepat (${lebar} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: tinggi });
    await masukCepat(page, 'OWNER');
    await menuUtama(page).getByRole('link', { name: 'Hasil Penjualan' }).click();
    await expect(page.getByRole('heading', { name: 'Hasil Penjualan' })).toBeVisible();
    const ringkasan = page.getByTestId('ringkasan-hasil');
    await expect(ringkasan).toContainText('Omzet');
    await expect(ringkasan).toContainText('Laba kotor');
    await page.getByRole('button', { name: '30 hari' }).click();
    await expect(page.getByRole('button', { name: '30 hari' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/Barang terlaris/)).toBeVisible();
    await expect(page.getByText('Per kasir')).toBeVisible();
    await page.getByRole('button', { name: /Arti kelas A, B, C/ }).click();
    await expect(page.getByText(/menyumbang ±80% nilai penjualan/)).toBeVisible();
    await page.keyboard.press('Escape');
    const ukuran = await page.evaluate(() => ({
      isi: document.documentElement.scrollWidth,
      tampak: document.documentElement.clientWidth,
    }));
    expect(ukuran.isi).toBeLessThanOrEqual(ukuran.tampak + 1);
    await page.screenshot({
      path: `test-results/hasil-penjualan-${lebar}.png`,
      fullPage: true,
    });
  });
}

test('Kasir melihat Hasil Penjualan tanpa laba; Staf tidak punya menunya', async ({ browser }) => {
  const kasir = await browser.newPage();
  await masukCepat(kasir, 'KASIR');
  await kasir.goto('/hasil-penjualan');
  await expect(kasir.getByTestId('ringkasan-hasil')).toContainText('Omzet');
  await expect(kasir.getByTestId('ringkasan-hasil')).not.toContainText('Laba kotor');
  const staf = await browser.newPage();
  await masukCepat(staf, 'STAF_PENJUALAN');
  await expect(menuUtama(staf).getByRole('link', { name: 'Hasil Penjualan' })).toHaveCount(0);
});
