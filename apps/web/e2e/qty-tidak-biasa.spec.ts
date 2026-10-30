import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-200: qty jauh di atas kebiasaan barang ditandai di keranjang dan dikonfirmasi sebelum bayar.
test('Kasir: qty tidak biasa ditandai dan dikonfirmasi sebelum bayar', async ({ page }) => {
  const kode = Date.now();
  await masukCepat(page, 'KASIR');
  const kat = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const sat = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const admin = await page.context().browser()!.newPage();
  await masukCepat(admin, 'ADMIN');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const b = await api<{ id: number; kode: string }>(admin, '/barang', 'POST', {
    namaBarang: `Lem Qty E2E ${kode}`,
    idKategori: kat[0]!.id,
    idSatuanDasar: sat.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 8000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 10000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '50', hppSatuan: 8000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    await page.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(page.url()).origin },
    });
    await api(page, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: b.id, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 10000 }],
    });
    await page.goto('/penjualan-langsung');
    await expect(page.getByRole('textbox', { name: 'Cari barang' })).toBeVisible();
    await page.waitForTimeout(1000);
    await page.keyboard.press('F2');
    await page.keyboard.type(`20*${b.kode}`);
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('qty-tidak-biasa')).toBeVisible();
    await page.keyboard.press('F8');
    await page.keyboard.press('Enter');
    const d = page.getByTestId('dialog-cek-qty');
    await expect(d).toContainText('biasanya paling banyak 1');
    await d.getByRole('button', { name: /Periksa lagi/ }).click();
    await expect(d).toHaveCount(0);
    await page.keyboard.press('F9');
  } finally {
    await api(admin, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
