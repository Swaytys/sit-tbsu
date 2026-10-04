import { expect, test, type Page } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Skenario roadmap Fase 5: "pengantaran DP → dua surat jalan → pelunasan → lunas". Menambah barang, pelanggan,
// order, dan invoice uji di database pengembangan (barang & pelanggan dinonaktifkan di akhir).

async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: data ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

test(
  'Pengantaran: DP → dua surat jalan → pelunasan → lunas & terkirim',
  { tag: '@kritis' },
  async ({ browser }) => {
    const kode = Date.now();
    const nama = `Besi Antar E2E ${kode}`;
    const admin = await browser.newPage();
    await masukCepat(admin, 'ADMIN');
    const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
    const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
    const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
    const barang = await api<{ id: number }>(admin, '/barang', 'POST', {
      namaBarang: nama,
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
    const plg = await api<{ id: number }>(admin, '/pelanggan', 'POST', {
      namaPelanggan: `CV Proyek E2E ${kode}`,
      noHp: '081200000000',
      alamat: 'Jl. Proyek No. 7',
    });
    try {
      const staf = await browser.newPage();
      await masukCepat(staf, 'STAF_PENJUALAN');
      const o = await api<{ id: number; noAntrean: number }>(staf, '/order?kirim=true', 'POST', {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg.id,
        alamatKirim: 'Jl. Proyek No. 7',
        baris: [{ idBarang: barang.id, qty: '5' }],
      });

      const kasir = await browser.newPage();
      await masukCepat(kasir, 'KASIR');
      await kasir.request.fetch('/api/shift/buka', {
        method: 'POST',
        data: { modalAwal: 0 },
        headers: { origin: new URL(kasir.url()).origin },
      }); // 409 bila shift sudah terbuka: diabaikan

      // 1. Invoice dengan DP transfer Rp 200.000 lewat layar POS (keyboard).
      await menuUtama(kasir).getByRole('link', { name: 'Penjualan Pengantaran' }).click();
      const tiket = kasir.getByRole('option', { name: `Antrean ${o.noAntrean}` });
      await expect(tiket).toContainText(`CV Proyek E2E ${kode}`);
      await kasir.keyboard.press('F3');
      await kasir.keyboard.type(String(o.noAntrean));
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 500.000');
      await kasir.keyboard.press('b');
      await kasir.keyboard.type('200000');
      await kasir.keyboard.press('Tab');
      await kasir.keyboard.type('BCA 123456');
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByTestId('hasil-transaksi')).toContainText('sisa Rp 300.000');
      const [inv] = await api<{ id: number }[]>(
        admin,
        `/penjualan?jenis=PENGANTARAN&cari=${encodeURIComponent(`CV Proyek E2E ${kode}`)}`,
      );
      await kasir.goto(`/penjualan/${inv!.id}`);
      await expect(kasir.getByRole('heading', { name: /^INV-\d{6}-\d{3,}/ })).toContainText('DP');

      // 2. Surat jalan pertama: 2 dari 5.
      await kasir.getByRole('button', { name: 'Buat surat jalan' }).click();
      await kasir.getByLabel(`Qty kirim ${nama}`).fill('2');
      await kasir.getByRole('dialog').getByRole('button', { name: 'Buat surat jalan' }).click();
      const sj1 = kasir.locator('[data-testid^="sj-SJ-"]').first();
      await sj1.getByRole('button', { name: 'Selesai dimuat' }).click();
      await expect(sj1).toContainText('Barang dimuat');
      await sj1.getByRole('button', { name: 'Berangkat kirim' }).click();
      await kasir.getByLabel('Nama sopir').fill('Pak Slamet');
      await kasir.getByRole('dialog').getByRole('button', { name: 'Berangkat' }).click();
      await sj1.getByRole('button', { name: 'Sudah diterima' }).click();
      await expect(sj1).toContainText('Diterima');
      await expect(kasir.getByText('Dikirim sebagian')).toBeVisible();

      // 3. Surat jalan kedua: sisa 3.
      await kasir.getByRole('button', { name: 'Buat surat jalan' }).click();
      await expect(kasir.getByLabel(`Qty kirim ${nama}`)).toHaveValue('3');
      await kasir.getByRole('dialog').getByRole('button', { name: 'Buat surat jalan' }).click();
      const sj2 = kasir.locator('[data-testid^="sj-SJ-"]').first();
      await sj2.getByRole('button', { name: 'Selesai dimuat' }).click();
      await sj2.getByRole('button', { name: 'Berangkat kirim' }).click();
      await kasir.getByLabel('Nama sopir').fill('Pak Slamet');
      await kasir.getByRole('dialog').getByRole('button', { name: 'Berangkat' }).click();
      await sj2.getByRole('button', { name: 'Sudah diterima' }).click();
      await expect(kasir.getByText('Terkirim', { exact: true })).toBeVisible();
      await expect(kasir.getByRole('button', { name: 'Buat surat jalan' })).toHaveCount(0);

      // 4. Pelunasan sisa Rp 300.000 lewat EDC.
      await kasir.getByRole('button', { name: 'Terima pembayaran' }).click();
      const dialog = kasir.getByRole('dialog');
      await expect(dialog.getByLabel('Bayar')).toBeFocused();
      await kasir.keyboard.press('e'); // EDC; kotak kosong = lunasi sisa
      await kasir.keyboard.press('Tab');
      await kasir.keyboard.type('EDC BRI');
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByText(/INV-\d{6}-\d{3,} lunas\./)).toBeVisible();
      await expect(kasir.getByRole('heading', { name: /^INV-/ })).toContainText('Lunas');
      await expect(kasir.getByRole('button', { name: 'Terima pembayaran' })).toHaveCount(0);
    } finally {
      await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
      await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  },
);
