import { expect, type Page } from '@playwright/test';

export const LABEL_TOMBOL_PERAN = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  KASIR: 'Kasir',
  STAF_PENJUALAN: 'Staf Penjualan',
} as const;

/** Masuk dengan tombol "masuk cepat" (hanya ada di mode pengembangan). */
export async function masukCepat(page: Page, peran: keyof typeof LABEL_TOMBOL_PERAN) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${LABEL_TOMBOL_PERAN[peran]}`) }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export function menuUtama(page: Page) {
  return page.getByRole('navigation', { name: 'Menu utama' });
}
