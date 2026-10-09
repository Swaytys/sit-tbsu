import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// K-095: isian order yang belum dikirim disimpan sebagai draf saat halaman ditinggalkan dan dibuka lagi.
// Menambah satu barang uji di database pengembangan.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test('order penjualan: isian tidak hilang saat pindah halaman (draf); F9 membuang draf', async ({
  page,
}) => {
  const nama = `Draf E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 1000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 3000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '20', hppSatuan: 1000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  // Draf lama pengguna ini (dari percobaan sebelumnya) dibuang agar yang dibuka adalah draf tes ini.
  const lama = await page.request.get('/api/order?status=DRAFT&milikSaya=true&perHalaman=100');
  for (const o of ((await lama.json()) as { data: { id: number }[] }).data) {
    await api(page, `/order/${o.id}/batal`, 'POST', { alasan: 'Bersihkan draf uji' });
  }

  await page.goto('/order');
  const cari = page.getByRole('textbox', { name: 'Cari barang' });
  await expect(cari).toBeFocused();
  await page.keyboard.type(`${nama}*4`);
  await expect(page.getByRole('listbox', { name: 'Hasil cari barang' })).toContainText(nama);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Barang transaksi' })).toContainText(nama);

  // Pindah menu lalu kembali: isian dibuka lagi dari draf.
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await expect(page.getByText(/disimpan sebagai draf/)).toBeVisible();
  await menuUtama(page).getByRole('link', { name: 'Order Penjualan' }).click();
  await expect(page.getByText(/Draf order .* dilanjutkan/)).toBeVisible();
  const keranjang = page.getByRole('listbox', { name: 'Barang transaksi' });
  await expect(keranjang).toContainText(nama);
  await expect(keranjang).toContainText('4');

  // F9: draf dibuang (dibatalkan) dan tidak dibuka lagi.
  await page.keyboard.press('F9');
  await expect(page.getByText('Draf dibuang.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Cari barang' })).toBeVisible();
  await expect(page.getByText('Belum ada barang.')).toBeVisible();
});
