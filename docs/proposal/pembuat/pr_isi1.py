from pr_alat import *
from pr_alat import _nomor_gambar

siapkan()

# ============================ SAMPUL ============================
for _ in range(2):
    d.add_paragraph()
d.add_picture(r'D:\sit-tbsu\apps\web\public\ikon-512.png', width=Cm(3.6))
d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
p('PROPOSAL', tebal=True, ukuran=15, warna=ABU, rata='tengah', setelah=0)
p('Rencana Implementasi Sistem Informasi', tebal=True, ukuran=22, warna=KAYU, rata='tengah', setelah=0)
p('Penjualan dan Persediaan', tebal=True, ukuran=22, warna=KAYU, rata='tengah', setelah=4)
p('BonsaiUrip', tebal=True, ukuran=30, warna=BIRU, rata='tengah', setelah=2)
p('Penjualan · Kasir · Pengantaran · Persediaan · Kas · Piutang · Laporan', ukuran=11.5, warna=ABU,
  rata='tengah', setelah=26)
p('Diajukan kepada', ukuran=11.5, rata='tengah', setelah=0)
p('Bapak/Ibu Pemilik UD. Sumber Urip', tebal=True, ukuran=17, rata='tengah', setelah=0)
p('Toko Bahan Bangunan · Jl. Peterongan No. 104, Peterongan, Jombang', ukuran=11.5, rata='tengah', setelah=50)
p('Disusun oleh: ______________________________', ukuran=11.5, rata='tengah', setelah=4)
p('Jombang, ____ ______________ 2026', ukuran=11.5, rata='tengah', setelah=4)
p('Aplikasi yang diperagakan: BonsaiUrip versi 1.18.0 (Setup-BonsaiUrip-1.18.0.exe)', ukuran=9.5, warna=ABU,
  rata='tengah')

# ============================ PENGANTAR ============================
h1('Kata pengantar')
p('Dengan hormat,', setelah=8)
p('Bersama dokumen ini kami mengajukan rencana penerapan aplikasi **BonsaiUrip** di UD. Sumber Urip. Aplikasi ini '
  'disusun berdasarkan pengamatan langsung cara kerja toko selama kerja praktik: pesanan di lantai toko, pembayaran '
  'di kasir, pengantaran dengan kendaraan toko, penerimaan barang dari pemasok, hingga pencatatan di buku transaksi '
  'dan buku persediaan.', rata='rata')
p('Dokumen ini menjelaskan, dengan bahasa sesederhana mungkin:', setelah=2)
for t in ['apa saja yang bisa dikerjakan aplikasi dan **bagaimana cara memakainya sehari-hari**;',
          '**pilihan tempat aplikasi berjalan** (di komputer toko atau di server internet) beserta biayanya;',
          '**perangkat yang dibutuhkan dengan harga pasar nyata** (Oktober 2026) dan sumber harganya;',
          '**siapa mengerjakan apa**, jadwal pelaksanaan 8 minggu, cara melatih karyawan, dan cara Bapak/Ibu '
          'mengawasi toko lewat aplikasi;',
          'risiko yang mungkin terjadi dan cara mencegahnya;',
          '**keputusan yang kami mohonkan** dari Bapak/Ibu (Bab 15), lengkap dengan lembar isian.']:
    poin(t)
p('Semua angka biaya adalah harga yang kami temukan di toko daring resmi dan sumber terbuka pada Oktober 2026; '
  'sumbernya dicantumkan di Lampiran D. Harga dapat berubah, sehingga sebelum membeli sebaiknya dicek ulang.',
  rata='rata', sebelum=6)
p('Kami menyadari bahwa mengubah kebiasaan kerja bukan hal kecil. Karena itu rencana ini dibuat **bertahap**, '
  'dengan masa uji coba di mana buku lama tetap dipakai sampai hasil aplikasi terbukti sama. Keputusan akhir '
  'sepenuhnya berada di tangan Bapak/Ibu.', rata='rata')
p('Atas perhatian dan kesempatan yang diberikan, kami ucapkan terima kasih.', sebelum=6, setelah=20)
p('Hormat kami,', setelah=40)
p('( ______________________________ )')

# ============================ DAFTAR ISI ============================
h1('Daftar isi')
p('(Bila nomor halaman belum tampil: klik kanan di daftar ini › Update Field.)', miring=True, ukuran=9, warna=ABU)
daftar_isi()

# ============================ RINGKASAN ============================
h1('Ringkasan untuk Bapak/Ibu Owner')
p('**Satu kalimat:** BonsaiUrip mencatat setiap pesanan, pembayaran, pengiriman, dan barang masuk-keluar di satu '
  'tempat, lalu menghitung sendiri stok, uang kas, piutang, dan laba, sehingga Owner bisa melihat keadaan toko '
  'kapan saja, termasuk dari HP.', rata='rata')
