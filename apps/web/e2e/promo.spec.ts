import { expect, test, type Page } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Promo (docs/06 §3, K-087): Admin membuat promo untuk satu barang uji lewat halaman Promo, kasir melihat
// potongan di keranjang (pratinjau API), melepas/memasang promo dengan tombol P, lalu struk mencetak nama
// promo. Barang dan promo uji dinonaktifkan di akhir agar tidak memengaruhi tes lain.

async function barangUji(page: Page, nama: string, harga: number) {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number; kode: string }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: Math.round(harga * 0.5),
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: harga }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '20', hppSatuan: Math.round(harga * 0.5) }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  return b;
}

test('Admin membuat promo barang; kasir melihat potongan, melepas/memasang dengan P, struk mencetak promo', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Lem Promo ${kode}`;
  const namaPromo = `Promo E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const lem = await barangUji(admin, nama, 4000);
  let idPromo: number | null = null;
  try {
    // Admin: halaman Promo → buat promo 10% untuk barang uji.
    // K-110: Promo ada di Pengaturan › Promo (bukan menu sendiri); alamat lama /promo dialihkan ke sana.
    await expect(menuUtama(admin).getByRole('link', { name: 'Promo' })).toHaveCount(0);
    await admin.goto('/promo');
    await expect(admin).toHaveURL(/\/pengaturan\?tab=promo$/);
    await expect(admin.getByRole('heading', { name: 'Promo', exact: true })).toBeVisible();
    await admin.getByRole('button', { name: 'Buat promo' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Buat promo' });
    await dialog.getByLabel('Nama promo').fill(namaPromo);
    await dialog.getByLabel('Potongan persen').fill('10');
    await dialog.getByLabel('Sasaran promo').click();
    await admin.getByRole('option', { name: 'Per barang (pilih beberapa)' }).click();
    await dialog.getByLabel('Tambah barang promo').fill(nama);
    await expect(admin.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
    await dialog.getByLabel('Tambah barang promo').press('Enter');
    await expect(dialog).toContainText(nama);
    await dialog.getByRole('button', { name: 'Simpan' }).click();
    await expect(
      admin.getByText(new RegExp(`Promo ${namaPromo} dibuat \\(PRM-\\d{5}\\)`)),
    ).toBeVisible();
    await admin.getByLabel('Cari promo').fill(namaPromo);
    const baris = admin.getByRole('row').filter({ hasText: namaPromo });
    await expect(baris).toContainText('10%');
    await expect(baris).toContainText('Berjalan');
    idPromo = (await api<{ id: number; nama: string }[]>(admin, `/promo?cari=${kode}`))[0]!.id;

    // Kasir: tambah barang → potongan promo tampil dan total memakai hasil API.
    const kasir = await browser.newPage();
    await kasir.addInitScript(() => {
      window.print = () => {
        document.body.dataset.terakhirDicetak =
          document.querySelector('.area-cetak')?.textContent ?? '';
      };
    });
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    });
    await kasir.goto('/penjualan-langsung');
    await kasir.keyboard.press('F2');
    await expect(kasir.getByLabel('Cari barang')).toBeFocused();
    await kasir.keyboard.type(`2*${lem.kode}`);
    await kasir.keyboard.press('Enter');
    const keranjang = kasir.getByRole('listbox', { name: 'Barang transaksi' });
    await expect(keranjang).toContainText(`Promo ${namaPromo} −Rp 800`);
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 7.200');

    // P di daftar barang melepas promo (dicatat log), P lagi memasangnya kembali.
    await kasir.keyboard.press('ArrowDown');
    await kasir.keyboard.press('p');
    await expect(keranjang).toContainText('dilepas');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 8.000');
    await kasir.keyboard.press('p');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 7.200');

    await kasir.keyboard.press('Enter'); // ke pembayaran
    await expect(kasir.getByLabel('Bayar')).toBeFocused();
    await kasir.keyboard.press('Enter'); // uang pas
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');
    await expect
      .poll(() => kasir.evaluate(() => document.body.dataset.terakhirDicetak ?? ''))
      .toContain(`Promo ${namaPromo}`);
    const struk = await kasir.evaluate(() => document.body.dataset.terakhirDicetak ?? '');
    expect(struk).toContain('Rp 7.200');

    // Promo terpakai: aturannya terkunci di form.
    await admin.reload();
    await admin.getByLabel('Cari promo').fill(namaPromo);
    const barisPromo = admin.getByRole('row').filter({ hasText: namaPromo });
    await expect(barisPromo).toContainText('1 baris');
    // K-110: jumlah potongan yang sudah diberikan promo ini tampil di daftar (10% × Rp 8.000 = Rp 800).
    await expect(barisPromo).toContainText('Rp 800');
  } finally {
    if (idPromo !== null) {
      await api(admin, `/promo/${idPromo}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
    await api(admin, `/barang/${lem.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('K-163: kampanye per barang (dua barang), beli 2 gratis 1, simpan sebagai templat, pakai templat', async ({
  page,
}) => {
  test.slow();
  const kode = Date.now();
  await masukCepat(page, 'ADMIN');
  const a = await barangUji(page, `Kampanye A ${kode}`, 5000);
  const b = await barangUji(page, `Kampanye B ${kode}`, 3000);
  const namaPromo = `Kampanye E2E ${kode}`;
  const dibuat: number[] = [];
  try {
    await page.goto('/pengaturan?tab=promo');
    await page.getByRole('button', { name: 'Buat promo' }).click();
    const d = page.getByRole('dialog', { name: 'Buat promo' });
    await d.getByLabel('Nama promo').fill(namaPromo);
    await d.getByLabel('Sasaran promo').click();
    await page.getByRole('option', { name: 'Per barang (pilih beberapa)' }).click();
    for (const x of [a, b]) {
      await d.getByLabel('Tambah barang promo').fill(x.kode);
      await expect(page.getByRole('option', { name: new RegExp(x.kode) })).toBeVisible();
      await d.getByLabel('Tambah barang promo').press('Enter');
    }
    await expect(d.getByRole('button', { name: /^Hapus / })).toHaveCount(2);
    await d.getByLabel('Jenis manfaat').click();
    await page.getByRole('option', { name: 'Beli X gratis Y' }).click();
    await d.getByLabel('Qty beli').fill('2');
    await d.getByLabel('Qty gratis').fill('1');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText(new RegExp(`Promo ${namaPromo} dibuat`))).toBeVisible();
    const p = (await api<{ id: number }[]>(page, `/promo?cari=${kode}`))[0]!;
    dibuat.push(p.id);

    // Qty 6 = 2 paket (2+1) → 2 gratis.
    const pr = await api<{ baris: { namaPromo: string | null; diskonPromo: number }[] }>(
      page,
      '/order/pratinjau',
      'POST',
      {
        idOrder: null,
        order: {
          jenisPenjualan: 'LANGSUNG',
          baris: [
            { idBarang: a.id, qty: '6' },
            { idBarang: b.id, qty: '3' },
          ],
        },
      },
    );
    expect(pr.baris.map((x) => [x.namaPromo, x.diskonPromo])).toEqual([
      [namaPromo, 10_000],
      [namaPromo, 3_000],
    ]);

    // Simpan sebagai templat, lalu pakai templat menjadi promo baru.
    await page.getByLabel('Cari promo').fill(namaPromo);
    await page.getByRole('button', { name: `Aksi untuk ${namaPromo}` }).click();
    await page.getByRole('menuitem', { name: 'Simpan sebagai templat' }).click();
    const dt = page.getByRole('dialog', { name: 'Simpan sebagai templat kampanye' });
    await dt.getByLabel('Nama templat').fill(`Templat ${kode}`);
    await dt.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText(new RegExp(`Templat Templat ${kode} dibuat`))).toBeVisible();
    await page.getByRole('button', { name: 'Templat kampanye' }).click();
    await page.getByLabel('Cari promo').fill(`Templat ${kode}`);
    await expect(page.getByRole('row').filter({ hasText: `Templat ${kode}` })).toContainText(
      'beli 2 gratis 1',
    );
    await page.getByRole('button', { name: `Aksi untuk Templat ${kode}` }).click();
    await page.getByRole('menuitem', { name: 'Pakai templat (promo baru)' }).click();
    const dp = page.getByRole('dialog', { name: new RegExp('Promo baru dari templat') });
    await dp.getByLabel('Nama promo').fill(`${namaPromo} jilid 2`);
    await expect(dp.getByRole('button', { name: /^Hapus / })).toHaveCount(2);
    await dp.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText(new RegExp(`jilid 2 dibuat`))).toBeVisible();
    for (const x of await api<{ id: number }[]>(page, `/promo?cari=${kode}`)) dibuat.push(x.id);
    for (const x of await api<{ id: number }[]>(page, `/promo?cari=${kode}&templat=1`)) {
      dibuat.push(x.id);
    }
  } finally {
    for (const id of new Set(dibuat)) {
      await api(page, `/promo/${id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
    for (const x of [a, b]) {
      await api(page, `/barang/${x.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  }
});
