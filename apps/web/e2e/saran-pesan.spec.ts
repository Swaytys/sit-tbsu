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
    referensi: 'TRF0001',
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

    // 4b. K-127: stok minimum/maksimum diisi di Data Barang, lalu metode C (tombol 3) memakainya.
    await page.goto(`/barang/${b.id}`);
    await page.getByLabel('Stok minimum').fill('60');
    await page.getByLabel('Stok maksimum (boleh kosong)').fill('120');
    await page.getByRole('button', { name: 'Simpan barang' }).click();
    await expect(page.getByText(/diperbarui|disimpan/).first()).toBeVisible();
    await page.goto('/persediaan?tab=saran-pesan');
    await page.getByLabel('Tampilkan').selectOption('SEMUA');
    await page.getByLabel('Pemasok').selectOption({ label: namaPemasok });
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('3');
    await expect(page.getByRole('button', { name: 'C · Min–maks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('status-hitung')).toContainText('Metode C');
    await expect(baris).toContainText('maks. 120');
    await expect(baris).toContainText('Pesan sekarang'); // tersedia 50 ≤ minimum 60
    await expect(baris).toContainText('70'); // 120 − 50
    // Metode B dengan tingkat layanan; pilihan diingat setelah halaman dimuat ulang.
    await page.getByRole('button', { name: 'B · Statistik' }).click();
    await page.getByLabel('Tingkat layanan').selectOption('98');
    await expect(page.getByTestId('status-hitung')).toContainText('Metode B');
    await page.reload();
    await expect(page.getByRole('button', { name: 'B · Statistik' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Tingkat layanan')).toHaveValue('98');
    await page.getByRole('button', { name: 'A · Rata-rata' }).click();

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