h2('Masalah yang dijawab')
tabel(['No', 'Masalah di toko sekarang (hasil pengamatan kerja praktik)', 'Jawaban BonsaiUrip'], [
    ['1', 'Penjualan langsung tidak selalu dicatat; rekap penjualan tidak akurat.',
     'Barang tidak bisa diserahkan tanpa struk; setiap penjualan bernomor dan masuk laporan otomatis.'],
    ['2', 'Saat ramai, kasir tidak tahu rincian barang yang diambil staf; selisih sulit terdeteksi.',
     'Staf mencatat order di tablet; order muncul di layar kasir lengkap dengan isi dan nomor antrean.'],
    ['3', 'Retur dicatat dengan mengubah/menghapus catatan lama; jejak hilang.',
     'Tidak ada yang dihapus. Retur dan void adalah dokumen baru dengan alasan dan persetujuan atasan.'],
    ['4', 'Pengantaran memakai tiga media; status transaksi, kiriman, dan bayar tidak sinkron.',
     'Satu papan Pengiriman: invoice → rit kendaraan → surat jalan → hasil kirim → tagihan menyesuaikan.'],
    ['5', 'Data barang belum tersusun (nama, satuan, harga tercecer).',
     'Data barang terstruktur: kategori, merek, satuan & kemasan, atribut (ukuran, warna), barcode, foto.'],
    ['6', 'Mutasi stok manual; riwayat tidak terlacak.',
     'Stok berubah hanya lewat transaksi; kartu stok mencatat setiap keluar-masuk dan siapa pelakunya.'],
    ['7', 'Belum ada harga bertingkat (eceran / grosir / distributor).',
     'Harga bertingkat otomatis menurut total belanja; promo terjadwal dengan anggaran.'],
    ['8', 'Belum ada laporan operasional.',
     'Lebih dari 20 laporan siap cetak/Excel: penjualan, laba kotor, stok, piutang, hutang, kas, dll.'],
], lebar=[0.9, 7.6, 8.1], judul='Delapan masalah toko dan jawabannya')
h2('Biaya ringkas (harga pasar Oktober 2026, rincian Bab 5)')
tabel(['Pilihan', 'Biaya awal (sekali)', 'Biaya bulanan', 'Total 3 tahun'], [
    ['**A. Server di toko (disarankan)**', 'Rp 15.454.500 (paket disarankan)\nRp 3.311.500 (paket minimal)',
     '± Rp 157.000', '± Rp 21,1 juta'],
    ['B. Server online (sewa)', 'Rp 15.454.500 (perangkat toko tetap dibutuhkan)', '± Rp 436.000', '± Rp 31,2 juta'],
], lebar=[4.6, 5.6, 2.8, 3.6], judul='Perbandingan biaya kedua pilihan')
h2('Rekomendasi kami')
kotak('Rekomendasi', [
    '1.  Jalankan aplikasi **di komputer toko (pilihan A)**: tanpa sewa bulanan, tetap jalan saat internet putus, '
    'dan sudah dalam bentuk berkas pemasangan (Setup .exe) yang diperagakan.',
    '2.  Tunjuk **1 orang PIC Sistem** (penanggung jawab) dari karyawan yang ada; tidak perlu menambah karyawan.',
    '3.  Mulai dengan **uji coba 2 minggu berdampingan dengan buku**. Buku baru dihentikan setelah hasil aplikasi '
    'dan buku sama 5 hari berturut-turut.',
    '4.  Bila kelak toko membuka cabang, seluruh data dapat dipindah ke server online tanpa mengetik ulang.',
], warna='DCFCE7')
h2('Keputusan yang kami mohonkan')
for t in ['Tempat aplikasi berjalan (A atau B).', 'Paket perangkat (minimal / disarankan / lengkap).',
          'Nama PIC Sistem.', 'Tanggal mulai, tanggal hitung stok awal, dan tanggal mulai penuh.']:
    poin(t)
p('Lembar isian keputusan tersedia di Bab 15.', miring=True, warna=ABU)

# ============================ BAB 1 ============================
h1('1. Latar belakang dan keadaan toko sekarang')
h2('1.1 Profil singkat UD. Sumber Urip')
p('UD. Sumber Urip adalah toko bahan bangunan di Jl. Peterongan No. 104, Peterongan, Jombang. Barang yang dijual '
  'antara lain semen, besi beton, pasir, cat (termasuk cat racikan), pipa PVC, triplek, kayu, baja ringan, alat '
  'tukang, kelistrikan, dan perlengkapan kamar mandi. Penjualan dilakukan dengan tiga cara: **langsung di toko**, '
  '**pesanan yang diambil kemudian**, dan **pengantaran** dengan kendaraan toko.', rata='rata')
h2('1.2 Cara kerja sekarang')
tabel(['Kegiatan', 'Cara sekarang', 'Media'], [
    ['Melayani pembeli', 'Staf mengambilkan barang, kasir menghitung dan menulis nota', 'Nota tulisan tangan'],
    ['Mencatat penjualan', 'Ditulis di buku transaksi (bila sempat)', 'Buku Transaksi Penjualan'],
    ['Pengantaran', 'Nota, surat jalan tulisan tangan, catatan sopir', 'Tiga media terpisah'],
    ['Barang datang', 'Dicatat di buku', 'Buku Persediaan Barang'],
    ['Harga', 'Diingat atau dilihat di buku katalog', 'Buku katalog'],
    ['Uang laci', 'Dihitung di akhir hari', 'Tidak tercatat per kasir'],
    ['Laporan', 'Direkap manual bila diperlukan', 'Tidak ada laporan rutin'],
], lebar=[3.4, 8.2, 5.0], judul='Cara kerja toko sebelum memakai aplikasi')
h2('1.3 Akibat yang dirasakan')
for t in [
    '**Uang dan barang sulit dicocokkan.** Bila uang laci kurang, tidak diketahui transaksi mana penyebabnya.',
    '**Stok di buku berbeda dengan gudang.** Pemesanan ke pemasok berdasarkan perkiraan; barang laris bisa '
    'habis, barang lambat menumpuk dan menahan modal.',
    '**Piutang pelanggan bergantung ingatan.** Jatuh tempo terlewat, pelanggan berhutang melebihi kemampuan.',
    '**Owner harus berada di toko** untuk mengetahui keadaan usaha, dan tidak punya angka laba yang pasti.',
    '**Kesalahan tidak meninggalkan jejak**, sehingga sulit membedakan salah hitung, lupa catat, atau penyimpangan.',
]:
    poin(t)
