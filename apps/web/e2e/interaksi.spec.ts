import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// K-190: log interaksi penelitian. Owner menyalakan → Kasir mendapat pemberitahuan, kliknya, pintasan, dialog,
// pencarian barang, dan lama di halaman tercatat; isi kotak isian tidak pernah tercatat. Setelan dikembalikan di akhir.

type Kejadian = {
  jenis: string;
  halaman: string;
  elemen: string | null;
  keterangan: string | null;
  angka: number | null;
};

test('Log interaksi: dinyalakan Owner, pemakaian Kasir tercatat tanpa isi ketikan, bisa dilihat dan diekspor', async ({
  browser,
}) => {
  test.slow();
  const owner = await browser.newPage();
  await masukCepat(owner, 'OWNER');
  const awal = await api<{ aktif: boolean; tingkat: string }>(owner, '/log-interaksi/setelan');
  await api(owner, '/log-interaksi/setelan', 'PUT', { aktif: true, tingkat: 'SEMUA' });
  try {
    const kasir = await browser.newPage();
    await masukCepat(kasir, 'KASIR');
    const saya = await api<{ id: number }>(kasir, '/auth/saya');
    const mulai = new Date().toISOString();
    // Pemberitahuan muncul sekali per sesi tab; masukCepat memuat ulang halaman (K-206), jadi tampilkan lagi.
    await kasir.evaluate(() => sessionStorage.clear());
    await kasir.reload();
    await expect(kasir.getByText(/dicatat untuk penelitian/)).toBeVisible();

    // Klik menu, pintasan R (dialog Rit baru), Esc.
    await menuUtama(kasir).getByRole('link', { name: 'Pengiriman' }).click();
    await expect(kasir.getByRole('region', { name: 'Backlog' })).toBeVisible();
    await kasir.keyboard.press('r');
    await expect(kasir.getByRole('dialog', { name: 'Rit baru' })).toBeVisible();
    await kasir.getByPlaceholder(/Catatan \(opsional\)/).fill('Rahasia 0812345678901');
    await kasir.keyboard.press('Escape');
    await expect(kasir.getByRole('dialog')).toHaveCount(0);

    // Pencarian umum (Ctrl+K): jumlah hasil dan panjang kata saja (bisa berisi nama pelanggan).
    await kasir.keyboard.press('Control+k');
    await kasir.keyboard.type('semen');
    await kasir.waitForTimeout(1200);
    await kasir.keyboard.press('Escape');
    // Pindah halaman: lama di /pengiriman tercatat; tab disembunyikan → antrean terkirim.
    await kasir.goto('/dashboard');
    await kasir.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    let data: Kejadian[] = [];
    await expect
      .poll(
        async () => {
          data = (
            await api<Kejadian[]>(owner, `/log-interaksi?idPengguna=${saya.id}&perHalaman=100`)
          ).filter(Boolean);
          return data.length;
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(3);
    // Kiriman bisa terbagi; tunggu sampai pencarian ikut masuk.
    await expect
      .poll(
        async () =>
          (
            await api<Kejadian[]>(owner, `/log-interaksi?idPengguna=${saya.id}&perHalaman=100`)
          ).some((k) => k.jenis === 'CARI'),
        { timeout: 30_000 },
      )
      .toBe(true);
    data = await api<Kejadian[]>(owner, `/log-interaksi?idPengguna=${saya.id}&perHalaman=100`);
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jenis: 'KLIK', elemen: 'Pengiriman' }),
        expect.objectContaining({ jenis: 'TOMBOL', keterangan: 'R', halaman: '/pengiriman' }),
        expect.objectContaining({ jenis: 'DIALOG', elemen: 'Rit baru', keterangan: 'buka' }),
        expect.objectContaining({ jenis: 'DIALOG', elemen: 'Rit baru', keterangan: 'tutup' }),
        expect.objectContaining({ jenis: 'CARI', elemen: '/api/cari', keterangan: '5 huruf' }),
        expect.objectContaining({ jenis: 'TOMBOL', keterangan: 'Ctrl+K' }),
        expect.objectContaining({ jenis: 'HALAMAN', halaman: '/pengiriman' }),
      ]),
    );
    // Isi ketikan tidak pernah terkirim.
    expect(JSON.stringify(data)).not.toMatch(/Rahasia|0812345678901|semen/);

    // Owner: tab Log interaksi menampilkan ringkasan dan baris; ekspor CSV berisi data kasir.
    await owner.goto('/pengaturan?tab=interaksi');
    await expect(owner.getByTestId('ringkasan-interaksi')).toContainText('menyala');
    await owner.getByLabel('Saring jenis interaksi').selectOption('CARI');
    await expect(owner.getByRole('cell', { name: /5 huruf/ }).first()).toBeVisible();
    const csv = await owner.request.get(
      `/api/log-interaksi/ekspor?format=CSV&idPengguna=${saya.id}&dari=${mulai.slice(0, 10)}`,
    );
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain('CARI');
  } finally {
    await api(owner, '/log-interaksi/setelan', 'PUT', awal);
  }
});
