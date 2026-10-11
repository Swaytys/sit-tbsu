import { expect, test, type Page } from '@playwright/test';
import { api, kodePersetujuan, masukCepat, menuUtama } from './pembantu';

// Menambah satu barang uji (dinonaktifkan di akhir) dan satu penjualan + retur di database pengembangan.

async function pastikanShift(page: Page) {
  await page.request.fetch('/api/shift/buka', {
    method: 'POST',
    data: { modalAwal: 0 },
    headers: { origin: new URL(page.url()).origin },
  }); // 409 bila sudah terbuka: diabaikan
}

test('Kasir mengajukan retur refund tunai → Admin menyetujui → stok barang kembali', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Engsel Retur E2E ${kode}`;
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

    await menuUtama(kasir).getByRole('link', { name: 'Retur Penjualan' }).click();
    await expect(kasir.getByRole('heading', { name: 'Retur Penjualan' })).toBeVisible();
    await kasir.getByLabel('Nomor invoice / struk').fill(pj.nomor);
    await kasir.getByRole('button', { name: new RegExp(pj.nomor) }).click();
    await kasir.getByLabel(`Qty retur ${nama}`).fill('2');
    await kasir.getByRole('button', { name: 'Kelebihan beli / sisa proyek' }).click();
    await kasir.getByRole('button', { name: 'Tunai', exact: true }).click();
    await expect(kasir.getByTestId('nilai-retur')).toHaveText('Rp 18.000');
    // Kasir butuh persetujuan: dialog atasan muncul; di sini retur diajukan dulu tanpa atasan.
    await kasir.getByRole('button', { name: 'Ajukan & minta persetujuan' }).click();
    await kasir.getByRole('button', { name: 'Nanti saja, tunggu persetujuan' }).click();
    await expect(kasir.getByText(/Retur \S+ diajukan/)).toBeVisible();
    // Transaksi tetap terpilih: sisa yang bisa diretur dan riwayat returnya langsung tampil.
    await expect(kasir.getByText('Transaksi ini sudah punya 1 retur')).toBeVisible();
    const barisBarang = kasir.getByRole('row').filter({ hasText: nama });
    await expect(barisBarang).toContainText('+ 2 menunggu');
    await expect(barisBarang).toContainText('1 sak');
    expect((await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`)).stokFisik).toBe(
      '7.000',
    );

    await admin.goto('/retur?tab=persetujuan');
    const baris = admin.getByRole('row').filter({ hasText: pj.nomor });
    await baris.getByRole('button', { name: 'Putuskan' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Setujui' }).click();
    await expect(admin.getByText(/Retur \S+ disetujui/)).toBeVisible();
    expect((await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`)).stokFisik).toBe(
      '9.000',
    );
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Retur disetujui dengan kode sekali pakai dari atasan di layar Kasir (K-102)', async ({
  browser,
}) => {
  const nama = `Engsel Setuju E2E ${Date.now()}`;
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
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await pastikanShift(kasir);
    const pj = await api<{ id: number; nomor: string }>(kasir, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '3' }] },
      pembayaran: [{ metode: 'TUNAI' }],
    });

    await kasir.goto('/retur');
    await kasir.getByLabel('Nomor invoice / struk').fill(pj.nomor);
    await kasir.getByRole('button', { name: new RegExp(pj.nomor) }).click();
    // Qty melebihi sisa ditandai dan tombol proses dimatikan.
    await kasir.getByLabel(`Qty retur ${nama}`).fill('4');
    await kasir.getByRole('button', { name: 'Barang cacat / rusak' }).click();
    await expect(kasir.getByText('maksimal 3')).toBeVisible();
    await expect(kasir.getByRole('button', { name: 'Ajukan & minta persetujuan' })).toBeDisabled();
    await kasir.getByLabel(`Qty retur ${nama}`).fill('1');
    await kasir.getByRole('button', { name: 'Ajukan & minta persetujuan' }).click();

    // Retur tersimpan menunggu; kasir meminta kode yang dikirim ke atasan, lalu mengetiknya.
    const dialog = kasir.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Kirim kode ke atasan' }).click();
    await expect(dialog.getByTestId('penerima-kode')).toContainText('Demo Admin');
    const kode = await kodePersetujuan(kasir, 'Demo Admin');
    const isian = dialog.getByLabel('Kode dari atasan (6 angka)');
    await isian.fill(kode === '000000' ? '111111' : '000000');
    await dialog.getByRole('button', { name: 'Setujui dengan kode' }).click();
    await expect(kasir.getByText('Kode salah. Sisa percobaan: 4.').first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await isian.fill(kode);
    await dialog.getByRole('button', { name: 'Setujui dengan kode' }).click();
    await expect(kasir.getByText(/Retur \S+ disetujui/)).toBeVisible();
    expect((await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`)).stokFisik).toBe(
      '8.000',
    );
    // Kasir tetap login sebagai dirinya; riwayat mencatat atasan pemilik kode.
    await kasir.getByRole('tab', { name: 'Riwayat retur' }).click();
    const baris = kasir.getByRole('row').filter({ hasText: pj.nomor });
    await expect(baris).toContainText('Demo Admin (kode atasan)');
    await expect(kasir.getByRole('button', { name: 'Menu pengguna' })).toContainText('Kasir');
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
