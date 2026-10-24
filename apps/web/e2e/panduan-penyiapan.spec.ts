import { expect, test } from '@playwright/test';
import { masukCepat } from './pembantu';

// K-105: penyiapan printer struk dan saluran kode persetujuan berupa langkah berurutan yang menyebut apa yang
// kurang. Printer diganti tiruan Web Serial; uji saluran dijawab tiruan (tidak ada pesan sungguhan terkirim).

test('Printer struk: salah pilih port diperingatkan; uji cetak dipandu sampai cetak langsung menyala', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Port = { getInfo: () => object; forget: () => Promise<void> };
    const w = window as unknown as {
      terkirim: number[];
      pilihan: 'modem' | 'printer';
      berizin: Port[];
    };
    w.terkirim = [];
    w.pilihan = 'modem';
    w.berizin = [];
    const buat = (info: object): Port => {
      const port = {
        getInfo: () => info,
        open: () => Promise.resolve(),
        close: () => Promise.resolve(),
        forget: () => {
          w.berizin = w.berizin.filter((x) => x !== port);
          return Promise.resolve();
        },
        get writable() {
          return new WritableStream<Uint8Array>({
            write(potongan) {
              w.terkirim.push(...potongan);
            },
          });
        },
      };
      return port;
    };
    const port = {
      modem: buat({ usbVendorId: 0x1199, usbProductId: 0x9075 }),
      printer: buat({}),
    };
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: {
        getPorts: () => Promise.resolve(w.berizin),
        requestPort: () => {
          const p = port[w.pilihan];
          if (!w.berizin.includes(p)) w.berizin.push(p);
          return Promise.resolve(p);
        },
      },
    });
  });
  await masukCepat(page, 'ADMIN');
  await page.goto('/pengaturan');
  await page.getByRole('tab', { name: 'Struk & printer' }).click();
  await expect(page.getByTestId('printer-terpilih')).toHaveText('Belum dipilih');
  await expect(page.getByRole('button', { name: 'Uji cetak' })).toBeDisabled();

  // Modem laptop (EM7455) terpilih: diperingatkan, langkah 2 belum selesai.
  await page.getByRole('button', { name: 'Pilih printer…' }).click();
  await expect(page.getByText('Salah pilih.')).toBeVisible();
  await expect(page.getByText(/modem seluler Sierra Wireless/)).toBeVisible();
  await expect(page.getByLabel('Langkah 2 belum selesai')).toBeVisible();

  // Pilih lagi: izin port lama dicabut, sehingga hanya printer yang tersisa.
  await page.evaluate(() => {
    (window as unknown as { pilihan: string }).pilihan = 'printer';
  });
  await page.getByRole('button', { name: 'Pilih printer lain…' }).click();
  await expect(page.getByTestId('printer-terpilih')).toContainText('Port serial');
  await expect(page.getByText('Salah pilih.')).toHaveCount(0);
  await expect(page.getByLabel('Langkah 2 selesai')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { berizin: unknown[] }).berizin.length),
  ).toBe(1);

  await page.getByLabel('Lebar kertas / karakter per baris').click();
  await page.getByRole('option', { name: 'Kertas 57/58 mm (32 karakter per baris)' }).click();
  await expect(page.getByLabel('Langkah 3 selesai')).toBeVisible();

  // Uji cetak terkirim: aplikasi menanyakan apa yang keluar, dan memberi saran sesuai jawabannya.
  await page.getByRole('button', { name: 'Uji cetak' }).click();
  await expect(page.getByText('Apa yang keluar dari printer?')).toBeVisible();
  const teks = await page.evaluate(() =>
    String.fromCharCode(...(window as unknown as { terkirim: number[] }).terkirim),
  );
  expect(teks).toContain('UJI CETAK STRUK');
  expect(teks).toContain('12345678901234567890123456789012\n');
  await page.getByRole('button', { name: 'Tidak keluar apa-apa' }).click();
  await expect(page.getByText(/bukan printernya/)).toBeVisible();
  await expect(page.getByLabel('Langkah 4 belum selesai')).toBeVisible();

  await page.getByRole('button', { name: 'Tercetak dan terbaca jelas' }).click();
  await expect(page.getByLabel('Langkah 4 selesai')).toBeVisible();
  await expect(page.getByLabel('Langkah 5 selesai')).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Cetak struk langsung ke printer thermal' }),
  ).toBeChecked();
  const tersimpan = await page.evaluate(
    () => JSON.parse(localStorage.getItem('tbsu:printer-struk') ?? '{}') as Record<string, unknown>,
  );
  expect(tersimpan).toMatchObject({
    langsung: true,
    teruji: true,
    lebarKarakter: 32,
    kepekatan: 'TEBAL',
  });
});

test('Persetujuan: tiap saluran punya tiga langkah dan tombol uji sendiri yang menyebut apa yang kurang', async ({
  page,
}) => {
  const diminta: string[] = [];
  await page.route('**/api/saluran/uji', async (rute) => {
    const { saluran } = rute.request().postDataJSON() as { saluran: 'TELEGRAM' | 'EMAIL' };
    diminta.push(saluran);
    await rute.fulfill({
      json: {
        data:
          saluran === 'TELEGRAM'
            ? { saluran, berhasil: false, pesan: 'Bot sudah aktif, tetapi akun belum dihubungkan.' }
            : { saluran, berhasil: true, pesan: 'Email uji terkirim ke demo@contoh.test.' },
      },
    });
  });
  await masukCepat(page, 'OWNER');
  await page.goto('/pengaturan');
  await page.getByRole('tab', { name: 'Persetujuan' }).click();

  const telegram = page.getByTestId('saluran-telegram');
  const email = page.getByTestId('saluran-email');
  for (const judul of [
    'Langkah 1. Buat bot toko dan isi tokennya',
    'Langkah 2. Hubungkan Telegram Demo Owner ke bot',
    'Langkah 3. Kirim pesan uji ke Telegram Anda',
  ]) {
    await expect(telegram.getByText(judul)).toBeVisible();
  }
  for (const judul of [
    'Langkah 1. Isi akun email pengirim (Gmail toko)',
    'Langkah 2. Isi alamat email Demo Owner (penerima kode)',
    'Langkah 3. Kirim email uji ke alamat Anda',
  ]) {
    await expect(email.getByText(judul)).toBeVisible();
  }

  // Tombol uji Telegram menguji Telegram, bukan email; hasilnya tetap tampil di kartunya sendiri.
  await telegram.getByRole('button', { name: 'Kirim pesan uji Telegram' }).click();
  await expect(telegram.getByRole('status')).toContainText('Belum berhasil. Bot sudah aktif');
  await expect(email.getByRole('status')).toHaveCount(0);
  await email.getByRole('button', { name: 'Kirim email uji' }).click();
  await expect(email.getByRole('status')).toContainText('Berhasil. Email uji terkirim');
  await expect(email.getByLabel('Langkah 3 selesai')).toBeVisible();
  expect(diminta).toEqual(['TELEGRAM', 'EMAIL']);
});
