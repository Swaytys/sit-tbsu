from pr_alat import *

# ============================ BAB 4 ============================
h1('4. Pilihan tempat aplikasi berjalan')
p('Aplikasi memerlukan satu komputer "rumah" (server) yang menyimpan data dan melayani semua perangkat. **Fitur '
  'aplikasinya sama** di kedua pilihan; yang berbeda adalah biaya, ketergantungan pada internet, dan siapa yang '
  'merawat server.', rata='rata')
h2('4.1 Pilihan A: server di toko (lokal)')
gambar('d2-lokal.png', 14.5, 'Pilihan A: semua perangkat tersambung ke komputer server di toko.')
p('**Cara kerja:** satu laptop/komputer di toko (sekaligus dipakai sebagai komputer kasir) dipasangi '
  'Setup-BonsaiUrip-1.18.0.exe. Database, aplikasi, dan cadangan berjalan di komputer itu. Tablet staf dan HP '
  'Owner tersambung melalui Tailscale; di dalam toko lalu lintasnya lewat WiFi toko (tidak lewat internet), '
  'sedangkan dari luar toko lewat internet secara terenkripsi.', rata='rata')
p('**Langkah pemasangan nyata (± 30 menit):**', tebal=True)
langkah([
    'Salin Setup-BonsaiUrip-1.18.0.exe ke komputer server › klik dua kali › pilih bahasa › Next sampai selesai. '
    'Tidak perlu hak Administrator.',
    'Aplikasi menyala sendiri; peramban membuka **Setup awal**. Owner mengisi data usaha, membuat akun Owner, '
    'mencetak **kode pemulihan** dan menyimpannya.',
    'Atur cadangan ke hardisk eksternal (Pengaturan › Cadangan) dan catat sandinya di kertas.',
    'Pasang **Tailscale** di laptop dan masuk dengan akun toko; aktifkan MagicDNS + HTTPS; tekan **Aktifkan** di '
    'Pengaturan › Akses HP/tablet.',
    'Di setiap tablet/HP: pasang Tailscale (akun yang sama), pindai kode QR, *Tambahkan ke layar utama*.',
    'Centang **nyala otomatis** agar BonsaiUrip menyala saat komputer dihidupkan.',
])
h2('4.2 Pilihan B: server online (sewa VPS)')
gambar('d3-server.png', 14.5, 'Pilihan B: server sewaan di pusat data, semua perangkat lewat internet.')
p('**Cara kerja:** aplikasi dipasang di server sewaan (VPS) di pusat data di Indonesia, dengan alamat web toko '
  '(mis. sumberurip.id) dan sertifikat HTTPS gratis. Semua perangkat, termasuk komputer kasir, membuka alamat itu '
  'lewat internet.', rata='rata')
p('**Yang perlu diketahui:**', tebal=True)
for t in ['Berkas Setup .exe adalah untuk Windows di toko. Untuk VPS, pengembang memasang versi server (Linux, '
          'Node.js, PostgreSQL) secara terpisah; aplikasinya sama, data bisa dipindah dengan berkas `.bonsai`.',
          'Komputer kasir dan printer **tetap dibutuhkan** di toko, sehingga biaya awal hampir sama dengan pilihan A.',
          'Bila internet toko putus, **kasir berhenti mencatat**. Diperlukan internet cadangan (mis. modem/paket '
          'data seluler) agar toko tetap bisa bertransaksi.',
          'Ada biaya bulanan sewa server dan domain selama aplikasi dipakai.']:
    poin(t)
h2('4.3 Perbandingan')
tabel(['Pertimbangan', 'A. Server di toko', 'B. Server online (VPS)'], [
    ['Biaya awal', 'Perangkat toko (lihat Bab 5)', 'Perangkat toko sama + jasa pemasangan server'],
    ['Biaya bulanan', '± Rp 157.000 (Tailscale + listrik)', '± Rp 436.000 (VPS + domain + internet cadangan)'],
    ['Saat internet putus', '**Toko tetap berjualan** (WiFi toko)', '**Transaksi berhenti** bila tanpa cadangan'],
    ['Saat listrik mati', 'UPS ± 10–20 menit untuk menutup shift; lalu berhenti', 'Server tetap jalan; perangkat toko tetap butuh listrik'],
    ['Kecepatan di kasir', 'Sangat cepat (satu komputer/jaringan lokal)', 'Tergantung kualitas internet'],
    ['Akses Owner dari luar', 'Ya, lewat Tailscale', 'Ya, langsung lewat alamat web'],
    ['Keamanan data', 'Data fisik di toko; cadangan terenkripsi ke disk terpisah', 'Data di pusat data; perlu perawatan keamanan server'],
    ['Perawatan', 'PIC: cek cadangan mingguan', 'Pengembang/penyedia: pembaruan server, pemantauan'],
    ['Risiko utama', 'Laptop rusak/hilang (ditanggulangi cadangan harian)', 'Internet tidak stabil; biaya terus berjalan'],
    ['Cocok untuk', '**1 toko**, internet kadang tidak stabil', 'Banyak cabang, internet sangat stabil'],
], lebar=[3.5, 6.5, 6.6], judul='Perbandingan pilihan A dan B')
h2('4.4 Hitungan biaya 3 tahun')
tabel(['Komponen', 'A. Server di toko', 'B. Server online'], [
    ['Perangkat toko (paket disarankan, Bab 5.2)', 'Rp 15.454.500', 'Rp 15.454.500'],
    ['Biaya bulanan × 36 bulan', '36 × Rp 157.000 = Rp 5.652.000', '36 × Rp 436.100 = Rp 15.699.600'],
    ['**Total 3 tahun**', '**Rp 21.106.500**', '**Rp 31.154.100**'],
    ['Selisih', '—', 'lebih mahal ± Rp 10 juta'],
], lebar=[6.4, 5.1, 5.1], judul='Total biaya kepemilikan 3 tahun (belum termasuk jasa pengembang)')
kotak('Rekomendasi', [
    'Pilihan **A** lebih murah ± Rp 10 juta dalam 3 tahun dan tidak berhenti saat internet putus, sesuai keadaan '
    'satu toko di Peterongan. Pilihan B layak dipertimbangkan bila toko membuka cabang. Perpindahan A → B tidak '
    'membutuhkan input ulang (fitur ekspor data `.bonsai`).',
], warna='DCFCE7')

# ============================ BAB 5 ============================
h1('5. Kebutuhan perangkat dan anggaran')
p('Harga di bawah adalah **harga pasar yang tercantum di toko daring resmi/marketplace pada Oktober 2026** '
  '(sumber di Lampiran D). Harga marketplace berubah karena promo dan stok; mohon dicek ulang sebelum membeli dan '
  'utamakan **garansi resmi**.', miring=True, warna=ABU, rata='rata')
