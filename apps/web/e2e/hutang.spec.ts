import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Fase 10: hutang pemasok, retur ke pemasok, dan stok rusak. Tes menambah satu pemasok, satu barang uji,
// penerimaan tempo, penyesuaian, retur, dan pembayaran di database pengembangan setiap kali jalan.

test('Admin membayar hutang, meretur barang rusak ke pemasok, dan memusnahkan sisanya', async ({
  page,
}) => {
  const akhiran = Date.now();
  const namaBarang = `Semen Hutang E2E ${akhiran}`;
  const namaPemasok = `Pemasok Hutang E2E ${akhiran}`;
  await masukCepat(page, 'ADMIN');

  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const barang = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 10000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 15000 }],
  });
  const pemasok = await api<{ id: number }>(page, '/pemasok', 'POST', {
    namaPemasok,
    noHp: '081234567890',
  });
  const rcv = await api<{ id: number; nomor: string }>(page, '/penerimaan', 'POST', {
    idPemasok: pemasok.id,
    jenis: 'PEMBELIAN',
    syaratBayar: 'TEMPO',
    tanggalJatuhTempo: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    noFakturPemasok: `FH-${akhiran}`,
    baris: [{ idBarang: barang.id, qtyMasuk: '10', hargaModalMasuk: 10000 }],
  });

  // --- Hutang Pemasok: bayar sebagian lewat transfer ---
  await menuUtama(page).getByRole('link', { name: 'Hutang Pemasok' }).click();
  await expect(page.getByRole('heading', { name: 'Hutang Pemasok' })).toBeVisible();
  await page.getByLabel('Cari hutang').fill(rcv.nomor);
  const baris = page.getByRole('row', { name: new RegExp(rcv.nomor) });
  await expect(baris).toContainText('Rp 100.000');
  await baris.getByRole('button', { name: 'Bayar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Bayar hutang ${rcv.nomor}` });
  await dialog.getByLabel('Nominal').fill('40000');
  await dialog.getByRole('button', { name: 'Simpan pembayaran' }).click();
  await expect(dialog.getByText('Rekening tujuan wajib diisi untuk transfer.')).toBeVisible();
  await dialog.getByLabel('Rekening tujuan').fill('BCA 123 a.n. Pemasok');
  await dialog.getByRole('button', { name: 'Simpan pembayaran' }).click();
  await expect(page.getByText(/PBP-\d{6}-\d{3,} dicatat; sisa hutang Rp 60\.000/)).toBeVisible();
  await expect(baris).toContainText('Sebagian');
  await baris.getByRole('button', { name: `Riwayat pembayaran ${rcv.nomor}` }).click();
  await expect(page.getByRole('dialog')).toContainText('BCA 123 a.n. Pemasok');
  await page.keyboard.press('Escape');

  // --- Pindahkan 3 sak ke stok rusak, lalu retur 2 sak (potong hutang) dari tab Stok rusak ---
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'RUSAK',
    alasan: 'Sak basah E2E',
    baris: [{ idBarang: barang.id, qtySelisih: '3' }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST', {});

  await page.goto('/persediaan?tab=rusak');
  await page.getByLabel('Cari stok rusak').fill(namaBarang);
  const rusak = page.getByRole('row', { name: new RegExp(namaBarang) });
  await expect(rusak).toContainText('3 sak');
  await rusak.getByRole('link', { name: 'Retur ke pemasok' }).click();
  await expect(page.getByRole('heading', { name: 'Retur ke pemasok' })).toBeVisible();
  await expect(page.getByLabel(`Qty ${namaBarang}`)).toHaveValue('3');
  await page.getByLabel(`Qty ${namaBarang}`).fill('2');
  await page.getByLabel('Pemasok', { exact: true }).click();
  await page.getByRole('option', { name: namaPemasok }).click();
  await page.getByLabel('Hutang yang dipotong').click();
  await page.getByRole('option', { name: new RegExp(rcv.nomor) }).click();
  await page.getByLabel('Alasan retur').fill('Sak basah, diklaim ke pemasok');
  await expect(page.getByText('Rp 20.000').first()).toBeVisible();
  await page.getByRole('button', { name: 'Simpan retur' }).click();
  await expect(page.getByText(/Retur RTP-\d{6}-\d{3,} disimpan/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /RTP-/ })).toContainText('Potong hutang');
  await expect(page.getByText(rcv.nomor)).toBeVisible();

  // Hutang berkurang Rp 20.000 (sisa 40.000).
  const hutang = await api<unknown>(page, `/hutang/PENERIMAAN/${rcv.id}/pembayaran`);
  expect(hutang).toHaveLength(1);
  await page.goto('/hutang');
  await page.getByLabel('Cari hutang').fill(rcv.nomor);
  await expect(page.getByRole('row', { name: new RegExp(rcv.nomor) })).toContainText(
    'retur Rp 20.000',
  );

  // --- Musnahkan sisa 1 sak rusak ---
  await page.goto('/persediaan?tab=rusak');
  await page.getByLabel('Cari stok rusak').fill(namaBarang);
  await page
    .getByRole('row', { name: new RegExp(namaBarang) })
    .getByRole('link', { name: 'Musnahkan' })
    .click();
  await expect(page.getByRole('heading', { name: /Pemusnahan/ })).toBeVisible();
  await expect(page.getByLabel(`Qty dimusnahkan ${namaBarang}`)).toHaveValue('1');
  await page.getByRole('button', { name: 'Simpan & selesaikan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
  await expect(page.getByText('Alasan pemusnahan wajib diisi.')).toBeVisible();
  await page.getByLabel('Alasan').fill('Pecah, dibuang');
  await page.getByRole('button', { name: 'Simpan & selesaikan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
  await expect(page.getByText(/ADJ-\d{6}-\d{3,} selesai; stok diperbarui/)).toBeVisible();

  const stok = await api<{ stokFisik: string; stokRusak: string }>(page, `/barang/${barang.id}`);
  expect(stok).toMatchObject({ stokFisik: '7.000', stokRusak: '0.000' });

  // Kasir tidak melihat menu hutang dan retur pemasok.
  await page.context().clearCookies();
  await masukCepat(page, 'KASIR');
  await expect(menuUtama(page).getByRole('link', { name: 'Hutang Pemasok' })).toHaveCount(0);
  await expect(menuUtama(page).getByRole('link', { name: 'Retur ke Pemasok' })).toHaveCount(0);
});
