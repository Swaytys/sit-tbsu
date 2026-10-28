# Masukan pemilik sebelum deploy (25 Oktober 2026, K-168–K-186)

Status: dicatat semua. Yang ditandai **Selesai** dikerjakan 25 Oktober; sisanya **Rencana** berurutan menurut
prioritas di bagian akhir.

## Keputusan

- **K-168 Mode demo terpisah, data awal asli.** Masuk cepat per peran dan data demo/e2e tidak ada di produksi
  (sudah: rute masuk cepat 404 saat `NODE_ENV=production`; database produksi hanya berisi seed). Ditambah: *mode demo*
  sebagai pemasangan sendiri (database demo terpisah), dan **panduan penyiapan pertama** (wizard) saat aplikasi
  pertama kali dibuka: profil toko → rekening → pengguna → impor barang/stok → pelanggan/pemasok → printer, dengan
  pilihan memuat **5 contoh data per jenis** bernama wajar (mis. "Semen Gresik 40 kg", "Toko Bangunan Makmur",
  "CV Sumber Rejeki") yang berbeda dari data demo dan bisa dihapus/dinonaktifkan sekali klik. *Rencana.*
  **Panduan dan contoh selesai (28 Okt):** halaman *Panduan penyiapan* (Owner/Admin; dibuka setelah akun pertama,
  tombol di Pengaturan, pengingat di Dashboard yang bisa disembunyikan) berisi 9 langkah berurutan: profil toko,
  rekening, akun karyawan, barang, stok awal, pelanggan, pemasok, kendaraan & sopir (bila perlu), printer struk
  (bila perlu). Status dihitung dari data asli; profil ditandai "sudah diperiksa". Tombol *Isi contoh* membuat
  5 barang (tanpa stok: saldo awal tidak bisa dihapus), 5 pelanggan, 5 pemasok, 2 kendaraan + 2 sopir bertanda
  "Data contoh"; *Nonaktifkan semua contoh* menonaktifkannya sekali klik (data master tidak dihapus). Mode demo
  sebagai pemasangan terpisah belum dibuat (ikut Setup v3).
- **K-169 Atribut dimensi ↔ data muatan satu sumber.** Panjang/lebar/tinggi/berat di atribut dan di data muatan
  harus satu data: mengisi salah satu mengisi yang lain. Aturan: barang tidak curah memakai P × L × T; barang curah
  memakai volume. Bila atribut dimensi dan volume sama-sama diisi, sistem memeriksa keselarasan (P × L × T dibanding
  volume, toleransi pembulatan) dan menolak/memperingatkan bila berbeda; volume yang selaras dihitung otomatis dari
  P × L × T. Contoh barang yang wajar memiliki keduanya: dus/kotak kemasan (dimensi luar) dengan isi cairan dalam
  liter (cat 5 L dalam kaleng 20 × 20 × 25 cm) — di sini volume isi ≠ volume kemasan, jadi atribut "isi" (liter)
  diperlakukan sebagai atribut produk, bukan volume muatan. *Rencana.*
- **K-170 Barang tanpa data muatan di order pengantaran.** Notifikasi "N barang di order pengantaran belum punya
  data muatan", lencana di kartu pengantaran dan di Data Barang, serta tautan langsung ke isian muatan barang itu.
  *Rencana.*
- **K-171 Hot page penjualan langsung/pengantaran pas layar.** Tombol untuk menggulir panel yang sedang fokus
  (atas/bawah) dan pindah fokus kiri/kanan; tulisan "(Menghitung…)" diganti ikon kecil (**Selesai**); kotak
  "Belanja Rp … lagi" diperkecil, bilah pintasan dipindah sejajar tab Kasir/Riwayat/Belum diambil. *Sebagian.*
- **K-172 Lencana topbar responsif.** Lencana shift (mis. "Shift kemarin belum ditutup") tidak boleh meluap saat
  layar dipersempit (**Selesai**: teks dipendekkan dan disembunyikan di layar sempit, tetap ada judul lengkap).
- **K-173 Kartu Pengiriman lebih informatif.** Tombol info cepat (pop-up: pelanggan, telepon, catatan, barang),
  **nomor antrean** tampil tebal di kartu (kode pendek yang mudah diingat, juga setelah dibagi), warna untuk kartu
  hasil pembagian/surat jalan sebagian, penanda hari ini vs sebelumnya, dan saringan Backlog. *Rencana.*
  **Selesai (28 Okt):** kartu Backlog dan surat jalan menampilkan **#nomor antrean** tebal (dari order asal, sama
  walau order dibagi); garis kiri biru = order baru, kuning + *Sisa dibagi* = sisa order yang sebagian sudah masuk
  rit, oranye + *Kirim ulang*; lencana *Hari ini* atau tanggal; tombol (i) membuka info cepat (pembeli, telepon,
  alamat, catatan kirim, barang belum dikirim); saringan Backlog *Semua / Hari ini / Lebih lama*.
