import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-191: kode pemulihan dan lupa password (pengguna uji baru, dinonaktifkan di akhir), dan setup awal K-205.
// Database pengembangan sudah berisi pengguna, jadi jawaban API setup awal ditiru di uji kedua.

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
    // K-209: cara bawaan kode email; pilih cara kode pemulihan.
    await page.getByRole('tab', { name: 'Kode pemulihan' }).click();
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Kode pemulihan', { exact: true }).fill('ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ');
    await page.getByLabel('Password baru (minimal 8 karakter)').fill('baru-uji-456');
    await page.getByLabel('Ulangi password baru').fill('baru-uji-456');
    await page.getByRole('button', { name: 'Ganti password' }).click();
    await expect(page.getByText('Username atau kode pemulihan salah.')).toBeVisible();
    await page.getByLabel('Kode pemulihan', { exact: true }).fill(kodePulih.toLowerCase());
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

test('Halaman masuk mengarah ke setup awal bila belum ada pengguna; isian divalidasi; kode pemulihan wajib disimpan (K-205)', async ({
  page,
}) => {
  // Database pengembangan sudah punya pengguna: jawaban "belum ada pengguna" dan setup awal ditiru.
  await page.route('**/api/auth/penyiapan', (r) =>
    r.fulfill({
      json: { data: { perluAkunPertama: true, namaToko: '', sloganToko: '', kotaToko: '' } },
    }),
  );
  let dikirim: unknown = null;
  await page.route('**/api/auth/setup-awal', (r) => {
    dikirim = r.request().postDataJSON();
    return r.fulfill({
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
    });
  });
  await page.goto('/login');
  await expect(page).toHaveURL(/\/mulai/);
  await expect(page.getByRole('heading', { name: 'Selamat datang' })).toBeVisible();
  await page.keyboard.press('Enter');

  // Data usaha: kosong ditolak dengan pesan per kolom.
  await expect(page.getByRole('heading', { name: 'Data usaha' })).toBeVisible();
  await page.getByRole('button', { name: /Lanjut/ }).click();
  await expect(page.getByText('Nama usaha wajib diisi.')).toBeVisible();
  await page.getByLabel(/^Nama usaha/).fill('Toko Maju Jaya');
  await page.getByLabel(/^Slogan/).fill('Lengkap dan murah');
  await page.getByLabel(/^Alamat/).fill('Jl. Merdeka 1');
  await page.getByLabel(/^Kota\/kabupaten/).fill('Kediri');
  await page.getByLabel(/^Telepon usaha/).fill('0354 123456');
  await page.getByRole('button', { name: /Lanjut/ }).click();

  // Cara berjualan: jam tutup harus setelah jam buka.
  await expect(page.getByRole('heading', { name: 'Cara berjualan' })).toBeVisible();
  await page.getByLabel(/^Buka/).fill('17:00');
  await page.getByLabel(/^Tutup/).fill('08:00');
  await page.getByRole('button', { name: /Lanjut/ }).click();
  await expect(page.getByText('Jam tutup harus setelah jam buka.')).toBeVisible();
  await page.getByLabel(/^Buka/).fill('07:00');
  await page.getByLabel(/^Tutup/).fill('17:00');
  // Alt+← kembali, Alt+→ lanjut.
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.getByRole('heading', { name: 'Data usaha' })).toBeVisible();
  await expect(page.getByLabel(/^Nama usaha/)).toHaveValue('Toko Maju Jaya');
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');

  // Akun Owner.
  await expect(page.getByRole('heading', { name: 'Akun Owner' })).toBeVisible();
  await page.getByLabel(/^Nama lengkap/).fill('Pak Harto');
  await page.getByLabel(/^Username/).fill('harto');
  await page.getByLabel(/^Password/).fill('rahasia-toko-1');
  await page.getByLabel(/^Ulangi password/).fill('rahasia-beda');
  await page.getByRole('button', { name: /Buat akun dan masuk/ }).click();
  await expect(page.getByText('Ulangi password tidak sama.')).toBeVisible();
  await page.getByLabel(/^Ulangi password/).fill('rahasia-toko-1');
  await page.getByRole('button', { name: /Buat akun dan masuk/ }).click();
  await expect(page.getByRole('heading', { name: 'Kode pemulihan' })).toBeVisible();
  await expect(page.getByTestId('kode-pemulihan')).toContainText('ABCDE-FGHJK-MNPQR-STUVW');
  await expect(page.getByRole('button', { name: 'Lanjut ke langkah berikutnya' })).toBeDisabled();
  expect(dikirim).toMatchObject({
    usaha: { namaToko: 'Toko Maju Jaya', kotaToko: 'Kediri', jenisUsaha: 'BAHAN_BANGUNAN' },
    operasional: { shiftJamBuka: '07:00', shiftJamTutup: '17:00' },
    owner: { username: 'harto' },
  });
});
