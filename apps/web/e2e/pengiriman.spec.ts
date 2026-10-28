import { expect, test, type Locator, type Page } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-160/K-174: Logistik › Pengiriman (papan). Rit baru (R) → seret order kirim ke grup rit dan lewat menu kartu
// (surat jalan dibuat saat masuk rit) → keluarkan ke Backlog → kirim lewat dialog rit → Dimuat → Berangkat (semua
// surat jalan rit tercetak) → Catat hasil (1 kembali utuh) → Selesai + kirim ulang di Backlog. Data uji dinonaktifkan.

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
    await kasir.addInitScript(() => {
      const w = window as unknown as { cetakSj?: number; judulCetak?: string };
      window.print = () => {
        w.cetakSj = document.querySelectorAll('.area-cetak [data-testid="surat-jalan"]').length;
        w.judulCetak = document.title;
      };
    });
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

    // 2. Invoice A diseret ke grup dengan mouse; invoice B dengan keyboard (K-177): Spasi angkat, panah memilih
    // tempat lepas (grup tujuan berbingkai biru), Spasi lepas.
    await seret(kasir, kasir.getByTestId(`order-kirim-${a.nomor}`), grup);
    await expect(grup).toContainText('1 surat jalan');
    await kasir.getByRole('button', { name: `Seret ${b.nomor}` }).focus();
    await kasir.keyboard.press('Space');
    await kasir.keyboard.press('ArrowRight');
    for (
      let i = 0;
      i < 15 && !/border-blue-500/.test((await grup.getAttribute('class')) ?? '');
      i++
    ) {
      await kasir.keyboard.press('ArrowUp');
    }
    await expect(grup).toHaveClass(/border-blue-500/);
    await kasir.keyboard.press('Space');
    await expect(grup).toContainText('2 surat jalan');
    await expect(kasir.getByTestId(`order-kirim-${a.nomor}`)).toHaveCount(0);
    const sjDi = await api<{ id: number; nomor: string; sopir: string | null }[]>(
      admin,
      `/surat-jalan?status=AKTIF&cari=${b.nomor}`,
    );
    expect(sjDi[0]!.sopir).toBe(`Papan E2E ${kode}`);

    // 2b. K-174: keluarkan surat jalan B → batal, order B kembali ke Backlog; lalu kirim lewat dialog rit.
    await grup.getByRole('button', { name: `Aksi ${sjDi[0]!.nomor}` }).click();
    await kasir.getByRole('menuitem', { name: /Keluarkan ke Backlog/ }).click();
    await expect(grup).toContainText('1 surat jalan');
    await expect(kasir.getByTestId(`order-kirim-${b.nomor}`)).toBeVisible();
    await kasir.getByRole('button', { name: `Aksi ${b.nomor}` }).click();
    await kasir.getByRole('menuitem', { name: /Kirim sebagian/ }).click();
    const dlg = kasir.getByRole('dialog');
    const ritUji = (
      await api<{ id: number; plat: string }[]>(admin, '/perjalanan?status=DIRENCANAKAN')
    ).find((r) => r.plat === truk.plat)!;
    await expect(dlg.getByLabel('Rit pengiriman')).toBeFocused();
    await dlg.getByLabel('Rit pengiriman').selectOption(String(ritUji.id));
    await kasir.keyboard.press('Enter');
    await expect(grup).toContainText('2 surat jalan');

    // 3. Dimuat → Berangkat.
    await grup.getByRole('button', { name: 'Dimuat' }).click();
    await expect(grup.getByText('Dimuat').first()).toBeVisible();
    await grup.getByRole('button', { name: 'Berangkat' }).click();
    const dBerangkat = kasir.getByRole('dialog');
    await dBerangkat.getByRole('radio', { name: /Cetak/ }).click();
    await expect(dBerangkat.getByRole('radio', { name: /Cetak/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await dBerangkat.getByRole('button', { name: /^Berangkat/ }).click();
    const jalan = kasir.locator('[data-testid^="jalan-TRP-"]').filter({ hasText: truk.plat });
    await expect(jalan).toBeVisible();
    // Semua surat jalan rit dicetak sekaligus (2 surat jalan; 4 lembar bila 2 rangkap).
    await expect
      .poll(() => kasir.evaluate(() => (window as unknown as { cetakSj?: number }).cetakSj))
      .toBeGreaterThanOrEqual(2);
    expect(
      await kasir.evaluate(() => (window as unknown as { judulCetak?: string }).judulCetak),
    ).toMatch(/^Surat jalan TRP-/);

    // 4. Catat hasil: SJ pertama semua diterima, SJ kedua 1 kembali utuh.
    await jalan
      .getByRole('button', { name: /^Catat hasil SJ-/ })
      .first()
      .click();
    await kasir.getByRole('button', { name: /Semua diterima/ }).click();
    await expect(jalan.getByTestId('penanda-hasil')).toHaveText('Terkirim semua');
    await jalan
      .getByRole('button', { name: /^Catat hasil SJ-/ })
      .first()
      .click();
    await kasir.getByLabel(`Kembali utuh ${nama}`).fill('1');
    // K-176: alasan wajib; kirim ulang = barang tetap milik pembeli dan kembali ke Backlog.
    await kasir.getByLabel(`Alasan kembali ${nama}`).selectOption('KIRIM_ULANG');
    await kasir.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(jalan).toHaveCount(0);
    const kartuSelesai = kasir
      .locator('[data-testid^="selesai-TRP-"]')
      .filter({ hasText: truk.plat });
    await expect(kartuSelesai).toBeVisible();
    // K-176: penanda hasil per surat jalan.
    await expect(kartuSelesai).toContainText('Terkirim semua');
    await expect(kartuSelesai).toContainText('Ada yang kembali');
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
