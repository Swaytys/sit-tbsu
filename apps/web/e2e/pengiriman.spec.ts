import { expect, test, type Locator, type Page } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-160: Logistik › Pengiriman (papan). Rit baru (R) → seret order kirim ke grup rit dan lewat menu kartu →
// Dimuat → Berangkat → Catat hasil (1 kembali utuh) → Selesai + kirim ulang di Backlog. Data uji dinonaktifkan.

async function seret(page: Page, kartu: Locator, tujuan: Locator) {
  const pegangan = kartu.getByRole('button', { name: /^Seret / });
  // Kolom Backlog bisa panjang (data uji lama); kartu bisa di luar layar kolom.
  await pegangan.scrollIntoViewIfNeeded();
  await tujuan.scrollIntoViewIfNeeded();
  const a = (await pegangan.boundingBox())!;
  const b = (await tujuan.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 15 });
  await page.mouse.up();
}

test('Papan Pengiriman: rit rencana, seret kartu, dimuat, berangkat, catat hasil', async ({
  browser,
}) => {
  test.slow();
  const kode = Date.now();
  const nama = `Bata Papan E2E ${kode}`;
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
    baris: [{ idBarang: barang.id, qtyFisik: '20', hppSatuan: 8000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: `Toko Papan E2E ${kode}`,
    noHp: '081200000011',
    alamat: 'Jl. Papan No. 1',
  });
  const truk = await api<{ id: number; plat: string }>(admin, '/kendaraan', 'POST', {
    plat: `N ${kode % 9000} PP`,
    jenis: 'Truk E2E',
  });
  const sopir = await api<{ id: number }>(admin, '/sopir', 'POST', { nama: `Papan E2E ${kode}` });
  const invoice = () =>
    api<{ id: number; nomor: string }>(admin, '/penjualan/checkout', 'POST', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg.id,
        alamatKirim: 'Jl. Papan No. 1',
        baris: [{ idBarang: barang.id, qty: '3' }],
      },
    });
  try {
    const a = await invoice();
    const b = await invoice();
    const kasir = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    await masukCepat(kasir, 'KASIR');
    await kasir.goto('/pengiriman');
    await expect(kasir.getByTestId(`order-kirim-${a.nomor}`)).toBeVisible();

    // 1. Rit baru lewat tombol R.
    await kasir.keyboard.press('r');
    await kasir.getByLabel('Kendaraan rit').selectOption(String(truk.id));
    await kasir.getByLabel('Sopir rit').selectOption(String(sopir.id));
    await kasir.keyboard.press('Enter');
    const grup = kasir.locator('[data-testid^="rit-TRP-"]').filter({ hasText: truk.plat });
    await expect(grup).toContainText('Seret order kirim ke sini');

    // 2. Invoice A diseret ke grup; invoice B lewat menu kartu.
    await seret(kasir, kasir.getByTestId(`order-kirim-${a.nomor}`), grup);
    await expect(grup).toContainText('1 surat jalan');
    await kasir.getByRole('button', { name: `Aksi ${b.nomor}` }).click();
    await kasir.getByRole('menuitem', { name: new RegExp(truk.plat) }).click();
    await expect(grup).toContainText('2 surat jalan');
    await expect(kasir.getByTestId(`order-kirim-${a.nomor}`)).toHaveCount(0);

    // 3. Dimuat → Berangkat.
    await grup.getByRole('button', { name: 'Dimuat' }).click();
    await expect(grup.getByText('Dimuat').first()).toBeVisible();
    await grup.getByRole('button', { name: 'Berangkat' }).click();
    await kasir.getByRole('dialog').getByRole('button', { name: 'Berangkat' }).click();
    const jalan = kasir.locator('[data-testid^="jalan-TRP-"]').filter({ hasText: truk.plat });
    await expect(jalan).toBeVisible();

    // 4. Catat hasil: SJ pertama semua diterima, SJ kedua 1 kembali utuh.
    await jalan
      .getByRole('button', { name: /^Catat hasil SJ-/ })
      .first()
      .click();
    await kasir.getByRole('button', { name: /Semua diterima/ }).click();
    await expect(jalan.getByText('hasil dicatat')).toHaveCount(1);
    await jalan
      .getByRole('button', { name: /^Catat hasil SJ-/ })
      .first()
      .click();
    await kasir.getByLabel(`Kembali utuh ${nama}`).fill('1');
    await kasir.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(jalan).toHaveCount(0);
    await expect(
      kasir.locator('[data-testid^="selesai-TRP-"]').filter({ hasText: truk.plat }),
    ).toBeVisible();
    const ulang = kasir
      .locator('[data-testid^="order-kirim-INV-"]')
      .filter({ hasText: `${nama} 1 sak` });
    await expect(ulang).toContainText('Kirim ulang');
  } finally {
    // Rit yang tertinggal karena uji gagal di tengah dibatalkan agar papan tidak menumpuk.
    const sisa = await api<{ id: number; plat: string }[]>(
      admin,
      '/perjalanan?status=DIRENCANAKAN',
    );
    for (const r of sisa.filter((x) => x.plat === truk.plat)) {
      await api(admin, `/perjalanan/${r.id}/batal`, 'POST', { alasan: 'Sisa uji otomatis papan' });
    }
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/sopir/${sopir.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
