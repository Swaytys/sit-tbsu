// Data transaksi demo + tangkapan layar tambahan untuk proposal (tahap 2).
import { createRequire } from 'node:module';
const require = createRequire('D:/sit-tbsu/apps/web/package.json');
const { chromium } = require('@playwright/test');
const URL = 'http://localhost:7878';
const OUT = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const api = async (path, method = 'GET', data) => {
  const r = await p.request.fetch(URL + '/api' + path, { method, data, headers: { origin: URL } });
  const t = await r.text();
  if (r.status() >= 300) console.log('API', method, path, r.status(), t.slice(0, 300));
  try { return JSON.parse(t).data; } catch { return null; }
};
await p.goto(URL + '/login');
await p.getByLabel('Username').fill('pemilik');
await p.getByLabel('Password').fill('rahasia-toko-1');
await p.getByRole('button', { name: /^Masuk/ }).click();
await p.waitForTimeout(2500);
try { await p.getByRole('button', { name: /Sudah saya periksa/ }).first().click({ timeout: 5000 }); await p.waitForTimeout(800); const y = p.getByRole('button', { name: /^Ya/ }); if (await y.count()) await y.first().click(); } catch (e) { console.log('tanpa bilah pemulihan'); }
await p.waitForTimeout(1000);

const isi = process.argv[3] !== 'tanpa-data';
if (isi) {
  await api('/rekening', 'POST', { jenis: 'TRANSFER', bank: 'BCA', nomor: '0123456789', atasNama: 'UD Sumber Urip', isDefault: true });
  await api('/rekening', 'POST', { jenis: 'QRIS', bank: 'QRIS BRI', isDefault: true });
  await api('/rekening', 'POST', { jenis: 'EDC', bank: 'EDC BCA', isDefault: true });
  const rek = (await api('/rekening?status=AKTIF')) ?? [];
  const idRek = (j) => rek.find((x) => x.jenis === j)?.id;
  const brg = (await api('/barang?perHalaman=50'))?.data ?? (await api('/barang?perHalaman=50')) ?? [];
  const daftar = Array.isArray(brg) ? brg : brg.data ?? [];
  console.log('barang', daftar.map((x) => x.namaBarang ?? x.nama).join(' | '));
  const plgR = await api('/pelanggan?perHalaman=20');
  const plg = Array.isArray(plgR) ? plgR : plgR?.data ?? [];
  const pms = await api('/pemasok?perHalaman=20');
  const pemasok = Array.isArray(pms) ? pms : pms?.data ?? [];
  const id = (i) => daftar[i % Math.min(daftar.length, 5)].id;
  // Penjualan langsung tunai dan non-tunai
  const qty = [['2', '1'], ['5'], ['1', '3'], ['10'], ['4', '2'], ['1'], ['3']];
  for (const [k, q] of qty.entries()) {
    await api('/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris: q.map((x, j) => ({ idBarang: id(k + j), qty: x })) },
      pembayaran: [{ metode: 'TUNAI' }],
    });
  }
  const totalTrf = async (baris) => {
    const r = await api('/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', baris },
      pembayaran: [{ metode: 'TRANSFER', nominal: 1, idRekening: idRek('TRANSFER'), referensi: 'TRF' + Date.now() }],
    });
    return r;
  };
  // Nominal transfer harus sama dengan total: coba hitung dulu dari API pratinjau bila ada; bila gagal biarkan.
  await totalTrf([{ idBarang: id(1), qty: '2' }]);
  if (plg[0]) {
    await api('/penjualan/checkout', 'POST', {
      order: { jenisPenjualan: 'LANGSUNG', idPelanggan: plg[0].id, baris: [{ idBarang: id(0), qty: '20' }] },
      pembayaran: [{ metode: 'TUNAI', nominal: 500000 }],
    });
  }
  for (const [k, c] of plg.slice(0, 3).entries()) {
    await api('/penjualan/checkout', 'POST', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: c.id,
        alamatKirim: ['Jl. Raya Peterongan No. 12, Jombang', 'Dsn. Kebontemu RT 02/RW 01, Peterongan', 'Perum Griya Indah Blok C-7, Jombang'][k],
        baris: [{ idBarang: id(k), qty: String(5 + k * 5) }, { idBarang: id(k + 1), qty: '2' }],
      },
    });
  }
  if (pemasok[0]) {
    await api('/penerimaan', 'POST', {
      idPemasok: pemasok[0].id,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TEMPO',
      tanggalJatuhTempo: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      noFakturPemasok: 'FKT-2026-1031',
      baris: [{ idBarang: id(0), qtyMasuk: '50', hargaModalMasuk: 52000 }, { idBarang: id(2), qtyMasuk: '20', hargaModalMasuk: 51000 }],
    });
  }
  if (pemasok[1]) {
    await api('/penerimaan', 'POST', {
      idPemasok: pemasok[1].id,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
      noFakturPemasok: 'NT-88',
      baris: [{ idBarang: id(1), qtyMasuk: '30', hargaModalMasuk: 49000 }],
    });
  }
  await api('/kendaraan', 'POST', { plat: 'S 8123 UR', jenis: 'Colt Diesel (bak kayu)' });
  await api('/kendaraan', 'POST', { plat: 'S 9461 UR', jenis: 'Pick-up L300' });
  await api('/sopir', 'POST', { nama: 'Pak Slamet', noHp: '081234560001' });
  await api('/sopir', 'POST', { nama: 'Mas Andi', noHp: '081234560002' });
  await api('/pengguna', 'POST', { namaPengguna: 'Siti (Kasir)', username: 'siti', peran: 'KASIR', password: 'kasir-toko-01' });
  await api('/pengguna', 'POST', { namaPengguna: 'Budi (Admin)', username: 'budi', peran: 'ADMIN', password: 'admin-toko-01' });
  await api('/pengguna', 'POST', { namaPengguna: 'Rina (Staf)', username: 'rina', peran: 'STAF_PENJUALAN', password: 'staf-toko-01' });
  await api('/promo', 'POST', {
    nama: 'Promo Semen Akhir Bulan',
    mulaiPada: '2026-10-25T07:00:00+07:00',
    selesaiPada: '2026-11-30T17:00:00+07:00',
    jenisPotongan: 'NOMINAL',
    potonganNominal: 2000,
    sasaran: 'SEMUA',
    aktif: true,
  });
}

