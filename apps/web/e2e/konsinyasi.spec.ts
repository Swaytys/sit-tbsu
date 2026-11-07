import { expect, test } from '@playwright/test';
import { api, idRekening, masukCepat, menuUtama } from './pembantu';

// Fase 11: setoran konsinyasi. Tes menambah satu pemasok, satu barang titipan, penerimaan konsinyasi,
// penjualan, setoran, dan pembayaran di database pengembangan setiap kali jalan.

test('Admin membuat setoran konsinyasi dari penjualan titipan lalu melunasinya', async ({
  page,
}) => {
  const akhiran = Date.now();
  const namaBarang = `Cat Titipan E2E ${akhiran}`;
  const namaPemasok = `Penitip E2E ${akhiran}`;
  await masukCepat(page, 'ADMIN');

  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const pemasok = await api<{ id: number }>(page, '/pemasok', 'POST', {
    namaPemasok,
    noHp: '081234567890',
  });
  const barang = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    kepemilikan: 'KONSINYASI',
    idPemasokKonsinyasi: pemasok.id,
    hargaTitip: 20000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 25000 }],
  });
  await api(page, '/penerimaan', 'POST', {
    idPemasok: pemasok.id,
    jenis: 'KONSINYASI',
    baris: [{ idBarang: barang.id, qtyMasuk: '10', hargaModalMasuk: 0 }],
  });
  // Shift admin mungkin sudah terbuka dari tes lain.
  await page.request.post('/api/shift/buka', {
    data: { modalAwal: 0 },
    headers: { origin: new URL(page.url()).origin },
  });
  await api(page, '/penjualan/checkout', 'POST', {
    order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '3' }] },
    pembayaran: [{ metode: 'TRANSFER', idRekening: await idRekening(page), referensi: 'E2E-0001' }],
  });

  await menuUtama(page).getByRole('link', { name: 'Konsinyasi' }).click();
  const baris = page.getByRole('row', { name: new RegExp(namaPemasok) });
  await expect(baris).toContainText('Rp 60.000');
  await baris.getByRole('link', { name: `Buat setoran ${namaPemasok}` }).click();
  await expect(page.getByRole('heading', { name: 'Buat setoran konsinyasi' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(namaBarang) })).toContainText('3 sak');
  await expect(page.getByText('Rp 60.000').first()).toBeVisible();
  await page.getByRole('button', { name: 'Simpan setoran' }).click();
  await expect(page.getByText(/Setoran KSG-\d{6}-\d{3,} disimpan: Rp 60\.000/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /KSG-/ })).toContainText('Belum lunas');

  await page.getByRole('button', { name: 'Bayar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Nominal')).toHaveValue('60.000');
  await dialog.getByLabel('Rekening tujuan').fill('BRI 123 a.n. Penitip');
  // K-196: transfer wajib nomor referensi bukti transfer.
  await dialog.getByLabel('No. referensi (wajib untuk transfer)').fill('TRF445566');
  await dialog.getByRole('button', { name: 'Simpan pembayaran' }).click();
  await expect(page.getByText(/hutang KSG-\d{6}-\d{3,} lunas/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /KSG-/ })).toContainText('Lunas');
  await expect(page.getByText('BRI 123 a.n. Penitip')).toBeVisible();

  await page.goto('/konsinyasi?tab=riwayat');
  await page.getByLabel('Cari setoran konsinyasi').fill(namaPemasok);
  await expect(page.getByRole('row', { name: new RegExp(namaPemasok) })).toContainText('Lunas');
});
