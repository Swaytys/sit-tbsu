import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-168: panduan penyiapan (Admin): langkah berstatus, isi contoh pelanggan, nonaktifkan semua contoh. Contoh yang
// tersisa dari percobaan sebelumnya dinonaktifkan dulu agar tombol "Isi contoh" muncul.

test('Panduan penyiapan: isi 5 contoh pelanggan lalu nonaktifkan semua contoh sekali klik', async ({
  page,
}) => {
  test.slow();
  await masukCepat(page, 'ADMIN');
  await api(page, '/penyiapan/contoh/nonaktifkan', 'POST');
  await page.goto('/pengaturan');
  await page.getByRole('link', { name: 'Panduan penyiapan' }).click();
  await expect(page.getByRole('heading', { name: 'Panduan penyiapan' })).toBeVisible();
  const kartu = page.getByTestId('langkah-PELANGGAN');
  await expect(kartu).toContainText('Pelanggan tetap');
  await kartu.getByRole('button', { name: 'Isi 5 contoh pelanggan' }).click();
  await expect(page.getByText('5 contoh dibuat.')).toBeVisible();
  await expect(kartu).toContainText('5 contoh aktif');

  const dibuat = await api<{ keterangan: string | null }[]>(
    page,
    '/pelanggan?status=AKTIF&cari=Toko%20Bangunan%20Makmur',
  );
  expect(dibuat.map((p) => p.keterangan)).toContain('Data contoh (boleh dinonaktifkan)');

  await page.goto('/penyiapan');
  await page.getByRole('button', { name: 'Nonaktifkan semua contoh' }).click();
  await page.getByRole('button', { name: /^Ya, nonaktifkan 5 contoh/ }).click();
  await expect(page.getByText('5 contoh dinonaktifkan.')).toBeVisible();
  await expect(kartu).not.toContainText('contoh aktif');
  const aktif = await api<{ namaPelanggan: string }[]>(
    page,
    '/pelanggan?status=AKTIF&cari=Toko%20Bangunan%20Makmur',
  );
  expect(aktif).toHaveLength(0);
});
