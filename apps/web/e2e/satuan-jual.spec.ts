import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Fase 12 (K-091): satuan jual per barang. Menambah satu barang uji dengan satuan jual "dus" dan satu
// penjualan di database pengembangan setiap kali jalan. Shift kasir dibuka bila belum.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test('Admin mengatur satuan jual dus; kasir menjual per dus dengan tombol S dan pindai barcode dus', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Keramik Dus E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  let satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  if (!satuan.some((s) => s.kode === 'dus')) {
    await api(admin, '/satuan', 'POST', { kode: 'dus', nama: 'Dus', jenisDimensi: 'JUMLAH' });
    satuan = await api(admin, '/satuan?status=AKTIF');
  }
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const satuanDasar = satuan.find((s) => s.kode === 'sak')!;
  const b = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuanDasar.id,
    hargaModalAwal: 4000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 5000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '100', hppSatuan: 4000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');

  // Admin: form barang › Satuan jual: dus isi 10, barcode sendiri, harga otomatis.
  await admin.goto(`/barang/${b.id}`);
  await admin.getByRole('button', { name: 'Tambah satuan jual' }).click();
  await admin.getByLabel('Satuan jual 1', { exact: true }).click();
  await admin.getByRole('option', { name: /\(dus\)/ }).click();
  await admin.getByLabel('Faktor satuan jual 1', { exact: true }).fill('10');
  await admin.getByLabel('Barcode satuan jual 1', { exact: true }).fill(`DUS${kode}`);
  await admin.getByRole('button', { name: 'Simpan satuan jual' }).click();
  await expect(admin.getByText('Satuan jual disimpan.')).toBeVisible();

  // Kasir: tambah barang (satuan dasar), S → dus (harga 10 × 5.000), lalu pindai barcode dus.
  const kasir = await browser.newPage();
  await masukCepat(kasir, 'KASIR');
  await kasir.request.fetch('/api/shift/buka', {
    method: 'POST',
    data: { modalAwal: 0 },
    headers: { origin: new URL(kasir.url()).origin },
  });
  await kasir.goto('/penjualan-langsung');
  await kasir.keyboard.press('F2');
  await expect(kasir.getByLabel('Cari barang')).toBeFocused();
  await kasir.keyboard.type(nama);
  await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
  await kasir.keyboard.press('Enter');
  await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 5.000');
  await kasir.keyboard.press('ArrowDown');
  await kasir.keyboard.press('s');
  await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 50.000');
  await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toContainText('dus');
  await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toContainText('= 10');

  await kasir.keyboard.press('F2');
  await kasir.keyboard.type(`DUS${kode}`);
  await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
  await kasir.keyboard.press('Enter');
  await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 100.000');

  await kasir.keyboard.press('F8');
  await kasir.keyboard.type('100000');
  await kasir.keyboard.press('Enter');
  await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');
  const stok = await api<{ stokFisik: string }>(admin, `/barang/${b.id}`);
  expect(stok.stokFisik).toBe('80.000');

  await menuUtama(admin).getByRole('link', { name: 'Data Barang' }).click();
  await expect(admin.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
});
