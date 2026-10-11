import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-104: penjualan pengantaran dibuat langsung di halamannya (tanpa order dari Order Penjualan), pelanggan
// dipilih dengan klik, dan cara bayar dipilih tegas (di sini "Bayar nanti"). Menambah barang, pelanggan, dan
// invoice uji di database pengembangan (barang & pelanggan dinonaktifkan di akhir).
test('Pengantaran tanpa order: pilih pelanggan dengan klik, bayar nanti → invoice piutang', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number; kode: string }>(admin, '/barang', 'POST', {
    namaBarang: `Pipa Antar E2E ${kode}`,
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
  const namaPlg = `Pak Antar E2E ${kode}`;
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: namaPlg,
    noHp: '081200000002',
    alamat: 'Jl. Antar No. 9',
  });
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila shift sudah terbuka: diabaikan
    await menuUtama(kasir).getByRole('link', { name: 'Penjualan Pengantaran' }).click();

    // Barang belum bisa ditambah sebelum pelanggan dipilih: kotak pilih pelanggan terbuka sendiri.
    await kasir.getByLabel('Cari barang').click();
    await kasir.keyboard.type(barang.kode);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByText('Pilih pelanggan dulu (F4)')).toBeVisible();
    await expect(kasir.getByLabel('Cari pelanggan')).toBeFocused();

    // Pelanggan dipilih dengan mouse; alamat kirim terisi dari data pelanggan.
    await kasir.getByLabel('Cari pelanggan').fill(namaPlg);
    await kasir.getByRole('option', { name: new RegExp(namaPlg) }).click();
    await expect(kasir.getByRole('button', { name: new RegExp(namaPlg) })).toBeVisible();
    await expect(kasir.getByLabel('Alamat kirim')).toHaveValue('Jl. Antar No. 9');
    await kasir.getByLabel('Ongkos kirim').fill('25000');

    await kasir.getByLabel('Cari barang').click();
    await kasir.keyboard.type(`2*${barang.kode}`);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 125.000');

    // Cara bayar dipilih dengan klik: seluruh tagihan menjadi piutang.
    await kasir.getByRole('radio', { name: /Bayar nanti/ }).click();
    await expect(kasir.getByTestId('ringkas-piutang')).toContainText(
      'Seluruh tagihan jadi piutang',
    );
    await expect(kasir.getByTestId('ringkas-piutang')).toContainText('Rp 125.000');
    await kasir.getByRole('button', { name: /Buat invoice/ }).click();
    const hasil = kasir.getByTestId('hasil-transaksi');
    await expect(hasil).toContainText(/Invoice INV-\d{6}-\d{3,} dibuat/);
    await expect(hasil).toContainText('sisa Rp 125.000');

    const [inv] = await api<{ id: number }[]>(
      admin,
      `/penjualan?jenis=PENGANTARAN&cari=${encodeURIComponent(namaPlg)}`,
    );
    const detail = await api<{
      statusPembayaran: string;
      alamatKirim: string;
      ongkir: number;
      sisaTagihan: number;
    }>(admin, `/penjualan/${inv!.id}`);
    expect(detail).toMatchObject({
      statusPembayaran: 'BELUM_BAYAR',
      alamatKirim: 'Jl. Antar No. 9',
      ongkir: 25000,
      sisaTagihan: 125000,
    });
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
