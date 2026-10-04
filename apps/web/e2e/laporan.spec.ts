import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Menambah satu barang uji (dinonaktifkan di akhir) dan satu penjualan di database pengembangan.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

async function pastikanShift(page: Page) {
  await page.request.fetch('/api/shift/buka', {
    method: 'POST',
    data: { modalAwal: 0 },
    headers: { origin: new URL(page.url()).origin },
  }); // 409 bila sudah terbuka: diabaikan
}

test('Admin: laporan penjualan & gross profit hari ini, ekspor Excel, cetak tercatat', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Keramik Laporan E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 40000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    await pastikanShift(admin);
    const pj = await api<{ nomor: string }>(admin, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '2' }] },
      pembayaran: [{ metode: 'TUNAI' }],
    });

    await menuUtama(admin).getByRole('link', { name: 'Laporan' }).click();
    const daftar = admin.getByRole('navigation', { name: 'Daftar laporan' });
    await daftar.getByRole('button', { name: 'Penjualan per Periode' }).click();
    await expect(
      admin.getByRole('heading', { name: 'Laporan Penjualan per Periode' }).first(),
    ).toBeVisible();
    await admin.getByRole('button', { name: 'Hari ini' }).click();
    const dokumen = admin.getByTestId('dokumen-laporan');
    await expect(dokumen.getByText(pj.nomor)).toBeVisible();
    await expect(dokumen.getByText('PENJUALAN BERSIH', { exact: true })).toBeVisible();

    await daftar.getByRole('button', { name: 'Gross Profit (Laba Kotor)' }).click();
    await expect(
      admin.getByRole('heading', { name: 'Laporan Gross Profit Penjualan' }).first(),
    ).toBeVisible();
    await admin.getByRole('button', { name: 'Hari ini' }).click();
    // Baris barang uji: penjualan 100.000, HPP 80.000, laba kotor 20.000, margin 20%.
    const baris = dokumen.getByRole('row').filter({ hasText: nama });
    await expect(baris).toContainText('100.000');
    await expect(baris).toContainText('80.000');
    await expect(baris).toContainText('20,0%');

    const unduh = admin.waitForEvent('download');
    await admin.getByRole('link', { name: 'Ekspor Excel' }).click();
    expect((await unduh).suggestedFilename()).toMatch(/^laporan-laba-kotor-.*\.xlsx$/);

    await admin.evaluate(() => {
      window.print = () => undefined;
    });
    const catat = admin.waitForResponse((r) => r.url().endsWith('/api/laporan/cetak'));
    await admin.getByRole('button', { name: 'Cetak / PDF' }).click();
    expect((await catat).status()).toBe(200);
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Kasir hanya melihat laporan penjualan & piutang; laporan laba dialihkan', async ({
  page,
}) => {
  await masukCepat(page, 'KASIR');
  await page.goto('/laporan?laporan=laba-kotor');
  await expect(
    page.getByRole('heading', { name: 'Laporan Penjualan per Periode' }).first(),
  ).toBeVisible();
  const daftar = page.getByRole('navigation', { name: 'Daftar laporan' });
  await expect(daftar.getByRole('button', { name: 'Piutang Usaha' })).toBeVisible();
  await expect(daftar.getByRole('button', { name: 'Stok Rekap' })).toHaveCount(0);
  await expect(daftar.getByRole('button', { name: 'Gross Profit (Laba Kotor)' })).toHaveCount(0);
  await expect(page.getByTestId('dokumen-laporan')).not.toContainText('HPP');
});

test('Dashboard per peran: Owner melihat omzet & grafik, Staf tidak', async ({ browser }) => {
  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  await expect(owner.getByRole('heading', { name: 'Dashboard Operasional' })).toBeVisible();
  await expect(owner.getByTestId('dashboard-penjualan-hari-ini')).toBeVisible();
  await expect(
    owner.getByRole('heading', { name: 'Penjualan bersih 7 hari terakhir' }),
  ).toBeVisible();
  await expect(
    owner.getByRole('img', { name: 'Grafik penjualan bersih 7 hari terakhir' }),
  ).toBeVisible();

  const staf = await browser.newPage();
  await masukCepat(staf, 'STAF_PENJUALAN');
  await expect(staf.getByTestId('dashboard-antrean')).toBeVisible();
  await expect(staf.getByTestId('dashboard-penjualan-hari-ini')).toHaveCount(0);
  await expect(staf.getByText('Penjualan bersih 7 hari terakhir')).toHaveCount(0);
});