h2('5.1 Spesifikasi dan harga per perangkat')
tabel(['Perangkat', 'Contoh produk dan spesifikasi minimal', 'Harga', 'Fungsi'], [
    ['Laptop server + kasir', 'Lenovo IdeaPad Slim 3 14", Core i3-1315U, RAM 8 GB, SSD 512 GB, Windows 11 + '
     'Office (OHS). Minimal: Core i3 gen-8 / Ryzen 3, RAM 8 GB, SSD', 'Rp 6.519.000',
     'Menjalankan aplikasi dan database; dipakai kasir'],
    ['UPS', 'APC Back-UPS BX650LI-MS 650 VA, garansi resmi 2 tahun', 'Rp 799.000',
     'Menjaga laptop & router saat listrik padam (± 10–20 menit)'],
    ['Printer struk + laci uang', 'Paket Blueprint Lite80D: printer thermal 80 mm (USB/Bluetooth) + cash drawer + '
     '1 rol kertas', 'Rp 1.513.500', 'Struk penjualan; laci terbuka otomatis'],
    ['  (alternatif printer saja)', 'Blueprint Lite80X 80 mm USB (setara Epson TM-T82) / Iware XS80', 'Rp 884.700 / Rp 595.000', '—'],
    ['Printer A4', 'Epson EcoTank L3210 (cetak, pindai, salin), garansi resmi 1 tahun', 'Rp 2.125.000',
     'Invoice, surat jalan 2 rangkap, laporan'],
    ['Hardisk eksternal', 'WD Elements 1 TB USB 3.0, garansi resmi 2 tahun', 'Rp 999.000',
     'Cadangan harian otomatis (terpisah dari laptop)'],
    ['Tablet', 'Samsung Galaxy Tab A9+ WiFi 4/64 GB, 11"', 'Rp 3.499.000', 'Order oleh staf penjualan; cek stok gudang'],
    ['Scanner barcode', 'Zebra LS2208 1D USB (resmi) / Honeywell HH400 1D-2D', 'Rp 1.049.000 / Rp 960.000',
     'Mempercepat kasir untuk barang berbarcode'],
    ['Router WiFi', 'TP-Link Archer A6 AC1200 dual band', 'Rp 578.900', 'Bila WiFi toko belum ada/lemah'],
], lebar=[3.0, 6.9, 2.8, 3.9], ukuran=9, judul='Perangkat, contoh produk, dan harga pasar Oktober 2026')
h2('5.2 Tiga paket pembelian')
tabel(['Paket', 'Isi', 'Total'], [
    ['**Minimal**\n(memakai komputer & printer A4 yang sudah ada)',
     'UPS Rp 799.000 + paket printer struk & laci Rp 1.513.500 + hardisk eksternal Rp 999.000', '**Rp 3.311.500**'],
    ['**Disarankan**', 'Laptop Rp 6.519.000 + UPS Rp 799.000 + paket printer struk & laci Rp 1.513.500 + printer A4 '
     'Rp 2.125.000 + hardisk eksternal Rp 999.000 + 1 tablet Rp 3.499.000', '**Rp 15.454.500**'],
    ['**Lengkap**', 'Paket disarankan + tablet kedua Rp 3.499.000 + scanner Rp 1.049.000 + router Rp 578.900',
     '**Rp 20.581.400**'],
], lebar=[4.0, 9.4, 3.2], judul='Paket pembelian')
p('Komputer yang sudah ada boleh dipakai sebagai server bila memenuhi syarat minimal: Windows 10/11 64-bit, '
  'prosesor setara Core i3 generasi 8 atau lebih baru, RAM 8 GB, penyimpanan SSD dengan ruang kosong ≥ 50 GB.',
  rata='rata')
h2('5.3 Biaya bulanan')
tabel(['Komponen', 'Perhitungan', 'Per bulan'], [
    ['Tailscale paket Standard (usaha)', 'US$8 per pengguna; semua perangkat toko masuk dengan 1 akun toko. '
     'Paket gratis Personal hanya untuk pemakaian non-usaha', '± Rp 135.000*'],
    ['Listrik server', '± 15 kWh/bulan (laptop ± 25–45 W, 12 jam/hari + printer) × Rp 1.444,70/kWh', '± Rp 22.000'],
    ['Internet', 'Memakai langganan yang sudah ada (bila belum: Biznet Home mulai Rp 175.000; XL SATU 100 Mbps '
     'Rp 279.000)', 'Rp 0 tambahan'],
    ['Kertas struk thermal 80 mm', 'Menggantikan nota tulisan tangan (biaya yang sudah ada)', '—'],
    ['**Jumlah pilihan A**', '', '**± Rp 157.000**'],
], lebar=[4.4, 9.2, 3.0], judul='Biaya bulanan pilihan A')
p('* Kurs dianggap ± Rp 16.800 per US$; dibayar sesuai kurs saat tagihan. Bila Owner memutuskan **tanpa akses '
  'HP/tablet**, biaya Tailscale Rp 0 dan aplikasi dipakai di laptop server saja.', miring=True, ukuran=9.5,
  warna=ABU, rata='rata')
tabel(['Komponen', 'Contoh nyata', 'Per bulan'], [
    ['Sewa VPS 2 core, RAM 4 GB', 'IDCloudHost Rocket VPS 2: harga normal Rp 315.000 (promo Rp 105.000); '
     'DomaiNesia Cloud VPS Turbo 4 GB Rp 320.000', 'Rp 315.000'],
    ['Domain .id', 'Perpanjangan Rp 252.900/tahun (tahun pertama Rp 210.900)', '± Rp 21.100'],
    ['Internet cadangan', 'Modem/paket data seluler agar kasir tidak berhenti saat internet utama putus (perkiraan)',
     '± Rp 100.000'],
    ['**Jumlah pilihan B**', '', '**± Rp 436.100**'],
], lebar=[4.4, 9.2, 3.0], judul='Biaya bulanan pilihan B')
h2('5.4 Saran pembelian')
for t in ['Beli dari **toko resmi** (official store) dengan garansi resmi Indonesia; simpan nota dan kartu garansi.',
          'Laptop: pastikan tipe prosesor sesuai (i3-1315U berbeda dengan i3-1215U), RAM 8 GB, dan SSD.',
          'Printer struk: pilih yang mendukung **ESC/POS** dan kertas **80 × 80 mm**; beberapa printer murah hanya '
          'menerima rol kecil 80 × 50 mm.',
          'Hardisk cadangan disimpan **terpasang di laptop** untuk cadangan harian; sebulan sekali salin juga ke '
          'flashdisk yang dibawa pulang Owner (aturan 3-2-1, Bab 12).']:
    poin(t)

# ============================ BAB 6 ============================
h1('6. Kebutuhan orang (SDM) dan pembagian tugas')
gambar('d10-organisasi.png', 14.5, 'Struktur peran setelah sistem berjalan.')
h2('6.1 Uraian tugas per peran')
tabel(['Peran', 'Tugas harian di sistem', 'Tugas berkala', 'Waktu tambahan'], [
    ['**Owner**', 'Membaca dashboard; menyetujui retur/void lewat kode; meninjau selisih shift',
     'Laporan bulanan, log aktivitas, akun karyawan, uji cadangan, tutup tahun', '15–30 menit/hari'],
    ['**PIC Sistem** (merangkap Admin)', 'Cek cadangan, cek transfer masuk, bantu karyawan',
     'Melatih karyawan baru, menghubungi pengembang, menjalankan pembaruan', '± 30 menit/hari; ± 1 jam/hari di bulan pertama'],
    ['**Admin**', 'Penerimaan barang, harga, pengiriman, hasil kirim', 'Opname mingguan, saran pesan, hutang pemasok',
     'Menggantikan pencatatan buku'],
    ['**Kasir**', 'Buka/tutup shift, pembayaran, struk, kas masuk/keluar', '—', '± 10 menit/hari (hitung per pecahan)'],
    ['**Staf penjualan**', 'Mencatat order di tablet', '—', 'Menggantikan nota tulis tangan'],
    ['**Gudang & sopir**', 'Menyerahkan/memuat sesuai struk dan surat jalan; melapor hasil kirim',
     'Membantu opname', 'Tidak perlu akun'],
], lebar=[3.0, 5.6, 5.0, 3.0], ukuran=9, judul='Uraian tugas')
h2('6.2 Syarat dan imbalan PIC Sistem')
for t in ['Karyawan tetap yang **jujur dan dipercaya Owner**, teliti, terbiasa memakai HP/komputer, dan tidak '
          'memegang uang laci (agar pengawasan terpisah).',
          'Bersedia menjadi tempat bertanya karyawan dan mengikuti pelatihan tambahan 3 jam.',
          '**Usulan:** tunjangan tanggung jawab Rp 300.000–500.000 per bulan selama memegang tugas PIC. Besarnya '
          'keputusan Owner.']:
    poin(t)
h2('6.3 Pemisahan tugas')
p('Prinsip pengendalian internal: **orang yang mencatat, orang yang memegang uang/barang, dan orang yang menyetujui '
  'koreksi tidak boleh orang yang sama.** Aplikasi sudah mengatur ini lewat izin per peran.', rata='rata')
