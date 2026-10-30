import { expect, test } from '@playwright/test';
import { api, masukCepat, menuUtama } from './pembantu';

// Skenario roadmap Fase 5: "pengantaran DP → dua surat jalan → pelunasan → lunas". Menambah barang, pelanggan,
// order, dan invoice uji di database pengembangan (barang & pelanggan dinonaktifkan di akhir).

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
    // K-150: kendaraan dan sopir dari data master (unik per jalannya tes, dinonaktifkan di akhir).
    const truk = await api<{ id: number; plat: string }>(admin, '/kendaraan', 'POST', {
      plat: `L ${kode % 10000} EE`,
      jenis: 'Pikap E2E',
    });
    const sopir = await api<{ id: number }>(admin, '/sopir', 'POST', {
      nama: `Slamet E2E ${kode}`,
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
      await kasir.reload(); // dialog buka shift yang sempat muncul sebelum shift dibuka lewat API ditutup

      // 1. Invoice dengan DP transfer Rp 200.000 lewat layar POS (keyboard).
      await menuUtama(kasir).getByRole('link', { name: 'Penjualan Pengantaran' }).click();
      const tiket = kasir.getByRole('option', { name: `Antrean ${o.noAntrean}`, exact: true });
      await expect(tiket).toContainText(`CV Proyek E2E ${kode}`);
      await kasir.keyboard.press('F3');
      await kasir.keyboard.type(String(o.noAntrean));
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 500.000');
      await kasir.keyboard.press('u'); // DP: sebagian sekarang, sisanya piutang
      await kasir.keyboard.press('b');
      await kasir.keyboard.type('200000');
      await kasir.keyboard.press('Tab'); // rekening tujuan (bawaan terpilih)
      await kasir.keyboard.press('Tab'); // No. referensi (wajib, K-154)
      await kasir.keyboard.type('TRX123456');
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByTestId('hasil-transaksi')).toContainText('sisa Rp 300.000');
      const [inv] = await api<{ id: number }[]>(
        admin,
        `/penjualan?jenis=PENGANTARAN&cari=${encodeURIComponent(`CV Proyek E2E ${kode}`)}`,
      );
      await kasir.goto(`/penjualan/${inv!.id}`);
      await expect(kasir.getByRole('heading', { name: /^INV-\d{6}-\d{3,}/ })).toContainText('DP');

      // 2. Surat jalan pertama: 2 dari 5, di rit baru yang dibuat dari dialog (K-174).
      const detailUrl = kasir.url();
      await kasir.getByRole('button', { name: 'Kirim dengan rit…' }).click();
      await kasir.keyboard.press('Alt+n');
      await kasir.getByLabel('Kendaraan rit').selectOption(String(truk.id));
      await kasir.getByLabel('Sopir rit').selectOption(String(sopir.id));
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByLabel('Rit pengiriman')).not.toHaveValue('');
      await kasir.getByLabel(`Qty kirim ${nama}`).fill('2');
      await kasir.keyboard.press('Enter');
      const sj1 = kasir.locator('[data-testid^="sj-SJ-"]').first();
      await expect(sj1).toContainText(`Sopir Slamet E2E ${kode}`);
      await expect(sj1).toContainText(truk.plat);
      await sj1.getByRole('button', { name: 'Selesai dimuat' }).click();
      await expect(sj1).toContainText('Barang dimuat');

      // Rit berangkat dari papan Pengiriman (surat jalan tidak dicetak di uji ini: pilihan 3).
      async function berangkatkan() {
        await kasir.goto('/pengiriman');
        const grup = kasir.locator('[data-testid^="rit-TRP-"]').filter({ hasText: truk.plat });
        // K-203: semua surat jalan rit dicentang Dimuat dulu.
        await expect(grup.getByRole('checkbox', { name: /^Dimuat SJ-/ }).first()).toBeVisible();
        const belum = grup.getByRole('checkbox', { name: /^Dimuat SJ-/, checked: false });
        while ((await belum.count()) > 0) {
          await belum.first().click();
          await kasir.waitForTimeout(300);
        }
        await grup.getByRole('button', { name: 'Berangkat' }).click();
        await kasir.keyboard.press('3');
        await kasir.keyboard.press('Enter');
        await expect(
          kasir.locator('[data-testid^="jalan-TRP-"]').filter({ hasText: truk.plat }),
        ).toBeVisible();
        await kasir.goto(detailUrl);
      }
      await berangkatkan();
      await expect(sj1).toContainText('Di jalan');
      await sj1.getByRole('button', { name: 'Catat hasil' }).click();
      await kasir.getByRole('button', { name: /Semua diterima/ }).click();
      await expect(sj1.getByTestId('ringkas-hasil')).toContainText('Semua diterima');
      await expect(kasir.getByText('Dikirim sebagian')).toBeVisible();

      // 3. Surat jalan kedua: sisa 3, rit baru dengan kendaraan & sopir yang sama (bebas lagi setelah hasil
      // surat jalan pertama dicatat).
      await kasir.getByRole('button', { name: 'Kirim dengan rit…' }).click();
      await expect(kasir.getByLabel(`Qty kirim ${nama}`)).toHaveValue('3');
      await kasir.getByRole('button', { name: /^Rit baru/ }).click();
      await kasir.getByLabel('Kendaraan rit').selectOption(String(truk.id));
      await kasir.getByLabel('Sopir rit').selectOption(String(sopir.id));
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByLabel('Rit pengiriman')).not.toHaveValue('');
      await kasir.getByRole('button', { name: /^Masukkan ke rit/ }).click();
      const sj2 = kasir.locator('[data-testid^="sj-SJ-"]').first();
      await expect(sj2).toContainText('Surat jalan dibuat');
      await berangkatkan();
      await sj2.getByRole('button', { name: 'Catat hasil' }).click();
      await kasir.keyboard.press('Enter'); // fokus awal di "Semua diterima"
      await expect(sj2.getByTestId('ringkas-hasil')).toContainText('Semua diterima');
      await expect(kasir.getByText('Terkirim', { exact: true })).toBeVisible();
      await expect(kasir.getByRole('button', { name: 'Kirim dengan rit…' })).toHaveCount(0);

      // 4. Pelunasan sisa Rp 300.000 lewat EDC.
      await kasir.getByRole('button', { name: 'Terima pembayaran' }).click();
      const dialog = kasir.getByRole('dialog');
      await expect(dialog.getByLabel('Bayar')).toBeFocused();
      await kasir.keyboard.press('e'); // EDC; kotak kosong = lunasi sisa
      await kasir.keyboard.press('Tab');
      await kasir.keyboard.press('Tab');
      await kasir.keyboard.type('APPR01');
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByText(/INV-\d{6}-\d{3,} lunas\./)).toBeVisible();
      await expect(kasir.getByRole('heading', { name: /^INV-/ })).toContainText('Lunas');
      await expect(kasir.getByRole('button', { name: 'Terima pembayaran' })).toHaveCount(0);
    } finally {
      await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
      await api(admin, `/pelanggan/${plg.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
      await api(admin, `/kendaraan/${truk.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
      await api(admin, `/sopir/${sopir.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
    }
  },
);
