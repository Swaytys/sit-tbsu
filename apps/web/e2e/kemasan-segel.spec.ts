import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-227 tahap 3: kemasan tersegel di Data Barang, penerimaan box utuh, buka kemasan, lembar hitung box + ecer.
test('kemasan tersegel: tandai dus, penerimaan, buka kemasan, kasir buka otomatis, opname dus + ecer', async ({
  browser,
}) => {
  const nama = `Baut Segel E2E ${Date.now()}`;
  const kepala = await browser.newPage();
  await masukCepat(kepala, 'ADMIN');
  const kategori = await api<{ id: number }[]>(kepala, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(kepala, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(kepala, '/tingkat-harga');
  const pemasok = await api<{ id: number }>(kepala, '/pemasok', 'POST', {
    namaPemasok: `Pemasok Segel E2E ${Date.now()}`,
    noHp: '081200001111',
  });
  const b = await api<{ id: number; kode: string }>(kepala, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'buah')!.id,
    hargaModalAwal: 500,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 700 }],
  });
  try {
    await api(kepala, `/barang/${b.id}/satuan-jual`, 'PUT', {
      baris: [{ idSatuan: satuan.find((s) => s.kode === 'dus')!.id, faktor: '10' }],
    });

    // 1. Data Barang: tandai dus sebagai kemasan tersegel.
    await kepala.goto(`/barang/${b.id}`);
    await kepala.getByRole('combobox', { name: 'Kemasan tersegel' }).click();
    await kepala.getByRole('option', { name: 'dus isi 10 buah' }).click();
    await expect(kepala.getByText('dus isi 10 buah kini dicatat tersegel.')).toBeVisible();

    // 2. Penerimaan 35 buah: 3 dus segel utuh + 5 ecer.
    await api(kepala, '/penerimaan', 'POST', {
      idPemasok: pemasok.id,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
      referensi: 'TRF0001',
      baris: [{ idBarang: b.id, qtyMasuk: '35', hargaModalMasuk: 500 }],
    });
    await kepala.reload();
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('3 dus segel');
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('5 buah ecer');

    // 3. Buka 1 dus menjadi ecer.
    await kepala.getByRole('button', { name: 'Buka kemasan…' }).click();
    const dialog = kepala.getByRole('dialog');
    await dialog.getByLabel('Alasan').fill('Isi rak ecer');
    await dialog.getByRole('button', { name: 'Buka 1 dus' }).click();
    await expect(kepala.getByText(`1 dus ${nama} dibuka menjadi ecer.`)).toBeVisible();
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('2 dus segel');
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('15 buah ecer');
    await expect(kepala.getByRole('row').filter({ hasText: 'Isi rak ecer' })).toContainText(
      'Dibuka jadi ecer',
    );

    // 4. Kasir menjual 20 buah ecer padahal ecer 15: keranjang memberi tahu 1 dus dibuka (K-246).
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila sudah terbuka: diabaikan
    await kasir.goto('/penjualan-langsung');
    await kasir.keyboard.press('F2');
    await expect(kasir.getByLabel('Cari barang')).toBeFocused();
    await kasir.keyboard.type(`20*${b.kode}`);
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByTestId('segel-dibuka')).toContainText(
      'Ecer kurang: 1 dus segel dibuka saat dibayar',
    );
    await kasir.keyboard.press('Enter'); // ke pembayaran
    await kasir.keyboard.press('Enter'); // uang pas
    await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');
    await kepala.reload();
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('1 dus segel');
    await expect(kepala.getByTestId('lapisan-segel')).toContainText('5 buah ecer');
    await expect(
      kepala.getByRole('row').filter({ hasText: 'Dibuka otomatis (ecer kurang)' }),
    ).toContainText('Demo Kasir');

    // 5. Opname: gudang menghitung dus segel dan ecer terpisah; jumlah = 1 × 10 + 5.
    const d = await api<{ id: number }>(kepala, '/penyesuaian', 'POST', {
      jenis: 'OPNAME',
      baris: [{ idBarang: b.id, qtyFisik: null }],
    });
    try {
      const gudang = await browser.newPage();
      await masukCepat(gudang, 'PETUGAS_GUDANG');
      await gudang.goto(`/opname/${d.id}/hitung`);
      await gudang.getByLabel(`Jumlah dus segel utuh ${nama}`).fill('1');
      await gudang.getByLabel(`Jumlah dus segel utuh ${nama}`).press('Enter');
      await gudang.getByLabel(`Jumlah ecer ${nama}`).fill('5');
      await expect(gudang.getByTestId('perkiraan-total')).toHaveText('= 15 buah');
      await gudang.getByLabel(`Jumlah ecer ${nama}`).press('Enter');
      await expect(gudang.getByText(`${nama}: 15 buah tersimpan.`)).toBeVisible();
    } finally {
      await api(kepala, `/penyesuaian/${d.id}/batal`, 'POST');
    }
  } finally {
    await api(kepala, `/barang/${b.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
