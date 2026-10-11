import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-103: struk dikirim langsung ke printer thermal (ESC/POS lewat Web Serial) tanpa jendela cetak. Printer
// diganti tiruan yang menampung byte yang dikirim. Menambah barang dan penjualan uji di database
// pengembangan (barang dinonaktifkan di akhir).
test('Kasir: struk langsung ke printer thermal tanpa jendela cetak; printer mati → tawaran jendela cetak', async ({
  browser,
}) => {
  const kode = Date.now();
  const admin = await browser.newPage();
  await masukCepat(admin, 'ADMIN');
  const kategori = await api<{ id: number }[]>(admin, '/kategori?status=AKTIF');
  const satuan = await api<{ id: number; kode: string }[]>(admin, '/satuan?status=AKTIF');
  const tier = await api<{ id: number; isDefault: boolean }[]>(admin, '/tingkat-harga');
  const nama = `Paku Cetak E2E ${kode}`;
  const barang = await api<{ id: number; kode: string }>(admin, '/barang', 'POST', {
    namaBarang: nama,
    idKategori: kategori[0]!.id,
    idSatuanDasar: satuan.find((s) => s.kode === 'sak')!.id,
    hargaModalAwal: 4000,
    hargaTier: [{ idTingkatHarga: tier.find((t) => t.isDefault)!.id, hargaTetap: 5500 }],
  });
  const adj = await api<{ id: number }>(admin, '/penyesuaian', 'POST', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: barang.id, qtyFisik: '10', hppSatuan: 4000 }],
  });
  await api(admin, `/penyesuaian/${adj.id}/selesai`, 'POST');
  try {
    const kasir = await browser.newPage();
    await kasir.addInitScript(() => {
      localStorage.setItem(
        'tbsu:printer-struk',
        JSON.stringify({ langsung: true, baud: 9600, lebarKarakter: 32, potong: true }),
      );
      const w = window as unknown as { strukTerkirim: number[]; printerMati: boolean };
      w.strukTerkirim = [];
      w.printerMati = false;
      const port = {
        getInfo: () => ({}),
        open: () => (w.printerMati ? Promise.reject(new Error('mati')) : Promise.resolve()),
        close: () => Promise.resolve(),
        get writable() {
          return new WritableStream<Uint8Array>({
            write(potongan) {
              w.strukTerkirim.push(...potongan);
            },
          });
        },
      };
      Object.defineProperty(navigator, 'serial', {
        configurable: true,
        value: {
          getPorts: () => Promise.resolve([port]),
          requestPort: () => Promise.resolve(port),
        },
      });
      window.print = () => {
        document.body.dataset.jendelaCetak = 'ya';
      };
    });
    await masukCepat(kasir, 'KASIR');
    await kasir.request.fetch('/api/shift/buka', {
      method: 'POST',
      data: { modalAwal: 0 },
      headers: { origin: new URL(kasir.url()).origin },
    }); // 409 bila shift sudah terbuka: diabaikan
    // Teks yang tercetak, tanpa byte perintah ESC/POS (ESC @, ESC a/E/d n, ESC p …, GS ! n, GS V 66 0).
    const teksTerkirim = () =>
      kasir.evaluate(() => {
        const b = (window as unknown as { strukTerkirim: number[] }).strukTerkirim;
        let teks = '';
        for (let i = 0; i < b.length; i++) {
          const c = b[i]!;
          if (c === 0x1b) i += b[i + 1] === 0x40 ? 1 : b[i + 1] === 0x70 ? 4 : 2;
          else if (c === 0x1d) i += b[i + 1] === 0x56 ? 3 : 2;
          else teks += String.fromCharCode(c);
        }
        return teks;
      });
    const jual = async () => {
      await kasir.keyboard.press('F2');
      await expect(kasir.getByLabel('Cari barang')).toBeFocused();
      await kasir.keyboard.type(`2*${barang.kode}`);
      await kasir.keyboard.press('Enter');
      await expect(kasir.getByTestId('total-pos')).toHaveText('Rp 11.000');
      await kasir.keyboard.press('Enter'); // ke pembayaran
      await kasir.keyboard.press('Enter'); // uang pas
      await expect(kasir.getByTestId('hasil-transaksi')).toContainText('LUNAS');
    };

    await kasir.goto('/penjualan-langsung');
    await jual();
    // Struk sampai ke printer sebagai teks: nama barang, rincian, total; baris tidak melebihi 32 karakter.
    await expect.poll(teksTerkirim).toContain('TOTAL');
    const teks = await teksTerkirim();
    expect(teks).toContain(nama);
    expect(teks).toContain('2 sak x 5.500');
    expect(teks).toMatch(/TOTAL +Rp 11\.000/);
    expect(teks.split('\n').every((b) => b.length <= 32)).toBe(true);
    // Diawali ESC @ (reset) dan tidak ada jendela cetak peramban.
    const awal = await kasir.evaluate(() =>
      (window as unknown as { strukTerkirim: number[] }).strukTerkirim.slice(0, 2),
    );
    expect(awal).toEqual([0x1b, 0x40]);
    expect(await kasir.evaluate(() => document.body.dataset.jendelaCetak)).toBeUndefined();

    // Printer mati: penjualan tetap tersimpan, kasir diberi tahu dan ditawari jendela cetak.
    await kasir.evaluate(() => {
      (window as unknown as { printerMati: boolean }).printerMati = true;
    });
    await jual();
    await expect(kasir.getByText(/Struk tidak tercetak/)).toBeVisible();
    await kasir.getByRole('button', { name: 'Jendela cetak' }).click();
    await expect.poll(() => kasir.evaluate(() => document.body.dataset.jendelaCetak)).toBe('ya');
  } finally {
    await api(admin, `/barang/${barang.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