tabel(['Kegiatan', 'Mencatat', 'Memegang uang/barang', 'Menyetujui/meninjau'], [
    ['Penjualan', 'Staf (order)', 'Kasir (uang), gudang (barang)', 'Owner (laporan harian)'],
    ['Retur/void', 'Kasir', 'Kasir', 'Admin/Owner (kode)'],
    ['Penerimaan barang', 'Admin', 'Gudang', 'Owner (laporan penerimaan)'],
    ['Opname', 'Admin', 'Gudang (2 orang menghitung)', 'Owner (penyesuaian mingguan)'],
    ['Transfer masuk', 'Kasir (No. referensi)', 'Rekening toko', 'Admin/Owner (cek mutasi)'],
], lebar=[3.4, 3.6, 5.0, 4.6], judul='Pemisahan tugas')
h2('6.4 Biaya waktu karyawan')
p('Tidak ada penambahan karyawan. Biaya yang timbul adalah waktu pelatihan dan masa uji coba. Acuan: **UMK '
  'Kabupaten Jombang 2026 Rp 3.320.770**; upah per jam = 1/173 × upah sebulan = **± Rp 19.195** (PP 35/2021). '
  'Bila pelatihan di luar jam kerja dihitung lembur: jam pertama 1,5 × dan jam berikutnya 2 × upah per jam.',
  rata='rata')
tabel(['Peserta', 'Orang', 'Jam pelatihan', 'Jam total', 'Perkiraan (lembur 1,5–2×)'], [
    ['Kasir', '2', '5', '10', '± Rp 365.000'],
    ['Staf penjualan', '2', '2,5', '5', '± Rp 175.000'],
    ['Admin/PIC', '1', '8', '8', '± Rp 297.000'],
    ['Gudang & sopir', '2', '1', '2', '± Rp 58.000'],
    ['**Jumlah**', '7', '', '25', '**± Rp 895.000**'],
], lebar=[3.6, 1.6, 2.8, 2.4, 6.2], judul='Perkiraan biaya waktu pelatihan (bila di luar jam kerja)')
p('Bila pelatihan dilakukan pada jam sepi di dalam jam kerja (disarankan), biaya ini tidak timbul.', miring=True,
  warna=ABU)
h2('6.5 Karyawan masuk dan keluar')
langkah(['Karyawan baru: Owner membuat akun sesuai peran; PIC melatih dengan daftar periksa Bab 9; karyawan '
         'mengikuti tur aplikasi; 3 hari pertama didampingi.',
         'Karyawan keluar: **akun dinonaktifkan hari itu juga** (sesi langsung berakhir); riwayat kerjanya tetap '
         'tersimpan di log.',
         'Pergantian PIC: serah terima kode pemulihan/sandi cadangan dilakukan di hadapan Owner, lalu sandi diganti.'])

# ============================ BAB 7 ============================
h1('7. Rencana pelaksanaan')
h2('7.1 Metode peralihan')
gambar('d6-konversi.png', 16.4, 'Empat metode konversi sistem dan pilihan untuk toko ini.')
p('Dari empat metode konversi sistem yang lazim (langsung, paralel, percontohan, bertahap), rencana ini memakai '
  '**gabungan bertahap dan paralel**: modul dinyalakan berurutan dan selama 2 minggu buku lama tetap dipakai '
  'berdampingan. Cara ini paling aman bagi toko yang belum pernah memakai aplikasi, dengan beban kerja ganda yang '
  'dibatasi waktunya.', rata='rata')
h2('7.2 Jadwal 8 minggu')
gambar('d4-jadwal.png', 16.4, 'Jadwal pelaksanaan.')
tabel(['Minggu', 'Kegiatan', 'Penanggung jawab', 'Selesai bila'], [
    ['1', 'Keputusan Owner (Bab 15); pembelian perangkat; penunjukan PIC; pengumuman kepada karyawan',
     'Owner', 'Lembar keputusan ditandatangani; perangkat tiba'],
    ['2', 'Pemasangan aplikasi, setup awal, cadangan, Tailscale; akun karyawan; rekening; struk & printer',
     'Pengembang + PIC', 'Uji cetak struk & invoice berhasil; cadangan pertama berhasil'],
    ['2–3', 'Input data master: barang (Excel), satuan, harga, pelanggan, pemasok, kendaraan, sopir',
     'Admin + PIC', 'Semua barang aktif punya harga dan satuan benar; diperiksa Owner'],
    ['3', '**Hitung stok awal** saat toko tutup (mis. Minggu) dan input sebagai saldo awal', 'Admin + gudang',
     'Lembar hitung bertanda tangan; saldo awal selesai'],
    ['3–4', 'Pelatihan per peran dengan data contoh; uji praktik', 'Pengembang + PIC', 'Semua peserta lulus uji praktik'],
    ['4', 'Percontohan: kasir & order dipakai untuk sebagian transaksi; persediaan dan penerimaan penuh',
     'Kasir, staf, admin', 'Tidak ada kendala yang menghentikan'],
    ['4–5', '**Uji paralel:** semua transaksi di aplikasi dan di buku; dibandingkan setiap sore', 'Semua; PIC rekap',
     'Uang & stok aplikasi = buku selama 5 hari kerja berturut-turut'],
    ['6', '**Mulai penuh:** buku dihentikan; semua lewat aplikasi; pengantaran & piutang penuh', 'Owner mengumumkan',
     'Satu minggu tanpa buku'],
    ['6–8', 'Pendampingan, evaluasi mingguan, pelatihan ulang, perbaikan kecil', 'PIC + pengembang',
     'Laporan evaluasi minggu ke-8 (Bab 13)'],
], lebar=[1.4, 7.4, 3.2, 4.6], ukuran=9, judul='Rincian kegiatan per minggu')
h2('7.3 Pemindahan data awal')
langkah([
    '**Tanggal potong (cut-off):** tetapkan satu hari (mis. Sabtu sore). Transaksi sebelum tanggal itu tetap di buku; '
    'sesudahnya di aplikasi.',
    '**Barang:** susun daftar di Excel (kode, nama baku, kategori, satuan, harga modal, harga jual) lalu *Import '
    'Excel*. Nama dibuat seragam: merek + jenis + ukuran, mis. "Semen Gresik 40 kg".',
    '**Stok awal:** dihitung fisik oleh **2 orang** per rak (satu menghitung, satu mencatat), ditandatangani, lalu '
    'dimasukkan sebagai **Saldo awal**.',
    '**Piutang dan hutang lama:** dicatat sebagai saldo per pelanggan/pemasok sesuai buku per tanggal potong, '
    'diperiksa Owner.',
    '**Pemeriksaan:** Owner memeriksa 20 barang acak (harga, satuan, stok) sebelum transaksi sungguhan pertama.',
])
h2('7.4 Uji penerimaan pengguna (UAT)')
p('Sebelum mulai penuh, skenario berikut dicoba bersama Owner dan dicentang bila hasilnya benar:', rata='rata')
tabel(['No', 'Skenario', 'Hasil yang diharapkan', '✓'], [
    ['1', 'Buka shift dengan hitung per pecahan', 'Modal awal sesuai uang laci', ''],
    ['2', 'Staf kirim order 3 barang; kasir proses dan bayar tunai', 'Struk tercetak; stok berkurang', ''],
    ['3', 'Penjualan transfer dengan No. referensi', 'Masuk daftar cek non-tunai', ''],
    ['4', 'Total belanja mencapai syarat Grosir', 'Harga otomatis berubah ke Grosir', ''],
    ['5', 'Penjualan DP ke pelanggan terdata', 'Sisa menjadi piutang dengan jatuh tempo', ''],
    ['6', 'Pengantaran: invoice → rit → surat jalan → hasil kirim', 'Status lengkap; surat jalan 2 rangkap', ''],
    ['7', 'Hasil kirim: 1 barang rusak, tidak diganti', 'Tagihan terpotong/uang dikembalikan sesuai status bayar', ''],
    ['8', 'Void dengan kode persetujuan dari HP Owner', 'Tercatat atas nama Owner; stok kembali', ''],
    ['9', 'Retur barang baik dari transaksi kemarin', 'Barang masuk stok; uang kembali dari shift', ''],
    ['10', 'Penerimaan barang tempo dari pemasok', 'Stok bertambah; hutang tercatat', ''],
    ['11', 'Opname 5 barang dengan 1 selisih', 'Penyesuaian dengan alasan', ''],
    ['12', 'Tutup shift dengan selisih Rp 2.000', 'Selisih tampil; keterangan wajib', ''],
    ['13', 'Coba matikan aplikasi saat shift terbuka', 'Ditolak dengan pesan', ''],
    ['14', 'Cadangkan sekarang lalu cek status', 'Berhasil', ''],
    ['15', 'Owner membuka dashboard dari HP di luar toko', 'Data sama dengan di toko', ''],
], lebar=[0.9, 7.2, 7.4, 1.1], ukuran=9, judul='Daftar uji penerimaan')
h2('7.5 Rencana mundur')
p('Selama minggu 4–5 buku masih dipakai, sehingga bila terjadi gangguan besar toko langsung kembali ke buku tanpa '
  'kehilangan catatan. Setelah mulai penuh, bila server mati: (1) catat penjualan di **nota cadangan bernomor** '
  'yang disiapkan PIC, (2) setelah aplikasi menyala, nota dicatat ulang dan diberi tanda "sudah dicatat", '
  '(3) bila laptop rusak, data dipulihkan dari cadangan ke laptop lain (target kurang dari 1 hari kerja).',
  rata='rata')

