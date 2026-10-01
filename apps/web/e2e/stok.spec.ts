import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji berstok kritis (lalu menonaktifkannya) di database pengembangan.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    // POST tanpa isi dikirim sebagai JSON kosong: tanpa Content-Type, CSRF Hono menganggapnya
    // kiriman form dan memeriksa header Sec-Fetch-Site yang tidak dikirim APIRequestContext.
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test('Admin: notifikasi stok kritis → posisi stok → kartu stok; mutasi tercatat', async ({
  page,
}) => {
  const nama = `Bata Stok E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const barang = await api<{ id: number; kode: string }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 900,
    stokMinimum: '10',
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 1200 }],
  });
  try {
    const adj = await api<{ id: number; nomor: string }>(page, '/penyesuaian', 'POST', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang: barang.id, qtyFisik: '3', hppSatuan: 1000 }],
    });
    await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');

    // Lonceng topbar memuat stok kritis (dihitung saat dibuka).
    await page.reload();
    await page.getByRole('button', { name: /^Notifikasi/ }).click();
    await page.getByRole('menuitem', { name: /Stok kritis/ }).click();
    await expect(page.getByRole('heading', { name: 'Stok Persediaan' })).toBeVisible();
    await expect(page).toHaveURL(/tab=posisi&status=KRITIS/);
    const baris = page.getByRole('row').filter({ hasText: nama });
    await expect(baris).toContainText('Kritis');
    await expect(baris).toContainText('Rp 3.000'); // nilai = 3 × 1.000

    // Kartu stok dari nama barang.
    await baris.getByRole('link', { name: nama }).click();
    await expect(page.getByRole('heading', { name: `Kartu Stok — ${nama}` })).toBeVisible();
    await expect(page.getByTestId('kartu-Saldo akhir')).toHaveText('3 sak');
    await expect(page.getByRole('link', { name: adj.nomor })).toBeVisible();

    // Mutasi: cari barang.
    await page.getByRole('tab', { name: 'Mutasi' }).click();
    await page.getByLabel('Cari mutasi barang').fill(barang.kode);
    await expect(page.getByRole('row').filter({ hasText: nama })).toContainText(adj.nomor);

    // Daftar barang menampilkan status stok.
    await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
    await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
    await page.getByLabel('Cari barang').fill(nama);
    await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('Kritis');
  } finally {
    await api(page, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Kasir: kartu peringatan stok di dashboard, tanpa menu Stok Persediaan', async ({ page }) => {
  await masukCepat(page, 'KASIR');
  await expect(page.getByRole('heading', { name: 'Peringatan stok' })).toBeVisible();
  await expect(page.getByTestId('jumlah-peringatan-stok')).toBeVisible();
  await expect(menuUtama(page).getByRole('link', { name: 'Stok Persediaan' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Notifikasi/ }).click();
  await expect(page.getByText('Tidak ada notifikasi.')).toBeVisible();
});