- **K-174 Alur surat jalan dibenahi (kritis).** Surat jalan baru dibuat setelah order masuk rit yang sudah punya
  kendaraan dan sopir; membagi order (sebagian) tidak membuat surat jalan; grup "Belum direncanakan" dihapus;
  saat **Berangkat** semua surat jalan rit dicetak/diunduh (pilihan cetak atau unduh) dan rit tidak bisa berangkat
  bila ada order tanpa surat jalan. Bug: berangkat tidak memunculkan cetak surat jalan. **Selesai (26 Okt):**
  surat jalan wajib memilih rit dan langsung berisi sopir/kendaraan rit; masuk rit sebagian lewat dialog qty + rit
  (papan, detail invoice, tombol S kasir; rit baru bisa dibuat dari dialog); keluar dari rit atau batal rit
  membatalkan surat jalan sehingga order kembali ke Backlog; berangkat langsung tanpa rit dihapus; dialog
  Berangkat memberi pilihan 1 Cetak / 2 Simpan PDF / 3 Tidak sekarang dan mencetak semua surat jalan rit dalam
  satu jendela; tombol Cetak di grup rit dan kartu Di jalan. Kolom baru di antara Backlog dan Dijadwalkan tidak
  dibuat: grup rit sudah memisahkan yang dikerjakan sekarang dari yang menunggu.
- **K-175 Kembali ke halaman asal.** Detail invoice yang dibuka dari Pengiriman kembali ke Pengiriman (**Selesai**).
- **K-176 Penyelesaian hasil pengantaran.** Kolom *ditolak* diganti alasan per barang (kelebihan, salah barang,
  rusak saat dicek, rusak di jalan); barang kembali utuh mengurangi tagihan otomatis; pengembalian uang lewat
  transfer menjadi tugas lanjutan dengan status *menunggu transfer → sudah ditransfer* (rekening boleh diisi
  belakangan, bukti/konfirmasi wajib). Kartu hasil diberi penanda: terkirim semua / sebagian kembali / ada rusak.
  **Selesai (28 Okt):** kolom *Ditolak* dihapus; *Kembali utuh* dan *Rusak* wajib beralasan. Kembali karena
  kelebihan/salah barang/pembeli batal mengurangi tagihan otomatis (stok kembali); *kirim ulang nanti* tetap
  dikirim lagi. Rusak di jalan / saat dicek ditanggung toko (dikirim pengganti atau tagihan dikurangi, retur
  terpisah). Refund transfer menjadi tugas *Retur Penjualan › Refund transfer* (menunggu → sudah ditransfer,
  rekening boleh diisi saat konfirmasi, nomor referensi wajib), dengan notifikasi lonceng. Penanda hasil di kartu
  Di jalan dan Selesai hari ini.
- **K-177 Seret kartu dengan keyboard** (Spasi angkat, panah pindah urutan/kolom, Spasi lepas) belum berfungsi;
  diperbaiki. **Selesai (26 Okt):** sebabnya, papan hanya mengenali tempat lepas dari posisi mouse. Kini panah
  melompat ke tempat lepas terdekat ke arah itu (kolom Backlog atau grup rit; grup tujuan berbingkai biru), Spasi
  melepas, Esc membatalkan. Urutan kartu di dalam satu kolom tidak bisa diatur manual: Backlog berurut tanggal
  invoice dan grup rit berurut rit terbaru, sehingga "pindah urutan" tidak punya arti di data (usulan bila perlu
  prioritas antar order: kolom prioritas). Ikut diperbaiki: Backlog bisa tidak menampilkan order baru bila banyak
  invoice lama yang barangnya sedang di rit (batas 100 invoice tertua); kini invoice yang seluruh barangnya sudah di
  surat jalan aktif tidak ikut dihitung.
- **K-178 BBM dan servis dihapus dari v1.** Pencatatan BBM/servis tanpa integrasi jarak dan peta tidak sepadan
  dengan beban input; ditunda ke versi dengan pembukuan (v4/v5). Tab BBM, Servis, dan Statistik disembunyikan
  (**Selesai**); data dan tabel tetap utuh. Pengingat STNK/KIR tetap.