# ============================ BAB 8 ============================
h1('8. Perubahan cara kerja toko dan prosedur baku (SOP)')
h2('8.1 Sebelum dan sesudah')
tabel(['Pekerjaan', 'Sebelum', 'Sesudah'], [
    ['Melayani pembeli', 'Nota tulisan tangan, hitung manual', 'Staf catat di tablet; kasir proses; struk tercetak'],
    ['Pembayaran transfer', 'Dicek kadang-kadang', 'Rekening + No. referensi wajib; dicek setiap hari'],
    ['Pengantaran', 'Tiga catatan terpisah', 'Satu papan: rit, surat jalan, hasil kirim, tagihan'],
    ['Barang datang', 'Ditulis di buku', 'Penerimaan Barang: stok dan modal otomatis'],
    ['Stok', 'Dihitung saat perlu', 'Terlihat setiap saat; opname kecil mingguan, penuh tahunan'],
    ['Uang laci', 'Dihitung akhir hari', 'Buka shift → kas masuk/keluar dicatat → tutup shift dicocokkan'],
    ['Kesalahan', 'Dicoret/dihapus', 'Void/retur/penyesuaian dengan alasan dan persetujuan'],
    ['Belanja ke pemasok', 'Perkiraan', 'Saran pesan berdasarkan kecepatan laku'],
    ['Laporan Owner', 'Direkap dari buku', 'Dibuka kapan saja, dari HP'],
], lebar=[3.4, 5.4, 7.8], judul='Perubahan cara kerja')
h2('8.2 Jadwal harian')
tabel(['Jam', 'Kegiatan', 'Pelaku', 'SOP'], [
    ['06.45', 'Nyalakan laptop dan printer; pastikan ikon BonsaiUrip di pojok kanan bawah', 'Kasir', 'SOP-02'],
    ['07.00', 'Masuk akun sendiri; buka shift; periksa lonceng notifikasi', 'Kasir', 'SOP-02'],
    ['07.00–16.45', 'Order (staf) → bayar di kasir → serah barang sesuai struk', 'Staf, kasir, gudang', 'SOP-03, 04'],
    ['Saat ada', 'Barang datang → hitung → catat penerimaan', 'Admin', 'SOP-09'],
    ['Saat ada', 'Susun rit, muat, berangkat; catat hasil saat sopir kembali', 'Admin/kasir', 'SOP-05, 06'],
    ['16.30', 'Cek transfer/EDC/QRIS hari ini dengan mutasi rekening', 'Admin/Owner', 'SOP-07'],
    ['17.00', 'Selesaikan void/retur menunggu; tutup shift; setor uang', 'Kasir', 'SOP-15'],
    ['17.15', 'Owner meninjau ringkasan hari ini dan selisih (dari HP)', 'Owner', 'SOP-19'],
    ['Malam', 'Cadangan otomatis berjalan (laptop menyala) atau saat menyala berikutnya', 'Otomatis', 'SOP-17'],
], lebar=[2.2, 8.8, 3.2, 2.4], judul='Contoh jadwal harian (jam disesuaikan dengan jam buka toko)')
h2('8.3 Aturan dasar yang wajib')
for t in ['**Satu orang, satu akun.** Dilarang memakai akun orang lain atau berbagi password.',
          '**Catat dulu, baru serahkan barang.** Tidak ada barang keluar tanpa struk/invoice/surat jalan.',
          '**Uang tunai hanya diterima saat shift terbuka;** uang keluar-masuk laci lainnya dicatat sebagai kas.',
          '**Non-tunai wajib rekening yang benar dan No. referensi** dari bukti bayar.',
          '**Transaksi tidak dihapus atau diedit;** koreksi lewat void, retur, atau penyesuaian dengan alasan jujur.',
          '**Stok berubah hanya lewat dokumen.** Tidak ada "membetulkan angka stok".',
          '**Kode persetujuan hanya disebutkan atasan bila setuju,** dan tidak boleh disimpan untuk dipakai lain kali.',
          '**Shift ditutup setiap hari** sebelum komputer dimatikan.',
          '**Penolakan aplikasi adalah pengaman, bukan galat:** baca pesannya, tanyakan Admin/Owner.']:
    poin(t)
h2('8.4 Daftar SOP yang sudah disusun')
tabel(['Kode', 'Prosedur', 'Kode', 'Prosedur'], [
    ['SOP-01', 'Pemasangan dan setup awal', 'SOP-12', 'Penyesuaian stok dan opname'],
    ['SOP-02', 'Membuka toko dan membuka shift', 'SOP-13', 'Void transaksi'],
    ['SOP-03', 'Penjualan langsung di kasir', 'SOP-14', 'Retur penjualan dan pengembalian uang'],
    ['SOP-04', 'Order penjualan dan pembayarannya', 'SOP-15', 'Tutup shift dan clerical check'],
    ['SOP-05', 'Penjualan pengantaran', 'SOP-16', 'Akun pengguna dan keamanan'],
    ['SOP-06', 'Pengiriman barang (rit)', 'SOP-17', 'Cadangan dan pemulihan data'],
    ['SOP-07', 'Pembayaran non-tunai dan cek rekening', 'SOP-18', 'Data master barang, harga, pelanggan'],
    ['SOP-08', 'Piutang dan penagihan', 'SOP-19', 'Laporan dan tutup buku'],
    ['SOP-09', 'Penerimaan barang dari pemasok', 'SOP-20', 'Pembaruan aplikasi'],
    ['SOP-10', 'Order pembelian dan pemesanan ulang', 'SOP-21', 'Penanganan masalah'],
    ['SOP-11', 'Hutang pemasok', '', ''],
], lebar=[1.7, 6.6, 1.7, 6.6], judul='Buku SOP BonsaiUrip (SOP-BU-01)')
p('Setiap SOP menetapkan pelaksana, waktu, langkah, larangan, dan bukti. Buku SOP lengkap dicetak terpisah dan '
  'disahkan Owner.', rata='rata')
h2('8.5 Dokumen kertas yang tetap disimpan')
for t in ['Surat jalan **asli bertanda tangan penerima**, disimpan dalam map per tanggal.',
          'Faktur/nota pemasok asli, disimpan per pemasok per bulan.',
          'Lembar hitung opname bertanda tangan.',
          'Laporan bulanan yang dicetak (laba, penjualan, stok), disimpan per bulan; dokumen pembukuan disimpan 10 tahun.']:
    poin(t)

# ============================ BAB 9 ============================
h1('9. Pelatihan karyawan')
gambar('d11-addie.png', 16.4, 'Model ADDIE untuk merancang pelatihan dan model Kirkpatrick untuk menilainya.')
p('Pelatihan disusun dengan model **ADDIE** (Analisis, Desain, Pengembangan, Pelaksanaan, Evaluasi) yang lazim '
  'dipakai untuk pelatihan kerja, dan dinilai dengan **empat tingkat Kirkpatrick** (reaksi, belajar, perilaku, '
  'hasil). Prinsipnya: **singkat per peran, langsung praktik**, memakai data contoh sehingga tidak ada ketakutan '
  'merusak data asli.', rata='rata')
