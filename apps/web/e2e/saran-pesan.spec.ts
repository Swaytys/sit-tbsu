import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-113: rekomendasi pemesanan ulang. Pemasok punya lama kirim dan jarak belanja; tab Saran Pesan menampilkan
// barang per pemasok dengan penjelasan rumusnya. Barang baru tanpa riwayat penjualan = "Tidak laku".

test.use({ viewport: { width: 1280, height: 800 } });

test('Admin mengisi lama kirim pemasok; Saran Pesan menampilkan barangnya beserta penjelasan rumus', async ({
  page,
}) => {
  const kode = Date.now();
  const namaPemasok = `Pemasok Saran E2E ${kode}`;
  const namaBarang = `Bata Saran E2E ${kode}`;
  await masukCepat(page, 'ADMIN');

  // 1. Data Pemasok: tambah pemasok dengan lama kirim 2 hari dan belanja tiap 5 hari.
  await page.goto('/pemasok');
  await page.getByRole('button', { name: /Tambah pemasok/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah pemasok' });
  await dialog.getByLabel('Nama pemasok').fill(namaPemasok);
  await dialog.getByLabel('No. HP / telepon').fill(`08${String(Date.now()).slice(-10)}`);
  await dialog.getByLabel('Lama kirim (hari)').fill('2');
  await dialog.getByLabel('Belanja tiap (hari)').fill('5');
  await dialog.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(new RegExp(`Pemasok ${namaPemasok} ditambahkan`))).toBeVisible();
  const pm = (
    await api<{ id: number; namaPemasok: string; lamaKirimHari: number | null }[]>(
      page,
      `/pemasok?cari=${encodeURIComponent(namaPemasok)}`,
    )
  )[0]!;
  expect(pm.lamaKirimHari).toBe(2);

  // 2. Barang dibeli dari pemasok itu (penerimaan pembelian tunai).
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 1000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 1500 }],
  });
  await api(page, '/penerimaan', 'POST', {
    idPemasok: pm.id,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TUNAI',
    metodeBayar: 'TRANSFER',
    baris: [{ idBarang: b.id, qtyMasuk: '50', hargaModalMasuk: 1000 }],
  });

  try {
    // 3. Stok Persediaan › Saran pesan: tampilkan semua barang dari pemasok itu.
    await page.goto('/persediaan?tab=saran-pesan');
    await expect(page.getByRole('tab', { name: 'Saran pesan' })).toHaveAttribute(
      'data-state',
      'active',
    );
    await page.getByLabel('Tampilkan').selectOption('SEMUA');
    await page.getByLabel('Pemasok').selectOption({ label: namaPemasok });
    const grup = page.getByTestId('grup-saran-pesan').filter({ hasText: namaPemasok });
    await expect(grup).toContainText('kirim 2 hari · belanja tiap 5 hari');
    const baris = grup.getByRole('row').filter({ hasText: namaBarang });
    await expect(baris).toContainText('Tidak laku'); // belum ada penjualan sebelum hari ini
    await expect(baris).toContainText('50');

    // 4. Penjelasan rumus.
    await page.getByRole('button', { name: /Cara sistem menghitung saran pesan/ }).click();
    await expect(page.getByText(/8 × \(3 \+ 7\) \+ 16 − 40/)).toBeVisible();
    await page.keyboard.press('Escape');

    // 5. Halaman tidak bergulir menyamping di 1280 px.
    const lebar = await page.evaluate(() => ({
      isi: document.documentElement.scrollWidth,
      tampak: document.documentElement.clientWidth,
    }));
    expect(lebar.isi).toBeLessThanOrEqual(lebar.tampak + 1);
  } finally {
    await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/pemasok/${pm.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
