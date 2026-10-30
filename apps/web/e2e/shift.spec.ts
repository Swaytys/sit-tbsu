import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama, tolakVoidMenunggu } from './pembantu';

// Shift Demo Kasir yang masih terbuka dari uji lain ditutup dulu (uang fisik 0, keterangan "uji otomatis").
// Menambah satu barang uji (dinonaktifkan di akhir) dan satu penjualan tunai di database pengembangan.

test(
  'Kasir: buka shift (hitung per pecahan), kasbon, jual tunai, tutup shift dua langkah dengan selisih',
  { tag: '@kritis' },
  async ({ browser }) => {
    test.slow(); // alur panjang (dua langkah tutup + buka lagi); 30 dtk tidak cukup saat mesin sibuk
    const kode = Date.now();
    const admin = await browser.newPage();
    await masukCepat(admin, 'ADMIN');
    const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
    const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
    const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
    const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
      namaBarang: `Lem Shift E2E ${kode}`,
      idKategori: kategori[0]!.id,
      idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
      hargaModalAwal: 8000,
      hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 12000 }],
    });
    const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang: barang.id, qtyFisik: '5', hppSatuan: 8000 }],
    });
    await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
    try {
      const kasir = await browser.newPage();
      await masukCepat(kasir, 'KASIR');
      const lama = await api<{ id: number } | null>(kasir, '/shift/saya');
      if (lama) {
        await tolakVoidMenunggu(admin);
        await api(kasir, `/shift/${lama.id}/tutup`, 'POST', {
          uangFisik: 0,
          keterangan: 'uji otomatis',
          akuiMenggantung: true,
        });
      }

      await menuUtama(kasir).getByRole('link', { name: 'Shift & Clerical Check' }).click();
      await expect(
        kasir.getByRole('heading', { name: 'Shift & Clerical Check', exact: true }),
      ).toBeVisible();

      // Dialog buka shift: Esc di langkah pertama menutup dialog tanpa perlu mengklik apa pun.
      await kasir.getByRole('button', { name: 'Buka shift' }).click();
      const dialog = kasir.getByRole('dialog', { name: 'Buka shift toko' });
      await expect(dialog).toBeVisible();
      await kasir.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);

      // H = hitung sekarang, per pecahan: 1 × Rp100.000.
      await kasir.getByRole('button', { name: 'Buka shift' }).click();
      await kasir.keyboard.press('h');
      await dialog.getByLabel('Jumlah Rp100.000').fill('1');
      await expect(dialog.getByTestId('total-buka')).toHaveText('Rp 100.000');
      await kasir.keyboard.press('Enter');
      await expect(dialog.getByText('Buka shift dengan modal awal')).toBeVisible();
      // Esc di konfirmasi kembali ke hitungan (angka tidak hilang), Enter lagi untuk lanjut.
      await kasir.keyboard.press('Escape');
      await expect(dialog.getByLabel('Jumlah Rp100.000')).toHaveValue('1');
      await dialog.getByRole('button', { name: 'Lanjut (Enter)' }).click();
      await expect(dialog.getByText('Rp 100.000', { exact: true })).toBeVisible();
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByText(/Shift SHF-\d{6}-\d{3,} dibuka/)).toBeVisible();

      await kasir.getByLabel('Nominal', { exact: true }).fill('15000');
      await kasir.getByLabel('Keterangan', { exact: true }).fill('Kasbon Pak Budi');
      await kasir.getByRole('button', { name: 'Catat' }).click();
      await expect(kasir.getByText('Kasbon Pak Budi')).toBeVisible();

      await api(kasir, '/penjualan/checkout', 'POST', {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '2' }] },
        pembayaran: [{ metode: 'TUNAI', uangDiterima: 50000 }],
      }); // saldo sistem = 100.000 + 24.000 − 15.000 = 109.000

      // Langkah 1: hitungan dikirim tanpa melihat angka sistem (blind count), lalu terkunci.
      await expect(kasir.getByText('Saldo menurut sistem')).toHaveCount(0);
      const hitung = kasir.getByTestId('hitung-tutup');
      await hitung.getByRole('radio', { name: 'Total saja' }).click();
      await hitung.getByLabel('Total uang shift').fill('104000');
      // K-197: daftar "Sebelum menutup" (bila ada) wajib dicentang dulu.
      const periksa = kasir.getByRole('checkbox', { name: 'Sudah saya periksa' });
      if (await periksa.isVisible()) await periksa.check();
      await kasir.getByRole('button', { name: 'Kirim hitungan' }).click();
      await kasir.getByRole('button', { name: 'Ya, kirim' }).click();

      // Langkah 2: hasil, bantuan, hitung ulang sekali, keterangan, uang ditinggal.
      await expect(kasir.getByText('Saldo menurut sistem')).toBeVisible();
      await expect(kasir.getByTestId('selisih-hitung')).toContainText('Kurang');
      await expect(kasir.getByTestId('selisih-hitung')).toContainText('-Rp 5.000');
      await expect(kasir.getByTestId('bantuan-selisih')).toBeVisible();

      await kasir.getByText('Hitung ulang (sekali)').click();
      const ulang = kasir.getByTestId('hitung-tutup-ulang');
      await ulang.getByRole('radio', { name: 'Total saja' }).click();
      await ulang.getByLabel('Total uang shift').fill('108000');
      await kasir.getByRole('button', { name: 'Kirim hitung ulang' }).click();
      await kasir.getByRole('button', { name: 'Ya, kirim' }).click();
      await expect(kasir.getByTestId('selisih-hitung')).toContainText('-Rp 1.000');
      await expect(kasir.getByText('Hitung ulang (sekali)')).toHaveCount(0);

      // Selisih Rp 1.000 masih dalam toleransi bawaan (Rp 1.000): keterangan tidak wajib.
      await expect(kasir.getByLabel('Keterangan selisih (wajib)')).toHaveCount(0);
      await kasir.getByLabel('Uang ditinggal untuk shift berikutnya').fill('100000');
      await kasir.getByRole('button', { name: 'Tutup shift' }).click();
      await kasir.getByRole('button', { name: 'Ya, tutup shift' }).click();

      await expect(kasir.getByText('Total saldo sistem')).toBeVisible();
      await expect(kasir.getByTestId('selisih-clerical')).toContainText('Rp 1.000');
      await kasir.getByRole('button', { name: 'Selesai' }).click();

      // Shift berikutnya menawarkan uang ditinggal tadi sebagai modal (Enter = pakai).
      await kasir.getByRole('button', { name: 'Buka shift' }).click();
      await expect(dialog.getByText('Pakai uang kemarin: Rp 100.000')).toBeVisible();
      await kasir.keyboard.press('Escape');

      await kasir.getByRole('tab', { name: 'Riwayat' }).click();
      await expect(
        kasir.getByRole('row').filter({ hasText: 'Selisih receh' }).first(),
      ).toBeVisible();
    } finally {
      await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  },
);

