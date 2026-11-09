import { expect, test, type Page } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

type Penghitung = { id: number; nama: string; peran: string };

async function buatBarang(page: Page, nama: string, stok: string) {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  const sa = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: stok, hppSatuan: 40000 }],
  });
  await api(page, `/penyesuaian/${sa.id}/selesai`, 'POST');
  return b;
}

/** Akun demo penghitung (nama tetap dari data awal). */
async function penghitung(page: Page, nama: string): Promise<Penghitung> {
  const daftar = await api<Penghitung[]>(page, '/opname/penghitung');
  const p = daftar.find((x) => x.nama === nama);
  if (!p) throw new Error(`penghitung ${nama} tidak ada`);
  return p;
}

// K-240/K-227: Kepala Toko menyusun daftar hitung harian untuk penghitung yang dipilih.
test('Kepala Toko menyusun daftar hitung harian untuk penghitung tertentu', async ({ page }) => {
  await masukCepat(page, 'ADMIN');
  const b = await buatBarang(page, `Opname E2E ${Date.now()}`, '5');
  await menuUtama(page).getByRole('link', { name: 'Stok Opname' }).click();
  await expect(page.getByRole('heading', { name: 'Stok Opname' })).toBeVisible();
  await expect(page.getByTestId('ringkasan-abc')).toContainText('Kelas A');
  await page.getByLabel('Jumlah barang daftar harian').fill('3');
  await expect(page.getByRole('button', { name: 'Susun daftar hitung hari ini' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Penghitung' }).click();
  await page
    .getByRole('option', { name: /Petugas Gudang/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Susun daftar hitung hari ini' }).click();
  await expect(
    page.getByText(/Daftar hitung ADJ-\d{6}-\d{3,} disusun \(\d+ barang\) untuk/),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Stok opname ADJ-/ })).toBeVisible();
  const kartu = page.getByTestId('kartu-penghitung');
  await expect(kartu).toContainText('Petugas Gudang');
  await expect(kartu).toContainText('belum mulai');
  // Bersihkan: draf dibatalkan.
  await page.getByRole('button', { name: 'Batalkan draf' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Batalkan/ })
    .click();
  await api(page, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
});

// K-227: hitung buta oleh gudang → selisih → hitung ulang Admin Persediaan dengan timbangan → Kepala menyelesaikan.
test('opname terkendali: hitung buta, hitung ulang orang lain (timbang), sebab baku, diselesaikan Kepala Toko', async ({
  browser,
}) => {
  const nama = `Baut Opname E2E ${Date.now()}`;
  const kepala = await browser.newPage();
  await masukCepat(kepala, 'ADMIN');
  const b = await buatBarang(kepala, nama, '10');
  try {
    // Data timbang lewat Data Barang: 50 buah = 125 g.
    await kepala.goto(`/barang/${b.id}`);
    await kepala.getByLabel('Jumlah sampel timbang').fill('50');
    await kepala.getByLabel('Berat sampel gram').fill('125');
    await kepala.getByRole('button', { name: 'Simpan data timbang' }).click();
    await expect(kepala.getByText('Data timbang disimpan: 50 sak = 125 g.')).toBeVisible();

    // Lembar opname untuk barang uji, ditugaskan ke Petugas Gudang.
    const gudangUser = await penghitung(kepala, 'Demo Petugas Gudang');
    const persediaanUser = await penghitung(kepala, 'Demo Admin Persediaan');
    const d = await api<{ id: number; nomor: string }>(kepala, '/penyesuaian', 'POST', {
      jenis: 'OPNAME',
      baris: [{ idBarang: b.id, qtyFisik: null }],
    });
    await api(kepala, `/opname/${d.id}/penghitung`, 'PATCH', { idPenghitung: gudangUser.id });

    // Gudang: isi daftar baru terlihat setelah "Mulai hitung"; stok sistem tidak tampil.
    const gudang = await browser.newPage();
    await masukCepat(gudang, 'PETUGAS_GUDANG');
    await gudang.goto('/opname');
    await gudang
      .getByTestId('tugas-hitung')
      .getByRole('listitem')
      .filter({ hasText: d.nomor })
      .getByRole('link', { name: 'Mulai hitung' })
      .click();
    await expect(gudang.getByText('Daftar ini ditugaskan ke Anda: 1 barang')).toBeVisible();
    await expect(gudang.getByText(nama)).toHaveCount(0);
    await gudang.getByRole('button', { name: 'Mulai hitung' }).click();
    await gudang.getByLabel(`Jumlah dihitung ${nama}`).fill('9');
    await gudang.getByLabel(`Jumlah dihitung ${nama}`).press('Enter');
    await expect(gudang.getByText(`${nama}: 9 sak tersimpan.`)).toBeVisible();
    await gudang.getByRole('button', { name: /Sudah saya hitung/ }).click();
    await expect(gudang.getByText(/Anda: 9 sak/)).toBeVisible();

    // Kepala: selisih −1 wajib dihitung ulang orang lain; pilih sebab.
    await kepala.goto(`/persediaan/penyesuaian/${d.id}`);
    const baris = kepala.getByRole('row').filter({ hasText: nama });
    await expect(baris).toContainText('Perlu hitung ulang orang lain');
    await expect(baris).toContainText(/9 · Demo Petugas Gudang \d\d:\d\d \(−1\)/);
    await kepala.getByLabel(`Sebab selisih ${nama}`).click();
    await kepala.getByRole('option', { name: 'Hilang', exact: true }).click();
    await kepala.getByRole('button', { name: 'Simpan draf' }).click();
    await expect(kepala.getByText(`Draf ${d.nomor} disimpan.`)).toBeVisible();
    await kepala.getByRole('button', { name: 'Simpan & selesaikan' }).click();
    await kepala.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
    await expect(kepala.getByText(/dihitung ulang oleh orang lain/)).toBeVisible();
    await expect(kepala.getByTestId('perlu-hitung-ulang')).toContainText('1 barang');
    await kepala.getByRole('combobox', { name: 'Tugaskan ke penghitung' }).click();
    await kepala.getByRole('option', { name: new RegExp(persediaanUser.nama) }).click();
    await kepala.getByRole('button', { name: 'Tugaskan', exact: true }).click();
    await expect(kepala.getByText(`ditugaskan ke ${persediaanUser.nama}`)).toBeVisible();

    // Admin Persediaan menghitung ulang dengan timbangan: 22,5 g × 50 ÷ 125 = 9.
    const persediaan = await browser.newPage();
    await masukCepat(persediaan, 'ADMIN_PERSEDIAAN');
    await persediaan.goto(`/opname/${d.id}/hitung`);
    await persediaan.getByRole('button', { name: 'Mulai hitung' }).click();
    const li = persediaan.getByRole('listitem').filter({ hasText: nama });
    await expect(li).toContainText('Perlu dihitung');
    await expect(li).toContainText('Sudah dihitung orang lain');
    await persediaan.getByLabel(`Jumlah dihitung ${nama}`).press('t');
    await persediaan.getByLabel(`Berat bersih gram ${nama}`).fill('22,5');
    await expect(persediaan.getByTestId('perkiraan-timbang')).toHaveText('≈ 9 sak');
    await persediaan.getByLabel(`Berat bersih gram ${nama}`).press('Enter');
    await expect(persediaan.getByText(`${nama}: 9 sak tersimpan.`)).toBeVisible();

    // Kepala: dua hitungan sama → selesaikan; stok 9.
    await kepala.reload();
    await expect(kepala.getByRole('row').filter({ hasText: nama })).toContainText(
      'Dikonfirmasi 2 orang',
    );
    await kepala.getByRole('button', { name: 'Simpan & selesaikan' }).click();
    await kepala.getByRole('alertdialog').getByRole('button', { name: 'Selesaikan' }).click();
    await expect(kepala.getByText(`${d.nomor} selesai; stok diperbarui.`)).toBeVisible();
    const brg = await api<{ stokFisik: string }>(kepala, `/barang/${b.id}`);
    expect(brg.stokFisik).toBe('9.000');
  } finally {
    await api(kepala, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
