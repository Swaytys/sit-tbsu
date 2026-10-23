import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-161: data muatan diisi di form barang (dalam gram dan mm, disimpan kg dan cm), lalu dialog Berangkat
// menampilkan muatan dan meminta alasan saat volume sedikit melebihi bak. Data uji dinonaktifkan di akhir.

test('Data muatan barang → pratinjau muatan di Berangkat: perlu alasan, berat lebih ditolak', async ({
  browser,
}) => {
  test.slow();
  const kode = Date.now();
  const nama = `Semen Muatan E2E ${kode}`;
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 50000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 60000 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '20', hppSatuan: 50000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
    namaPelanggan: `Toko Muatan E2E ${kode}`,
    noHp: '081200000009',
    alamat: 'Jl. Muatan 1',
  });
  const pikap = await api<{ id: number; plat: string }>(admin, '/kendaraan', 'POST', {
    plat: `N ${kode % 9000} MU`,
    jenis: 'Pikap E2E',
    kapasitasKg: 1000,
    bakPanjangCm: 80,
    bakLebarCm: 60,
    bakTinggiCm: 42,
  });
  const motor = await api<{ id: number; plat: string }>(admin, '/kendaraan', 'POST', {
    plat: `N ${(kode % 9000) + 1} MV`,
    jenis: 'Motor roda tiga E2E',
    kapasitasKg: 200,
  });
  const sopir = await api<{ id: number }>(admin, '/sopir', 'POST', { nama: `Muatan E2E ${kode}` });
  try {
    // 1. Form barang: berat 50.000 g, ukuran 700 × 450 × 120 mm → disimpan 50 kg, 70 × 45 × 12 cm.
    await admin.goto(`/barang/${barang.id}`);
    await admin.getByLabel('Satuan berat').selectOption('g');
    await admin.getByLabel('Berat', { exact: true }).fill('50000');
    await admin.getByLabel('Satuan ukuran').selectOption('mm');
    await admin.getByLabel('Panjang', { exact: true }).fill('700');
    await admin.getByLabel('Lebar', { exact: true }).fill('450');
    await admin.getByLabel('Tinggi', { exact: true }).fill('120');
    await admin
      .getByRole('button', { name: /^Simpan/ })
      .first()
      .click();
    await expect(admin.getByText(`Barang ${nama} disimpan.`)).toBeVisible();
    const d = await api<{ muatan: { beratKg: string; panjangCm: string } }>(
      admin,
      `/barang/${barang.id}`,
    );
    expect(d.muatan).toMatchObject({ beratKg: '50', panjangCm: '70' });

    // 2. Invoice 5 sak + surat jalan.
    const inv = await api<{ id: number; baris: { id: number }[] }>(
      admin,
      '/penjualan/checkout',
      'POST',
      {
        order: {
          jenisPenjualan: 'PENGANTARAN',
          idPelanggan: plg.id,
          alamatKirim: 'Jl. Muatan 1',
          baris: [{ idBarang: barang.id, qty: '5' }],
        },
      },
    );
    await api(admin, `/penjualan/${inv.id}/surat-jalan`, 'POST', {
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }],
    });

    // 3. Berangkat dari detail invoice: motor (200 kg) ditolak, pikap perlu alasan.
    await admin.goto(`/penjualan/${inv.id}`);
    await admin.getByRole('button', { name: 'Berangkat kirim' }).click();
    await admin.getByLabel('Kendaraan').selectOption(String(motor.id));
    await admin.getByLabel('Sopir').selectOption(String(sopir.id));
    await expect(admin.getByTestId('panel-muatan')).toContainText('melebihi daya angkut');
    await expect(admin.getByRole('button', { name: /^Berangkat/ })).toBeDisabled();
    await admin.getByLabel('Kendaraan').selectOption(String(pikap.id));
    await expect(admin.getByTestId('muatan-volume')).toContainText('perlu alasan');
    await admin.getByRole('button', { name: /^Berangkat/ }).click();
    await expect(admin.getByText(/Tulis alasan kenapa muatan tetap aman/)).toBeVisible();
    await admin
      .getByLabel('Alasan muatan')
      .fill('Sak ditumpuk satu lapis di atas dinding bak, diikat dan ditutup terpal.');
    await admin.getByRole('button', { name: /^Berangkat/ }).click();
    await expect(admin.getByText(/TRP-\d{6}-\d{3,} berangkat/)).toBeVisible();
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    await api(admin, `/kendaraan/${motor.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