h2('1.4 Tujuan penerapan')
tabel(['Tujuan', 'Ukuran keberhasilan (dicek bulan ke-3)'], [
    ['Setiap penjualan tercatat', '100% barang keluar memiliki struk/invoice; selisih stok opname turun'],
    ['Uang kas dapat dipertanggungjawabkan', 'Selisih tutup shift ≤ Rp 1.000 pada ≥ 90% hari kerja'],
    ['Stok sesuai gudang', 'Selisih opname mingguan < 1% nilai barang yang dihitung'],
    ['Piutang terkendali', 'Tidak ada piutang yang terlambat tanpa tindak lanjut tercatat'],
    ['Owner memantau tanpa harus di toko', 'Owner membuka dashboard/laporan dari HP minimal 3 kali seminggu'],
    ['Laporan tersedia tepat waktu', 'Laporan bulanan dicetak paling lambat tanggal 5 bulan berikutnya'],
], lebar=[6.0, 10.6], judul='Tujuan dan ukurannya')

# ============================ BAB 2 ============================
h1('2. Mengenal BonsaiUrip')
h2('2.1 Bentuk aplikasi')
p('BonsaiUrip adalah aplikasi yang **dipasang di satu komputer toko** (disebut *server*) dari berkas '
  '**Setup-BonsaiUrip-1.18.0.exe** (± 61 MB). Setelah dipasang, aplikasi dibuka lewat ikon di desktop dan tampil '
  'di peramban (Chrome/Edge), seperti membuka situs web, tetapi datanya tersimpan **di komputer toko sendiri**. '
  'Komputer kasir, tablet staf, dan HP Owner membuka aplikasi yang sama sehingga semua orang melihat data yang '
  'sama pada saat yang sama.', rata='rata')
tabel(['Bagian', 'Isi', 'Keterangan untuk Owner'], [
    ['Program aplikasi', 'BonsaiUrip 1.18.0', 'Dibuat khusus untuk toko ini; berbahasa Indonesia'],
    ['Database', 'PostgreSQL 17 (disertakan di Setup)', 'Program penyimpan data yang dipakai bank dan perusahaan besar; gratis'],
    ['Cadangan', 'restic 0.17.3 (disertakan)', 'Menyalin data setiap hari dalam bentuk terkunci sandi'],
    ['Peramban', 'Chrome atau Edge', 'Sudah ada di Windows'],
    ['Akses HP/tablet', 'Tailscale (jalur terenkripsi)', 'Lihat Bab 4'],
], lebar=[3.4, 5.4, 7.8], judul='Komponen yang terpasang')
h2('2.2 Empat peran pengguna')
p('Setiap karyawan masuk dengan **akun sendiri** (username dan password). Menu yang tampil menyesuaikan perannya; '
  'data sensitif seperti harga modal dan laba **disaring di server**, bukan hanya disembunyikan di layar. Peran '
  'atas mewarisi semua kemampuan peran di bawahnya (Staf ⊂ Kasir ⊂ Admin ⊂ Owner). Ada 57 izin rinci yang sudah '
  'ditetapkan untuk empat peran ini.', rata='rata')
tabel(['Peran', 'Pekerjaan utama di aplikasi', 'Tidak dapat'], [
    ['**Staf Penjualan**', 'Mencatat order pembeli, cek stok tersedia & harga, menambah pelanggan baru',
     'Menerima uang, melihat harga modal/laba, mengubah data pelanggan tanpa kode atasan'],
    ['**Kasir**', 'Buka/tutup shift, penjualan langsung, penjualan pengantaran, terima pembayaran & piutang, '
     'cetak struk/invoice, ajukan retur/void, catat BBM', 'Melihat harga modal/laba, menyetujui koreksi sendiri'],
    ['**Admin**', 'Data barang & harga, penerimaan barang, order pembelian, opname, pengiriman, kendaraan, '
     'cek transfer masuk, laporan, menyetujui retur/void', 'Kelola akun, pengaturan inti (sesuai izin)'],
    ['**Owner**', 'Semua, termasuk akun karyawan, pengaturan, laba, log aktivitas, cadangan, arsip tahunan', '—'],
], lebar=[3.0, 8.6, 5.0], judul='Peran dan wewenang')
h2('2.3 Alur kerja harian')
gambar('d1-alur.png', 16.4, 'Alur kerja harian: tiap langkah dicatat sekali, sisanya dihitung aplikasi.')
h2('2.4 Dokumen yang dihasilkan')
gambar('d9-dokumen.png', 16.4, 'Alur dokumen bernomor otomatis.')
tabel(['Kode', 'Dokumen', 'Dibuat oleh', 'Contoh nomor'], [
    ['ORD', 'Order penjualan (pesanan dari staf)', 'Staf/Kasir', 'ORD-261031-012'],
    ['STR', 'Struk penjualan langsung (kertas thermal 58/80 mm)', 'Kasir', 'STR-261031-004'],
    ['INV', 'Invoice penjualan pengantaran/kredit (A4)', 'Kasir/Admin', 'INV-261031-002'],
    ['TRP', 'Rit: satu perjalanan kendaraan + sopir', 'Admin/Kasir', 'TRP-261031-001'],
    ['SJ', 'Surat jalan 2 rangkap (asli toko, salinan penerima)', 'Otomatis dari rit', '—'],
    ['RCV', 'Penerimaan barang dari pemasok', 'Admin', 'RCV-261031-001'],
    ['ADJ', 'Penyesuaian stok: saldo awal, opname, koreksi, rusak', 'Admin', 'ADJ-261031-001'],
    ['SHF / CLC', 'Shift kasir / pencocokan uang saat tutup', 'Kasir', 'SHF-261031-001'],
    ['RTR', 'Retur penjualan', 'Kasir (disetujui atasan)', 'RTR-261031-001'],
    ['PBP', 'Pembayaran hutang ke pemasok', 'Admin/Owner', 'PBP-261031-001'],
], lebar=[2.0, 7.2, 3.4, 4.0], judul='Dokumen dan penomorannya')
p('Format nomor dapat diatur Owner di *Pengaturan › Penomoran*. Nomor tidak pernah dipakai dua kali dan tidak '
  'bisa dibuat manual.', miring=True, ukuran=9.5, warna=ABU)

