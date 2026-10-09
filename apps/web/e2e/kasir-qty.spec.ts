import { expect, test, type Page } from '@playwright/test';
import { masukCepat } from './pembantu';

// K-093: qty di kotak cari kasir bisa ditulis di belakang nama ("semen*3"), dan F1 menyisipkan "*".
// K-094: struk berukuran kertas thermal.
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

test('kasir: "nama*3" dan F1 untuk qty', async ({ page }) => {
  const nama = `Paku Qty E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 1000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 2000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '50', hppSatuan: 1000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  // Nama dengan "*" ditolak.
  const tolak = await page.request.fetch('/api/barang', {
    method: 'POST',
    data: { namaBarang: 'Paku * 5', idKategori: kategori[0]!.id, idSatuanDasar: satuan[0]!.id },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(tolak.status()).toBe(400);

  await page.request.post('/api/shift/buka', {
    data: { modalAwal: 0 },
    headers: { origin: new URL(page.url()).origin },
  });
  await page.goto('/penjualan-langsung');
  await expect(page.getByTestId('total-pos')).toBeVisible();
  await page.keyboard.press('F2');
  await expect(page.getByRole('textbox', { name: 'Cari barang' })).toBeFocused();
  await page.keyboard.type(`${nama}*3`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('total-pos')).toHaveText('Rp 6.000');

  // F1 menyisipkan "*" lalu angka qty; qty barang yang sama bertambah.
  await page.keyboard.type(nama);
  await page.keyboard.press('F1');
  await page.keyboard.type('2');
  await expect(page.getByRole('textbox', { name: 'Cari barang' })).toHaveValue(`${nama}*2`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('total-pos')).toHaveText('Rp 10.000');

  // K-094: struk dicetak di kertas gulungan thermal (lebar 57/58/80 mm, tinggi mengikuti isi), bukan A4.
  await page.evaluate(() => {
    const w = window as unknown as { ukuranStruk?: string };
    window.print = () => {
      w.ukuranStruk = document.querySelector('.area-cetak style')?.textContent ?? '';
    };
  });
  await page.keyboard.press('F8');
  await page.keyboard.type('10000');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hasil-transaksi')).toContainText('LUNAS');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { ukuranStruk?: string }).ukuranStruk))
    .toMatch(/size: (57|58|80)mm \d+mm/);
});
