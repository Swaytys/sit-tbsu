import { expect, test, type Page } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-122: order disimpan untuk diambil nanti, kembali ke draf dari kasir, peringatan barang di draf lain,
// pilihan "Buka draf otomatis". Menambah satu barang uji (dinonaktifkan di akhir); semua draf/order uji
// dibatalkan di akhir.

async function barangUji(page: Page, nama: string, harga: number, stok: string) {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
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

type OrderRingkas = { id: number; status: string; namaPembeli: string | null };

async function batalkanDraf(page: Page) {
  const draf = await api<OrderRingkas[]>(page, '/order?status=DRAFT&milikSaya=true&perHalaman=100');
  for (const d of draf) {
    await api(page, `/order/${d.id}/batal`, 'POST', { alasan: 'Bersih-bersih uji e2e' });
  }
}

test('Order disimpan untuk nanti, kasir mengembalikannya ke draf, peringatan draf lain, buka draf otomatis', async ({
  browser,
}) => {
  const kode = Date.now();
  const nama = `Paku Simpan ${kode}`;
  const pembeli = `Pak Uji ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const paku = await barangUji(admin, nama, 2000, '5');
  const staf = await browser.newPage();
  await masukCepat(staf, 'STAF_PENJUALAN');
  const kasir = await browser.newPage();
  await masukCepat(kasir, 'KASIR');
  try {
    await batalkanDraf(staf);
    await staf.goto('/order');
    await expect(staf.getByLabel('Buka draf otomatis')).toBeChecked();
    await expect(staf.getByLabel('Cari barang')).toBeFocused();

    // 1. Simpan untuk nanti (F7): nama, HP, tanggal ambil; stok ditahan.
    await staf.keyboard.type(`2*${nama}`);
    await expect(staf.getByTestId('panel-detail-barang')).toContainText(nama);
    await staf.keyboard.press('Enter');
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 4.000');
    await staf.keyboard.press('F7');
    const dialog = staf.getByRole('dialog', { name: /Simpan untuk diambil nanti/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Simpan order (Enter)' }).click();
    await expect(
      dialog.getByText('Nama pembeli wajib diisi untuk order yang disimpan.'),
    ).toBeVisible();
    await dialog.getByLabel('Nama pembeli').fill(pembeli);
    await dialog.getByLabel('No. HP pembeli').fill('0812 3456 7890');
    await dialog.getByRole('button', { name: '3 hari' }).click();
    await dialog.getByLabel('No. HP pembeli').press('Enter');
    await expect(staf.getByText(/disimpan untuk Pak Uji .* Stok ditahan/)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 0');
    const disimpan = (
      await api<OrderRingkas[]>(staf, '/order?status=DISIMPAN&perHalaman=100')
    ).find((o) => o.namaPembeli === pembeli);
    expect(disimpan?.status).toBe('DISIMPAN');
    expect((await api<{ stokTersedia: string }>(admin, `/barang/${paku.id}`)).stokTersedia).toBe(
      '3.000',
    );

    // 2. Peringatan draf lain: draf Admin memuat 2; tersedia 3; menambah 2 lagi → tidak cukup.
    await api(admin, '/order', 'POST', {
      jenisPenjualan: 'LANGSUNG',
      namaPembeli: `Bu Draf ${kode}`,
      baris: [{ idBarang: paku.id, qty: '2' }],
    });
    await staf.keyboard.type(`2*${nama}`);
    await staf.keyboard.press('Enter');
    const peringatan = staf.getByTestId('peringatan-draf-lain');
    await expect(peringatan).toContainText(`Bu Draf ${kode}`);
    await expect(peringatan).toContainText('Draf milik');
    await staf.keyboard.press('Escape'); // hapus lagi dari order ini
    await expect(peringatan).toHaveCount(0);
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 0');
    await staf.keyboard.type(`1*${nama}`);
    await staf.keyboard.press('Enter'); // 2 + 1 = 3 ≤ tersedia: tanpa peringatan
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 2.000');
    await expect(peringatan).toHaveCount(0);
    await staf.keyboard.press('F9');
    await staf.getByRole('button', { name: 'Ya, mulai dari awal' }).click();
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 0');

    // 3. Kasir memproses order disimpan, lalu pembeli batal sementara → kembali ke draf (stok dilepas).
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila sudah terbuka: diabaikan
    await kasir.goto('/order?status=DISIMPAN');
    await kasir.getByRole('button', { name: new RegExp(pembeli) }).click();
    await expect(kasir.getByText(/Diambil \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    await kasir.getByRole('button', { name: 'Proses ke pembayaran' }).click();
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 4.000');
    await kasir.keyboard.press('F9');
    await expect(kasir.getByRole('dialog', { name: /mau diapakan/ })).toBeVisible();
    await kasir.keyboard.press('d');
    await expect(kasir.getByText(/dikembalikan ke draf/)).toBeVisible();
    const drafStaf = await api<OrderRingkas[]>(staf, '/order?status=DRAFT&milikSaya=true');
    expect(drafStaf.map((o) => o.id)).toContain(disimpan!.id);
    expect((await api<{ stokTersedia: string }>(admin, `/barang/${paku.id}`)).stokTersedia).toBe(
      '5.000',
    );

    // 4. Buka draf otomatis: mati → form kosong; nyala → draf terakhir dimuat.
    await staf.getByLabel('Buka draf otomatis').uncheck();
    await staf.reload();
    await expect(staf.getByLabel('Cari barang')).toBeFocused();
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 0');
    await staf.getByLabel('Buka draf otomatis').check();
    await staf.reload();
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 4.000');
  } finally {
    await staf.goto('/');
    await batalkanDraf(staf);
    await batalkanDraf(admin);
    await api(admin, `/barang/${paku.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
