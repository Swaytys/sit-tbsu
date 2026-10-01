import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji berstok (lalu menonaktifkannya), order, dan penjualan di database
// pengembangan. Shift kasir "Demo Kasir" dibuka bila belum (tutup shift baru ada di Fase 6).

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

async function siapkanBarang(page: Page, nama: string) {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 50000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 62000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '10', hppSatuan: 50000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  return b.id;
}

async function pastikanShift(kasir: Page) {
  const tombol = kasir.getByRole('button', { name: 'Buka shift' });
  if (await tombol.isVisible()) {
    await tombol.click();
    await kasir.getByLabel('Modal awal').fill('100000');
    await kasir.getByRole('dialog').getByRole('button', { name: 'Buka shift' }).click();
    await expect(kasir.getByText(/Shift SHF-\d{6}-\d{3,} dibuka/)).toBeVisible();
  }
}

test('Kasir: keranjang dengan keyboard (F2/Enter), bayar tunai dengan kembalian, struk', async ({
  browser,
}) => {
  const nama = `Bata Kasir E2E ${Date.now()}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const idBarang = await siapkanBarang(admin, nama);
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await menuUtama(kasir).getByRole('link', { name: 'Penjualan Langsung' }).click();
    await expect(kasir.getByText('Total pembayaran')).toBeVisible();
    await kasir.waitForTimeout(500); // status shift dimuat
    await pastikanShift(kasir);

    await kasir.keyboard.press('F2');
    await expect(kasir.getByLabel('Cari barang')).toBeFocused();
    await kasir.keyboard.type(nama);
    await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
    await kasir.keyboard.press('Enter');
    await kasir.getByRole('button', { name: `Tambah ${nama}` }).click();
    await expect(kasir.getByTestId('total-kasir')).toHaveText('Rp 124.000');

    await kasir.getByLabel('Uang diterima').fill('150000');
    await expect(kasir.getByTestId('kembalian')).toHaveText('Rp 26.000');
    await kasir.getByLabel('Uang diterima').press('Enter');
    const dialog = kasir.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: /Transaksi STR-\d{6}-\d{3,} berhasil/ }),
    ).toBeVisible();
    await expect(dialog.getByTestId('struk')).toContainText(nama);
    await expect(dialog.getByTestId('struk')).toContainText('Rp 26.000');
    await dialog.getByRole('button', { name: 'Transaksi baru' }).click();
    await expect(kasir.getByTestId('total-kasir')).toHaveText('Rp 0');

    const b = await api<{ stokFisik: string }>(admin, `/barang/${idBarang}`);
    expect(b.stokFisik).toBe('8.000');

    await kasir.getByRole('tab', { name: 'Riwayat' }).click();
    await expect(kasir.getByRole('row').filter({ hasText: 'Rp 124.000' }).first()).toBeVisible();
  } finally {
    await api(admin, `/barang/${idBarang}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Staf membuat order → Kasir memproses dari antrean → bayar → order selesai', async ({
  browser,
}) => {
  const nama = `Semen Antre E2E ${Date.now()}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const idBarang = await siapkanBarang(admin, nama);
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    const o = await api<{ id: number; nomor: string }>(staf, '/order?kirim=true', 'POST', {
      jenisPenjualan: 'LANGSUNG',
      namaPembeli: 'Tukang (Bp. Joko)',
      baris: [{ idBarang, qty: '3' }],
    });

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.goto(`/order?id=${o.id}`);
    await kasir.getByRole('button', { name: 'Proses ke pembayaran' }).click();
    await expect(kasir).toHaveURL(/penjualan-langsung\?order=/);
    await expect(kasir.getByText(o.nomor).first()).toBeVisible();
    await kasir.waitForTimeout(500);
    await pastikanShift(kasir);
    await expect(kasir.getByTestId('total-kasir')).toHaveText('Rp 186.000');
    await kasir.getByRole('button', { name: 'Uang pas' }).click();
    await kasir.getByRole('button', { name: /Bayar & cetak/ }).click();
    await expect(
      kasir.getByRole('dialog').getByRole('heading', { name: /berhasil/ }),
    ).toBeVisible();
    await expect(kasir.getByRole('dialog').getByTestId('struk')).toContainText('Tukang (Bp. Joko)');

    const selesai = await api<{ status: string; idPenjualan: number }>(admin, `/order/${o.id}`);
    expect(selesai.status).toBe('SELESAI');
    const pj = await api<{ statusPembayaran: string }>(admin, `/penjualan/${selesai.idPenjualan}`);
    expect(pj.statusPembayaran).toBe('LUNAS');
  } finally {
    await api(admin, `/barang/${idBarang}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