- **K-179 Order pembelian di Penerimaan Barang.** Halaman Penerimaan menampilkan order pembelian yang menunggu
  barang/konfirmasi dengan tombol Terima (**Selesai**).
- **K-180 Isian otomatis dan saran alasan.** No. HP pembeli terisi dari data pelanggan (**Selesai** untuk "Simpan
  untuk diambil nanti"). Kotak alasan memakai saran sesuai konteks (batal order, void, retur, tutup PO, buka
  kembali arsip, dll.) yang bisa diklik lalu diubah (**Selesai** untuk komponen bersama dan dialog batal order;
  dialog lain menyusul). **Selesai seluruhnya (28 Okt):** saran alasan juga di tolak/batal pengajuan retur-void,
  ajukan void, buka kembali arsip, kecualikan barang dari opname, koreksi modal shift, batal surat jalan, batal rit;
  kotak `window.prompt` batal surat jalan di detail invoice diganti dialog beralasan.
- **K-181 Info cepat di setiap kode.** Setiap kode dokumen/data yang tampil di elemen interaktif (linimasa kas,
  daftar, kartu) punya tombol info cepat (pop-up ringkas: barang, qty, total, pembeli, pengguna, status). *Rencana.*
  **Selesai (28 Okt):** tombol (i) di samping nomor dokumen membuka info cepat (jenis, pihak, status, waktu,
  total/sisa/pengguna, sampai 12 barang, tautan halaman lengkap) untuk invoice/struk, order, surat jalan, rit, retur,
  dan void; izin sama dengan halaman detailnya (`GET /api/info-cepat?nomor=`). Dipasang di linimasa kas shift,
  aktivitas terkini Dashboard, riwayat penjualan, daftar retur, dan papan Pengiriman. Dokumen pembelian (PO,
  penerimaan) menyusul.
- **K-182 Laporan per halaman A4.** Menu jenis laporan pindah ke atas; pratinjau dibagi per halaman A4 (1, 2, 3, …)
  dengan ukuran besar dan jelas seperti pratinjau cetak. *Rencana.*
- **K-183 Pemeriksaan data diperluas** ke nama/alamat ganda, barang tanpa harga/kategori/satuan, data muatan kosong,
  dll. *Rencana.*
- **K-184 Harga dasar FIFO.** FIFO ditambahkan sebagai pilihan; penjelasan bahwa *harga beli terakhir* (latest cost)
  bukan LIFO: latest cost memakai satu harga terakhir untuk semua stok, LIFO menghitung lapisan stok dari pembelian
  terbaru sampai habis. *Rencana.*
- **K-185 Promo: sasaran AND bertingkat dan potongan setelah beli N.** Satu kelompok sasaran = kategori AND merk AND
  barang (mengerucut); boleh banyak kelompok (OR antar kelompok). Jenis baru: *beli N potong Rp X* (mis. beli 2
  potong Rp 2.000). "Harga khusus per satuan" dijelaskan ulang di "?" (harga jual menjadi angka tetap, bukan
  dipotong) atau digabung bila membingungkan. *Rencana.*
- **K-186 Aplikasi saat ditutup.** Menutup tab/jendela saat shift masih terbuka memunculkan peringatan peramban
  (**Selesai**); aplikasi menyala otomatis saat Windows dimulai (server sudah; pintasan peramban di folder Startup
  ditambahkan pemasang, **Selesai**). Shift yang tertinggal terbuka tetap aman: muncul sebagai "Shift kemarin belum
  ditutup" dan bisa ditutup belakangan (alur K-134). Menahan penutupan jendela sepenuhnya tidak bisa dilakukan
  halaman web.

- **K-187 Surat jalan 2 rangkap.** Satu kali cetak menghasilkan 2 lembar dengan keterangan di bawah: "ASLI - Arsip
  Toko (Kembali bersama Sopir)" dan "SALINAN - Arsip Customer / Penerima". Pilihan *Cetak surat jalan 2 rangkap* di
  Pengaturan › Struk & printer › Invoice, surat jalan & kertas (bawaan menyala; konfigurasi
  `surat_jalan_rangkap`). **Selesai.**