# ============================ BAB 3 ============================
h1('3. Fitur lengkap dan cara pemakaian sehari-hari')
p('Bab ini menjelaskan setiap bagian aplikasi: **gunanya**, **langkah pemakaian sebenarnya** (tombol yang ditekan), '
  'dan **pengaman bawaan** yang mencegah kesalahan. Semua layar dapat dipakai dengan mouse/sentuh maupun keyboard. '
  'Foto layar diambil dari aplikasi versi 1.18.0 dengan data contoh.', rata='rata')

h2('3.1 Masuk, dashboard, notifikasi, dan pencarian')
dua_gambar('42-login.png', '02b-dashboard.png', 'Halaman masuk', 'Dashboard Owner')
langkah([
    'Klik ikon **BonsaiUrip** di desktop komputer toko. Layar pembuka tampil, lalu peramban terbuka sendiri.',
    'Isi **Username** dan **Password** › **Masuk**. Masuk pertama kali wajib mengganti password.',
    '**Dashboard** menampilkan penjualan hari ini dibanding kemarin, antrean order, pengiriman aktif, peringatan '
    'stok, grafik 7 hari, dan aksi cepat. Isi dashboard menyesuaikan peran (omzet hanya untuk Owner/Admin).',
    '**Lonceng** di kanan atas berisi hal yang perlu ditindaklanjuti: order terlalu lama, stok habis/kritis, '
    'retur/void menunggu persetujuan, piutang jatuh tempo, transfer belum dicek, cadangan bermasalah, '
    'STNK/KIR kendaraan hampir habis.',
    '**Cari apa saja: Ctrl+K.** Ketik nama barang, pelanggan, pemasok, nomor dokumen (boleh sebagian), atau '
    'nama halaman; Enter untuk membuka.',
])
kotak('Pengaman bawaan', [
    '•  Sesi berakhir sendiri setelah **60 menit** tidak dipakai, dan paling lama **12 jam** sejak masuk.',
    '•  **5 kali** salah password berturut-turut: akun dikunci **15 menit**.',
    '•  Password disimpan teracak (argon2id); tidak ada orang, termasuk pengembang, yang bisa membacanya.',
    '•  Lupa password: kode ke email, atau **kode pemulihan** yang dicetak saat setup.',
])
gambar('35-notifikasi.png', 13.5, 'Lonceng notifikasi terbuka.')

h2('3.2 Order Penjualan (Staf Penjualan)')
p('Dipakai staf di lantai toko/gudang, sebaiknya dengan **tablet**. Pembeli umum tidak perlu didata: cukup barang '
  'dan jumlahnya. Begitu dikirim, order mendapat **nomor antrean** dan langsung muncul di layar kasir, sementara '
  'barangnya **ditahan** (tidak bisa dijual ke pembeli lain).', rata='rata')
gambar('05-order.png', 16.4, 'Order Penjualan: cari barang, daftar order, total, kirim ke kasir.')
langkah([
    'Buka *Transaksi › Order Penjualan*. Ketik nama/kode barang lalu **Enter**. Untuk jumlah langsung ketik '
    '`3*semen` (= 3 sak semen).',
    'Lupa nama barang? Ketik cirinya: `pipa 3 inch putih`, `cat 5 kg`, `besi 12 mm`. Atau pilih kategori lalu '
    '**Daftar** untuk melihat barang bergambar.',
    'Perhatikan label **Laris / Lambat / Tidak laku / Baru** dan angka **stok tersedia** (merah tebal) di hasil cari.',
    'Pelanggan langganan: **F4**. Pengantaran: **F3** (alamat terisi dari data pelanggan).',
    '**Bacakan ulang** pesanan kepada pembeli, lalu **F8 Kirim ke antrean**. Sebutkan nomor antrean kepada pembeli '
    'dan bawa barangnya ke kasir.',
    'Pembeli mengambil besok? **F7 Simpan untuk nanti**: isi nama, No. HP, tanggal ambil (paling lama 14 hari). '
    'Barang ditahan; lewat tanggal ambil, lonceng mengingatkan.',
])
kotak('Harga otomatis', [
    'Staf **tidak memilih harga**. Harga mengikuti total belanja satu transaksi: begitu total mencapai syarat tier '
    '(mis. Grosir mulai Rp 1.000.000), semua barang memakai harga tier itu. Di atas total tertulis '
    '"Belanja Rp … lagi untuk harga Grosir" untuk ditawarkan kepada pembeli. Promo terpasang sendiri.',
])