const foto = async (rute, nama, tunggu = 2500, aksi) => {
  try {
    await p.goto(URL + rute);
    await p.waitForTimeout(tunggu);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    if (aksi) await aksi();
    await p.screenshot({ path: `${OUT}/${nama}.png` });
  } catch (e) {
    console.log('gagal', nama, String(e).slice(0, 120));
  }
};
await foto('/dashboard', '02b-dashboard');
await foto('/dashboard', '35-notifikasi', 2500, async () => {
  await p.getByRole('button', { name: /notifikasi/i }).first().click();
  await p.waitForTimeout(900);
});
await foto('/penerimaan', '16-penerimaan');
await foto('/persediaan?tab=penyesuaian', '17-penyesuaian');
await foto('/persediaan?tab=saran-pesan', '18-saran-pesan', 4000);
await foto('/persediaan?tab=mutasi', '19-mutasi');
await foto('/piutang', '20-piutang');
await foto('/hutang', '21-hutang');
await foto('/harga-jual', '22-harga-jual');
await foto('/pengaturan?tab=promo', '23-promo');
await foto('/hasil-penjualan', '24-hasil-penjualan', 4000);
await foto('/retur', '25-retur');
await foto('/void', '26-void');
await foto('/armada', '27-armada');
await foto('/pengguna', '28-pengguna');
await foto('/pengaturan?tab=log', '29-log');
await foto('/pengaturan?tab=persetujuan', '30-persetujuan');
await foto('/pengaturan?tab=pembayaran', '31-pembayaran');
await foto('/pengaturan?tab=operasional', '32-operasional');
await foto('/pengiriman', '06b-pengiriman');
await foto('/penjualan-pengantaran', '36-pengantaran');
await foto('/shift', '09b-shift');
await foto('/order-pembelian', '37-order-pembelian');
await foto('/pemasok', '38-pemasok');
await foto('/pengaturan?tab=harga', '39-harga-dasar');
await foto('/laporan', '08b-laporan', 4000);
await foto('/pengaturan?tab=struk', '40-struk');
await foto('/penjualan-langsung', '41-kasir-antrean');
await ctx.close();
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
const q = await ctx2.newPage();
await q.goto(URL + '/login');
await q.waitForTimeout(1500);
await q.screenshot({ path: `${OUT}/42-login.png` });
await b.close();
console.log('ok');