- **K-188 Pemasang tanpa terminal.** Bug: pemasangan berhenti karena password `postgres` salah/lupa dan akun dev
  `sit` dipakai ulang. Diperbaiki: berkas **Pasang BonsaiUrip** (klik dua kali, minta izin Administrator), semua
  isian lewat jendela, akun database aplikasi sendiri `bonsai`/`bonsaiurip` dengan password acak, jalan keluar
  "Saya lupa" (izin lokal sementara, pg_hba.conf dikembalikan), jendela akhir berisi password Owner yang bisa
  disalin. **Selesai.** **Setup-BonsaiUrip.exe** (Inno Setup, 37 MB) **selesai 25 Okt**: membawa Node dan hasil
  build, wizard, ikon, pintasan; dibuat dengan `installeruat-installer.ps1`. Lanjutan (*Rencana*, v2): membawa
  PostgreSQL portabel (port 5433, password acak) agar tidak butuh PostgreSQL terpasang dan tanpa password postgres.
- **K-188 v2 Aplikasi desktop mandiri (26 Oktober).** Percobaan Setup v1 gagal berulang di komputer pemilik
  (modul hilang karena tautan pnpm, `.env` lama, nama pintasan, password `postgres`, HTTPS/port 443) karena
  rancangannya bergantung pada banyak hal di luar aplikasi dan tidak bisa diuji tanpa hak Administrator. Rancangan
  diganti mengikuti pola aplikasi desktop: **PostgreSQL ikut di dalam Setup** (dibuat sendiri pada pemakaian pertama,
  password acak, port pribadi 54329, hanya localhost), **dipasang per pengguna tanpa hak Administrator**,
  **BonsaiUrip.exe** (peluncur berikon) menyalakan database + server lalu membuka `http://localhost:7878` (localhost
  dianggap aman oleh peramban: cookie sesi dan cetak struk langsung tetap berfungsi, tanpa sertifikat), data di
  `%LOCALAPPDATA%\BonsaiUrip` terpisah dari program (pembaruan/hapus aplikasi tidak menghapus data), password awal
  Owner tampil sekali di jendela dan tersalin otomatis. Diuji di komputer pengembang dari folder ber-spasi: database
  dibuat, migrasi 34/34, login owner 200, matikan 7 detik, nyala ulang 17 detik, password tidak dibuat ulang,
  masuk-cepat 404. Setup 54 MB. **Selesai.** Mode server jaringan (HTTPS, banyak komputer) tetap lewat
  `fase-8-pasang-server.md`; cadangan otomatis dari Setup dan tanda tangan digital Setup: *Rencana*.
- **K-190 Log aktivitas untuk penelitian.** Ekspor log aktivitas ke Excel **sudah ada** sejak 24 Oktober
  (Pengaturan › Log aktivitas › pilih tanggal › *Ekspor Excel*); kalimat "belum bisa diekspor" berasal dari status
  lama di laporan fitur dan sudah diperbarui. Tambahan (*Rencana*, sebelum turun lapangan): **log interaksi rinci**
  untuk data penelitian (DeLone & McLean: penggunaan sistem, kepuasan pengguna): halaman dibuka dan lamanya, tombol/
  menu yang diklik, pintasan keyboard, pencarian (kata dan jumlah hasil), dialog dibuka/dibatalkan, galat yang
  tampil ke pengguna, waktu menyelesaikan alur (mis. order → bayar). Rancangan: tabel terpisah `log_interaksi` (log
  audit `log_aktivitas` tetap ringkas), dikumpulkan di tampilan dan dikirim berkelompok, **tidak mencatat isi
  ketikan** (hanya nama elemen; password, nominal, data pribadi tidak direkam), dinyalakan/dimatikan Owner di
  Pengaturan dengan pemberitahuan ke pengguna (etika penelitian), dapat disaring per pengguna/periode/halaman, dan
  diekspor CSV/Excel untuk diolah. Pilihan yang perlu diputuskan pemilik: tingkat rincian (klik semua elemen atau
  hanya aksi bermakna) dan lama penyimpanan data. **Selesai (26 Okt):** *Pengaturan › Log interaksi* (Owner):
  nyala/mati (bawaan mati) dan tingkat rincian dipilih sendiri di layar (*Semua elemen yang diklik* atau *Tombol,
  tautan, menu saja*); tabel saring jenis/pengguna/halaman/tanggal; ekspor Excel dan CSV. Yang dicatat: halaman dan
  lamanya, klik (label elemen), pintasan (F-key, Ctrl/Alt, huruf di luar kotak isian), dialog buka/tutup + lama,
  pencarian (jumlah hasil; kata hanya pencarian barang, lainnya panjang kata), galat yang tampil. Isi kotak isian
  tidak dibaca; server menyamarkan deret ≥ 7 angka. Pengguna diberi tahu sekali per sesi. Tabel `log_interaksi`
  (migrasi 0034). Waktu menyelesaikan alur (order → bayar) dihitung dari data ini saat diolah (urutan halaman, klik,
  dan waktu per sesi), tidak dicatat terpisah. **Masih menunggu pemilik:** lama penyimpanan. Sementara semua data
  disimpan; menghapus data lama berarti pengecualian aturan log append-only, jadi perlu persetujuan.