h2('3.3 Penjualan Langsung (Kasir)')
gambar('04-kasir.png', 16.4, 'Layar kasir: papan antrean (kiri), keranjang dan pembayaran (kanan).')
p('**Langkah melayani pembeli:**', tebal=True)
langkah([
    'Order dari staf muncul di **papan antrean** (terlama tersorot). Tekan **Enter** untuk memproses, atau ketik '
    'nomor antrean + Enter.',
    'Tanpa order: **F2** cari barang, Enter tambah. Scan barcode juga bisa (scanner USB).',
    'Baris kuning **"Qty tidak biasa"** berarti jumlahnya jauh dari kebiasaan (mis. 2 jadi 20): tanyakan ulang.',
    '**F8 Bayar.** Tunai: ketik uang diterima › Enter; kembalian tampil besar dan struk tercetak.',
    'Non-tunai: **B** transfer, **E** EDC/kartu, **Q** QRIS. Rekening toko sudah terpilih; isi **No. referensi** '
    'dari bukti bayar pembeli (wajib, minimal 4 huruf/angka).',
    'Bayar campuran (sebagian tunai, sebagian transfer): pilih cara, ketik nominal, tekan **C**; ulangi; bagian '
    'terakhir Enter.',
    'Pelanggan terdata boleh **DP** (U) atau **Bayar nanti** (N); sisanya menjadi piutang, dengan batas kredit.',
    'Serahkan barang **sambil mencocokkan dengan struk**.',
])
tabel(['Tombol', 'Fungsi', 'Tombol', 'Fungsi'], [
    ['F2', 'Cari barang', 'F8', 'Bayar'],
    ['F4', 'Pilih pelanggan', 'F9', 'Mulai dari awal (selalu ditanya dulu)'],
    ['3*semen', 'Tambah 3 semen sekaligus', 'T / B / E / Q', 'Tunai / Transfer / EDC / QRIS'],
    ['P', 'Lepas/pasang promo baris', 'K', 'Kembalian tidak diambil pembeli'],
    ['Alt+1/2/3', 'Pindah Order / Langsung / Pengantaran', 'Ctrl+Z', 'Urungkan hapus barang'],
], lebar=[2.4, 5.9, 2.6, 5.7], judul='Pintasan keyboard layar kasir')
dua_gambar('40-struk.png', '31-pembayaran.png', 'Pengaturan struk & printer', 'Rekening penerimaan non-tunai')

h2('3.4 Penjualan Pengantaran dan Pengiriman')
p('Untuk barang yang diantar: kasir membuat **invoice** dengan alamat kirim, ongkir, dan cara bayar (**Lunas, DP, '
  'Bayar nanti,** atau **Saat terima**). Pengiriman diatur di papan **Logistik › Pengiriman** yang berisi empat '
  'kolom: Backlog → Dijadwalkan → Di jalan → Selesai hari ini.', rata='rata')
gambar('36-pengantaran.png', 15.5, 'Penjualan Pengantaran.')
gambar('06b-pengiriman.png', 16.4, 'Papan Pengiriman: invoice menunggu (Backlog) disusun ke rit.')
langkah([
    '**Rit baru (R):** pilih kendaraan, sopir, jam berangkat.',
    'Seret kartu invoice dari Backlog ke rit (atau menu ⋮ › Masukkan ke rit). Surat jalan otomatis dibuat dengan '
    'nama sopir dan plat. Bisa kirim sebagian; sisanya tetap di Backlog.',
    'Muat barang sesuai surat jalan, centang **Dimuat** per surat jalan.',
    'Periksa **bar muatan** (berat, volume, panjang barang): hijau aman; oranye wajib tulis alasan; **merah ditolak** '
    '(tombol Berangkat mati) supaya kendaraan tidak kelebihan muatan.',
    '**Berangkat** › cetak surat jalan 2 rangkap.',
    'Sopir kembali: **Catat hasil** per surat jalan: semua diterima, kembali utuh (kirim ulang / batal), atau rusak. '
    'Tagihan, stok, dan pengembalian uang menyesuaikan otomatis sesuai status bayar pembeli.',
])
gambar('27-armada.png', 15.5, 'Kendaraan & Sopir: daya angkut, ukuran bak, pengingat servis, STNK/KIR.')
p('Di menu yang sama tersedia **catatan BBM** (liter, odometer), **servis berkala**, dan **statistik** per '
  'kendaraan/sopir: jumlah rit, tepat jadwal, biaya BBM per km, barang kembali/rusak.', rata='rata')

h2('3.5 Piutang dan limit kredit')
gambar('20-piutang.png', 15.5, 'Piutang: total belum lunas, jatuh tempo, per pelanggan.')
langkah([
    'Penjualan DP/bayar nanti otomatis menjadi piutang dengan jatuh tempo sesuai term pelanggan.',
    'Lonceng mengingatkan **piutang jatuh tempo ≤ 3 hari** dan **terlambat**.',
    'Pelanggan membayar: *Piutang* › pilih tagihan › **Terima pembayaran** (tunai saat shift terbuka atau transfer '
    'dengan No. referensi).',
    'Penjualan yang membuat piutang melewati **limit kredit** pelanggan ditahan; kasir perlu kode persetujuan atasan.',
])
gambar('12-pelanggan.png', 15.5, 'Data Pelanggan: limit kredit, sisa limit, tagihan berjalan, jatuh tempo terdekat.')

h2('3.6 Koreksi: Retur, Void, dan persetujuan atasan')
p('Transaksi **tidak pernah diedit atau dihapus**. Kesalahan diperbaiki dengan dokumen koreksi yang mencatat alasan, '
  'pengaju, dan penyetuju.', rata='rata')
tabel(['Jenis', 'Kapan dipakai', 'Hasil'], [
    ['**Void**', 'Salah transaksi di shift yang masih buka dan barang belum dikirim/diretur',
     'Transaksi/baris batal; stok kembali; uang dikembalikan dari kas shift'],
    ['**Retur penjualan**', 'Barang dikembalikan pembeli (sudah lewat shift atau sudah dikirim)',
     'Uang kembali, tukar barang sama, atau potong tagihan; barang baik masuk stok, rusak dipisah'],
    ['**Penyesuaian stok**', 'Barang rusak, hilang, salah serah, hasil opname', 'Stok dikoreksi dengan alasan wajib'],
    ['**Koreksi modal shift**', 'Salah ketik modal awal kasir', 'Angka lama tetap tercatat'],
], lebar=[3.4, 7.0, 6.2], judul='Jenis koreksi')
p('**Persetujuan atasan tanpa memberikan password:**', tebal=True)
langkah([
    'Kasir mengajukan retur/void › **Kirim kode ke atasan**.',
    'Admin/Owner menerima pesan **Telegram atau email** berisi rincian permintaan dan **kode 6 angka**.',
    'Bila setuju, atasan menyebutkan kodenya (boleh lewat telepon). Kasir mengetik kode › **Setujui dengan kode**.',
    'Kode berlaku **10 menit**, sekali pakai, hanya untuk permintaan itu; 5 kali salah ketik membatalkan kode. '
    'Persetujuan tercatat atas nama atasan.',
])
p('Retur/void bernilai kecil (di bawah batas yang ditetapkan Owner di *Pengaturan › Operasional*) langsung jadi '
  'tanpa kode. Batas Rp 0 berarti semua retur/void harus disetujui.', rata='rata')
