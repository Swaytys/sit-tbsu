import { expect, test, type Page } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu barang uji berstok (lalu menonaktifkannya) dan beberapa order di database pengembangan.

async function siapkanBarang(page: Page, nama: string) {
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const b = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 50000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 62000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: b.id, qtyFisik: '10', hppSatuan: 50000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  return b.id;
}

test('Staf membuat order lewat input cepat, mengubahnya dari Daftar order → Kasir membuka di POS; stok tersedia berkurang', async ({
  browser,
}) => {
  const nama = `Semen Order E2E ${Date.now()}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const idBarang = await siapkanBarang(admin, nama);
  let idOrder = 0;
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    await menuUtama(staf).getByRole('link', { name: 'Order Penjualan' }).click();
    await staf.getByLabel('Cari barang', { exact: true }).fill(`2*${nama}`);
    await expect(staf.getByRole('option', { name: new RegExp(nama) })).toContainText('stok 10');
    await staf.getByLabel('Cari barang', { exact: true }).press('Enter');
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 124.000');
    await staf.keyboard.press('F8');
    await expect(staf.getByTestId('order-terakhir')).toBeVisible();

    // K-129: tidak ada form order lengkap; Ubah membuka order di input cepat (mode ubah, F8 simpan).
    // K-129: tidak ada tab; F10 membuka daftar order (bawaan saringan Semua, K-139).
    await staf.keyboard.press('F10');
    await expect(staf.getByRole('button', { name: /Kembali ke input/ })).toBeVisible();
    await expect(staf.getByRole('tab', { name: 'Semua' })).toHaveAttribute('data-state', 'active');
    await expect(staf.getByRole('link', { name: 'Form order lengkap' })).toHaveCount(0);
    await staf
      .getByRole('button', { name: new RegExp(nama) })
      .first()
      .click();
    await expect(staf.getByRole('heading', { name: /^Order ORD-/ })).toBeVisible();
    idOrder = Number(new URL(staf.url()).searchParams.get('id'));
    await staf.getByRole('link', { name: 'Ubah' }).click();
    await expect(staf.getByTestId('mode-ubah')).toBeVisible();
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 124.000');
    await staf.getByRole('button', { name: `Tambah 1 ${nama}` }).click();
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 186.000');
    await staf.keyboard.press('F8');
    await expect(staf.getByText(/Perubahan order ORD-\d{6}-\d{3,} disimpan/)).toBeVisible();
    await expect(staf.getByTestId('mode-ubah')).toHaveCount(0);

    const b = await api<{ stokTersedia: string }>(admin, `/barang/${idBarang}`);
    expect(b.stokTersedia).toBe('7.000');

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila shift sudah terbuka: diabaikan
    await kasir.goto(`/order?id=${idOrder}`);
    await expect(kasir.getByRole('heading', { name: /^Order ORD-/ })).toBeVisible();
    await kasir.getByRole('button', { name: 'Proses ke pembayaran' }).click();
    // Layar POS membuka & mengunci order itu sendiri, kursor siap di kotak bayar.
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 186.000');
    await expect(kasir.getByLabel('Bayar')).toBeFocused();
    const o = await api<{ status: string }>(admin, `/order/${idOrder}`);
    expect(o.status).toBe('DIPROSES');
    // F9 = mulai dari awal: ditanya dulu (K-106) dengan pilihan untuk order itu (K-122); A = kembali ke
    // antrean (tidak dihapus).
    await kasir.keyboard.press('F9');
    const pilihan = kasir.getByRole('dialog', { name: /mau diapakan/ });
    await expect(pilihan).toContainText('Order tidak dihapus');
    await pilihan.getByRole('button', { name: /Kembalikan ke antrean/ }).click();
    await expect
      .poll(async () => (await api<{ status: string }>(admin, `/order/${idOrder}`)).status)
      .toBe('MENUNGGU');
  } finally {
    if (idOrder) await api(admin, `/order/${idOrder}/batal`, 'POST', { alasan: 'Uji e2e' });
    await api(admin, `/barang/${idBarang}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