h2('9.1 Analisis kebutuhan per peran')
tabel(['Peran', 'Harus bisa', 'Tidak perlu'], [
    ['Staf penjualan', 'Mencari barang dengan ciri, order cepat, simpan order, pelanggan', 'Uang, laporan'],
    ['Kasir', 'Shift, pembayaran semua cara, struk, piutang, retur/void, tutup shift', 'Harga, opname'],
    ['Admin', 'Barang & harga, penerimaan, opname, pengiriman, cek transfer, laporan', 'Akun, pengaturan inti'],
    ['Owner', 'Membaca dashboard & laporan, persetujuan dari HP, akun, cadangan', 'Pekerjaan kasir harian'],
    ['PIC', 'Semua di atas + cadangan, pemulihan, pembaruan, melatih orang lain', '—'],
], lebar=[3.0, 9.4, 4.2], judul='Kebutuhan pelatihan')
h2('9.2 Kurikulum')
tabel(['Modul', 'Peserta', 'Materi', 'Durasi', 'Lulus bila'], [
    ['M0 Dasar', 'Semua', 'Masuk/keluar, menu, Ctrl+K, lonceng, tur, aturan dasar, kenapa toko berubah', '1 jam',
     'Bisa masuk dan menyebutkan 5 aturan dasar'],
    ['M1 Order', 'Staf', 'Cari barang (nama/ciri/kategori), qty, F4/F3, F8, simpan nanti, draf', '1,5 jam',
     '5 order praktik benar tanpa bantuan'],
    ['M2 Kasir', 'Kasir', 'Buka shift 3 cara, antrean, F2/F8, tunai/non-tunai/campuran, DP, struk, kembalian', '2 jam',
     '10 transaksi praktik tanpa salah'],
    ['M3 Koreksi & tutup', 'Kasir', 'Void, retur, kode atasan, kas masuk/keluar, tutup shift, bantuan selisih', '2 jam',
     'Tutup shift praktik dengan selisih 0'],
    ['M4 Persediaan', 'Admin', 'Barang, harga & tier, penerimaan, opname, stok rusak, saran pesan, order pembelian',
     '2 jam', 'Satu siklus beli–terima–opname benar'],
    ['M5 Pengantaran', 'Admin, kasir', 'Invoice antar, rit, muatan, surat jalan, hasil kirim, BBM', '2 jam',
     'Satu rit dari invoice sampai hasil kirim'],
    ['M6 Owner', 'Owner', 'Dashboard, laporan, persetujuan dari HP, akun, log, cadangan', '1,5 jam',
     'Menyetujui void dari HP; membaca laba kotor'],
    ['M7 PIC', 'PIC', 'Cadangan & pemulihan, pindah komputer, pembaruan, Tailscale, cara melatih', '3 jam',
     'Memulihkan data contoh dari cadangan'],
], lebar=[2.4, 1.9, 6.4, 1.5, 4.4], ukuran=9, judul='Kurikulum pelatihan')
h2('9.3 Metode')
for t in ['**Jelaskan → contohkan → praktik** (tell–show–do): pelatih menjelaskan tujuan, mencontohkan di layar, '
          'peserta mengulang sendiri.',
          '**Tur di dalam aplikasi** sebagai bahan ulang mandiri; **Buku SOP** dan **Buku Panduan** dicetak dan '
          'disimpan di meja kasir.',
          '**Pendampingan sebaya (buddy):** karyawan yang sudah lancar mendampingi yang belum selama minggu 4–5.',
          '**Jadwal di jam sepi** (mis. 13.00–15.00) dalam kelompok kecil 2–3 orang, agar pelayanan tidak terganggu.',
          '**Data contoh** dinyalakan untuk latihan dan dinonaktifkan sebelum mulai sungguhan.']:
    poin(t)
h2('9.4 Evaluasi pelatihan')
tabel(['Tingkat', 'Yang dinilai', 'Cara', 'Kapan'], [
    ['1 Reaksi', 'Apakah pelatihan dipahami dan berguna', 'Lembar kesan 5 pertanyaan (skala 1–5)', 'Akhir sesi'],
    ['2 Belajar', 'Kemampuan memakai aplikasi', 'Uji praktik sesuai kolom "Lulus bila"', 'Akhir modul'],
    ['3 Perilaku', 'Dipakai benar dalam kerja nyata', 'Pengamatan PIC + log aktivitas (mis. koreksi berulang)', 'Minggu 5–6'],
    ['4 Hasil', 'Dampak pada toko', 'Selisih kas & stok, piutang terlambat (Bab 10)', 'Bulan ke-3'],
], lebar=[2.2, 4.6, 6.4, 3.4], judul='Evaluasi empat tingkat')
p('**Contoh lembar uji praktik kasir:** buka shift (hitung per pecahan) · proses order antrean · jual 3 barang '
  'tunai · jual transfer dengan referensi · bayar campuran · catat kas keluar beli bensin Rp 20.000 · ajukan void '
  'satu baris dengan kode · tutup shift. Lulus bila semua benar dan selisih Rp 0.', rata='rata')

# ============================ BAB 10 ============================
h1('10. Pengawasan (kontrol) dan budaya kerja')
p('Pengawasan disusun mengikuti lima komponen pengendalian internal **COSO** yang menjadi acuan umum pengendalian '
  'usaha, dan dijalankan dengan siklus perbaikan **PDCA** (rencanakan–kerjakan–periksa–perbaiki).', rata='rata')
h2('10.1 Lima komponen pengendalian')
tabel(['Komponen', 'Artinya', 'Wujud di toko dengan BonsaiUrip'], [
    ['Lingkungan pengendalian', 'Sikap dan contoh dari pimpinan', 'Owner memakai angka aplikasi untuk keputusan; '
     'aturan dasar ditandatangani semua karyawan'],
    ['Penilaian risiko', 'Mengenali titik rawan', 'Uang laci, transfer fiktif, stok hilang, piutang macet (Bab 11)'],
    ['Kegiatan pengendalian', 'Pengaman dalam pekerjaan', 'Akun pribadi, izin per peran, kode persetujuan, hitung '
     'buta saat tutup shift, stok satu pintu, transaksi tidak bisa dihapus, batas kredit, batas muatan'],
    ['Informasi & komunikasi', 'Informasi tepat ke orang tepat', 'Lonceng notifikasi, dashboard, laporan, pesan '
     'Telegram/email ke atasan'],
    ['Pemantauan', 'Memeriksa bahwa pengaman berjalan', 'Tinjauan harian/mingguan/bulanan, log aktivitas, opname, '
     'uji pulih cadangan'],
], lebar=[3.6, 3.8, 9.2], judul='Pengendalian internal (COSO)')
h2('10.2 Siklus pemantauan Owner')
gambar('d5-kontrol.png', 16.4, 'Siklus kontrol harian sampai tahunan.')
gambar('d8-pdca.png', 15.0, 'Siklus perbaikan PDCA.')
h2('10.3 Angka yang dipantau (indikator kinerja)')
tabel(['Indikator', 'Target', 'Dilihat di', 'Bila meleset'], [
    ['Selisih tutup shift', '≤ Rp 1.000 (toleransi diatur)', 'Shift › Riwayat', 'Penjelasan tertulis; hitung ulang; latih ulang'],
    ['Transfer tidak masuk', '0', 'Cek uang non-tunai', 'Hubungi pembeli hari itu; void/retur bila batal'],
    ['Selisih opname', '< 1% nilai barang dihitung', 'Laporan penyesuaian', 'Telusuri kartu stok; perketat serah barang'],
    ['Void/retur per kasir', 'Wajar dan beralasan', 'Laporan retur, log', 'Bicarakan pola yang berulang'],
    ['Piutang terlambat', 'Turun tiap bulan', 'Umur piutang', 'Tagih; turunkan limit kredit'],
    ['Barang habis (laris)', '0 barang kelas A habis', 'Stok, saran pesan', 'Pesan lebih awal; ubah metode saran'],
    ['Cadangan', 'Berhasil setiap hari', 'Pengaturan › Cadangan', 'Perbaiki hari itu; cadangkan sekarang'],
], lebar=[3.4, 3.6, 3.4, 6.2], ukuran=9, judul='Indikator kinerja')
h2('10.4 Rapat mingguan 15 menit')
langkah(['Angka minggu ini: penjualan, selisih kas, selisih opname, piutang terlambat.',
         'Kendala memakai aplikasi (dicatat PIC; yang berupa usulan perbaikan diteruskan ke pengembang).',
         'Satu perbaikan cara kerja untuk minggu depan.',
         'Apresiasi karyawan dengan catatan terbaik.'])