dua_gambar('25-retur.png', '26-void.png', 'Retur Penjualan', 'Void Transaksi')
gambar('30-persetujuan.png', 14.5, 'Pengaturan › Persetujuan: menyiapkan Telegram/email penerima kode.')

h2('3.7 Shift kasir dan pencocokan uang (clerical check)')
p('Toko memegang **satu kumpulan uang tunai**, sehingga hanya ada **satu shift terbuka**. Uang tunai hanya bisa '
  'diterima saat shift terbuka. Semua uang masuk-keluar laci tercatat dengan nama pencatatnya.', rata='rata')
gambar('09b-shift.png', 16.4, 'Shift & Clerical Check: kas masuk/keluar dan hitung uang per pecahan.')
p('**Membuka shift (pagi):**', tebal=True)
langkah([
    '*Shift & Clerical Check* › **Buka shift**. Pilih: **Enter** pakai uang kemarin (laci tidak disentuh), **H** '
    'hitung sekarang per pecahan, atau **N** buka dulu, hitung dalam 60 menit (toko sudah ramai).',
    'Uang di luar penjualan (tambah receh, kasbon, beli bensin, setor ke Owner) dicatat di **Kas masuk/keluar**.',
])
p('**Menutup shift (sore):**', tebal=True)
langkah([
    'Baca kotak **Sebelum menutup**: merah wajib diselesaikan (mis. void menunggu); kuning dibaca dan dicentang '
    '(transfer belum dicek, retur menunggu, uang COD masih dibawa sopir).',
    'Hitung uang **per pecahan** dan kirim. **Angka sistem belum ditampilkan** saat menghitung (hitungan jujur).',
    'Hasil: selisih hijau (cocok), merah (kurang), kuning (lebih). **Bantuan mencari selisih** menunjukkan '
    'kemungkinan sebab, mis. "sama dengan kembalian STR-…". Selisih di atas toleransi wajib diberi keterangan.',
    'Isi **uang ditinggal** untuk besok, sisanya disetor › **Tutup shift**.',
])
kotak('Pengaman shift', [
    '•  Aplikasi **tidak bisa dimatikan** (juga tidak bisa diperbarui/dihapus) selama shift masih terbuka.',
    '•  Bila listrik/komputer mati mendadak saat shift terbuka, saat menyala lagi tampil **ringkasan shift dan '
    'langkah pemeriksaan** (gambar berikut).',
    '•  Admin/Owner mencocokkan setiap transfer/EDC/QRIS dengan mutasi rekening di **Cek uang non-tunai**.',
])
gambar('43-pemulihan.png', 15.5, 'Layar pemulihan setelah komputer mati mendadak saat shift terbuka.')

h2('3.8 Data master: barang, satuan, pelanggan, pemasok')
gambar('03-barang.png', 16.4, 'Data Barang.')
tabel(['Fitur', 'Penjelasan'], [
    ['Barang', 'Kode, nama baku (merek + jenis + ukuran), kategori, merek, foto, stok minimum, atribut fleksibel '
     '(panjang, diameter, warna, watt, berat).'],
    ['Satuan & kemasan', 'Satuan dasar = satuan terkecil yang dijual (sak, batang, meter). Kemasan: dus isi 12, '
     'roll isi 50 m, dll., dengan barcode dan harga sendiri.'],
    ['Data muatan', 'Berat dan ukuran per satuan untuk menghitung muatan kendaraan; bisa diisi massal lewat Excel.'],
    ['Import Excel', 'Ratusan barang dan saldo awal stok dimasukkan sekaligus dari berkas Excel.'],
    ['Label barcode', 'Cetak label harga + barcode di printer thermal atau kertas label A4.'],
    ['Pelanggan', 'No. HP (format +62), alamat, golongan, term bayar, limit kredit. Kasir/Staf perlu kode atasan '
     'untuk mengubah data pelanggan.'],
    ['Pemasok', 'Kontak, lama kirim, frekuensi belanja (dipakai saran pesan).'],
    ['Cegah data ganda', 'Nama/No. HP yang sama atau mirip ditolak atau diperingatkan sebelum disimpan.'],
    ['Tidak dihapus', 'Data yang tidak dipakai dinonaktifkan; riwayat transaksi tetap utuh.'],
], lebar=[3.6, 13.0], judul='Fitur data master')
gambar('38-pemasok.png', 15.5, 'Data Pemasok.')

