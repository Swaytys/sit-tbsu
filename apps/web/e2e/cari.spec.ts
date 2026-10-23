import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-167: pencarian universal Ctrl+K. Menambah satu barang uji (dinonaktifkan di akhir).

test('Ctrl+K: cari barang lalu Enter membuka form barang; menu dan nomor dokumen ikut dicari', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Cat Cari E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 1000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 1500 }],
  });
  try {
    await admin.keyboard.press('Control+k');
    const kotak = admin.getByLabel('Cari di seluruh aplikasi');
    await expect(kotak).toBeFocused();
    await kotak.fill(`Cari E2E ${kode}`);
    await expect(admin.getByRole('option').filter({ hasText: nama })).toBeVisible();
    await admin.keyboard.press('Enter');
    await expect(admin).toHaveURL(new RegExp(`/barang/${barang.id}$`));

    // Menu: "Piutang" ditemukan sebagai halaman.
    await admin.keyboard.press('Control+k');
    await admin.getByLabel('Cari di seluruh aplikasi').fill('piutang');
    await expect(admin.getByRole('option').filter({ hasText: 'Halaman' }).first()).toContainText(
      'Piutang',
    );
    await admin.keyboard.press('Escape');
    await expect(admin.getByLabel('Cari di seluruh aplikasi')).toHaveCount(0);
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
