import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
// Mengandalkan data seed: kategori Semen, satuan sak/m, atribut Warna/Panjang, tier Normal/Grosir (20%),
// pembulatan harga 100.

/** PNG 1×1 piksel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function pilih(page: Page, label: string, opsi: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: opsi, exact: true }).click();
}

test('Admin menambah barang dengan atribut dan harga; tinjau harga lalu simpan di Harga Jual', async ({
  page,
}) => {
  // Alur terpanjang (form barang → daftar → Tinjau Harga → Harga Jual → Kelola tier → versi titipan):
  // batas waktu dilonggarkan agar tidak gagal saat komputer sedang sibuk.
  test.slow();
  const nama = `Barang E2E ${Date.now()}`;
  const penitip = `Penitip E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const pemasok = await page.request.post('/api/pemasok', {
    data: { namaPemasok: penitip, noHp: '081234567890' },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(pemasok.ok()).toBe(true);
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await page.getByRole('link', { name: 'Tambah barang' }).click();
  await expect(page.getByRole('heading', { name: 'Tambah barang' })).toBeVisible();

  // Validasi klien: nama wajib.
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText('Nama barang wajib diisi.')).toBeVisible();

  await page.getByLabel('Nama barang').fill(nama);
  await pilih(page, 'Kategori', 'Semen');
  await pilih(page, 'Satuan dasar', 'sak — Sak');
  await page.getByLabel('Harga modal awal').fill('41234');
  await expect(page.getByLabel('Harga modal awal')).toHaveValue('41.234');

  await page.getByRole('button', { name: 'Tambah atribut' }).click();
  await pilih(page, 'Jenis atribut 1', 'Warna');
  await page.getByLabel('Nilai atribut 1').fill('Abu-abu');
  await page.getByRole('button', { name: 'Tambah atribut' }).click();
  await pilih(page, 'Jenis atribut 2', 'Panjang');
  await page.getByLabel('Nilai atribut 2').fill('6');
  await pilih(page, 'Satuan atribut 2', 'm');

  // K-094: harga Normal bawaan ikut markup; barang ini memakai harga tetap dan ditinjau dulu.
  await pilih(page, 'Cara menentukan harga Normal', 'Harga tetap (Rp)');
  await page.getByLabel('Harga Normal', { exact: true }).fill('55000');
  await expect(page.getByRole('switch', { name: 'Harga otomatis' })).toBeChecked();
  await page.getByRole('switch', { name: 'Harga otomatis' }).click();
  await page.getByLabel('Berkas gambar').setInputFiles({
    name: 'semen.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText(/ditambahkan \(BRG-\d{5}\)/)).toBeVisible();
  await expect(page).toHaveURL(/\/barang$/);

  // Daftar: harga Normal tetap, Grosir ikut tier = ceil100(41.234 × 1,2) = 49.500; gambar tampil.
  await page.getByLabel('Cari barang').fill(nama);
  const baris = page.getByRole('row').filter({ hasText: nama });
  await expect(baris).toContainText('Rp 55.000');
  await expect(baris).toContainText('Rp 49.500');
  await expect(baris.locator('img')).toBeVisible();

  // Ubah harga modal awal → barang ditandai perlu tinjau harga (H5).
  await baris.getByRole('link', { name: nama }).click();
  await expect(page.getByLabel('Nilai atribut 2')).toHaveValue('6');
  await page.getByLabel('Harga modal awal').fill('45000');
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText(`Barang ${nama} disimpan.`)).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  await expect(baris).toContainText('Perlu tinjau harga');

  // Tinjau Harga (H6): usulan dari dasar baru 45.000; terapkan tanpa mengganti harga Normal.
  await menuUtama(page).getByRole('link', { name: 'Harga Jual' }).click();
  await expect(page.getByRole('heading', { name: 'Harga Jual' })).toBeVisible();
  await page.getByRole('tab', { name: /Tinjau Harga/ }).click();
  await page.getByLabel('Cari barang ditinjau').fill(nama);
  const barisTinjau = page.getByRole('row').filter({ hasText: nama });
  await expect(barisTinjau).toContainText('Rp 49.500→Rp 54.000'); // Grosir 45.000 × 1,2
  await expect(barisTinjau).toContainText('Rp 55.000→Rp 56.300'); // usulan Normal (K-086)
  await page.getByRole('switch', { name: /Ganti juga harga Normal/ }).click();
  await barisTinjau.getByRole('button', { name: 'Terapkan', exact: true }).click();
  await expect(page.getByText(/Usulan harga 1 barang diterapkan/)).toBeVisible();
  await expect(barisTinjau).toHaveCount(0);

  // Harga per tier: Grosir sudah 54.000 dan hanya tampil (selalu markup tier, K-098); harga Normal diubah.
  await page.getByRole('tab', { name: 'Harga per tier' }).click();
  await page.getByLabel('Cari barang', { exact: true }).fill(nama);
  const barisHarga = page.getByRole('row').filter({ hasText: nama });
  await expect(barisHarga).not.toContainText('Perlu tinjau');
  await expect(page.getByRole('switch', { name: `Harga otomatis ${nama}` })).not.toBeChecked();
  await expect(page.getByLabel(`Harga Normal ${nama}`, { exact: true })).toHaveValue('55.000');
  await expect(page.getByLabel(`Harga Grosir ${nama}`, { exact: true })).toHaveText('Rp 54.000');
  await expect(page.getByRole('button', { name: `Metode harga Grosir ${nama}` })).toHaveCount(0);
  await expect(page.getByText('Cara kerja harga jual')).toBeVisible();
  await page.getByLabel(`Harga Normal ${nama}`, { exact: true }).fill('57000');
  await page.getByRole('button', { name: 'Simpan perubahan (1)' }).click();
  await expect(page.getByText('Harga 1 barang disimpan (1 harga berubah).')).toBeVisible();
  await expect(page.getByLabel(`Harga Normal ${nama}`, { exact: true })).toHaveValue('57.000');

  // Kelola tier: harga dasar ditandai dan dijelaskan; tidak bisa dinonaktifkan.
  await page.getByRole('button', { name: 'Kelola tier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kelola tier harga' });
  const barisNormal = dialog.getByRole('row').filter({ hasText: 'Normal' });
  await expect(barisNormal).toContainText('Harga dasar');
  await expect(barisNormal).toContainText('Semua transaksi');
  await expect(dialog.getByText('Cara kerja tier harga')).toBeVisible();
  await dialog.getByRole('button', { name: 'Aksi untuk Normal' }).click();
  await expect(page.getByRole('menuitem', { name: 'Ubah' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Nonaktifkan' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Tutup' }).first().click();

  // K-094: barang yang sama juga dititipkan pemasok: salin dari menu baris Data Barang.
  await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
  await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  await page.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await page.getByRole('menuitem', { name: 'Daftarkan versi titipan' }).click();
  await expect(page.getByText(/Disalin dari/)).toBeVisible();
  await expect(page.getByLabel('Nama barang')).toHaveValue(nama);
  await expect(page.getByLabel('Nilai atribut 1')).toHaveValue('Abu-abu');
  await page.getByLabel('Pemasok penitip').click();
  await page.getByRole('option', { name: penitip }).click();
  await page.getByLabel('Harga titip').fill('40000');
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page.getByText(/ditambahkan \(BRG-\d{5}\)/)).toBeVisible();

  // Bersihkan: nonaktifkan kedua barang uji (milik toko dan titipan).
  await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
  await page.getByLabel('Cari barang').fill(nama);
  const barisNama = page.getByRole('row').filter({ hasText: nama });
  await expect(barisNama).toHaveCount(2);
  for (const i of [0, 1]) {
    await page
      .getByRole('button', { name: `Aksi untuk ${nama}` })
      .nth(i)
      .click();
    await page.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
    await expect(barisNama.nth(i)).toContainText('Nonaktif');
  }
});

test('halaman form barang tidak membuat seluruh halaman ikut bergulir melewati tata letak', async ({
  page,
}) => {
  await masukCepat(page, 'ADMIN');
  await page.goto('/barang/baru');
  await expect(page.getByRole('heading', { name: 'Tambah barang' })).toBeVisible();
  // Dokumen tidak boleh lebih tinggi dari layar; yang bergulir hanya area konten.
  const tinggi = await page.evaluate(() => ({
    dokumen: document.documentElement.scrollHeight,
    layar: window.innerHeight,
  }));
  expect(tinggi.dokumen).toBeLessThanOrEqual(tinggi.layar);
});
