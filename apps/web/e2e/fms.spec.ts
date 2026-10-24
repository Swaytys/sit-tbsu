import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-162: catatan BBM dan servis, pengingat servis & KIR, statistik armada. Kendaraan uji dinonaktifkan di akhir.

function tanggal(selisihHari: number): string {
  const d = new Date(Date.now() + selisihHari * 86_400_000);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

test('Admin mencatat servis dan BBM; pengingat servis/KIR tampil; odometer mundur ditolak; statistik', async ({
  page,
}) => {
  test.slow();
  const kode = Date.now();
  const plat = `W ${kode % 9000} FM`;
  await masukCepat(page, 'ADMIN');
  const truk = await api<{ id: number }>(page, '/kendaraan', 'POST', {
    plat,
    jenis: 'Truk FMS E2E',
    kapasitasKg: 4000,
    berlakuKir: tanggal(-1),
    servisTiapKm: 5000,
  });
  try {
    await menuUtama(page).getByRole('link', { name: 'Kendaraan & Sopir' }).click();
    const baris = page.getByRole('row').filter({ hasText: plat });
    await expect(baris).toContainText('KIR habis');
    await expect(baris).toContainText('Odometer belum dicatat');

    // Servis lewat tab Servis.
    await page.getByRole('tab', { name: 'Servis' }).click();
    await page.getByRole('button', { name: 'Catat servis' }).click();
    const ds = page.getByRole('dialog', { name: 'Catat servis' });
    await ds.getByLabel('Kendaraan').selectOption(String(truk.id));
    await ds.getByLabel('Odometer').fill('20000');
    await ds.getByLabel('Jenis servis').fill('Ganti oli E2E');
    await ds.getByLabel('Biaya').fill('450000');
    await ds.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Catatan servis disimpan.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: plat })).toContainText('Rp 450.000');

    // BBM: odometer mundur ditolak, lalu benar.
    await page.getByRole('tab', { name: 'BBM' }).click();
    await page.getByRole('button', { name: 'Catat BBM' }).click();
    const db = page.getByRole('dialog', { name: 'Catat BBM' });
    await db.getByLabel('Kendaraan').selectOption(String(truk.id));
    await db.getByLabel('Odometer').fill('19500');
    await db.getByLabel('Liter').fill('40,5');
    await db.getByLabel('Total bayar').fill('405000');
    await db.getByRole('button', { name: 'Simpan' }).click();
    await expect(db.getByText(/lebih kecil dari catatan sebelumnya \(20\.000 km\)/)).toBeVisible();
    await db.getByLabel('Odometer').fill('24700');
    await db.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Catatan BBM disimpan.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: plat }).first()).toContainText('40,5 L');

    // Servis berikutnya 25.000 km: tinggal 300 km → segera.
    await page.getByRole('tab', { name: 'Kendaraan' }).click();
    await expect(baris).toContainText('24.700 km');
    await expect(baris).toContainText('Servis berikutnya: 25.000 km');

    // Notifikasi topbar.
    const notif = await api<{ jenis: string; keterangan: string }[]>(page, '/notifikasi');
    expect(notif.find((n) => n.jenis === 'ARMADA_SURAT')?.keterangan).toContain(
      `${plat}: KIR habis`,
    );
    expect(notif.find((n) => n.jenis === 'ARMADA_SERVIS')?.keterangan).toContain(plat);

    // Statistik.
    await page.getByRole('tab', { name: 'Statistik' }).click();
    const st = page.getByRole('row').filter({ hasText: plat });
    await expect(st).toContainText('Rp 405.000');
    await expect(st).toContainText('4.700 km');
    await expect(st).toContainText('Rp 450.000');
  } finally {
    await api(page, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
