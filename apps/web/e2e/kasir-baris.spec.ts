import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-099: catatan order sampai ke kasir, pindah layar dengan Alt+angka, menu ⋮ per baris barang, dan nama
// barang panjang yang tidak terpotong. Menambah satu barang uji (dinonaktifkan di akhir).

test('catatan order tampil di kasir; Alt+2 pindah layar; menu baris mengubah qty', async ({
  browser,
}) => {
  const nama = `Keramik Lantai Motif Kayu Cokelat Tua Ukuran Besar E2E ${Date.now()}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const jenis = await api<{ id: number; kode: string }[]>(admin, '/jenis-atribut?status=AKTIF');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 4000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 5000 }],
    atribut: [{ idJenisAtribut: jenis.find((j) => j.kode === 'WARNA')!.id, nilai: 'Cokelat tua' }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '20', hppSatuan: 4000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila sudah terbuka: diabaikan

    // Order cepat dengan catatan untuk kasir.
    await kasir.goto('/order');
    await expect(kasir.getByLabel('Cari barang')).toBeFocused();
    await kasir.keyboard.type(nama);
    await expect(kasir.getByRole('option', { name: new RegExp(nama) })).toBeVisible();
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-order')).toHaveText('Rp 5.000');
    await kasir.getByLabel('Catatan untuk kasir').fill('Pembeli menunggu di depan');
    await kasir.keyboard.press('F8');
    const terakhir = kasir.getByTestId('order-terakhir');
    await expect(terakhir).toBeVisible();
    const noAntrean = (await terakhir.locator('span').nth(1).textContent())?.trim() ?? '';

    // Alt+2: pindah ke Penjualan Langsung; tiket antrean memuat catatan.
    await kasir.keyboard.press('Alt+2');
    await expect(kasir).toHaveURL(/\/penjualan-langsung$/);
    await expect(kasir.getByRole('navigation', { name: 'Pindah layar penjualan' })).toBeVisible();
    const tiket = kasir.getByRole('option', { name: `Antrean ${noAntrean}`, exact: true });
    await expect(tiket).toContainText('Catatan: Pembeli menunggu di depan');
    await tiket.click();
    await expect(kasir.getByTestId('catatan-order')).toContainText('Pembeli menunggu di depan');

    // Baris barang: nama utuh dan atribut tampil; menu ⋮ → ubah qty.
    const baris = kasir.getByRole('option', { name: new RegExp(nama) });
    await expect(baris).toContainText(nama);
    await expect(baris).toContainText('Cokelat tua');
    await kasir.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
    await kasir.getByRole('menuitem', { name: /Ubah qty/ }).click();
    const isian = kasir.getByLabel(`Qty ${nama}`, { exact: true });
    await expect(isian).toBeFocused();
    await isian.fill('3');
    await isian.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 15.000');
    // Tombol M membuka menu baris dari keyboard; tidak ada lagi pilihan tier.
    await kasir.keyboard.press('m');
    await expect(kasir.getByRole('menuitem', { name: /Hapus dari daftar/ })).toBeVisible();
    await expect(kasir.getByRole('menuitem', { name: /tier/i })).toHaveCount(0);
    await kasir.keyboard.press('Escape');

    // Keranjang yang sudah diubah tidak hilang diam-diam: pindah layar meminta konfirmasi.
    await kasir.keyboard.press('Alt+1');
    await expect(kasir.getByRole('alertdialog')).toContainText('Tinggalkan halaman ini?');
    await kasir.getByRole('button', { name: 'Tetap di sini' }).click();
    await expect(kasir).toHaveURL(/\/penjualan-langsung$/);
  } finally {
    const aktif = await api<{ id: number; ringkasan: { namaBarang: string }[] }[]>(
      admin,
      '/order/antrean?jenis=LANGSUNG',
    );
    const idOrder = aktif.find((o) => o.ringkasan.some((r) => r.namaBarang === nama))?.id ?? null;
    if (idOrder !== null) {
      await admin.request.fetch(`/api/order/${idOrder}/lepas`, {
        method: 'POST',
        data: {},
        headers: { origin: new URL(admin.url()).origin },
      });
      await api(admin, `/order/${idOrder}/batal`, 'POST', { alasan: 'Uji e2e' });
    }
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