h2('10.5 Membangun budaya')
for t in ['**Owner memberi contoh:** bertanya "di aplikasi berapa?" bukan "kira-kira berapa?".',
          '**Penghargaan:** kasir/admin dengan selisih 0 sebulan penuh mendapat apresiasi (bentuk ditentukan Owner).',
          '**Konsekuensi yang jelas dan diumumkan sejak awal:** memakai akun orang lain, tidak mencatat transaksi, '
          'atau mengisi referensi palsu adalah pelanggaran.',
          '**Kesalahan jujur tidak dihukum:** aplikasi menyediakan jalan koreksi yang rapi; yang dinilai adalah '
          'kejujuran melapor.',
          '**Aplikasi melindungi karyawan:** setiap uang dan barang tercatat atas nama pelaku, sehingga karyawan yang '
          'jujur tidak ikut dicurigai saat ada selisih.']:
    poin(t)
h2('10.6 Daftar periksa bulanan Owner')
tabel(['✓', 'Pemeriksaan'], [
    ['☐', 'Laporan laba kotor dan penjualan bulan lalu dicetak dan diarsipkan'],
    ['☐', 'Log aktivitas ditinjau: koreksi, persetujuan, perubahan harga, login gagal berulang'],
    ['☐', 'Akun pengguna ditinjau: karyawan yang keluar sudah nonaktif'],
    ['☐', 'Uji pulih cadangan otomatis berhasil; salinan bulanan dibawa pulang'],
    ['☐', 'Kendaraan: jadwal servis, STNK, KIR'],
    ['☐', 'Piutang terlambat dan limit kredit pelanggan ditinjau'],
], lebar=[1.0, 15.6])

# ============================ BAB 11 ============================
h1('11. Manajemen perubahan dan risiko')
h2('11.1 Tahapan perubahan pada karyawan (ADKAR)')
gambar('d7-adkar.png', 16.4, 'Model ADKAR: lima tahap yang dilalui setiap orang saat berubah.')
tabel(['Tahap', 'Tujuan', 'Tindakan nyata', 'Kapan'], [
    ['**Sadar** (Awareness)', 'Karyawan tahu alasan perubahan', 'Owner menyampaikan langsung: masalah selisih, '
     'tujuan, jadwal; bahwa tidak ada PHK karena aplikasi', 'Minggu 1'],
    ['**Mau** (Desire)', 'Karyawan melihat untungnya', 'Tunjukkan: tidak perlu menulis nota, tidak dicurigai saat '
     'selisih, kerja lebih cepat; libatkan karyawan memberi masukan', 'Minggu 1–2'],
    ['**Tahu caranya** (Knowledge)', 'Paham langkah kerja', 'Pelatihan per peran (Bab 9), tur aplikasi, Buku SOP', 'Minggu 3–4'],
    ['**Mampu** (Ability)', 'Lancar dalam kerja nyata', 'Uji paralel dengan pendampingan PIC dan buddy', 'Minggu 4–5'],
    ['**Bertahan** (Reinforcement)', 'Tidak kembali ke cara lama', 'Buku dihentikan, apresiasi, rapat mingguan, '
     'laporan hanya dari aplikasi', 'Minggu 6 dst.'],
], lebar=[3.2, 3.6, 7.6, 2.2], ukuran=9, judul='Tindakan per tahap ADKAR')
h2('11.2 Rencana komunikasi')
tabel(['Kapan', 'Siapa menyampaikan', 'Kepada', 'Isi'], [
    ['Minggu 1', 'Owner', 'Semua karyawan', 'Alasan, tujuan, jadwal, peran masing-masing, nama PIC'],
    ['Minggu 3', 'PIC', 'Per kelompok peran', 'Jadwal pelatihan, aturan dasar'],
    ['Minggu 4', 'Owner + PIC', 'Semua', 'Mulai uji paralel; cara melapor kendala'],
    ['Minggu 6', 'Owner', 'Semua', 'Mulai penuh; buku dihentikan; apresiasi'],
    ['Setiap minggu', 'PIC', 'Owner', 'Rekap kendala dan angka'],
], lebar=[2.4, 3.4, 3.4, 7.4], judul='Rencana komunikasi')
h2('11.3 Hambatan yang biasa muncul')
tabel(['Hambatan', 'Cara mengatasi'], [
    ['"Lebih cepat pakai buku"', 'Tunjukkan hasil uji paralel; dengan pintasan keyboard, kasir lancar setelah 1–2 minggu.'],
    ['Takut salah / kurang terbiasa komputer', 'Latihan dengan data contoh; tur; pendamping; kesalahan bisa dikoreksi.'],
    ['Merasa diawasi', 'Jelaskan bahwa catatan atas nama justru melindungi karyawan jujur.'],
    ['Lupa mencatat saat ramai', 'Aturan "catat dulu baru serahkan"; staf mencatat, kasir fokus menerima uang.'],
    ['Kembali ke cara lama', 'Owner hanya menerima laporan dari aplikasi setelah minggu 6.'],
], lebar=[4.6, 12.0], judul='Hambatan dan penanganan')
h2('11.4 Peta risiko')
p('Nilai risiko = kemungkinan (1–3) × dampak (1–3). Nilai 6–9 diutamakan.', miring=True, warna=ABU)
tabel(['Risiko', 'K', 'D', 'Nilai', 'Pencegahan', 'Bila terjadi'], [
    ['Laptop server rusak/hilang', '2', '3', '6', 'Cadangan harian terenkripsi ke disk terpisah; salinan bulanan di '
     'luar toko', 'Pasang Setup di laptop lain, pulihkan dari cadangan (< 1 hari)'],
    ['Listrik padam', '3', '2', '6', 'UPS; nyala otomatis', 'Ringkasan shift dan langkah pemeriksaan tampil otomatis'],
    ['Data salah input', '3', '2', '6', 'Cek qty tidak biasa, persetujuan atasan, data ganda ditolak',
     'Void/retur/penyesuaian dengan jejak'],
    ['Transfer fiktif', '2', '3', '6', 'No. referensi wajib, cek mutasi harian', 'Tandai "tidak masuk", tindak lanjuti'],
    ['Karyawan tidak mau berubah', '2', '2', '4', 'ADKAR, pelatihan, apresiasi', 'Pendampingan khusus; pembicaraan Owner'],
    ['Internet putus', '3', '1', '3', 'Pilihan A tidak bergantung internet', 'Toko tetap berjalan; akses luar menunggu'],
    ['Karyawan keluar', '2', '1', '2', 'Akun pribadi', 'Nonaktifkan akun hari itu juga'],
    ['Sandi cadangan hilang', '1', '3', '3', 'Dicatat di kertas, disimpan di 2 tempat aman', 'Buat cadangan baru dengan sandi baru'],
    ['Pengembang tidak tersedia', '1', '2', '2', 'Panduan, SOP, PIC terlatih; kode program tersimpan', 'Aplikasi tetap jalan tanpa perubahan'],
], lebar=[3.2, 0.7, 0.7, 1.1, 5.4, 5.5], ukuran=8.5, judul='Peta risiko dan mitigasi')

