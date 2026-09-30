import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

test('halaman Kategori, Satuan & Atribut menampilkan satuan dari database', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  await menuUtama(page).getByRole('link', { name: 'Kategori, Satuan & Atribut' }).click();

  await expect(page).toHaveURL(/\/kategori-satuan$/);
  await expect(page).toHaveTitle('Kategori, Satuan & Atribut · BonsaiUrip');

  // Data seed: satuan basis panjang "m" dengan faktor 1.
  const barisMeter = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'm', exact: true }) });
  await expect(barisMeter).toContainText('Meter');
  await expect(barisMeter).toContainText('Basis');
  await expect(page.getByRole('row').filter({ hasText: 'Sentimeter' })).toContainText('0,01 m');

  const tautan = menuUtama(page).getByRole('link', { name: 'Kategori, Satuan & Atribut' });
  await expect(tautan).toHaveAttribute('aria-current', 'page');
});