h2('3.9 Harga jual, tier, dan promo')
gambar('22-harga-jual.png', 16.4, 'Harga Jual: harga per tier, margin, sakelar harga otomatis.')
tabel(['Fitur', 'Cara kerja'], [
    ['Harga dasar', 'Harga jual = harga modal + markup. Dasar modal dapat dipilih: **rata-rata tertimbang**, '
     '**harga beli terakhir**, atau **stok tertua dulu (FIFO)**. Pembulatan diatur (mis. ke Rp 100).'],
    ['Harga tetap', 'Barang tertentu boleh berharga tetap (Rp) yang diketik Admin.'],
    ['Tier otomatis', 'Normal, Grosir, Distributor: dipakai otomatis menurut total belanja satu transaksi.'],
    ['Tinjau harga', 'Saat harga beli naik, harga jual ikut naik (bila otomatis); saat turun, barang masuk daftar '
     'tinjau untuk diputuskan Admin.'],
    ['Promo', 'Lima jenis manfaat: potongan %, potongan Rp per satuan, harga khusus, **beli X gratis Y**, '
     'beli N potong Rp X. Berlaku per tanggal, hari, dan jam (mis. 13:00–15:00); sasaran semua barang, kategori, '
     'merek, atau barang tertentu; untuk semua pembeli atau golongan pelanggan tertentu.'],
    ['Anggaran promo', 'Batas total potongan dan batas per pembeli; promo berhenti sendiri saat anggaran habis.'],
], lebar=[3.4, 13.2], judul='Pengaturan harga')
dua_gambar('39-harga-dasar.png', '23-promo.png', 'Pengaturan harga dasar + kalkulator contoh',
           'Daftar promo dengan potongan terpakai')

h2('3.10 Persediaan, pembelian, dan hutang pemasok')
gambar('07-stok.png', 16.4, 'Stok Persediaan: posisi stok dengan status Habis / Kritis / Perlu dipesan / Aman.')
p('Aplikasi membedakan tiga angka stok: **fisik** (yang ada di gudang), **dipesan** (ditahan order yang belum '
  'dibayar), dan **tersedia** (fisik dikurangi dipesan, yang boleh dijual). Stok **hanya berubah lewat dokumen** '
  '(penjualan, penerimaan, retur, penyesuaian), sehingga setiap perubahan bisa ditelusuri di kartu stok.',
  rata='rata')
tabel(['Fitur', 'Langkah singkat', 'Hasil otomatis'], [
    ['Penerimaan barang', 'Hitung fisik barang datang › *Penerimaan Barang* › Catat penerimaan: pemasok, No. faktur, '
     'qty, harga beli; tunai atau tempo', 'Stok bertambah; HPP rata-rata dihitung ulang; tempo menjadi hutang'],
    ['Order pembelian', 'Draf dari Saran pesan › Kirim ke pemasok (cetak/salin ke WhatsApp) › uang muka bila ada '
     '› terima barang (boleh sebagian)', 'Barang yang sudah dipesan tidak disarankan dua kali'],
    ['Saran pesan', 'Pilih metode: A Rata-rata, B Statistik (tingkat layanan 90/95/98%), C Min–maks, D Tren',
     'Daftar barang perlu dibeli per pemasok + perkiraan biaya'],
    ['Opname', 'Hitung fisik (sebaiknya 2 orang) › isi di *Penyesuaian* jenis Opname › selesaikan',
     'Selisih tercatat dengan alasan; stok sama dengan gudang'],
    ['Stok rusak', 'Pindahkan dari stok baik › retur ke pemasok atau musnahkan (alasan wajib)',
     'Barang rusak tidak terjual tanpa sengaja'],
    ['Hutang pemasok', 'Bayar sebagian/penuh, transfer atau tunai dari shift', 'Umur hutang dan jatuh tempo terpantau'],
    ['Konsinyasi (titipan)', 'Daftarkan barang titipan, terima, jual biasa, buat setoran berkala',
     'Nilai yang harus disetor ke penitip dihitung otomatis'],
], lebar=[3.0, 8.0, 5.6], judul='Fitur persediaan dan pembelian')
dua_gambar('16-penerimaan.png', '17-penyesuaian.png', 'Penerimaan Barang', 'Penyesuaian dan opname')
dua_gambar('18-saran-pesan.png', '19-mutasi.png', 'Saran pesan ulang (4 metode)', 'Mutasi stok (riwayat keluar-masuk)')
dua_gambar('21-hutang.png', '37-order-pembelian.png', 'Hutang Pemasok', 'Order Pembelian')

h2('3.11 Laporan dan Hasil Penjualan')
gambar('24-hasil-penjualan.png', 16.4, 'Hasil Penjualan: omzet, transaksi, rata-rata, laba kotor, dibanding periode sebelumnya.')
tabel(['Kelompok', 'Laporan yang tersedia'], [
    ['Penjualan', 'Penjualan per periode, produk terlaris, detail invoice, retur penjualan, promo, daftar harga '
     '(katalog untuk pelanggan); di layar Hasil Penjualan: per kategori, per kasir, per cara bayar, jam dan hari ramai'],
    ['Persediaan', 'Stok rekap, kartu stok, stok minimum, nilai persediaan (termasuk barang rusak), riwayat harga beli '
     '(bandingkan antarpemasok), rekomendasi pemesanan ulang'],
    ['Keuangan', 'Laba kotor (gross profit), umur piutang, hutang usaha, konsinyasi'],
    ['Pengawasan', 'Log aktivitas (ekspor Excel), statistik kendaraan dan sopir, riwayat shift dan selisih'],
], lebar=[3.0, 13.6], judul='Daftar laporan')
p('Setiap laporan memakai **kop toko, periode, ringkasan, dan kolom tanda tangan**, tampil per lembar A4 seperti '
  'hasil cetak, dan bisa **dicetak/PDF** atau **diekspor ke Excel**. Kasir melihat laporan penjualan tanpa harga '
  'modal dan laba.', rata='rata')
gambar('08b-laporan.png', 16.4, 'Laporan Stok Rekap dalam pratinjau A4.')

