import { expect, test, type Page } from '@playwright/test';
import { masukCepat } from './pembantu';

// Alur POS K-073 yang dijalankan HANYA dengan keyboard (tanpa klik) untuk Staf & Kasir. Menambah barang,
// pelanggan, order, dan penjualan uji di database pengembangan (barang/pelanggan dinonaktifkan di akhir).
// Shift "Demo Kasir" dibuka bila belum.

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

async function barangUji(page: Page, nama: string, harga: number, stok = '20') {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number; kode: string }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: Math.round(harga * 0.8),
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: harga }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: stok, hppSatuan: Math.round(harga * 0.8) }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  return b;
}

async function bukaShift(kasir: Page) {
  await kasir.request.fetch('/api/shift/buka', {
    method: 'POST',
    data: { modalAwal: 0 },
    headers: { origin: new URL(kasir.url()).origin },
  }); // 409 bila sudah terbuka: diabaikan
}

test('Staf input order cepat → tiket muncul di kasir tanpa reload → kasir bayar dengan keyboard', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const paku = await barangUji(admin, `Paku POS ${kode}`, 2000);
  const semen = await barangUji(admin, `Semen POS ${kode}`, 62000);
  try {
    const kasir = await browser.newPage();
    // Catat isi dokumen yang dicetak (window.print) agar terbukti struk benar-benar dicetak.
    await kasir.addInitScript(() => {
      window.print = () => {
        document.body.dataset.terakhirDicetak =
          document.querySelector('.area-cetak')?.textContent ?? '';
      };
    });
    await masukCepat(kasir, 'KASIR');
    await bukaShift(kasir);
    await kasir.goto('/penjualan-langsung');
    await expect(kasir.getByTestId('total-pos')).toBeVisible();

    // Staf: halaman Order Penjualan langsung siap input; semua dengan keyboard.
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    await staf.goto('/order');
    await expect(staf.getByLabel('Cari barang')).toBeFocused();
    await staf.keyboard.type(`3*Paku POS ${kode}`);
    await expect(staf.getByRole('option', { name: new RegExp(`Paku POS ${kode}`) })).toBeVisible();
    await staf.keyboard.press('Enter');
    await staf.keyboard.type(`Semen POS ${kode}`);
    await staf.keyboard.press('Enter'); // Enter cepat: tetap ditambah walau hasil belum tampil
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 68.000');
    await staf.keyboard.press('Enter'); // kotak kosong → siap kirim
    await staf.keyboard.press('Enter'); // kirim
    const terakhir = staf.getByTestId('order-terakhir');
    await expect(terakhir).toBeVisible();
    const noAntrean = (await terakhir.locator('span').nth(1).textContent())?.trim() ?? '';
    expect(noAntrean).toMatch(/^\d+$/);
    await expect(staf.getByLabel('Cari barang')).toBeFocused();

    // Kasir: tiket muncul sendiri (siaran) dengan isi barang terbaca.
    const tiket = kasir.getByRole('option', { name: `Antrean ${noAntrean}` });
    await expect(tiket).toContainText(`Paku POS ${kode}`);
    await expect(tiket).toContainText('3 sak');
    await expect(tiket).toContainText('Rp 68.000');

    // F3 → antrean; ketik nomor antrean + Enter → order terbuka & kursor di kotak bayar.
    await kasir.keyboard.press('F3');
    await kasir.keyboard.type(noAntrean);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 68.000');
    await expect(kasir.getByLabel('Bayar')).toBeFocused();
    await kasir.keyboard.type('100000');
    await expect(kasir.getByTestId('kembalian')).toHaveText('Rp 32.000');
    await kasir.keyboard.press('Enter');
    const hasil = kasir.getByTestId('hasil-transaksi');
    await expect(hasil).toContainText('LUNAS');
    await expect(hasil).toContainText('Rp 32.000');
    await expect(kasir.getByRole('option', { name: `Antrean ${noAntrean}` })).toHaveCount(0);
    // Struk tercetak otomatis: nomor STR, barang, total, kembalian.
    await expect
      .poll(() => kasir.evaluate(() => document.body.dataset.terakhirDicetak ?? ''))
      .toMatch(/STR-\d{6}-\d{3,}/);
    const struk = await kasir.evaluate(() => document.body.dataset.terakhirDicetak ?? '');
    expect(struk).toContain(`Paku POS ${kode}`);
    expect(struk).toContain('Rp 68.000');
    expect(struk).toContain('Rp 32.000');

    const p = await api<{ stokFisik: string }>(admin, `/barang/${paku.id}`);
    expect(p.stokFisik).toBe('17.000');
  } finally {
    for (const b of [paku, semen]) {
      await api(admin, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  }
});

test('Kasir: jual langsung tanpa order hanya dengan keyboard (F2 → barang → Enter → Enter uang pas)', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kawat = await barangUji(admin, `Kawat POS ${kode}`, 4500);
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await bukaShift(kasir);
    await kasir.goto('/penjualan-langsung');
    await kasir.keyboard.press('F2');
    await expect(kasir.getByLabel('Cari barang')).toBeFocused();
    await kasir.keyboard.type(`2*${kawat.kode}`);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 9.000');
    // Tambah satu lagi lewat daftar barang: ↓ lalu "+".
    await kasir.keyboard.press('ArrowDown');
    await kasir.keyboard.press('+');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 13.500');
    await kasir.keyboard.press('Enter'); // ke pembayaran
    await expect(kasir.getByLabel('Bayar')).toBeFocused();
    await kasir.keyboard.press('Enter'); // kosong = uang pas
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');
    const b = await api<{ stokFisik: string }>(admin, `/barang/${kawat.id}`);
    expect(b.stokFisik).toBe('17.000');
  } finally {
    await api(admin, `/barang/${kawat.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Kasir: FIFO menyorot order terlama; kasir boleh memilih order lain lalu mengubah isinya saat bayar', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const bata = await barangUji(admin, `Bata POS ${kode}`, 1000);
  const pasir = await barangUji(admin, `Pasir POS ${kode}`, 3000);
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    const o1 = await api<{ id: number; noAntrean: number }>(staf, '/order?kirim=true', 'POST', {
      jenisPenjualan: 'LANGSUNG',
      baris: [{ idBarang: bata.id, qty: '10' }],
    });
    const o2 = await api<{ id: number; noAntrean: number }>(staf, '/order?kirim=true', 'POST', {
      jenisPenjualan: 'LANGSUNG',
      baris: [{ idBarang: pasir.id, qty: '1' }],
    });

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await bukaShift(kasir);
    await kasir.goto('/penjualan-langsung');
    // Order lain dari sesi uji sebelumnya mungkin masih di antrean; FIFO: o1 sebelum o2.
    const t1 = kasir.getByRole('option', { name: `Antrean ${o1.noAntrean}` });
    const t2 = kasir.getByRole('option', { name: `Antrean ${o2.noAntrean}` });
    await expect(t1).toBeVisible();
    await expect(t2).toBeVisible();
    await kasir.keyboard.press('F3');
    await expect(kasir.getByRole('listbox', { name: 'Antrean order' })).toBeFocused();
    const urut = await kasir
      .getByRole('option')
      .evaluateAll((el) => el.map((e) => e.getAttribute('aria-label')));
    expect(urut.indexOf(`Antrean ${o1.noAntrean}`)).toBeLessThan(
      urut.indexOf(`Antrean ${o2.noAntrean}`),
    );

    // Pembeli o2 datang lebih dulu: panggil nomornya, tambah 2 bata, bayar uang pas.
    await kasir.keyboard.type(String(o2.noAntrean));
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 3.000');
    await kasir.keyboard.press('F2');
    await kasir.keyboard.type(`2*${bata.kode}`);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 5.000');
    await kasir.keyboard.press('F8');
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');

    const selesai = await api<{ status: string; idPenjualan: number }>(admin, `/order/${o2.id}`);
    expect(selesai.status).toBe('SELESAI');
    const pj = await api<{ totalNeto: number; baris: unknown[] }>(
      admin,
      `/penjualan/${selesai.idPenjualan}`,
    );
    expect(pj).toMatchObject({ totalNeto: 5000 });
    expect(pj.baris).toHaveLength(2);
    // o1 tetap menunggu di antrean.
    expect((await api<{ status: string }>(admin, `/order/${o1.id}`)).status).toBe('MENUNGGU');
    await api(admin, `/order/${o1.id}/batal`, 'POST', { alasan: 'Uji e2e' });
  } finally {
    for (const b of [bata, pasir]) {
      await api(admin, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  }
});

test('Pengantaran: order → invoice DP transfer → surat jalan semua barang, hanya keyboard', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const besi = await barangUji(admin, `Besi POS ${kode}`, 100000);
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: `CV POS ${kode}`,
    noHp: '081200000001',
    alamat: 'Jl. Proyek 7',
  });
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    const o = await api<{ id: number; noAntrean: number }>(staf, '/order?kirim=true', 'POST', {
      jenisPenjualan: 'PENGANTARAN',
      idPelanggan: plg.id,
      alamatKirim: 'Jl. Proyek 7',
      baris: [{ idBarang: besi.id, qty: '5' }],
    });

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await bukaShift(kasir);
    await kasir.goto('/penjualan-pengantaran');
    await expect(kasir.getByRole('option', { name: `Antrean ${o.noAntrean}` })).toContainText(
      `CV POS ${kode}`,
    );
    await kasir.keyboard.press('F3');
    await kasir.keyboard.type(String(o.noAntrean));
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 500.000');
    await expect(kasir.getByLabel('Bayar')).toBeFocused();
    await kasir.keyboard.press('b'); // transfer
    await kasir.keyboard.type('200000');
    await kasir.keyboard.press('Tab');
    await kasir.keyboard.type('BCA 123');
    await kasir.keyboard.press('Enter');
    const hasil = kasir.getByTestId('hasil-transaksi');
    await expect(hasil).toContainText(/Invoice INV-\d{6}-\d{3,} dibuat/);
    await expect(hasil).toContainText('sisa Rp 300.000');
    await expect(hasil).toBeFocused();
    await kasir.keyboard.press('s');
    await expect(kasir.getByText(/Surat jalan SJ-\d{6}-\d{3,} dibuat/)).toBeVisible();

    const pj = await api<{ id: number; statusPembayaran: string }[]>(
      admin,
      `/penjualan?jenis=PENGANTARAN&cari=${encodeURIComponent(`CV POS ${kode}`)}`,
    );
    const detail = await api<{ statusPembayaran: string; suratJalan: unknown[] }>(
      admin,
      `/penjualan/${pj[0]!.id}`,
    );
    expect(detail.statusPembayaran).toBe('DP');
    expect(detail.suratJalan).toHaveLength(1);
  } finally {
    await api(admin, `/barang/${besi.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});

test('Staf: order pengantaran dengan keyboard (F3 jenis, F4 pelanggan, alamat terisi otomatis, F8 kirim)', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const genteng = await barangUji(admin, `Genteng POS ${kode}`, 5000);
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: `Toko Antar ${kode}`,
    noHp: '081200000002',
    alamat: 'Jl. Kenanga 12',
  });
  let idOrder = 0;
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    await staf.goto('/order');
    await expect(staf.getByLabel('Cari barang')).toBeFocused();
    await staf.keyboard.press('F3');
    await expect(staf.getByTestId('jenis-order')).toContainText('PENGANTARAN');
    await staf.keyboard.press('F4');
    await expect(staf.getByLabel('Cari pelanggan')).toBeFocused();
    await staf.keyboard.type(`Toko Antar ${kode}`);
    await expect(
      staf.getByRole('option', { name: new RegExp(`Toko Antar ${kode}`) }),
    ).toBeVisible();
    await staf.keyboard.press('Enter');
    await expect(staf.getByLabel('Alamat kirim')).toHaveValue('Jl. Kenanga 12');
    await expect(staf.getByLabel('Cari barang')).toBeFocused();
    await staf.keyboard.type(`10*${genteng.kode}`);
    await staf.keyboard.press('Enter');
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 50.000');
    await staf.keyboard.press('F8');
    await expect(staf.getByTestId('order-terakhir')).toBeVisible();

    const [o] = await api<{ id: number; jenisPenjualan: string; alamatKirim: string }[]>(
      admin,
      `/order?status=AKTIF&jenis=PENGANTARAN&cari=${encodeURIComponent(`Toko Antar ${kode}`)}`,
    );
    idOrder = o!.id;
    expect(o).toMatchObject({ jenisPenjualan: 'PENGANTARAN' });
  } finally {
    if (idOrder) await api(admin, `/order/${idOrder}/batal`, 'POST', { alasan: 'Uji e2e' });
    await api(admin, `/barang/${genteng.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
