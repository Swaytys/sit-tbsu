import { expect, test } from '@playwright/test';
import { api, idRekening, masukCepat, menuUtama } from './pembantu';

// Menambah barang, pelanggan, dan penjualan belum lunas di database pengembangan (dinonaktifkan di akhir).

test('Kasir: piutang pelanggan tampil dengan peringatan, dilunasi dari halaman Piutang', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: `Cat Piutang E2E ${kode}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 30000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 45000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '5', hppSatuan: 30000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const namaPlg = `Toko Piutang E2E ${kode}`;
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: namaPlg,
    noHp: '081300000000',
  });
  try {
    const pj = await api<{ id: number; nomor: string }>(admin, '/penjualan/checkout', 'POST', {
      order: {
        jenisPenjualan: 'LANGSUNG',
        idPelanggan: plg.id,
        baris: [{ idBarang: barang.id, qty: '2' }],
      },
      pembayaran: [
        {
          metode: 'TRANSFER',
          nominal: 40000,
          idRekening: await idRekening(admin),
          referensi: 'E2E-0001',
        },
      ],
    });

    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await menuUtama(kasir).getByRole('link', { name: 'Piutang' }).click();
    await expect(kasir.getByRole('heading', { name: 'Piutang' })).toBeVisible();
    await kasir.getByLabel('Cari piutang').fill(pj.nomor);
    const baris = kasir.getByRole('row').filter({ hasText: pj.nomor });
    await expect(baris).toContainText('Rp 50.000');
    await expect(baris).toContainText('DP');

    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    });
    await baris.getByRole('button', { name: 'Terima pembayaran' }).click();
    const dialog = kasir.getByRole('dialog');
    await expect(dialog.getByLabel('Bayar')).toBeFocused();
    await kasir.keyboard.press('Enter'); // kosong = uang pas (lunasi)
    await expect(kasir.getByText(`${pj.nomor} lunas.`)).toBeVisible();
    await expect(kasir.getByRole('row').filter({ hasText: pj.nomor })).toHaveCount(0);
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