h2('3.12 Pengaturan, akun, log aktivitas, cadangan, dan data')
tabel(['Menu', 'Isi'], [
    ['Data Pengguna', 'Tambah akun karyawan (password awal wajib diganti), reset password, nonaktifkan akun '
     'karyawan yang keluar (sesinya langsung berakhir).'],
    ['Log aktivitas', 'Siapa melakukan apa dan kapan, termasuk persetujuan, perubahan harga, cetak/ekspor laporan; '
     'tidak bisa dihapus; bisa diekspor ke Excel.'],
    ['Cadangan', 'Salinan otomatis harian, terenkripsi sandi, ke disk/flashdisk terpisah; uji pulih otomatis tiap '
     'bulan; opsi cloud.'],
    ['Data (pindah komputer)', 'Ekspor seluruh data ke satu berkas `.bonsai` bersandi (AES-256) untuk dipindah ke '
     'komputer baru; simpan salinan sebelum perubahan besar.'],
    ['Arsip tahunan', 'Tutup buku tahunan: transaksi tahun lalu dikunci dan disalin ke berkas arsip yang diperiksa '
     'keutuhannya.'],
    ['Operasional', 'Jam buka/tutup shift, toleransi selisih kas, batas retur/void tanpa persetujuan, batas muatan, '
     'parameter saran pesan.'],
    ['Lainnya', 'Profil toko & logo, struk & printer, penomoran, pembayaran (rekening), harga dasar, promo, '
     'keamanan, persetujuan (Telegram/email), akses HP/tablet.'],
], lebar=[3.6, 13.0], judul='Menu pengaturan')
dua_gambar('28-pengguna.png', '29-log.png', 'Data Pengguna', 'Log aktivitas')
dua_gambar('10-cadangan.png', '32-operasional.png', 'Pengaturan cadangan', 'Pengaturan operasional')

h2('3.13 HP dan tablet')
p('Aplikasi tampil menyesuaikan layar HP/tablet (menu menjadi laci ☰, panel bertumpuk). HP/tablet dipasangi '
  'BonsaiUrip seperti aplikasi (*Tambahkan ke layar utama*), lalu membuka komputer toko lewat **Tailscale**, '
  'jalur terenkripsi yang tidak memerlukan IP tetap atau membuka port internet. Halaman *Pengaturan › Akses '
  'HP/tablet* memandu pemasangannya dan menampilkan **kode QR** untuk dipindai. Layar kasir paling nyaman di '
  'tablet posisi mendatar.', rata='rata')
t = d.add_table(rows=1, cols=3)
for i, (n, k) in enumerate((('14-hp-dashboard.png', 'Dashboard di HP'), ('15-hp-menu.png', 'Menu di HP'),
                            ('11-akses.png', 'Pengaturan › Akses HP/tablet'))):
    sel = t.rows[0].cells[i]
    sel.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    sel.paragraphs[0].add_run().add_picture(f'{G}\\{n}', width=Cm(3.3 if i < 2 else 7.4))
    _nomor_gambar[0] += 1
    q = sel.add_paragraph()
    q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    teks(q, f'Gambar {_nomor_gambar[0]}. {k}', miring=True, ukuran=9, warna=ABU)
d.add_paragraph()

h2('3.14 Mudah dipelajari: setup awal, tur, dan Buku SOP')
dua_gambar('01-setup.png', '13-tur.png', 'Setup awal saat pertama dipasang', 'Tur & panduan per halaman')
for t in ['**Setup awal langkah demi langkah:** data usaha, cara berjualan, akun Owner, kode pemulihan, lalu (boleh '
          'dilewati) logo & struk, rekening, email, cadangan, akun karyawan, data awal.',
          '**14 tur di dalam aplikasi:** menyorot bagian layar dan menjelaskan gunanya; ditawarkan saat menu pertama '
          'kali dibuka dan bisa diulang kapan saja.',
          '**Data contoh** untuk latihan, yang dapat dinonaktifkan sekaligus sebelum mulai sungguhan.',
          '**Buku SOP** (21 prosedur baku, daftar periksa harian/mingguan/bulanan) dan **Buku Panduan** per peran, '
          'siap dicetak.']:
    poin(t)

h2('3.15 Mutu aplikasi dan keterbatasan yang perlu diketahui')
tabel(['Aspek', 'Keadaan pada versi 1.18.0'], [
    ['Pengujian otomatis', '449 tes aturan bisnis dengan database sungguhan + 29 tes perhitungan bersama + 53 berkas '
     'uji ujung-ke-ujung di peramban; 5 alur kritis wajib lulus sebelum '
     'setiap pembaruan'],
    ['Ketepatan uang & jumlah', 'Uang disimpan dalam rupiah bulat (tanpa pecahan koma yang bisa meleset); jumlah '
     'barang sampai 3 angka di belakang koma (mis. 1,5 m³ pasir)'],
    ['Keutuhan data', '59 tabel dengan aturan pengaman di database; stok diubah satu pintu dengan penguncian baris '
     'sehingga dua kasir bersamaan tidak membuat stok kacau; klik ganda tidak membuat transaksi ganda'],
    ['Kecepatan', 'Uji 5.000 barang: pencarian 5–28 milidetik'],
    ['Keamanan', 'Lihat Bab 12'],
], lebar=[3.8, 12.8], judul='Mutu aplikasi')
kotak('Keterbatasan (disampaikan apa adanya)', [
    '•  Aplikasi **tidak tersambung langsung ke bank**: transfer/EDC/QRIS dicocokkan manual dengan mutasi rekening '
    '(ada layar khususnya).',
    '•  Bila **komputer server mati**, aplikasi tidak bisa dipakai sampai menyala lagi (tidak ada mode luring di '
    'perangkat lain). Karena itu UPS dan cadangan harian wajib.',
    '•  Cetak struk langsung tanpa jendela cetak hanya di **Chrome/Edge**.',
    '•  Belum mencakup **PPN/faktur pajak**, **akuntansi penuh** (neraca, jurnal), **multi-gudang/cabang**, dan '
    '**WhatsApp otomatis**.',
    '•  Akses HP/tablet bergantung pada **Tailscale** (layanan pihak ketiga; berbayar untuk usaha, lihat Bab 5).',
])
