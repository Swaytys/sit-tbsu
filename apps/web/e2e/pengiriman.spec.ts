import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-149/K-150: papan Pengiriman aktif — perlu surat jalan → siap berangkat (centang + B) → di jalan → catat hasil
// (1 kembali utuh) → muncul lagi di "Perlu surat jalan" sebagai kirim ulang. Data uji dinonaktifkan di akhir.

test('Pengiriman aktif: buat SJ, berangkat dengan kendaraan master, hasil kembali utuh → kirim ulang', async ({
  browser,
}) => {
  test.slow();
  const kode = Date.now();
  const nama = `Bata Kirim E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 8000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 10000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 8000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: `Toko Kirim E2E ${kode}`,
    noHp: '081200000001',
    alamat: 'Jl. Kirim No. 1',
  });
  const truk = await api<{ id: number; plat: string }>(admin, '/kendaraan', 'POST', {
    plat: `N ${kode % 10000} KR`,
    jenis: 'Truk E2E',
  });
  const sopir = await api<{ id: number }>(admin, '/sopir', 'POST', { nama: `Joko E2E ${kode}` });
  try {
    const inv = await api<{ id: number; nomor: string }>(admin, '/penjualan/checkout', 'POST', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg.id,
        alamatKirim: 'Jl. Kirim No. 1',
        baris: [{ idBarang: barang.id, qty: '4' }],
      },
    });

    const kasir = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await masukCepat(kasir, 'KASIR');
    await menuUtama(kasir).getByRole('link', { name: 'Penjualan Pengantaran' }).click();
    await kasir.getByRole('tab', { name: 'Pengiriman aktif' }).click();

    // 1. Perlu surat jalan → buat (qty terisi sisa: 4).
    const perlu = kasir.getByTestId(`perlu-${inv.nomor}`);
    await perlu.getByRole('button', { name: 'Buat surat jalan' }).click();
    await expect(kasir.getByLabel(`Qty kirim ${nama}`)).toHaveValue('4');
    await kasir.getByRole('dialog').getByRole('button', { name: 'Buat surat jalan' }).click();
    await expect(perlu).toHaveCount(0);

    // 2. Siap berangkat: centang, B, pilih kendaraan & sopir, Enter.
    const siap = kasir
      .locator('[data-testid^="siap-SJ-"]')
      .filter({ hasText: `Toko Kirim E2E ${kode}` });
    await siap.getByRole('checkbox').check();
    await kasir.keyboard.press('b');
    await kasir.getByLabel('Kendaraan').selectOption(String(truk.id));
    await kasir.getByLabel('Sopir').selectOption(String(sopir.id));
    await kasir.keyboard.press('Enter');
    await expect(
      kasir.getByText(new RegExp(`TRP-\\d{6}-\\d{3,} berangkat: ${truk.plat}`)),
    ).toBeVisible();

    // 3. Di jalan: catat hasil, 1 kembali utuh.
    const jalan = kasir.locator('[data-testid^="jalan-TRP-"]').filter({ hasText: truk.plat });
    await expect(jalan).toContainText(`Joko E2E ${kode}`);
    await jalan.getByRole('button', { name: /^Catat hasil SJ-/ }).click();
    await kasir.getByLabel(`Kembali utuh ${nama}`).fill('1');
    await expect(kasir.getByRole('dialog').locator('[data-testid^="diterima-"]')).toHaveText('3');
    await kasir.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(kasir.getByText(/Perlu surat jalan" untuk dikirim ulang/)).toBeVisible();
    await expect(jalan).toHaveCount(0);

    // 4. Sisa 1 kembali ke "Perlu surat jalan" sebagai kirim ulang; stok tidak berubah (10 − 4 saat checkout = 6).
    const ulang = kasir.getByTestId(`perlu-${inv.nomor}`);
    await expect(ulang).toContainText('Kirim ulang');
    await expect(ulang).toContainText(`${nama} 1 sak`);
    const b = await api<{ stokFisik: string }>(admin, `/barang/${barang.id}`);
    expect(b.stokFisik).toBe('6.000');
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/sopir/${sopir.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
