import { expect, test } from '@playwright/test';
import { masukCepat, menuUtama } from './pembantu';

// Tes ini menambah satu pengguna uji (lalu menonaktifkannya) di database pengembangan setiap kali jalan.
test(
  'Owner menambah kasir; kasir wajib ganti password; Owner menonaktifkannya',
  { tag: '@kritis' },
  async ({ browser }) => {
    const username = `e2e.${Date.now()}`;
    const nama = `Kasir E2E ${username.slice(-5)}`;

    // 1. Owner menambah pengguna.
    const owner = await browser.newPage();
    await masukCepat(owner, 'OWNER');
    await menuUtama(owner).getByRole('link', { name: 'Data Pengguna' }).click();
    await expect(owner.getByRole('heading', { name: 'Data Pengguna' })).toBeVisible();

    await owner.getByRole('button', { name: 'Tambah pengguna' }).click();
    const dialog = owner.getByRole('dialog', { name: 'Tambah pengguna' });
    await dialog.getByLabel('Nama pengguna').fill(nama);
    await dialog.getByLabel('Username').fill(username);
    await dialog.getByLabel('Password awal').fill('awal-e2e-123');
    await dialog.getByRole('button', { name: 'Simpan' }).click();
    await expect(owner.getByText(/ditambahkan \(USR-\d{5}\)/)).toBeVisible();

    await owner.getByLabel('Cari pengguna').fill(username);
    const baris = owner.getByRole('row').filter({ hasText: username });
    await expect(baris).toContainText('Kasir');
    await expect(baris).toContainText('Wajib ganti password');

    // 2. Kasir login pertama kali → wajib ganti password.
    const kasir = await browser.newPage();
    await kasir.goto('/login');
    await kasir.getByLabel('Username').fill(username);
    await kasir.getByLabel('Password').fill('awal-e2e-123');
    await kasir.getByRole('button', { name: 'Masuk' }).click();
    await expect(kasir).toHaveURL(/\/ganti-password$/);

    await kasir.getByLabel('Password lama').fill('awal-e2e-123');
    await kasir.getByLabel('Password baru', { exact: true }).fill('baru-e2e-1234');
    await kasir.getByLabel('Ulangi password baru').fill('baru-e2e-1234');
    await kasir.getByRole('button', { name: 'Simpan password baru' }).click();
    await expect(kasir).toHaveURL(/\/dashboard$/);
    await expect(kasir.getByText(`Selamat datang, ${nama} (Kasir)`)).toBeVisible();

    // 3. Owner menonaktifkan kasir → sesi kasir langsung berakhir.
    await owner.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
    await owner.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
    await owner.getByRole('alertdialog').getByRole('button', { name: 'Nonaktifkan' }).click();
    await expect(baris).toContainText('Nonaktif');

    await kasir.reload();
    await expect(kasir).toHaveURL(/\/login/);
  },
);

// K-243: peran khusus dan izin per akun. Menambah satu pengguna uji dan satu peran khusus setiap kali jalan.
test('Owner membuat peran khusus, memasangnya ke kasir baru, lalu mencabut satu izin', async ({
  browser,
}) => {
  const akhiran = String(Date.now()).slice(-6);
  const username = `e2e.izin.${akhiran}`;
  const nama = `Kasir Izin ${akhiran}`;
  const namaPeran = `Kasir Antar ${akhiran}`;

  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  await menuUtama(owner).getByRole('link', { name: 'Data Pengguna' }).click();

  await owner.getByRole('button', { name: 'Tambah pengguna' }).click();
  const tambah = owner.getByRole('dialog', { name: 'Tambah pengguna' });
  await tambah.getByLabel('Nama pengguna').fill(nama);
  await tambah.getByLabel('Username').fill(username);
  await tambah.getByLabel('Password awal').fill('awal-e2e-123');
  await tambah.getByRole('button', { name: 'Simpan' }).click();
  await expect(owner.getByText(/ditambahkan \(USR-\d{5}\)/)).toBeVisible();

  // 1. Peran khusus: Kasir + pengantaran.
  await owner.getByRole('button', { name: 'Peran khusus' }).click();
  const peran = owner.getByRole('dialog');
  await peran.getByRole('button', { name: 'Tambah peran khusus' }).click();
  await peran.getByLabel('Nama peran').fill(namaPeran);
  await peran.locator('[data-izin="penjualan.surat_jalan.kelola"]').click();
  await expect(peran.getByText('ditambah 1')).toBeVisible();
  await peran.getByRole('button', { name: 'Simpan peran' }).click();
  await expect(owner.getByText(`Peran khusus "${namaPeran}" disimpan`)).toBeVisible();
  await expect(peran.getByRole('row').filter({ hasText: namaPeran })).toContainText('+1');
  await peran.getByRole('button', { name: 'Tutup' }).last().click();

  // 2. Pasang ke kasir baru dan cabut satu izin bawaan.
  await owner.getByLabel('Cari pengguna').fill(username);
  await owner.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await owner.getByRole('menuitem', { name: 'Atur izin' }).click();
  const izin = owner.getByRole('dialog', { name: `Atur izin ${nama}` });
  await izin.getByRole('combobox', { name: 'Peran khusus' }).click();
  await owner.getByRole('option', { name: namaPeran }).click();
  await izin.locator('[data-izin="laporan.ekspor"]').click();
  await expect(izin.getByText('dicabut 1')).toBeVisible();
  await izin.getByRole('button', { name: 'Simpan izin' }).click();
  await expect(owner.getByText(`Izin ${nama} disimpan`)).toBeVisible();
  const baris = owner.getByRole('row').filter({ hasText: username });
  await expect(baris).toContainText(namaPeran);
  await expect(baris).toContainText('−1');

  // 3. Kasir login: label peran khusus tampil; izin efektif dari API.
  const kasir = await browser.newPage();
  await kasir.goto('/login');
  await kasir.getByLabel('Username').fill(username);
  await kasir.getByLabel('Password').fill('awal-e2e-123');
  await kasir.getByRole('button', { name: 'Masuk' }).click();
  await kasir.getByLabel('Password lama').fill('awal-e2e-123');
  await kasir.getByLabel('Password baru', { exact: true }).fill('baru-e2e-1234');
  await kasir.getByLabel('Ulangi password baru').fill('baru-e2e-1234');
  await kasir.getByRole('button', { name: 'Simpan password baru' }).click();
  await expect(kasir).toHaveURL(/\/dashboard$/);
  const saya = (await (await kasir.request.get('/api/auth/saya')).json()) as {
    data: { izin: string[]; namaPeranKustom: string };
  };
  expect(saya.data.namaPeranKustom).toBe(namaPeran);
  expect(saya.data.izin).toContain('penjualan.surat_jalan.kelola');
  expect(saya.data.izin).not.toContain('laporan.ekspor');

  // Bersihkan: nonaktifkan akun dan peran uji.
  await owner.getByRole('button', { name: `Aksi untuk ${nama}` }).click();
  await owner.getByRole('menuitem', { name: 'Nonaktifkan' }).click();
  await owner.getByRole('alertdialog').getByRole('button', { name: 'Nonaktifkan' }).click();
  await owner.getByRole('button', { name: 'Peran khusus' }).click();
  await owner
    .getByRole('dialog')
    .getByRole('row')
    .filter({ hasText: namaPeran })
    .getByRole('button', { name: 'Nonaktifkan' })
    .click();
  await expect(owner.getByText(`Peran "${namaPeran}" dinonaktifkan`)).toBeVisible();
});
