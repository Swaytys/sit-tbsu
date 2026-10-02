import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Menambah satu barang uji (dinonaktifkan di akhir) dan satu penjualan + void di database pengembangan.

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

test('Kasir mengajukan void item → Admin menyetujui dengan refund tunai → stok kembali', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Engsel Void E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 7000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 9000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 7000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  await pastikanShift(admin);
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await pastikanShift(kasir);
    const pj = await api<{ id: number; nomor: string }>(kasir, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '3' }] },
      pembayaran: [{ metode: 'TUNAI' }],
    });

    await menuUtama(kasir).getByRole('link', { name: 'Void Transaksi' }).click();
    await expect(kasir.getByRole('heading', { name: 'Void Transaksi' })).toBeVisible();
    await kasir.getByLabel('Cari transaksi').fill(pj.nomor);
    await kasir.getByRole('button', { name: new RegExp(pj.nomor) }).click();
    await kasir.getByLabel(`Void ${nama}`).check();
    await kasir.getByLabel('Alasan void').fill('Salah ketik qty');
    await kasir.getByRole('button', { name: 'Ajukan void' }).click();
    await expect(kasir.getByText(/Void VD-\d{6}-\d{3,} diajukan/)).toBeVisible();
    expect((await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`)).stokFisik).toBe(
      '7.000',
    );

    await admin.goto('/void?tab=persetujuan');
    const baris = admin.getByRole('row').filter({ hasText: pj.nomor });
    await baris.getByRole('button', { name: 'Putuskan' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Tunai (laci shift saya)' }).click();
    await dialog.getByRole('button', { name: 'Setujui' }).click();
    await expect(admin.getByText(/disetujui; kembalikan Rp 27\.000/)).toBeVisible();
    expect((await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`)).stokFisik).toBe(
      '10.000',
    );
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
