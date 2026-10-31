// Data demo + tangkapan layar untuk proposal.
import { createRequire } from 'node:module';
const require = createRequire('D:/sit-tbsu/apps/web/package.json');
const { chromium, devices } = require('@playwright/test');
const URL = 'http://localhost:7878';
const OUT = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const api = async (path, method = 'GET', data) => {
  const r = await p.request.fetch(URL + '/api' + path, { method, data, headers: { origin: URL } });
  const t = await r.text();
  if (r.status() >= 300) console.log('API', path, r.status(), t.slice(0, 200));
  try { return JSON.parse(t).data; } catch { return null; }
};
await p.goto(URL + '/');
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/01-setup.png` });
await api('/auth/setup-awal', 'POST', {
  usaha: { jenisUsaha: 'BAHAN_BANGUNAN', jenisUsahaLain: '', namaToko: 'UD. Sumber Urip', namaBadanUsaha: 'Toko Bahan Bangunan', sloganToko: 'Bahan bangunan lengkap, harga bersahabat', alamatToko: 'Jl. Raya Peterongan', kotaToko: 'Jombang', telpToko: '0321 000000', emailToko: '' },
  operasional: { layanan: ['LANGSUNG', 'ORDER', 'ANTAR'], shiftJamBuka: '07:00', shiftJamTutup: '17:00' },
  owner: { namaPengguna: 'Pemilik Toko', username: 'pemilik', email: '', noHp: '', password: 'rahasia-toko-1', konfirmasi: 'rahasia-toko-1' },
});
await api('/penyiapan/setup-awal/selesai', 'POST', { dilewati: [] });
for (const k of ['PENGENALAN','DASHBOARD','BARANG','MITRA','ORDER','KASIR','PENGANTARAN','PENGIRIMAN','SHIFT','PENERIMAAN','STOK','KOREKSI','LAPORAN','PENGATURAN'])
  await api('/auth/tur', 'POST', { kode: k, hasil: 'SELESAI' });
for (const j of ['BARANG', 'PELANGGAN', 'PEMASOK', 'ARMADA']) await api('/penyiapan/contoh', 'POST', { jenis: j });
const barang = (await api('/barang?perHalaman=20'))?.data ?? (await api('/barang')) ?? [];
const daftar = Array.isArray(barang) ? barang : barang.data ?? [];
const adj = await api('/penyesuaian', 'POST', {
  jenis: 'SALDO_AWAL',
  baris: daftar.slice(0, 5).map((x, i) => ({ idBarang: x.id, qtyFisik: String([120, 300, 45, 80, 25][i] ?? 10), hppSatuan: 50000 })),
});
if (adj) await api(`/penyesuaian/${adj.id}/selesai`, 'POST');
await api('/shift/buka', 'POST', { modalAwal: 500000 });

const foto = async (rute, nama, tunggu = 2500) => {
  await p.goto(URL + rute);
  await p.waitForTimeout(tunggu);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${nama}.png` });
};
await foto('/dashboard', '02-dashboard');
await foto('/barang', '03-barang');
await p.goto(URL + '/penjualan-langsung');
await p.waitForTimeout(2500);
await p.keyboard.press('F2');
await p.keyboard.type('Semen');
await p.waitForTimeout(1200);
await p.keyboard.press('Enter');
await p.waitForTimeout(800);
await p.keyboard.type('2*Pasir');
await p.waitForTimeout(1200);
await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/04-kasir.png` });
await foto('/order', '05-order');
await foto('/pengiriman', '06-pengiriman');
await foto('/persediaan', '07-stok');
await foto('/laporan', '08-laporan', 3500);
await foto('/shift', '09-shift');
await foto('/pengaturan?tab=cadangan', '10-cadangan');
await foto('/pengaturan?tab=akses', '11-akses');
await foto('/pelanggan', '12-pelanggan');
await foto('/tur', '13-tur');
await ctx.close();
const hp = await b.newContext({ ...devices['Pixel 7'] });
const q = await hp.newPage();
await q.goto(URL + '/login');
await q.getByLabel('Username').fill('pemilik');
await q.getByLabel('Password').fill('rahasia-toko-1');
await q.getByRole('button', { name: /^Masuk/ }).click();
await q.waitForTimeout(3000);
await q.keyboard.press('Escape');
await q.screenshot({ path: `${OUT}/14-hp-dashboard.png` });
await q.getByRole('button', { name: 'Buka atau tutup menu' }).click();
await q.waitForTimeout(600);
await q.screenshot({ path: `${OUT}/15-hp-menu.png` });
await b.close();
console.log('ok', daftar.length);