# ============================ BAB 12 ============================
h1('12. Keamanan dan cadangan data')
h2('12.1 Pengaman yang sudah ada di aplikasi')
tabel(['Ancaman', 'Pengaman'], [
    ['Orang lain memakai akun karyawan', 'Password pribadi teracak (argon2id); sesi berakhir 60 menit tidak dipakai; '
     '5 kali salah = kunci 15 menit'],
    ['Karyawan melihat modal/laba', 'Disaring di server menurut izin, bukan hanya disembunyikan di layar'],
    ['Koreksi tanpa sepengetahuan atasan', 'Kode persetujuan 6 angka ke HP atasan, berlaku 10 menit, sekali pakai'],
    ['Transaksi diubah/dihapus diam-diam', 'Tidak ada fitur hapus/ubah transaksi; log aktivitas tidak bisa dihapus'],
    ['Data hilang', 'Cadangan harian terenkripsi + uji pulih bulanan; arsip tahunan diperiksa keutuhannya'],
    ['Data dibawa orang saat pindah komputer', 'Berkas ekspor `.bonsai` dikunci sandi (AES-256-GCM)'],
    ['Penyadapan saat memakai HP/tablet', 'Lalu lintas Tailscale terenkripsi ujung ke ujung; HTTPS'],
    ['Serangan dari internet', 'Pilihan A tidak membuka port ke internet; pemeriksaan asal permintaan (CSRF), '
     'semua perintah database berparameter'],
], lebar=[5.0, 11.6], judul='Ancaman dan pengaman')
h2('12.2 Aturan cadangan 3-2-1')
p('Praktik umum perlindungan data: **3 salinan** data, di **2 media berbeda**, **1 salinan di luar lokasi**.',
  rata='rata')
tabel(['Salinan', 'Media', 'Lokasi', 'Kapan'], [
    ['1. Data aktif', 'SSD laptop server', 'Toko', 'Terus-menerus'],
    ['2. Cadangan harian', 'Hardisk eksternal WD 1 TB (terenkripsi)', 'Toko, terpasang', 'Otomatis setiap hari'],
    ['3. Salinan bulanan', 'Flashdisk / berkas .bonsai bersandi', 'Dibawa pulang Owner', 'Awal bulan'],
], lebar=[3.4, 5.6, 4.0, 3.6], judul='Penerapan aturan 3-2-1')
h2('12.3 Kewajiban Owner')
for t in ['Menyimpan **kode pemulihan Owner** dan **sandi cadangan** di kertas, di dua tempat aman (mis. brankas dan '
          'rumah). Keduanya **tidak bisa diminta ulang** dari pengembang.',
          'Memberi password Windows pada laptop server dan mengunci layar saat ditinggal.',
          'Tidak memasang program tidak jelas di laptop server; laptop server tidak dipakai untuk keperluan pribadi.',
          'Meninjau log aktivitas sebulan sekali.']:
    poin(t)

# ============================ BAB 13 ============================
h1('13. Ukuran keberhasilan penerapan')
p('Keberhasilan dinilai dengan **model keberhasilan sistem informasi DeLone & McLean**, yang melihat enam sisi: mutu '
  'sistem, mutu informasi, mutu layanan, pemakaian, kepuasan pengguna, dan manfaat bersih. Penilaian dilakukan pada '
  '**akhir bulan ke-1 dan ke-3** setelah mulai penuh.', rata='rata')
tabel(['Dimensi', 'Pertanyaan', 'Cara mengukur', 'Target'], [
    ['Mutu sistem', 'Apakah aplikasi cepat, stabil, mudah?', 'Kuesioner skala 1–5; jumlah gangguan', '≥ 4; gangguan 0 per bulan'],
    ['Mutu informasi', 'Apakah stok, kas, laporan akurat dan tepat waktu?', 'Selisih opname dan kas; tanggal laporan',
     'Selisih turun; laporan ≤ tgl 5'],
    ['Mutu layanan', 'Apakah bantuan PIC/pengembang cepat?', 'Waktu penyelesaian kendala', '≤ 1 hari kerja'],
    ['Pemakaian', 'Apakah semua transaksi lewat aplikasi?', 'Transaksi aplikasi vs barang keluar; log', '100%'],
    ['Kepuasan pengguna', 'Apakah karyawan dan Owner puas?', 'Kuesioner skala 1–5', '≥ 4'],
    ['Manfaat bersih', 'Apa dampaknya bagi toko?', 'Selisih kas & stok, piutang terlambat, waktu rekap, barang habis',
     'Membaik dibanding bulan ke-1'],
], lebar=[2.8, 4.4, 5.4, 4.0], ukuran=9, judul='Ukuran keberhasilan DeLone & McLean')
p('**Contoh butir kuesioner** (skala 1 sangat tidak setuju – 5 sangat setuju): (1) Aplikasi mudah saya pakai. '
  '(2) Saya bisa menyelesaikan pekerjaan lebih cepat. (3) Angka stok di aplikasi sesuai gudang. (4) Saya tahu '
  'harus bertanya kepada siapa bila ada kendala. (5) Saya lebih tenang karena pekerjaan saya tercatat.',
  rata='rata')

# ============================ BAB 14 ============================
h1('14. Dukungan, pembaruan, dan pengembangan lanjutan')
h2('14.1 Pembaruan aplikasi (SOP-20)')
langkah(['Pembaruan hanya dari berkas Setup yang diserahkan langsung oleh pengembang.',
         'Tutup shift; Pengaturan › Cadangan › **Cadangkan sekarang**; pastikan berhasil.',
         'Jalankan Setup baru; pilih **Pakai data yang sudah ada**.',
         'Buka *Tentang aplikasi* untuk memastikan versi baru; lakukan satu transaksi uji kecil lalu void.',
         'Catat tanggal dan versi pembaruan.'])
h2('14.2 Saluran bantuan')
tabel(['Tingkat', 'Siapa', 'Contoh masalah'], [
    ['1', 'PIC Sistem', 'Lupa password, cara memakai fitur, printer tidak mencetak'],
    ['2', 'Pengembang (telepon/WhatsApp)', 'Pesan galat, aplikasi tidak menyala, pemulihan data'],
    ['3', 'Pengembang (datang ke toko)', 'Penggantian laptop, pemasangan ulang, pelatihan ulang'],
], lebar=[1.6, 4.8, 10.2], judul='Tingkat bantuan')
p('Saat melapor, sertakan foto layar, jam kejadian, dan akun yang dipakai. Catatan teknis aplikasi tersimpan di '
  'folder `%LOCALAPPDATA%\\BonsaiUrip\\log`.', rata='rata')
h2('14.3 Rencana versi berikutnya')
tabel(['Rencana', 'Isi'], [
    ['Versi 1.19 (setelah presentasi)', 'Istilah di halaman Data dan pemasang dibuat lebih sederhana; membuat atau '
     'mengganti data toko dari dalam aplikasi dan halaman masuk tanpa memasang ulang; halaman Pemeriksaan data '
     'dipisah dan nama tab Data diperjelas.'],
    ['Usulan berikutnya', 'Printer struk dari tablet (Bluetooth/jaringan); laporan kas per shift; analisis ABC; '
     'perbandingan periode; peran dan izin yang dapat diatur Owner.'],
    ['Belum direncanakan', 'PPN/faktur pajak, akuntansi penuh, multi-gudang/cabang, WhatsApp otomatis, sambungan '
     'langsung ke bank.'],
], lebar=[4.4, 12.2], judul='Pengembangan lanjutan')

# ============================ BAB 15 ============================
h1('15. Keputusan yang dimohonkan dan persetujuan')
p('Mohon Bapak/Ibu memberi tanda centang dan mengisi kolom berikut.', rata='rata')
tabel(['No', 'Keputusan', 'Pilihan'], [
    ['1', 'Tempat aplikasi berjalan', '☐ A. Server di toko (disarankan)     ☐ B. Server online'],
    ['2', 'Paket perangkat', '☐ Minimal (Rp 3,3 jt)   ☐ Disarankan (Rp 15,5 jt)   ☐ Lengkap (Rp 20,6 jt)'],
    ['3', 'Komputer server', '☐ Memakai komputer yang ada     ☐ Membeli laptop baru'],
    ['4', 'Akses HP/tablet (Tailscale ± Rp 135 rb/bulan)', '☐ Ya     ☐ Tidak, laptop server saja'],
    ['5', 'Jumlah tablet', '☐ 0    ☐ 1    ☐ 2    ☐ ___'],
    ['6', 'PIC Sistem', 'Nama: ______________________   Tunjangan: Rp __________'],
    ['7', 'Penerima kode persetujuan', '☐ Owner   ☐ Admin: __________   Lewat: ☐ Telegram  ☐ Email'],
    ['8', 'Batas retur/void tanpa persetujuan', 'Rp __________ (Rp 0 = semua perlu persetujuan)'],
    ['9', 'Toleransi selisih kas', 'Rp __________'],
    ['10', 'Tanggal mulai persiapan', '____ / ____ / 20____'],
    ['11', 'Tanggal hitung stok awal', '____ / ____ / 20____'],
    ['12', 'Tanggal mulai penuh', '____ / ____ / 20____'],
], lebar=[1.0, 5.4, 10.2], judul='Lembar keputusan Owner')
p('')
tabel(['Disetujui oleh', 'Diajukan oleh'], [[
    '\n\n\n\n( ______________________ )\nOwner UD. Sumber Urip\nTanggal: ____________',
    '\n\n\n\n( ______________________ )\nPengembang BonsaiUrip\nTanggal: ____________']],
    lebar=[8.3, 8.3], warna_kepala='36261C', ukuran=10.5)

