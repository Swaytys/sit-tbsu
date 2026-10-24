import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-165/K-166: arsip tahunan (tutup, periksa, buka kembali) dan Tentang aplikasi. Tahun lalu di database
// pengembangan ditutup lalu dibuka kembali di akhir.

test('Owner: tahun berjalan tidak bisa ditutup; tahun lalu ditutup, diperiksa, dibuka kembali; versi tampil', async ({
  page,
}) => {
  test.slow();
  const tahunLalu = new Date().getFullYear() - 1;
  await masukCepat(page, 'OWNER');
  const truk = await api<{ id: number }>(page, '/kendaraan', 'POST', {
    plat: `K ${Date.now() % 9000} AR`,
    jenis: 'Truk arsip',
  });
  try {
    await api(page, '/armada/bbm', 'POST', {
      idKendaraan: truk.id,
      tanggal: `${tahunLalu}-12-30`,
      liter: '5',
      totalRp: 50_000,
    });
    const status = (await api<{ tahun: number; status: string | null }[]>(page, '/arsip')).find(
      (t) => t.tahun === tahunLalu,
    );
    if (status?.status !== 'DITUTUP') await api(page, `/arsip/${tahunLalu}/tutup`, 'POST');

    await page.goto('/pengaturan');
    await page.getByRole('tab', { name: 'Arsip tahunan' }).click();
    const ini = page.getByTestId(`arsip-${tahunLalu + 1}`);
    await expect(ini).toContainText('Belum ditutup');
    await expect(ini).toContainText('Tahun berjalan belum selesai');
    await expect(ini.getByRole('button', { name: `Tutup tahun ${tahunLalu + 1}` })).toBeDisabled();

    const lalu = page.getByTestId(`arsip-${tahunLalu}`);
    await expect(lalu).toContainText('Ditutup');
    await lalu.getByRole('button', { name: 'Periksa' }).click();
    await expect(page.getByText('Berkas utuh dan sama dengan database.')).toBeVisible();
    const unduh = page.waitForEvent('download');
    await lalu.getByRole('link', { name: 'Unduh berkas' }).click();
    expect((await unduh).suggestedFilename()).toMatch(
      new RegExp(`^arsip-${tahunLalu}-.*\\.json\\.gz$`),
    );

    await lalu.getByRole('button', { name: 'Buka kembali' }).click();
    await page.getByLabel('Alasan buka kembali').fill('Uji otomatis arsip tahunan');
    await page.getByRole('button', { name: 'Buka kembali' }).last().click();
    await expect(lalu).toContainText('Dibuka kembali');

    await page.getByRole('button', { name: 'Menu pengguna' }).click();
    await page.getByRole('menuitem', { name: 'Tentang aplikasi' }).click();
    const d = page.getByRole('dialog', { name: 'Tentang BonsaiUrip' });
    await expect(d).toContainText(/Versi tampilan \d+\.\d+\.\d+ · server \d+\.\d+\.\d+/);
    await expect(d).toContainText('Arsip tahunan');
  } finally {
    await api(page, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
