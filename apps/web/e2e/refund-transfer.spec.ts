import { expect, test } from '@playwright/test';
import { api, idRekening, masukCepat } from './pembantu';

// K-176: hasil pengantaran dengan alasan; barang kembali karena kelebihan pada invoice lunas → refund transfer tanpa
// rekening → tugas di Retur › Pengembalian uang (K-193; cara bisa diganti) → konfirmasi dengan rekening + bukti.
// Data uji dinonaktifkan.

test('Hasil pengantaran: kelebihan pesanan → refund transfer menunggu → dikonfirmasi dengan bukti', async ({
  page,
}) => {
  test.slow();
  const kode = Date.now();
  const nama = `Keramik Refund E2E ${kode}`;
  await masukCepat(page, 'ADMIN');
  const kategori = await api<{ id: number }[]>(page, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(page, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(page, '/tingkat-harga');
  const barang = await api<{ id: number }>(page, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'dus')!.id,
    hargaModalAwal: 40000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 50000 }],
  });
  const adj = await api<{ id: number }>(page, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 40000 }],
  });
  await api(page, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const plg = await api<{ id: number }>(page, '/pelanggan', 'POST', {
    namaPelanggan: `Toko Refund E2E ${kode}`,
    noHp: '081200000077',
    alamat: 'Jl. Refund 1',
  });
  const truk = await api<{ id: number }>(page, '/kendaraan', 'POST', {
    plat: `N ${kode % 9000} RF`,
    jenis: 'Pikap E2E',
  });
  const sopir = await api<{ id: number }>(page, '/sopir', 'POST', { nama: `Refund E2E ${kode}` });
  try {
    const inv = await api<{ id: number; baris: { id: number }[] }>(
      page,
      '/penjualan/checkout',
      'POST',
      {
        order: {
          jenisPenjualan: 'PENGANTARAN',
          idPelanggan: plg.id,
          alamatKirim: 'Jl. Refund 1',
          baris: [{ idBarang: barang.id, qty: '3' }],
        },
        pembayaran: [
          {
            metode: 'TRANSFER',
            nominal: 150000,
            idRekening: await idRekening(page),
            referensi: `E2E-RF-${kode % 100000}`,
          },
        ],
      },
    );
    const rit = await api<{ id: number }>(page, '/perjalanan/rencana', 'POST', {
      idKendaraan: truk.id,
      idSopir: sopir.id,
      jadwalBerangkat: new Date(Date.now() + 3600_000).toISOString(),
    });
    await api(page, `/perjalanan/${rit.id}/isi`, 'POST', { idPenjualan: inv.id });
    await api(page, `/perjalanan/${rit.id}/dimuat`, 'POST', {});
    await api(page, `/perjalanan/${rit.id}/berangkat`, 'POST', {});

    // Catat hasil di detail invoice: 1 dus kembali karena kelebihan, uang dikembalikan lewat transfer.
    await page.goto(`/penjualan/${inv.id}`);
    await page.getByRole('button', { name: 'Catat hasil' }).click();
    await page.getByLabel(`Kembali utuh ${nama}`).fill('1');
    await page.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(page.getByText('Pilih alasan untuk setiap barang')).toBeVisible();
    await page.getByLabel(`Alasan kembali ${nama}`).selectOption('KELEBIHAN');
    await page.getByRole('radio', { name: 'Transfer' }).check();
    await page.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(page.getByText(/menunggu dikembalikan \(transfer\)/)).toBeVisible();
    await expect(page.getByTestId('ringkas-hasil')).toContainText(
      'dikembalikan 1 dus (kelebihan pesanan)',
    );

    // K-193: tugas di Retur › Pengembalian uang; cara bisa diganti (dengan alasan) selama menunggu.
    await page.goto('/retur?tab=pengembalian');
    const pembeli = `Toko Refund E2E ${kode}`;
    const diTransfer = page
      .getByTestId('pengembalian-TRANSFER')
      .locator('tr')
      .filter({ hasText: pembeli });
    const diTunai = page
      .getByTestId('pengembalian-TUNAI')
      .locator('tr')
      .filter({ hasText: pembeli });
    await expect(diTransfer).toContainText('Rp 50.000');
    await expect(diTransfer).toContainText('belum diisi');
    await diTransfer.getByRole('button', { name: 'Jadikan tunai' }).click();
    await page.getByLabel('Alasan ganti cara').fill('Pembeli minta tunai saat datang');
    await page.getByRole('button', { name: 'Ganti cara' }).click();
    await expect(diTunai).toContainText('Rp 50.000');
    await expect(diTransfer).toHaveCount(0);
    await diTunai.getByRole('button', { name: 'Jadikan transfer' }).click();
    await page.getByLabel('Alasan ganti cara').fill('Pembeli minta ditransfer');
    await page.getByRole('button', { name: 'Ganti cara' }).click();
    await expect(diTransfer).toContainText('Rp 50.000');

    await diTransfer.getByRole('button', { name: 'Sudah ditransfer' }).click();
    await page.getByLabel('Rekening tujuan refund').fill('BCA 1234567890 a.n. Toko Refund');
    await page.getByRole('button', { name: /^Sudah ditransfer \(Enter\)/ }).click();
    await expect(page.getByText(/No\. referensi wajib, 4–40 huruf\/angka/)).toBeVisible();
    await page.getByLabel('Referensi transfer').fill('MB-77889900');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/dicatat sudah ditransfer/)).toBeVisible();
    await expect(diTransfer).toHaveCount(0);
    await expect(page.getByText('ref. MB-77889900').first()).toBeVisible();
  } finally {
    await api(page, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(page, `/sopir/${sopir.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