# ============================ LAMPIRAN ============================
h1('Lampiran A. Daftar istilah')
tabel(['Istilah', 'Artinya'], [
    ['Server', 'Komputer "rumah" aplikasi tempat data disimpan'],
    ['Lokal / VPS', 'Server di toko sendiri / server sewaan di pusat data'],
    ['Peramban', 'Program pembuka halaman web (Chrome, Edge)'],
    ['Tailscale', 'Layanan jalur aman terenkripsi untuk menyambungkan HP/tablet ke komputer toko'],
    ['Shift', 'Masa kerja kasir dari buka sampai tutup kas; satu shift untuk seluruh toko'],
    ['Clerical check', 'Pencocokan uang hasil hitung dengan catatan aplikasi saat tutup shift'],
    ['Order', 'Pesanan yang dicatat staf dan dibayar di kasir'],
    ['Struk / invoice', 'Bukti penjualan langsung / bukti penjualan pengantaran atau kredit'],
    ['Rit', 'Satu perjalanan kendaraan + sopir'],
    ['Surat jalan', 'Dokumen pengiriman barang, 2 rangkap'],
    ['Void', 'Pembatalan transaksi di shift yang sama'],
    ['Retur', 'Pengembalian barang oleh pembeli atau ke pemasok'],
    ['Opname', 'Penghitungan stok fisik lalu dicocokkan dengan aplikasi'],
    ['HPP / harga modal', 'Rata-rata harga beli barang'],
    ['Tier harga', 'Tingkat harga (Normal, Grosir, Distributor) menurut total belanja'],
    ['Konsinyasi', 'Barang titipan pemasok yang dibayar setelah laku'],
    ['Piutang / hutang', 'Uang yang belum dibayar pelanggan / yang belum dibayar ke pemasok'],
    ['Cadangan (backup)', 'Salinan data untuk berjaga bila komputer rusak'],
    ['PIC', 'Orang yang ditunjuk sebagai penanggung jawab'],
    ['UAT', 'Uji penerimaan pengguna: skenario dicoba Owner sebelum mulai'],
], lebar=[4.0, 12.6])

h1('Lampiran B. Pintasan keyboard')
tabel(['Layar', 'Tombol', 'Fungsi'], [
    ['Semua', 'Ctrl+K', 'Cari apa saja (barang, pelanggan, dokumen, halaman)'],
    ['Semua', 'Ctrl+/', 'Tampilkan/ciutkan daftar tombol'],
    ['Semua', 'Alt+1 / Alt+2 / Alt+3', 'Order / Penjualan Langsung / Pengantaran'],
    ['Order', 'Enter, 3*semen', 'Tambah barang; dengan jumlah'],
    ['Order', 'F3 / F4 / F7 / F8 / F9', 'Pengantaran / pelanggan / simpan nanti / kirim / mulai dari awal'],
    ['Kasir', 'F2 / F8 / F9', 'Cari barang / bayar / mulai dari awal'],
    ['Kasir (bayar)', 'T / B / E / Q / C', 'Tunai / transfer / EDC / QRIS / tambah bagian bayar campuran'],
    ['Kasir (bayar)', 'L / U / N / K', 'Lunas / DP / bayar nanti / kembalian tidak diambil'],
    ['Kasir', 'P / S / M / Del / Ctrl+Z', 'Promo baris / ganti satuan / menu baris / hapus / urungkan'],
    ['Kasir', 'Alt+← / Alt+→, PgUp/PgDn', 'Pindah panel antrean–transaksi; gulir panel'],
    ['Buka shift', 'Enter / H / N', 'Pakai uang kemarin / hitung sekarang / hitung nanti'],
    ['Pengiriman', 'R', 'Rit baru'],
    ['Saran pesan', '1 / 2 / 3 / 4', 'Metode A / B / C / D'],
], lebar=[3.2, 5.0, 8.4])

h1('Lampiran C. Galeri tampilan lain')
dua_gambar('41-kasir-antrean.png', '02-dashboard.png', 'Penjualan Langsung tanpa order', 'Dashboard (toko baru)')
dua_gambar('09-shift.png', '08-laporan.png', 'Shift sebelum transaksi', 'Daftar laporan')

h1('Lampiran D. Sumber data harga dan acuan')
tabel(['Data', 'Nilai', 'Sumber (diakses Oktober 2026)'], [
    ['Laptop Lenovo IdeaPad Slim 3 14IRU8 i3-1315U 8/512', 'Rp 6.519.000', 'tokopedia.com/blessingcombali (82X6005PID)'],
    ['UPS APC BX650LI-MS 650 VA', 'Rp 799.000', 'tokopedia.com/pojokitcom; luckycomonline'],
    ['Paket Blueprint Lite80D + cash drawer', 'Rp 1.513.500', 'tokopedia.com/blueprint'],
    ['Blueprint Lite80X USB', 'Rp 884.700', 'tokopedia.com/blueprint'],
    ['Iware XS80', 'Rp 595.000', 'tokopedia.com/klikbarcode'],
    ['Epson EcoTank L3210', 'Rp 2.125.000', 'tokopedia.com/rajakomputerkediri'],
    ['WD Elements 1 TB', 'Rp 999.000 – 1.005.000', 'tokopedia.com/gadgetgendong; rajahdd'],
    ['Samsung Galaxy Tab A9+ WiFi 4/64', 'Rp 3.499.000', 'Harga resmi Samsung Indonesia (infokomputer.grid.id)'],
    ['Zebra LS2208 / Honeywell HH400', 'Rp 1.049.000 / Rp 960.000', 'tokopedia.com/zebra-os; barcode-store-solutions'],
    ['TP-Link Archer A6', 'Rp 578.900', 'tokopedia.com/duniacom-srv'],
    ['IDCloudHost Rocket VPS 2 (2 core, 4 GB)', 'Rp 315.000 (promo Rp 105.000)', 'idcloudhost.com/en/server-vps'],
    ['DomaiNesia Cloud VPS Turbo 4 GB', 'Rp 320.000', 'whtop.com (paket domainesia.com)'],
    ['Domain .id', 'Rp 210.900 (thn 1), Rp 252.900 (perpanjang)', 'hostinger.com/id/tld/domain-id'],
    ['Tailscale Standard', 'US$8/pengguna/bulan; Personal hanya non-komersial', 'tailscale.com/pricing'],
    ['Internet rumah', 'Biznet 0D Rp 175.000; XL SATU 100 Mbps Rp 279.000', 'selular.id; bisnis.com (2026)'],
    ['UMK Kabupaten Jombang 2026', 'Rp 3.320.770', 'mamikos.com (daftar UMK Jatim 2026); cek SK Gubernur'],
    ['Upah lembur', '1/173 × upah sebulan; jam I 1,5×, berikutnya 2×', 'PP No. 35 Tahun 2021 Pasal 31–32'],
    ['Tarif listrik', 'Rp 1.444,70 per kWh', 'Tarif tenaga listrik PLN (golongan > 1.300 VA); mohon cek tagihan'],
], lebar=[5.6, 4.6, 6.4], ukuran=8.5)
p('Acuan metode: Laudon & Laudon, *Management Information Systems* (metode konversi sistem); Prosci ADKAR '
  '(manajemen perubahan); model ADDIE dan Kirkpatrick (pelatihan); COSO *Internal Control – Integrated Framework* '
  '(pengendalian internal); siklus PDCA Deming; DeLone & McLean (2003), *The DeLone and McLean Model of '
  'Information Systems Success: A Ten-Year Update*; aturan cadangan 3-2-1.', ukuran=9.5, rata='rata')
