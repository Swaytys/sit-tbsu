import { expect, test, type Page } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji (lalu menonaktifkannya) dan beberapa dokumen penyesuaian
// di database pengembangan setiap kali jalan.

async function tambahBarang(page: Page, nama: string) {
  await page.getByLabel('Cari barang').click();
  await page.getByLabel('Cari barang').fill(nama);
  await expect(page.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
  await page.getByLabel('Cari barang').press('Enter');
}

async function selesaikan(page: Page) {
  await page.getByRole('button', { name: 'Simpan & selesaikan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
  await expect(page.getByText(/ADJ-\d{6}-\d{3,} selesai; stok diperbarui/)).toBeVisible();
}

async function stokBarang(page: Page, id: number) {
  return (await api<{ stokFisik: string }>(page, `/barang/${id}`)).stokFisik;
}

test('Admin: saldo awal, koreksi, lalu stok opname mengubah stok sesuai dokumen', async ({
  page,
}) => {
  const nama = `Paku Penyesuaian E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const barang = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 9000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 12000 }],
  });

  // 1. Saldo awal 20 @ 10.000.
  await menuUtama(page).getByRole('link', { name: 'Stok Persediaan' }).click();
  await expect(page.getByRole('heading', { name: 'Stok Persediaan' })).toBeVisible();
  await page.getByRole('tab', { name: 'Penyesuaian' }).click();
  await page.getByRole('link', { name: 'Saldo awal' }).click();
  await expect(page.getByRole('heading', { name: /Saldo awal \(baru\)/ })).toBeVisible();
  await tambahBarang(page, nama);
  await page.getByLabel(`Jumlah awal ${nama}`).fill('20');
  await page.getByLabel(`Nilai ${nama}`).fill('10000');
  await expect(page.getByText('Rp 200.000')).toBeVisible();
  await selesaikan(page);
  await expect(page.getByText('Selesai', { exact: true }).first()).toBeVisible();
  expect(await stokBarang(page, barang.id)).toBe('20.000');

  // 2. Koreksi −2 dengan alasan (wajib).
  await page.goto('/persediaan/penyesuaian/baru?jenis=KOREKSI');
  await tambahBarang(page, nama);
  await page.getByLabel(`Selisih (+/−) ${nama}`).fill('-2');
  await page.getByRole('button', { name: 'Simpan & selesaikan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
  await expect(page.getByText('Alasan koreksi wajib diisi.')).toBeVisible();
  await page.getByLabel('Alasan', { exact: true }).fill('Sak sobek saat bongkar');
  await selesaikan(page);
  expect(await stokBarang(page, barang.id)).toBe('18.000');

  // 3. Stok opname: fisik 17 → selisih −1.
  await page.goto('/persediaan/penyesuaian/baru?jenis=OPNAME');
  await tambahBarang(page, nama);
  await page.getByLabel(`Fisik dihitung ${nama}`).fill('17');
  await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('−1');
  await selesaikan(page);
  await expect(page.getByRole('row').filter({ hasText: nama })).toContainText('−1');
  expect(await stokBarang(page, barang.id)).toBe('17.000');

  // Daftar penyesuaian menampilkan ketiganya sebagai Selesai.
  await page.goto('/persediaan?tab=penyesuaian');
  await expect(page.getByRole('link', { name: /^ADJ-/ }).first()).toBeVisible();

  await api(page, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
});

test('Admin: hapus baris bisa diurungkan; pindah halaman dengan isian belum disimpan diminta konfirmasi', async ({
  page,
}) => {
  const nama = `Kawat Urungkan E2E ${Date.now()}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const barang = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 500,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 700 }],
  });
  try {
    await page.goto('/persediaan/penyesuaian/baru?jenis=KOREKSI');
    await tambahBarang(page, nama);
    await page.getByLabel(`Selisih (+/−) ${nama}`).fill('4');

    await page.getByRole('button', { name: 'Hapus baris 1' }).click();
    await expect(page.getByLabel(`Selisih (+/−) ${nama}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Urungkan' }).click();
    await expect(page.getByLabel(`Selisih (+/−) ${nama}`)).toHaveValue('4');

    await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Tinggalkan halaman ini?' });
    await dialog.getByRole('button', { name: 'Tetap di sini' }).click();
    await expect(page.getByLabel(`Selisih (+/−) ${nama}`)).toHaveValue('4');

    await menuUtama(page).getByRole('link', { name: 'Data Barang' }).click();
    await dialog.getByRole('button', { name: 'Tinggalkan' }).click();
    await expect(page.getByRole('heading', { name: 'Data Barang' })).toBeVisible();
  } finally {
    await api(page, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Admin: barang di lembar opname dikecualikan dengan alasan, tetap tercatat di dokumen', async ({
  page,
}) => {
  const kode = Date.now();
  await masukCepat(page, 'ADMIN');
  const kat = await api<{ id: number }>(page, '/kategori', 'POST', { nama: `Opname E2E ${kode}` });
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const buat = (nama: string) =>
    api<{ id: number }>(page, '/barang', 'POST', {
      namaBarang: nama,
      idKategori: kat.id,
      idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
      hargaModalAwal: 500,
      hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 700 }],
    });
  const a = await buat(`Opname A ${kode}`);
  const b = await buat(`Opname B ${kode}`);
  try {
    await page.goto('/persediaan?tab=penyesuaian');
    await page.getByRole('button', { name: 'Stok opname' }).click();
    await page.getByLabel('Barang yang dihitung').click();
    await page.getByRole('option', { name: `Kategori Opname E2E ${kode}` }).click();
    await page.getByRole('button', { name: 'Buat lembar opname' }).click();
    await expect(page.getByTestId('ringkasan-opname')).toContainText('2 barang');

    // Barang di lembar tidak bisa dihapus, hanya dikecualikan dengan alasan.
    await expect(page.getByRole('button', { name: /^Hapus baris/ })).toHaveCount(0);
    await page.getByLabel(`Fisik dihitung Opname A ${kode}`).fill('5');
    await page.getByRole('button', { name: `Kecualikan Opname B ${kode}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Kecualikan' })).toBeDisabled();
    await dialog.getByLabel('Alasan', { exact: true }).fill('Rak atas belum bisa dijangkau');
    await dialog.getByRole('button', { name: 'Kecualikan' }).click();
    await expect(page.getByTestId('ringkasan-opname')).toContainText('1 dikecualikan');

    await selesaikan(page);
    const barisB = page.getByRole('row').filter({ hasText: `Opname B ${kode}` });
    await expect(barisB).toContainText('Dikecualikan');
    await expect(barisB).toContainText('Rak atas belum bisa dijangkau');
    await expect(barisB).toContainText('oleh');
    expect(await stokBarang(page, a.id)).toBe('5.000');
    expect(await stokBarang(page, b.id)).toBe('0.000');
  } finally {
    for (const id of [a.id, b.id]) {
      await api(page, `/barang/${id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
    await api(page, `/kategori/${kat.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
