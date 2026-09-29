import { expect, test } from '@playwright/test';

test('beranda diarahkan ke halaman Satuan yang berisi data dari database', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/satuan$/);
  await expect(page).toHaveTitle('Satuan · BonsaiUrip');
  await expect(page.getByRole('heading', { name: 'Satuan', level: 1 })).toBeVisible();

  // Data seed: satuan basis panjang "m" dengan faktor 1.
  const barisMeter = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'm', exact: true }) });
  await expect(barisMeter).toContainText('Meter');
  await expect(barisMeter).toContainText('Basis');
  await expect(page.getByRole('row').filter({ hasText: 'Sentimeter' })).toContainText('0,01 m');
});

test('menu samping menandai halaman aktif', async ({ page }) => {
  await page.goto('/satuan');
  const tautan = page
    .getByRole('navigation', { name: 'Menu utama' })
    .getByRole('link', { name: 'Satuan' });
  await expect(tautan).toHaveAttribute('aria-current', 'page');
});
