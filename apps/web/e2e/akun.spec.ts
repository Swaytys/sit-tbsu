import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-191: kode pemulihan dan lupa password (pengguna uji baru, dinonaktifkan di akhir), dan tampilan halaman
// Buat akun pertama. Database pengembangan sudah berisi pengguna, jadi jawaban API akun pertama ditiru di uji kedua.

test('Kode pemulihan di Akun saya → lupa password → masuk dengan password baru; kode lama hangus', async ({
  browser,
}) => {
  const kode = Date.now() % 1_000_000;
  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  const username = `pulih.${kode}`;
  const p = await api<{ id: number }>(owner, '/pengguna', 'POST', {
    namaPengguna: `Uji Pulih ${kode}`,
    username,
    peran: 'KASIR',
    password: 'awal-uji-123',
  });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    await page.goto('/login');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill('awal-uji-123');
    await page.getByRole('button', { name: /^Masuk/ }).click();
    // Akun baru dari Data Pengguna wajib mengganti password awal.
    await expect(page).toHaveURL(/ganti-password/);
    await page.getByLabel('Password lama').fill('awal-uji-123');
    await page.getByLabel('Password baru', { exact: true }).fill('kedua-uji-789');
    await page.getByLabel('Ulangi password baru').fill('kedua-uji-789');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/dashboard/);

    await page.goto('/akun/password');
    await page.getByLabel('Password saat ini untuk kode pemulihan').fill('kedua-uji-789');
    await page.getByRole('button', { name: 'Buat kode' }).click();
    const kotak = page.getByTestId('kode-pemulihan');
    await expect(kotak).toBeVisible();
    const kodePulih = (await kotak.locator('.font-mono').first().textContent())!.trim();
    expect(kodePulih).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    const selesai = kotak.getByRole('button', { name: 'Selesai' });
    await expect(selesai).toBeDisabled();
    await kotak.getByText('Saya sudah menyimpan').click();
    await selesai.click();
    await expect(page.getByText(/Sudah ada, dibuat/)).toBeVisible();

    // Keluar lalu lupa password.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Lupa password?' }).click();
    await expect(page.getByRole('heading', { name: 'Lupa password' })).toBeVisible();
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Kode pemulihan').fill('ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ');
    await page.getByLabel('Password baru (minimal 8 karakter)').fill('baru-uji-456');
    await page.getByLabel('Ulangi password baru').fill('baru-uji-456');
    await page.getByRole('button', { name: 'Ganti password' }).click();
    await expect(page.getByText('Username atau kode pemulihan salah.')).toBeVisible();
    await page.getByLabel('Kode pemulihan').fill(kodePulih.toLowerCase());
    await page.getByRole('button', { name: 'Ganti password' }).click();
    await expect(page.getByRole('heading', { name: 'Password sudah diganti' })).toBeVisible();
    const kodeBaru = (await page
      .getByTestId('kode-pemulihan')
      .locator('.font-mono')
      .first()
      .textContent())!.trim();
    expect(kodeBaru).not.toBe(kodePulih);
    await page.getByText('Saya sudah menyimpan').click();
    await page.getByRole('button', { name: 'Masuk sekarang' }).click();
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill('baru-uji-456');
    await page.getByRole('button', { name: /^Masuk/ }).click();
    await expect(page).toHaveURL(/dashboard/);
  } finally {
    await api(owner, `/pengguna/${p.id}/nonaktifkan`, 'POST');
  }
});

test('Halaman masuk mengarah ke Buat akun pertama bila belum ada pengguna; kode pemulihan wajib disimpan', async ({
  page,
}) => {
  // Database pengembangan sudah punya pengguna: jawaban "belum ada pengguna" dan pembuatan akun ditiru.
  await page.route('**/api/auth/penyiapan', (r) =>
    r.fulfill({ json: { data: { perluAkunPertama: true } } }),
  );
  await page.route('**/api/auth/akun-pertama', (r) =>
    r.fulfill({
      status: 201,
      json: {
        data: {
          pengguna: {
            id: 1,
            kode: 'USR-00001',
            username: 'harto',
            namaPengguna: 'Pak Harto',
            peran: 'OWNER',
            izin: [],
            wajibGantiPassword: false,
          },
          kodePemulihan: 'ABCDE-FGHJK-MNPQR-STUVW',
        },
      },
    }),
  );
  await page.goto('/login');
  await expect(page).toHaveURL(/akun-pertama/);
  await expect(page.getByRole('heading', { name: 'Buat akun pertama' })).toBeVisible();
  await page.getByLabel('Nama Anda').fill('Pak Harto');
  await page.getByLabel('Username (untuk masuk)').fill('harto');
  await page.getByLabel('Password (minimal 8 karakter)').fill('rahasia-toko-1');
  await page.getByLabel('Ulangi password').fill('rahasia-beda');
  await page.getByRole('button', { name: 'Buat akun dan masuk' }).click();
  await expect(page.getByText('Ulangi password tidak sama.')).toBeVisible();
  await page.getByLabel('Ulangi password').fill('rahasia-toko-1');
  await page.getByRole('button', { name: 'Buat akun dan masuk' }).click();
  await expect(page.getByRole('heading', { name: 'Simpan kode pemulihan' })).toBeVisible();
  await expect(page.getByTestId('kode-pemulihan')).toContainText('ABCDE-FGHJK-MNPQR-STUVW');
  await expect(page.getByRole('button', { name: 'Lanjut ke panduan penyiapan' })).toBeDisabled();
});