test('Kasir: buka dulu hitung nanti, uang penjualan masuk, hitung susulan → hasil → simpan', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: `Lem Susulan E2E ${kode}`,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 8000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 12000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '5', hppSatuan: 8000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    const lama = await api<{ id: number } | null>(kasir, '/shift/saya');
    if (lama) {
      await tolakVoidMenunggu(admin);
      await api(kasir, `/shift/${lama.id}/tutup`, 'POST', {
        uangFisik: 0,
        keterangan: 'uji otomatis',
        akuiMenggantung: true,
      });
    }
    await menuUtama(kasir).getByRole('link', { name: 'Shift & Clerical Check' }).click();
    await kasir.getByRole('button', { name: 'Buka shift' }).click();
    await kasir.keyboard.press('n');
    await expect(kasir.getByText(/sementara; hitung uang shift dalam \d+ menit/)).toBeVisible();
    await kasir.keyboard.press('Enter');
    await expect(kasir.getByText(/Shift SHF-\d{6}-\d{3,} dibuka/)).toBeVisible();
    const s = await api<{ modalAwal: number }>(kasir, '/shift/saya');

    // Toko ramai: penjualan tunai Rp 24.000 (uang Rp 50.000, kembalian Rp 26.000) sebelum laci dihitung.
    await api(kasir, '/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: barang.id, qty: '2' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 50000 }],
    });
    await kasir.reload();
    await expect(kasir.getByTestId('peringatan-shift')).toContainText(
      'Hitung uang shift belum dikirim',
    );

    // Laci berisi Rp 5.000 lebih dari modal sementara + penjualan: selisih semalam jadi koreksi modal.
    const kartu = kasir.getByTestId('hitung-susulan');
    await kartu.getByRole('radio', { name: 'Total saja' }).click();
    await kartu.getByLabel('Total uang shift').fill(String(s.modalAwal + 24000 + 5000));
    await kartu.getByRole('button', { name: 'Kirim hitungan' }).click();
    await kartu.getByRole('button', { name: 'Ya, kirim' }).click();
    // K-134: hasil tampil dengan angka; simpan untuk menetapkan modal.
    await expect(kartu.getByTestId('selisih-semalam')).toContainText('Selisih semalam Rp 5.000');
    await kartu.getByRole('button', { name: 'Simpan hasil' }).click();
    await expect(
      kasir.getByText('Hitung uang shift disimpan; modal awal sudah benar.'),
    ).toBeVisible();
    await expect(kasir.getByTestId('hitung-susulan')).toHaveCount(0);
    // Spanduk hitung susulan hilang (spanduk lain, mis. lewat jam tutup, boleh tetap ada).
    await expect(kasir.getByText('Hitung uang shift belum dikirim')).toHaveCount(0);
    await expect(kasir.getByText('(dikoreksi Rp 5.000)')).toBeVisible();

    const saya = await api<{ id: number }>(kasir, '/shift/saya');
    await api(kasir, `/shift/${saya.id}/tutup`, 'POST', {
      uangFisik: s.modalAwal + 29000,
      keterangan: 'uji otomatis',
    });
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
