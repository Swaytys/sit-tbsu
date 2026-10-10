import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu pemasok dan satu barang uji (lalu menonaktifkannya) serta satu penerimaan
// di database pengembangan setiap kali jalan. Penerimaan tidak bisa dihapus (docs/05 E5).

test(
  'Admin mencatat penerimaan tunai; stok bertambah; riwayat dan bukti terima tampil',
  { tag: '@kritis' },
  async ({ page }) => {
    const akhiran = Date.now();
    const namaBarang = `Semen Penerimaan E2E ${akhiran}`;
    const namaPemasok = `Pemasok E2E ${akhiran}`;
    await masukCepat(page, 'ADMIN');

    // Susun data master lewat API (alur master sudah diuji di tes lain).
    const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
    const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
    const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
    const barang = await api<{ id: number }>(page, '/barang', 'POST', {
      namaBarang,
      idKategori: kategori[0]!.id,
      idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
      hargaModalAwal: 10000,
      hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 15000 }],
    });
    const pemasok = await api<{ id: number }>(page, '/pemasok', 'POST', {
      namaPemasok,
      noHp: '081234567890',
    });

    await menuUtama(page).getByRole('link', { name: 'Penerimaan Barang' }).click();
    await page.getByRole('link', { name: 'Catat penerimaan' }).click();
    await page.getByLabel('Pemasok', { exact: true }).click();
    await page.getByRole('option', { name: namaPemasok }).click();
    await page.getByLabel('No. faktur pemasok').fill(`F-${akhiran}`);

    await page.getByLabel('Cari barang').click();
    await page.getByLabel('Cari barang').fill(namaBarang);
    await expect(page.getByRole('option', { name: new RegExp(namaBarang) })).toBeVisible();
    await page.getByLabel('Cari barang').press('Enter');
    await page.getByLabel(`Qty ${namaBarang}`).fill('10');
    await page.getByLabel(`Harga ${namaBarang}`).fill('12000');
    await expect(page.getByText('Rp 120.000').first()).toBeVisible();
    await page.getByRole('button', { name: 'Simpan penerimaan' }).click();

    await expect(page.getByText(/Penerimaan RCV-\d{6}-\d{3,} disimpan/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Penerimaan RCV-/ })).toBeVisible();
    await expect(page.getByText('BUKTI PENERIMAAN BARANG')).toBeVisible();
    await expect(page.getByText('Lunas').first()).toBeVisible();
    const nomor = (await page
      .getByRole('heading', { name: /Penerimaan RCV-/ })
      .textContent())!.replace('Penerimaan ', '');

    // Stok bertambah di Data Barang.
    await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
    await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
    await page.getByLabel('Cari barang').fill(namaBarang);
    await expect(page.getByRole('row').filter({ hasText: namaBarang })).toContainText('10');

    // Riwayat penerimaan.
    await menuUtama(page).getByRole('link', { name: 'Penerimaan Barang' }).click();
    await expect(page.getByRole('heading', { name: 'Penerimaan Barang' })).toBeVisible();
    await page.getByLabel('Cari penerimaan').fill(nomor);
    const baris = page.getByRole('row').filter({ hasText: nomor });
    await expect(baris).toContainText(namaPemasok);
    await expect(baris).toContainText('Rp 120.000');

    // Bersihkan master uji.
    await api(page, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/pemasok/${pemasok.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  },
);
