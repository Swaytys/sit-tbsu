import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-125: order pembelian: draf → kirim → konfirmasi → terima barang dari PO (form penerimaan terisi) → selesai.
// Menambah pemasok dan barang uji (dinonaktifkan di akhir).

test.use({ viewport: { width: 1280, height: 800 } });

test('Admin membuat order pembelian, mengirim, mengonfirmasi, lalu menerima barangnya', async ({
  page,
}) => {
  const kode = Date.now();
  const namaPemasok = `Pemasok PO E2E ${kode}`;
  const namaBarang = `Keramik PO E2E ${kode}`;
  await masukCepat(page, 'ADMIN');
  const pm = await api<{ id: number }>(page, '/pemasok', 'POST', {
    namaPemasok,
    noHp: `+62813${String(kode).slice(-8)}`,
  });
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });

  try {
    await menuUtama(page).getByRole('link', { name: 'Order Pembelian' }).click();
    await expect(page.getByRole('heading', { name: 'Order Pembelian' })).toBeVisible();
    await page.getByRole('button', { name: 'Order pembelian baru' }).click();
    const dialog = page.getByRole('dialog', { name: 'Order pembelian baru' });
    await dialog.getByRole('combobox', { name: 'Pemasok' }).selectOption({ label: namaPemasok });
    await dialog.getByLabel('Tambah barang').fill(namaBarang);
    await expect(page.getByRole('option', { name: new RegExp(namaBarang) })).toBeVisible();
    await dialog.getByLabel('Tambah barang').press('Enter');
    await dialog.getByLabel(`Qty ${namaBarang}`).fill('20');
    await expect(dialog.getByText('Rp 800.000').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Simpan draf' }).click();
    await expect(page.getByText('Draf order pembelian dibuat.')).toBeVisible();

    const rincian = page.getByTestId('rincian-po');
    await expect(rincian).toContainText('Draf');
    // K-236: kesepakatan terisi bawaan dari pemasok (tanpa tempo = tunai saat barang datang).
    await expect(page.getByTestId('kotak-kesepakatan')).toContainText('Tunai saat barang datang');
    await rincian.getByRole('button', { name: 'Kirim ke pemasok' }).click();
    await expect(rincian).toContainText(/PO-\d{6}-\d{3}/);
    await expect(rincian).toContainText('Dipesan');

    await rincian.getByRole('button', { name: 'Konfirmasi pemasok' }).click();
    const konf = page.getByRole('dialog', { name: /Konfirmasi pemasok/ });
    await konf.getByLabel(`Qty dikirim ${namaBarang}`).fill('15');
    await konf.getByRole('button', { name: 'Simpan konfirmasi' }).click();
    await expect(rincian).toContainText('Dikonfirmasi');
    await expect(rincian).toContainText('pesan awal 20');

    await rincian.getByRole('link', { name: 'Terima barang' }).click();
    await expect(
      page.getByRole('heading', { name: /Catat penerimaan barang dari PO-/ }),
    ).toBeVisible();
    await expect(page.getByLabel(`Qty ${namaBarang}`)).toHaveValue('15');
    // K-196: bayar transfer wajib nomor referensi bukti transfer.
    await page.getByLabel('No. referensi transfer (wajib)').fill(`TRF${String(kode).slice(-6)}`);
    await page.getByRole('button', { name: 'Simpan penerimaan' }).click();
    await expect(page.getByText(/Penerimaan RCV-\d{6}-\d{3,} disimpan/)).toBeVisible();
    await expect(page.getByRole('link', { name: /PO-\d{6}-\d{3}/ })).toBeVisible();
    await page.getByRole('link', { name: /PO-\d{6}-\d{3}/ }).click();
    await expect(page.getByTestId('rincian-po')).toContainText('Selesai');

    const ukuran = await page.evaluate(() => ({
      isi: document.documentElement.scrollWidth,
      tampak: document.documentElement.clientWidth,
    }));
    expect(ukuran.isi).toBeLessThanOrEqual(ukuran.tampak + 1);
    await page.screenshot({ path: 'test-results/order-pembelian.png' });
  } finally {
    await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/pemasok/${pm.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

// K-225: order di atas batas tanpa persetujuan diajukan, disetujui orang lain (bukan pembuatnya), lalu dikirim.
test('Order pembelian besar diajukan, disetujui Owner, lalu dikirim ke pemasok', async ({
  page,
  browser,
}) => {
  const kode = Date.now();
  const namaBarang = `Besi PO Setuju ${kode}`;
  await masukCepat(page, 'ADMIN');
  const pm = await api<{ id: number }>(page, '/pemasok', 'POST', {
    namaPemasok: `Pemasok Setuju ${kode}`,
    noHp: `+62814${String(kode).slice(-8)}`,
  });
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  const po = await api<{ id: number }>(page, '/order-pembelian', 'POST', {
    idPemasok: pm.id,
    tanggalKirimDiminta: '2099-12-31',
    caraKirim: 'DIANTAR',
    syaratBayar: 'SAAT_TERIMA',
    baris: [{ idBarang: b.id, qty: '100', harga: 40000 }],
  });
  const owner = await browser.newPage();
  try {
    await page.goto(`/order-pembelian?id=${po.id}`);
    const rincian = page.getByTestId('rincian-po');
    await expect(page.getByTestId('kotak-persetujuan')).toContainText('Wajib disetujui');
    await expect(rincian.getByRole('button', { name: 'Kirim ke pemasok' })).toHaveCount(0);
    await rincian.getByRole('button', { name: 'Ajukan persetujuan' }).click();
    await expect(rincian).toContainText('Menunggu persetujuan');
    // Pembuat order tidak mendapat tombol Setujui untuk ordernya sendiri.
    await expect(rincian.getByRole('button', { name: 'Setujui' })).toHaveCount(0);

    await masukCepat(owner, 'OWNER');
    await owner.goto(`/order-pembelian?id=${po.id}`);
    const r2 = owner.getByTestId('rincian-po');
    await r2.getByRole('button', { name: 'Setujui' }).click();
    const d = owner.getByRole('dialog', { name: /Setujui draf/ });
    await d.getByLabel('Catatan persetujuan').fill('Stok besi menipis');
    await d.getByRole('button', { name: 'Setujui order' }).click();
    await expect(owner.getByText('Order disetujui.')).toBeVisible();
    await expect(r2).toContainText('Stok besi menipis');

    await page.reload();
    await expect(rincian).toContainText('Disetujui');
    await rincian.getByRole('button', { name: 'Kirim ke pemasok' }).click();
    await expect(rincian).toContainText(/PO-\d{6}-\d{3}/);
    await expect(rincian).toContainText('Stok besi menipis');
  } finally {
    await owner.close();
    await api(page, `/order-pembelian/${po.id}/batal`, 'POST', { alasan: 'Selesai uji' }).catch(
      () => undefined,
    );
    await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/pemasok/${pm.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
