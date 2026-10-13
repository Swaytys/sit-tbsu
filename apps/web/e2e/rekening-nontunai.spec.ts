import { expect, test } from '@playwright/test';
import { api, CATATAN_UJI_E2E, masukCepat } from './pembantu';

// K-111: rekening toko didaftarkan sekali, kasir memilihnya (tidak mengetik), dan Admin mengecek uang masuk.
// K-109: jadwal shift di Pengaturan › Operasional divalidasi. Menambah barang, rekening, dan penjualan uji di
// database pengembangan (barang dan rekening dinonaktifkan di akhir).
test('Admin mendaftarkan rekening → Kasir membayar transfer dengan memilihnya → Admin mengecek uang masuk', async ({
  browser,
}) => {
  const kode = Date.now();
  const bank = `BCA E2E ${String(kode).slice(-6)}`;
  const label = `${bank} 123`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number; kode: string }>(admin, '/barang', 'POST', {
    namaBarang: `Kuas Rekening E2E ${kode}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 4000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 7500 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 4000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  let idRekening: number | null = null;
  try {
    // 1. Admin: Pengaturan › Pembayaran → tambah rekening bank dan jadikan bawaan.
    await admin.goto('/pengaturan?tab=pembayaran');
    const kartu = admin.getByTestId('rekening-TRANSFER');
    await kartu.getByRole('button', { name: 'Tambah' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Tambah rekening toko' });
    await dialog.getByLabel('Nama bank').fill(bank);
    await dialog.getByLabel('Nomor rekening').fill('123');
    await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Simpan' }).click();
    await expect(admin.getByText(`Rekening ${label} ditambahkan.`)).toBeVisible();
    await expect(kartu.getByRole('listitem').filter({ hasText: label })).toContainText('Bawaan');
    idRekening = (await api<{ id: number; nama: string }[]>(admin, '/rekening?status=SEMUA')).find(
      (r) => r.nama === label,
    )!.id;

    // 2. Kasir: B (transfer) → rekening bawaan sudah terpilih, tidak ada yang diketik → Enter.
    const kasir = await browser.newPage();
    await kasir.addInitScript(() => {
      window.print = () => undefined;
    });
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila shift sudah terbuka: diabaikan
    await kasir.goto('/penjualan-langsung');
    await kasir.keyboard.press('F2');
    await expect(kasir.getByLabel('Cari barang', { exact: true })).toBeFocused();
    await kasir.keyboard.type(`2*${barang.kode}`);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 15.000');
    await kasir.keyboard.press('Enter'); // ke pembayaran
    await kasir.keyboard.press('b'); // transfer
    const pilih = kasir.getByLabel('Rekening tujuan');
    await expect(pilih.locator('option:checked')).toHaveText(label);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');

    // 3. Admin: Shift & Clerical Check › Cek uang non-tunai → cocokkan → Sudah masuk.
    await admin.goto('/shift?tab=nontunai');
    await admin.getByLabel('Rekening', { exact: true }).selectOption({ label });
    await expect(admin.getByTestId('ringkasan-nontunai')).toContainText(label);
    await expect(admin.getByTestId('ringkasan-nontunai')).toContainText('Rp 15.000');
    const baris = admin.getByRole('row').filter({ hasText: label });
    await expect(baris).toHaveCount(1);
    await expect(baris).toContainText('Belum dicek');
    await baris.getByRole('button', { name: /^Sudah masuk/ }).click();
    await expect(admin.getByText(/BYR-\d{6}-\d{3,}: sudah masuk\./)).toBeVisible();
    await expect(
      admin.getByText('Tidak ada pembayaran non-tunai yang menunggu dicek.'),
    ).toBeVisible();

    // Hasilnya tampil di rincian penjualan; salah tanda bisa diubah, "tidak masuk" wajib catatan.
    await admin.getByLabel('Hasil cek').selectOption({ label: 'Sudah masuk' });
    const sudah = admin.getByRole('row').filter({ hasText: label });
    await sudah.getByRole('button', { name: /^Ubah hasil cek/ }).click();
    const cek = admin.getByRole('dialog', { name: /^Hasil pengecekan BYR-/ });
    await cek.getByRole('radio', { name: 'Tidak masuk' }).click();
    await expect(cek.getByRole('button', { name: 'Simpan hasil' })).toBeDisabled();
    await cek.getByLabel(/^Catatan/).fill(`Tidak ada di mutasi ${CATATAN_UJI_E2E}`);
    await cek.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(admin.getByText(/BYR-\d{6}-\d{3,}: tidak masuk\./)).toBeVisible();
    await admin.getByLabel('Hasil cek').selectOption({ label: 'Tidak masuk' });
    await admin.getByRole('row').filter({ hasText: label }).getByRole('link').click();
    await expect(admin).toHaveURL(/\/penjualan\/\d+$/);
    await expect(admin.getByRole('row').filter({ hasText: label })).toContainText('Tidak masuk');
  } finally {
    if (idRekening !== null) {
      await api(admin, `/rekening/${idRekening}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Pengaturan › Operasional: jadwal shift dijelaskan dan jam tutup harus setelah jam buka', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/pengaturan?tab=operasional');
  await expect(page.getByText('Jadwal shift', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Perubahan jadwal baru berlaku untuk shift yang dibuka setelah disimpan.'),
  ).toBeVisible();
  const buka = page.getByLabel('Jam buka shift');
  const tutup = page.getByLabel('Jam tutup shift');
  const [asalBuka, asalTutup] = [await buka.inputValue(), await tutup.inputValue()];
  await buka.fill('10:00');
  await tutup.fill('09:00');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Jam tutup shift harus setelah jam buka.')).toBeVisible();
  // Tidak ada yang tersimpan: isian dikembalikan agar form tidak dianggap berubah.
  await buka.fill(asalBuka);
  await tutup.fill(asalTutup);
});
