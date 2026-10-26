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
- **K-174 Alur surat jalan dibenahi (kritis).** Surat jalan baru dibuat setelah order masuk rit yang sudah punya
  kendaraan dan sopir; membagi order (sebagian) tidak membuat surat jalan; grup "Belum direncanakan" dihapus;
  saat **Berangkat** semua surat jalan rit dicetak/diunduh (pilihan cetak atau unduh) dan rit tidak bisa berangkat
  bila ada order tanpa surat jalan. Bug: berangkat tidak memunculkan cetak surat jalan. *Rencana (prioritas 1).*
- **K-175 Kembali ke halaman asal.** Detail invoice yang dibuka dari Pengiriman kembali ke Pengiriman (**Selesai**).
- **K-176 Penyelesaian hasil pengantaran.** Kolom *ditolak* diganti alasan per barang (kelebihan, salah barang,
  rusak saat dicek, rusak di jalan); barang kembali utuh mengurangi tagihan otomatis; pengembalian uang lewat
  transfer menjadi tugas lanjutan dengan status *menunggu transfer → sudah ditransfer* (rekening boleh diisi
  belakangan, bukti/konfirmasi wajib). Kartu hasil diberi penanda: terkirim semua / sebagian kembali / ada rusak.
  *Rencana.*
- **K-177 Seret kartu dengan keyboard** (Spasi angkat, panah pindah urutan/kolom, Spasi lepas) belum berfungsi;
  diperbaiki. *Rencana.*
- **K-178 BBM dan servis dihapus dari v1.** Pencatatan BBM/servis tanpa integrasi jarak dan peta tidak sepadan
  dengan beban input; ditunda ke versi dengan pembukuan (v4/v5). Tab BBM, Servis, dan Statistik disembunyikan
  (**Selesai**); data dan tabel tetap utuh. Pengingat STNK/KIR tetap.
- **K-179 Order pembelian di Penerimaan Barang.** Halaman Penerimaan menampilkan order pembelian yang menunggu
  barang/konfirmasi dengan tombol Terima (**Selesai**).
- **K-180 Isian otomatis dan saran alasan.** No. HP pembeli terisi dari data pelanggan (**Selesai** untuk "Simpan
  untuk diambil nanti"). Kotak alasan memakai saran sesuai konteks (batal order, void, retur, tutup PO, buka
  kembali arsip, dll.) yang bisa diklik lalu diubah (**Selesai** untuk komponen bersama dan dialog batal order;
  dialog lain menyusul).
- **K-181 Info cepat di setiap kode.** Setiap kode dokumen/data yang tampil di elemen interaktif (linimasa kas,
  daftar, kartu) punya tombol info cepat (pop-up ringkas: barang, qty, total, pembeli, pengguna, status). *Rencana.*
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
  hanya aksi bermakna) dan lama penyimpanan data.
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
