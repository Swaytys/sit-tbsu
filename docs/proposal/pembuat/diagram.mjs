import { createRequire } from 'node:module';
const require = createRequire('D:/sit-tbsu/apps/web/package.json');
const { chromium } = require('@playwright/test');
const OUT = process.argv[2];
const gaya = `<style>
*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
body{margin:0;padding:24px;background:#fff;color:#0f172a}
.row{display:flex;align-items:center;gap:10px;justify-content:center}
.box{border:2px solid #2563eb;border-radius:12px;padding:12px 14px;text-align:center;background:#eff6ff;min-width:150px}
.box b{display:block;font-size:17px;margin-bottom:3px}.box span{font-size:13px;color:#334155}
.g{border-color:#16a34a;background:#f0fdf4}.o{border-color:#d97706;background:#fffbeb}.k{border-color:#36261c;background:#f5ebd7}.r{border-color:#dc2626;background:#fef2f2}.s{border-color:#64748b;background:#f8fafc}
.ar{font-size:30px;color:#64748b}
h3{margin:0 0 14px;text-align:center;font-size:20px}
.col{display:flex;flex-direction:column;gap:10px;align-items:center}
.cloud{border:3px dashed #2563eb;border-radius:40px;padding:14px 24px;background:#eff6ff;text-align:center}
.note{font-size:13px;color:#475569;text-align:center;margin-top:10px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #cbd5e1;padding:6px;text-align:center}th{background:#0f172a;color:#fff}
.on{background:#2563eb}.on2{background:#16a34a}.on3{background:#d97706}.on4{background:#7c3aed}
</style>`;
const diagram = {
  'd1-alur': `<h3>Alur kerja harian dengan BonsaiUrip</h3>
<div class="row">
<div class="box"><b>1. Staf Penjualan</b><span>catat pesanan pembeli<br>(tablet / komputer)</span></div><div class="ar">➜</div>
<div class="box"><b>2. Kasir</b><span>terima bayar: tunai / transfer<br>/ EDC / QRIS, cetak struk</span></div><div class="ar">➜</div>
<div class="box g"><b>3. Gudang / Sopir</b><span>serahkan barang atau<br>kirim dengan surat jalan</span></div></div>
<div class="row" style="margin-top:14px"><div class="ar">⬇</div></div>
<div class="row">
<div class="box o"><b>Stok berkurang otomatis</b><span>tidak perlu hitung manual</span></div><div class="ar">➜</div>
<div class="box o"><b>Uang tercatat per shift</b><span>dicocokkan saat tutup kas</span></div><div class="ar">➜</div>
<div class="box k"><b>4. Owner</b><span>lihat penjualan, laba, stok,<br>piutang dari HP kapan saja</span></div></div>
<p class="note">Barang datang dari pemasok → <b>Penerimaan Barang</b> → stok bertambah & harga modal terhitung otomatis.</p>`,

  'd2-lokal': `<h3>Pilihan A — Server di toko (lokal)</h3>
<div class="row"><div class="box k" style="min-width:300px"><b>💻 Komputer/Laptop Server di toko</b><span>BonsaiUrip + database (Setup .exe)<br>nyala selama jam toko · UPS</span></div></div>
<div class="row"><div class="ar">⬍</div><span style="font-size:13px;color:#475569">WiFi toko (cepat, tanpa internet)</span></div>
<div class="row">
<div class="box"><b>🖥 Kasir</b><span>komputer/tablet<br>+ printer struk</span></div>
<div class="box"><b>📱 Staf penjualan</b><span>tablet</span></div>
<div class="box"><b>📦 Gudang/Admin</b><span>HP/tablet</span></div>
<div class="box g"><b>📱 Owner (di luar toko)</b><span>HP lewat Tailscale<br>(internet, terenkripsi)</span></div></div>
<div class="row" style="margin-top:12px"><div class="box s"><b>💾 Cadangan harian</b><span>flashdisk / hardisk eksternal (+ opsi cloud)</span></div></div>
<p class="note">Tanpa biaya sewa bulanan. Bila internet putus, toko tetap bisa berjualan.</p>`,

  'd3-server': `<h3>Pilihan B — Server online (sewa hosting)</h3>
<div class="row"><div class="cloud"><b style="font-size:18px">☁ Server sewaan (VPS) di data center</b><br><span style="font-size:13px">BonsaiUrip + database · alamat web toko · cadangan otomatis</span></div></div>
<div class="row"><div class="ar">⬍</div><span style="font-size:13px;color:#475569">Internet (wajib stabil)</span></div>
<div class="row">
<div class="box"><b>🖥 Kasir</b><span>komputer/tablet<br>+ printer struk</span></div>
<div class="box"><b>📱 Staf penjualan</b><span>tablet</span></div>
<div class="box"><b>📦 Gudang/Admin</b><span>HP/tablet</span></div>
<div class="box g"><b>📱 Owner</b><span>HP dari mana saja</span></div></div>
<p class="note">Tidak perlu komputer server di toko, tetapi ada biaya bulanan dan toko berhenti bila internet putus.</p>`,

  'd4-jadwal': `<h3>Jadwal pelaksanaan (± 8 minggu)</h3>
<table><tr><th style="width:34%">Kegiatan</th>${[1,2,3,4,5,6,7,8].map(i=>`<th>M${i}</th>`).join('')}</tr>
${[['Keputusan & pembelian perangkat',[1]],['Pasang aplikasi, akun, pengaturan',[2]],['Input data barang, harga, pelanggan, pemasok',[2,3]],['Hitung stok awal (opname)',[3]],['Pelatihan per peran',[3,4]],['Uji coba paralel (buku + aplikasi)',[4,5]],['Mulai penuh (go-live)',[6]],['Pendampingan & evaluasi',[6,7,8]]]
.map(([n,m],j)=>`<tr><td style="text-align:left">${n}</td>${[1,2,3,4,5,6,7,8].map(i=>`<td class="${m.includes(i)?['on','on','on','on2','on3','on3','on4','on4'][j]:''}"></td>`).join('')}</tr>`).join('')}</table>
<p class="note">M = minggu. Uji coba paralel: transaksi dicatat di buku DAN aplikasi untuk memastikan hasilnya sama sebelum buku ditinggalkan.</p>`,

  'd5-kontrol': `<h3>Siklus kontrol Owner</h3>
<div class="row">
<div class="box"><b>Setiap hari</b><span>penjualan hari ini<br>selisih kas tutup shift<br>transfer masuk rekening</span></div><div class="ar">➜</div>
<div class="box g"><b>Setiap minggu</b><span>stok kritis & saran pesan<br>piutang jatuh tempo<br>koreksi stok</span></div><div class="ar">➜</div>
<div class="box o"><b>Setiap bulan</b><span>laba rugi · log aktivitas<br>akun karyawan · uji cadangan</span></div><div class="ar">➜</div>
<div class="box k"><b>Setiap tahun</b><span>opname penuh<br>tutup buku tahunan</span></div></div>
<p class="note">Semua angka diambil dari aplikasi; tidak ada rekap manual.</p>`,

  'd6-konversi': `<h3>Empat cara beralih dari buku ke aplikasi</h3>
<table><tr><th>Cara</th><th>Bagaimana</th><th>Risiko</th><th>Biaya tenaga</th><th>Cocok?</th></tr>
<tr><td><b>Langsung (direct)</b></td><td style="text-align:left">Hari ini buku, besok aplikasi</td><td style="background:#fee2e2">Tinggi</td><td>Rendah</td><td>Tidak</td></tr>
<tr><td><b>Paralel</b></td><td style="text-align:left">Buku dan aplikasi dipakai bersamaan, hasil dibandingkan</td><td style="background:#dcfce7">Rendah</td><td style="background:#fee2e2">Tinggi (catat 2x)</td><td>Ya, 2 minggu</td></tr>
<tr><td><b>Percontohan (pilot)</b></td><td style="text-align:left">Satu bagian/kasir mencoba dulu</td><td style="background:#fef9c3">Sedang</td><td>Sedang</td><td>Ya, minggu 1</td></tr>
<tr><td><b>Bertahap (phased)</b></td><td style="text-align:left">Modul dinyalakan satu per satu</td><td style="background:#dcfce7">Rendah</td><td>Sedang</td><td>Ya</td></tr></table>
<p class="note"><b>Dipakai di proposal ini: gabungan bertahap + paralel.</b> Persediaan dulu, lalu kasir &amp; order, lalu pengantaran &amp; piutang; tiap tahap dipakai berdampingan dengan buku sampai selisih nol.</p>`,

  'd7-adkar': `<h3>Lima tahap perubahan pada karyawan (model ADKAR)</h3>
<div class="row">
<div class="box"><b>A · Sadar</b><span>tahu kenapa toko<br>berubah</span></div><div class="ar">➜</div>
<div class="box"><b>D · Mau</b><span>melihat untungnya<br>bagi dirinya</span></div><div class="ar">➜</div>
<div class="box g"><b>K · Tahu caranya</b><span>pelatihan per peran,<br>tur aplikasi</span></div><div class="ar">➜</div>
<div class="box o"><b>A · Mampu</b><span>praktik sampai lancar,<br>didampingi PIC</span></div><div class="ar">➜</div>
<div class="box k"><b>R · Bertahan</b><span>pujian, evaluasi,<br>buku lama dihentikan</span></div></div>
<p class="note">Bila karyawan "macet", cari tahap yang belum tercapai, lalu perbaiki tahap itu (bukan menambah tekanan).</p>`,

  'd8-pdca': `<h3>Siklus perbaikan berkelanjutan (PDCA)</h3>
<div class="row">
<div class="box"><b>PLAN · Rencanakan</b><span>target bulan ini:<br>selisih kas 0, stok cocok</span></div><div class="ar">➜</div>
<div class="box g"><b>DO · Kerjakan</b><span>jalankan SOP harian<br>di aplikasi</span></div><div class="ar">➜</div>
<div class="box o"><b>CHECK · Periksa</b><span>laporan, selisih shift,<br>opname, log aktivitas</span></div><div class="ar">➜</div>
<div class="box k"><b>ACT · Perbaiki</b><span>ubah aturan / latih ulang /<br>usulkan perbaikan aplikasi</span></div><div class="ar">↺</div></div>
<p class="note">Rapat mingguan 15 menit memutar siklus ini satu kali.</p>`,

  'd9-dokumen': `<h3>Alur dokumen di BonsaiUrip (semua bernomor otomatis)</h3>
<div class="row">
<div class="box"><b>ORD</b><span>order staf<br>(stok ditahan)</span></div><div class="ar">➜</div>
<div class="box"><b>STR / INV</b><span>struk (langsung) /<br>invoice (antar)</span></div><div class="ar">➜</div>
<div class="box g"><b>TRP + SJ</b><span>rit kendaraan +<br>surat jalan 2 rangkap</span></div><div class="ar">➜</div>
<div class="box g"><b>Hasil kirim</b><span>diterima / kembali /<br>rusak</span></div></div>
<div class="row" style="margin-top:12px">
<div class="box o"><b>SHF + CLC</b><span>shift kasir +<br>pencocokan uang</span></div>
<div class="box o"><b>RCV</b><span>penerimaan barang<br>dari pemasok</span></div>
<div class="box o"><b>ADJ</b><span>penyesuaian / opname<br>(alasan wajib)</span></div>
<div class="box r"><b>RTR / VOID</b><span>koreksi dengan<br>persetujuan atasan</span></div></div>
<p class="note">Tidak ada dokumen yang dihapus. Kesalahan diperbaiki dengan dokumen koreksi, sehingga jejaknya selalu ada.</p>`,

  'd10-organisasi': `<h3>Struktur peran setelah sistem berjalan</h3>
<div class="row"><div class="box k" style="min-width:260px"><b>Owner</b><span>keputusan, persetujuan, laporan, cadangan</span></div></div>
<div class="row"><div class="ar">⬇</div></div>
<div class="row"><div class="box g" style="min-width:260px"><b>PIC Sistem (merangkap Admin)</b><span>penghubung pengembang, akun, pelatihan karyawan baru</span></div><div class="box s"><b>Pengembang</b><span>pemasangan, perbaikan,<br>pendampingan</span></div></div>
<div class="row"><div class="ar">⬇</div></div>
<div class="row">
<div class="box"><b>Kasir</b><span>shift, pembayaran, struk</span></div>
<div class="box"><b>Staf penjualan</b><span>order di tablet</span></div>
<div class="box"><b>Gudang & sopir</b><span>serah/muat sesuai dokumen</span></div></div>
<p class="note">Pemisahan tugas: yang mencatat pesanan, yang menerima uang, dan yang menyetujui koreksi adalah orang berbeda.</p>`,

  'd11-addie': `<h3>Rancangan pelatihan (model ADDIE) dan cara menilainya (Kirkpatrick)</h3>
<div class="row">
<div class="box"><b>Analisis</b><span>siapa butuh apa<br>(per peran)</span></div><div class="ar">➜</div>
<div class="box"><b>Desain</b><span>materi, durasi,<br>syarat lulus</span></div><div class="ar">➜</div>
<div class="box"><b>Siapkan</b><span>data contoh, tur,<br>Buku SOP</span></div><div class="ar">➜</div>
<div class="box g"><b>Laksanakan</b><span>jelaskan → contohkan<br>→ praktik</span></div><div class="ar">➜</div>
<div class="box o"><b>Evaluasi</b><span>4 tingkat di bawah</span></div></div>
<table style="margin-top:12px"><tr><th>Tingkat 1 · Reaksi</th><th>Tingkat 2 · Belajar</th><th>Tingkat 3 · Perilaku</th><th>Tingkat 4 · Hasil</th></tr>
<tr><td>lembar kesan singkat</td><td>uji praktik per peran</td><td>diamati 2 minggu (log aktivitas)</td><td>selisih kas/stok turun</td></tr></table>`,
};
const b = await chromium.launch();
for (const [nama, isi] of Object.entries(diagram)) {
  const p = await b.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(`<html><head>${gaya}</head><body><div id="d" style="display:inline-block;width:1050px">${isi}</div></body></html>`);
  await p.locator('#d').screenshot({ path: `${OUT}/${nama}.png` });
  await p.close();
}
await b.close();
console.log('ok');
