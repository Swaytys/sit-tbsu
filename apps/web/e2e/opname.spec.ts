import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-240: halaman Stok Opname: ringkasan ABC, Kepala Toko menyusun daftar hitung harian acak.
test('Kepala Toko menyusun daftar hitung harian dari halaman Stok Opname', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  // Database uji sekali pakai bisa belum punya barang: siapkan satu.
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: `Opname E2E ${Date.now()}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  await menuUtama(page).getByRole('link', { name: 'Stok Opname' }).click();
  await expect(page.getByRole('heading', { name: 'Stok Opname' })).toBeVisible();
  await expect(page.getByTestId('ringkasan-abc')).toContainText('Kelas A');
  await page.getByLabel('Jumlah barang daftar harian').fill('3');
  await page.getByRole('button', { name: 'Susun daftar hitung hari ini' }).click();
  await expect(
    page.getByText(/Daftar hitung ADJ-\d{6}-\d{3,} disusun \(\d+ barang\)/),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Stok opname ADJ-/ })).toBeVisible();
  // Bersihkan: draf dibatalkan.
  await page.getByRole('button', { name: 'Batalkan draf' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Batalkan/ })
    .click();
  await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
});
