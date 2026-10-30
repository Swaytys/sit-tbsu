import { expect, test } from '@playwright/test';
import { masukCepat } from './pembantu';

// K-201: atribut dimensi ↔ data muatan selaras langsung di form (tanpa menyimpan).
test('Form barang: data muatan → atribut dan atribut → data muatan saat isian selesai', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/barang/baru');
  const berat = page.getByRole('textbox', { name: 'Berat', exact: true });
  await berat.fill('7,5');
  await berat.blur();
  await expect(page.getByLabel('Nilai atribut 1')).toHaveValue('7,5');
  await expect(page.getByLabel('Jenis atribut 1')).toContainText('Berat');
  await expect(page.getByLabel('Satuan atribut 1')).toContainText('kg');

  await page.getByRole('textbox', { name: 'Panjang', exact: true }).fill('40');
  await page.getByRole('textbox', { name: 'Panjang', exact: true }).blur();
  await expect(page.getByLabel('Nilai atribut 2')).toHaveValue('40');
  await expect(page.getByLabel('Satuan atribut 2')).toContainText('cm');

  // Atribut diubah → data muatan ikut.
  await page.getByLabel('Nilai atribut 1').fill('8');
  await page.getByLabel('Nilai atribut 1').blur();
  await expect(berat).toHaveValue('8');
});
