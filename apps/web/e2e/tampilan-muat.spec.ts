import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-114: tampilan muat di layar laptop. Deret tab Pengaturan tidak terpotong (membungkus ke baris berikut),
// dan rincian barang yang disorot di layar kasir tampil menutupi area antrean.

test.use({ viewport: { width: 1280, height: 800 } });

test('Pengaturan: semua tab terlihat tanpa digeser di layar 1280 px', async ({ page }) => {
  await masukCepat(page, 'OWNER');
  await page.goto('/pengaturan');
  const deret = page.getByRole('tablist');
  await expect(deret).toBeVisible();
  const lebar = await deret.evaluate((el) => ({ isi: el.scrollWidth, tampak: el.clientWidth }));
  expect(lebar.isi).toBeLessThanOrEqual(lebar.tampak + 1);
  for (const nama of ['Profil toko', 'Promo', 'Persetujuan', 'Cadangan', 'Log aktivitas']) {
    const tab = page.getByRole('tab', { name: nama });
    await expect(tab).toBeInViewport();
  }
  // Halaman sendiri tidak bergulir menyamping.
  const halaman = await page.evaluate(() => ({
    isi: document.documentElement.scrollWidth,
    tampak: document.documentElement.clientWidth,
  }));
  expect(halaman.isi).toBeLessThanOrEqual(halaman.tampak + 1);
});

test('Kasir: barang yang disorot tampil rinci menutupi area antrean; Esc menutupnya', async ({
  page,
}) => {
  const nama = `Keramik Rinci E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number; kode: string }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 30000,
    stokMinimum: '5',
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 45000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '12', hppSatuan: 30000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    await page.goto('/penjualan-langsung');
    await page.keyboard.press('Escape'); // dialog buka shift (bila muncul) ditunda
    await page.getByLabel('Cari barang', { exact: true }).click();
    await page.keyboard.type(b.kode);
    const panel = page.getByTestId('panel-detail-barang');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(nama);
    await expect(panel).toContainText('Tersedia');
    await expect(panel).toContainText('Rp 45.000');
    // Hasil cari tidak bergulir menyamping.
    const daftar = page.getByRole('listbox', { name: 'Hasil cari barang' });
    const lebar = await daftar.evaluate((el) => ({ isi: el.scrollWidth, tampak: el.clientWidth }));
    expect(lebar.isi).toBeLessThanOrEqual(lebar.tampak + 1);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  } finally {
    await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
