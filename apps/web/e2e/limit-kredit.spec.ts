import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-101: penjualan tidak lunas yang melampaui limit kredit pelanggan. Kasir tidak punya izin melanjutkan;
// Admin mengetik akunnya di layar kasir (persetujuan di tempat) tanpa kasir keluar. Menambah barang, pelanggan,
// dan invoice uji di database pengembangan (barang & pelanggan dinonaktifkan di akhir).
test('Limit kredit terlampaui: Admin menyetujui di layar Kasir (K-101)', async ({ browser }) => {
  const password = process.env.SEED_OWNER_PASSWORD;
  test.skip(!password, 'SEED_OWNER_PASSWORD tidak ada di .env');
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: `Besi Limit E2E ${kode}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 80000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 100000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 80000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const namaPlg = `CV Limit E2E ${kode}`;
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: namaPlg,
    noHp: '081200000001',
    alamat: 'Jl. Limit No. 1',
    limitKredit: 100000,
  });
  try {
    const staf = await browser.newPage();
    await masukCepat(staf, 'STAF_PENJUALAN');
    const o = await api<{ id: number; noAntrean: number }>(staf, '/order?kirim=true', 'POST', {
      jenisPenjualan: 'PENGANTARAN',
      idPelanggan: plg.id,
      alamatKirim: 'Jl. Limit No. 1',
      baris: [{ idBarang: barang.id, qty: '5' }],
    });

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila shift sudah terbuka: diabaikan

    // Total Rp 500.000, DP Rp 200.000 → sisa Rp 300.000 jadi piutang, di atas limit Rp 100.000.
    await menuUtama(kasir).getByRole('link', { name: 'Penjualan Pengantaran' }).click();
    await expect(kasir.getByRole('option', { name: `Antrean ${o.noAntrean}` })).toContainText(
      namaPlg,
    );
    await kasir.keyboard.press('F3');
    await kasir.keyboard.type(String(o.noAntrean));
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 500.000');
    await kasir.keyboard.press('u'); // DP: sebagian sekarang, sisanya piutang
    await kasir.keyboard.press('b');
    await kasir.keyboard.type('200000');
    await kasir.keyboard.press('Tab');
    await kasir.keyboard.type('BCA 123456');
    await kasir.keyboard.press('Enter');

    const dialog = kasir.getByRole('dialog', { name: 'Limit kredit terlampaui' });
    await expect(dialog).toContainText('limit Rp 100.000');
    await expect(dialog).toContainText('tagihan baru Rp 300.000');
    // Password salah: dialog tetap terbuka, belum ada invoice.
    await dialog.getByLabel('Nama pengguna atasan').fill('demo.admin');
    await dialog.getByLabel('Password atasan').fill('bukan-password-ini');
    await dialog.getByRole('button', { name: 'Setujui sekarang' }).click();
    await expect(kasir.getByText('Username atau password salah.').first()).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Password atasan').fill(password!);
    await dialog.getByRole('button', { name: 'Setujui sekarang' }).click();
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('sisa Rp 300.000');
    await expect(dialog).toHaveCount(0);
    // Kasir tetap login sebagai dirinya sendiri.
    const saya = await api<{ username: string }>(kasir, '/auth/saya');
    expect(saya.username).toBe('demo.kasir');
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
