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

test('Staf memakai form order lengkap → antrean → Kasir membuka order di layar POS; stok tersedia berkurang', async ({
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
    await staf.getByRole('tab', { name: 'Daftar order' }).click();
    await staf.getByRole('link', { name: 'Form order lengkap' }).click();
    await expect(staf.getByRole('heading', { name: 'Buat order baru' })).toBeVisible();

    await staf.getByLabel('Cari barang').click();
    await staf.getByLabel('Cari barang').fill(nama);
    await expect(staf.getByRole('option', { name: new RegExp(nama) })).toContainText('stok 10');
    await staf.getByLabel('Cari barang').press('Enter');
    await staf.getByLabel(`Qty ${nama}`).fill('3');
    await expect(staf.getByTestId('total-order')).toHaveText('Rp 186.000');
    // Tier selalu otomatis (tidak ada pilihan tier, K-099); Staf tidak berizin memberi diskon.
    await expect(staf.getByLabel(`Tier ${nama}`)).toHaveCount(0);
    await expect(staf.getByLabel(`Diskon ${nama}`)).toHaveCount(0);
    await staf.getByRole('button', { name: 'Kirim ke antrean' }).click();
    await expect(staf.getByText(/Order ORD-\d{6}-\d{3,} masuk antrean kasir/)).toBeVisible();
    await expect(staf.getByRole('heading', { name: /^Order ORD-/ })).toBeVisible();
    await expect(staf.getByText('Menunggu kasir').first()).toBeVisible();
    idOrder = Number(new URL(staf.url()).searchParams.get('id'));

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
    // F9 = kembalikan order ke antrean.
    await kasir.keyboard.press('F9');
    await expect
      .poll(async () => (await api<{ status: string }>(admin, `/order/${idOrder}`)).status)
      .toBe('MENUNGGU');
  } finally {
    if (idOrder) await api(admin, `/order/${idOrder}/batal`, 'POST', { alasan: 'Uji e2e' });
    await api(admin, `/barang/${idBarang}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
