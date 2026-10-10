import { expect, test } from '@playwright/test';
import { aktifkanTierGrosir, api, masukCepat } from './pembantu';

// K-098: tier harga dipakai otomatis menurut total nilai belanja transaksi, untuk semua barang.
// Mengandalkan data seed: tier Normal (harga dasar) dan Grosir (markup 20%, nonaktif). Grosir diaktifkan
// selama tes dan dipulihkan di akhir agar tes lain (yang menghitung dengan harga Normal) tidak terpengaruh.

test('tier menurut nilai belanja: syarat di Kelola tier, harga Grosir otomatis di kasir', async ({
  page,
}) => {
  const nama = `Kawat Tier E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  // Modal 10.000: Normal diisi Rp 15.000; Grosir = 10.000 × 1,2 = 12.000.
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 10000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 15000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '50', hppSatuan: 10000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const grosir = await aktifkanTierGrosir(page, 900_000_000);

  try {
    // Kelola tier: Grosir mulai belanja Rp 100.000.
    await page.goto('/harga-jual');
    await page.getByRole('button', { name: 'Kelola tier' }).click();
    const dialog = page.getByRole('dialog', { name: 'Kelola tier harga' });
    await dialog.getByRole('button', { name: 'Aksi untuk Grosir' }).click();
    await page.getByRole('menuitem', { name: 'Ubah' }).click();
    await dialog.getByLabel('Mulai belanja').fill('100000');
    await dialog.getByRole('button', { name: 'Simpan tier' }).click();
    await expect(page.getByText('Tier Grosir disimpan.')).toBeVisible();
    await expect(dialog.getByRole('row').filter({ hasText: 'Grosir' })).toContainText(
      'Belanja mulai Rp 100.000',
    );
    await dialog.getByRole('button', { name: 'Tutup' }).first().click();

    // Tabel Harga Jual: syarat tampil di judul kolom; harga Grosir hanya tampil.
    await expect(page.getByRole('columnheader', { name: /Grosir/ })).toContainText(
      'belanja mulai Rp 100.000',
    );
    await page.getByLabel('Cari barang', { exact: true }).fill(nama);
    await expect(page.getByLabel(`Harga Grosir ${nama}`, { exact: true })).toHaveText('Rp 12.000');

    // Kasir: 6 sak = Rp 90.000 masih harga Normal, dengan petunjuk kekurangan belanja.
    await page.request.post('/api/shift/buka', {
      data: { modalAwal: 0 },
      headers: { origin: new URL(page.url()).origin },
    });
    await page.goto('/penjualan-langsung');
    await expect(page.getByTestId('total-pos')).toBeVisible();
    await page.keyboard.press('F2');
    await page.keyboard.type(`${nama}*6`);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('total-pos')).toHaveText('Rp 90.000');
    await expect(page.getByTestId('info-tier-belanja')).toHaveText(
      'Belanja Rp 10.000 lagi untuk harga Grosir.',
    );

    // 7 sak = Rp 105.000 (harga Normal) ≥ syarat: semua barang memakai harga Grosir 12.000.
    await page.keyboard.type(`${nama}*1`);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('total-pos')).toHaveText('Rp 84.000');
    await expect(page.getByTestId('info-tier-belanja')).toContainText(
      'Harga Grosir berlaku untuk semua barang.',
    );
  } finally {
    await grosir.pulihkan();
  }
});