- **K-191 Setup v3 standar komersial (26 Oktober; dikerjakan SETELAH backlog sistem selesai, diuji, dan direvisi
  pemilik).** Setup v2 sudah berjalan di komputer pemilik. Untuk v3:
  1. **Layar pembuka (splash)** bermerek BonsaiUrip dengan animasi saat aplikasi dibuka, menggantikan kotak
     "Menyiapkan..." yang tidak standar.
  2. **Tanpa password bawaan di jendela pesan.** Pemakaian pertama membuka halaman **Buat akun pertama** (nama,
     nama pengguna, password, pertanyaan/kode pemulihan) sebelum halaman masuk; halaman ini hanya ada selama belum ada
     satu pengguna pun (masuk K-168, dikerjakan bersama backlog sistem).
  3. **Lupa password / pemulihan akun** (terutama Owner): kode pemulihan sekali pakai yang dibuat saat akun pertama
     dibuat dan bisa dicetak/disimpan, ditambah reset oleh Owner/Admin untuk pengguna lain (masuk backlog sistem).
     **Butir 2 dan 3 selesai (26 Okt):** halaman *Buat akun pertama* (nama, username, password, ulangi) muncul
     sendiri dari halaman masuk selama belum ada pengguna; akun menjadi Owner dan langsung masuk. Kode pemulihan
     XXXXX-XXXXX-XXXXX-XXXXX tampil sekali dengan tombol Salin/Unduh berkas/Cetak dan centang "sudah menyimpan".
     *Lupa password?* di halaman masuk: username + kode + password baru (kode baru diberikan); tanpa kode: minta
     Owner/Admin reset di Data Pengguna (sudah ada). *Akun saya* › Kode pemulihan: buat ulang dengan password.
     Peluncur tidak lagi membuat password Owner acak dan BonsaiUrip.exe tidak lagi menampilkan jendela password
     (berlaku di Setup berikutnya; pemasangan v2 yang sudah punya akun tidak berubah). Tiga rute publik baru
     dicatat di docs/04 §7.
  4. **Keluar aplikasi yang jelas:** ikon di area notifikasi Windows (system tray, "Show hidden icons") dengan menu
     Buka BonsaiUrip / Matikan BonsaiUrip; menutup peramban tidak mematikan server (penjelasan di tutorial).
     Sementara (v2): menu Start › *Matikan BonsaiUrip*.
  5. **Pilih lokasi pemasangan** di wizard (boleh drive D:), ditambah halaman ringkasan yang menyebut folder program
     dan folder data. v2 memasang ke `%LOCALAPPDATA%\Programs\BonsaiUrip` tanpa bertanya, data di
     `%LOCALAPPDATA%\BonsaiUrip`.
  6. **Tutorial dari awal sampai akhir** (wizard Setup → akun pertama → pengaturan toko → transaksi pertama → keluar).
  7. **Keamanan di Windows:** tanda tangan digital (SmartScreen), izin folder data, enkripsi cadangan, kunci layar
     sesi; dibahas dengan pemilik sebelum v3.
  8. Periksa ulang kekurangan v2 yang ditemukan saat uji pemilik.
- **K-189 Identitas visual.** Tanda BonsaiUrip (bonsai krem di papan kayu walnut, dari logo Sumber Urip Bonsai)
  dipakai sebagai ikon tab, sidebar, dan halaman masuk (`apps/web/public/favicon.svg`, `logo-bonsaiurip.svg`).
  **Selesai.** Ikon .ico dipakai Setup dan BonsaiUrip.exe (K-188 v2).

## Urutan pengerjaan berikutnya

0. K-190 log interaksi untuk penelitian (diminta sebelum turun lapangan).

1. K-174 alur surat jalan (kritis), K-177 seret keyboard.
2. K-168 panduan penyiapan pertama + contoh data asli.
3. K-176 penyelesaian hasil pengantaran, K-173 kartu Pengiriman.
4. K-181 info cepat, K-180 saran alasan di semua dialog, K-171 sisa.
5. K-169, K-170 data muatan.
6. K-182 laporan A4, K-185 promo, K-184 FIFO, K-183 pemeriksaan data.
