import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// K-100: berkas sebuah halaman gagal diunduh (mis. tab lama setelah server diperbarui). Aplikasi memuat ulang
// sendiri satu kali; bila masih gagal, yang tampil adalah halaman galat berbahasa Indonesia di dalam kerangka,
// bukan layar galat bawaan React Router.
test('halaman yang gagal diunduh: muat ulang otomatis sekali, lalu halaman galat di dalam kerangka', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  const berkasPromo = '**/halaman-promo.tsx*';
  await page.route(berkasPromo, (rute) => rute.abort());

  // Pindah halaman lewat menu tidak memuat ulang dokumen, jadi `load` berikutnya = muat ulang otomatis.
  const muatUlangOtomatis = page.waitForEvent('load');
  await menuUtama(page).getByRole('link', { name: 'Promo', exact: true }).click();
  await muatUlangOtomatis;

  await expect(page.getByRole('heading', { name: 'Aplikasi baru saja diperbarui' })).toBeVisible();
  await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);
  // Menu samping tetap ada: pengguna bisa pindah ke halaman lain tanpa memuat ulang.
  await expect(menuUtama(page).getByRole('link', { name: 'Dashboard' })).toBeVisible();

  await page.unroute(berkasPromo);
  await page.getByRole('button', { name: 'Muat ulang' }).click();
  await expect(page.getByRole('heading', { name: 'Promo', exact: true })).toBeVisible();
});
