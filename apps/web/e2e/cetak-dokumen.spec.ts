import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-124: kertas per jenis dokumen dan cetak otomatis invoice/surat jalan (Pengaturan, berlaku semua komputer);
// kepekatan struk (per komputer). Setelan toko dikembalikan di akhir.

type Profil = Record<string, unknown>;

test('Pengaturan cetak: kertas invoice dan cara cetak tersimpan dan dipakai saat mencetak; kepekatan struk', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      const gaya = [...document.querySelectorAll('.area-cetak style')].map((s) => s.textContent);
      document.body.dataset.ukuranCetak = gaya.join(' ');
    };
  });
  await masukCepat(page, 'ADMIN');
  const awal = await api<{ profil: Profil }>(page, '/pengaturan');
  try {
    await page.goto('/pengaturan');
    await page.getByRole('tab', { name: 'Struk & printer' }).click();

    await page.getByRole('combobox', { name: 'Invoice pengantaran setelah dibuat' }).click();
    await page.getByRole('option', { name: 'Tanya dulu' }).click();
    await page.getByRole('combobox', { name: 'Kertas invoice' }).click();
    await page.getByRole('option', { name: 'A5 lanskap (setengah A4)' }).click();
    const kartu = page.locator('form').filter({ hasText: 'Invoice, surat jalan & kertas' });
    await kartu.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Pengaturan disimpan.')).toBeVisible();

    const tampil = await api<Profil>(page, '/pengaturan/tampilan');
    expect(tampil).toMatchObject({ invoiceCetak: 'TANYA', kertasInvoice: 'A5_LANSKAP' });
    // Kartu struk menyimpan tanpa menimpa setelan dokumen.
    expect((await api<{ profil: Profil }>(page, '/pengaturan')).profil.suratJalanCetak).toBe(
      awal.profil.suratJalanCetak,
    );

    // Kepekatan struk: per komputer, tersimpan di peramban.
    await page.getByText('Pengaturan lanjutan (kepekatan').click();
    await page.getByRole('combobox', { name: 'Kepekatan cetak' }).click();
    await page.getByRole('option', { name: 'Paling tebal' }).click();
    const atur = await page.evaluate(() => localStorage.getItem('tbsu:printer-struk'));
    expect(JSON.parse(atur ?? '{}')).toMatchObject({ kepekatan: 'PALING_TEBAL' });
    await expect(page.getByTestId('logo-struk')).toBeVisible();

    // Invoice pengantaran yang sudah ada dicetak dengan kertas pilihan.
    const daftar = await api<{ id: number }[]>(page, '/penjualan?jenis=PENGANTARAN&perHalaman=1');
    test.skip(daftar.length === 0, 'Belum ada penjualan pengantaran di database pengembangan.');
    await page.goto(`/penjualan/${daftar[0]!.id}`);
    await page.getByRole('button', { name: 'Cetak invoice' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-ukuran-cetak', /size: A5 landscape/);
  } finally {
    await api(page, '/pengaturan', 'PATCH', { profil: awal.profil });
  }
});
