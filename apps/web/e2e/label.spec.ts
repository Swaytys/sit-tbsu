import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Fase 12 (K-090): cetak label barang dan laporan Daftar Harga. Tidak mengubah data.

test('Admin menyusun label barang dengan barcode; Daftar Harga tampil di Laporan', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  // Database uji sekali pakai (K-119) bisa belum punya barang: siapkan satu barang aktif.
  const namaBarang = `Label E2E ${Date.now()}`;
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByRole('link', { name: 'Cetak label' }).click();
  await expect(page.getByRole('heading', { name: 'Cetak label barang' })).toBeVisible();

  await page.getByLabel('Cari barang').fill(namaBarang);
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.getByLabel('Cari barang').press('Enter');
  await page
    .getByLabel(/^Tambah label/)
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Cetak 2 label' })).toBeVisible();
  // Pratinjau memuat dua label dengan barcode Code 128.
  await expect(page.getByRole('img', { name: /^Barcode / })).toHaveCount(2);

  await page.getByLabel('Jenis label').click();
  await page.getByRole('option', { name: /Stiker barcode/ }).click();
  await page.getByLabel('Tampilkan harga').click();
  await expect(page.getByRole('img', { name: /^Barcode / })).toHaveCount(2);

  await menuUtama(page).getByRole('link', { name: 'Laporan' }).click();
  const daftar = page.getByRole('navigation', { name: 'Daftar laporan' });
  await daftar.getByRole('button', { name: 'Kelompok Laporan Penjualan' }).click();
  await page.getByRole('menuitem', { name: 'Daftar Harga' }).click();
  await expect(page.getByRole('heading', { name: 'Daftar Harga Barang' }).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nama Barang' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
  await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
});
