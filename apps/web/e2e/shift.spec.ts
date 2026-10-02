import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Shift Demo Kasir yang masih terbuka dari uji lain ditutup dulu (uang fisik 0, keterangan "uji otomatis").
// Menambah satu barang uji (dinonaktifkan di akhir) dan satu penjualan tunai di database pengembangan.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test('Kasir: buka shift, kasbon, jual tunai, tutup shift blind count dengan selisih', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: `Lem Shift E2E ${kode}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 8000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 12000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '5', hppSatuan: 8000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    const lama = await api<{ id: number } | null>(kasir, '/shift/saya');
    if (lama) {
      await api(kasir, `/shift/${lama.id}/tutup`, 'POST', {
        uangFisik: 0,
        keterangan: 'uji otomatis',
      });
    }

    await menuUtama(kasir).getByRole('link', { name: 'Shift & Clerical Check' }).click();
    await expect(kasir.getByRole('heading', { name: 'Shift & Clerical Check' })).toBeVisible();
    await kasir.getByLabel('Modal awal').fill('100000');
    await kasir.getByRole('button', { name: 'Buka shift' }).click();
    await expect(kasir.getByText(/Shift SHF-\d{6}-\d{3,} dibuka/)).toBeVisible();

    await kasir.getByLabel('Nominal').fill('15000');
    await kasir.getByLabel('Keterangan').fill('Kasbon Pak Budi');
    await kasir.getByRole('button', { name: 'Catat' }).click();
    await expect(kasir.getByText('Kasbon Pak Budi')).toBeVisible();

    await api(kasir, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '2' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 50000 }],
    }); // saldo sistem = 100.000 + 24.000 − 15.000 = 109.000

    // Blind count: angka sistem belum terlihat sebelum tutup.
    await expect(kasir.getByText('Total saldo sistem')).toHaveCount(0);
    await kasir.getByLabel('Hitung total uang tunai di laci kasir').fill('108000');
    await kasir.getByRole('button', { name: 'Tutup shift' }).click();
    await expect(kasir.getByLabel('Keterangan selisih wajib diisi')).toBeFocused();
    await kasir.getByLabel('Keterangan selisih wajib diisi').fill('Kurang seribu, receh');
    await kasir.getByRole('button', { name: 'Tutup shift' }).click();
    await expect(kasir.getByText('Total saldo sistem')).toBeVisible();
    await expect(kasir.getByTestId('selisih-clerical')).toContainText('Rp 1.000');
    await expect(kasir.getByTestId('selisih-clerical')).toContainText('Kurang');

    await kasir.getByRole('tab', { name: 'Riwayat' }).click();
    await expect(kasir.getByRole('row').filter({ hasText: 'Kurang seribu, receh' })).toBeVisible();
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
