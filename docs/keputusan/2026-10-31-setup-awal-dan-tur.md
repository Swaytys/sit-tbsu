# Uji Setup v3: setup awal, tur fitur, aplikasi umum (31 Oktober 2026, K-205–K-211)

Pemilik mencoba Setup v3 (versi 1.15.0) di laptop. Layar pembuka dinilai bagus. Masukan dan keputusan dicatat di
bawah. Status tiap butir diperbarui saat dikerjakan.

## Temuan

Setelah memasang, pemilik langsung bertemu halaman **Masuk ke Sistem** dan tidak bisa masuk. Penyebab: folder data
`%LOCALAPPDATA%\BonsaiUrip` masih berisi database dari Setup v2 (dibuat 26 Oktober). Setup v2 membuat akun Owner
dengan password acak yang hanya tampil sekali di jendela. Setup v3 memakai data itu lagi (sesuai rancangan: memperbarui
tidak menghapus data), sehingga halaman *Buat akun pertama* tidak muncul karena akun sudah ada. Pemilik tidak punya
jalan keluar di layar.

## Keputusan

- **K-205 Setup awal di aplikasi (wizard pemakaian pertama).** Pemakaian pertama bukan halaman login, melainkan
  rangkaian form langkah demi langkah seperti aplikasi umum: data usaha (jenis usaha, nama, slogan, alamat, kontak,
  logo), cara operasional (jenis penjualan yang dipakai, cara bayar dan rekening, jam shift), akun Owner (data diri
  lengkap), kode pemulihan, cadangan, lalu data awal (contoh atau mulai kosong). Setelah selesai baru masuk aplikasi.
  Isian disimpan ke pengaturan yang sama dengan Pengaturan, jadi tidak perlu membuka Pengaturan lagi. Bisa diulang dari
  Pengaturan (isian lama tampil, data transaksi tidak tersentuh). *Rencana.*
- **K-206 Tur fitur di dalam aplikasi.** Setelah setup, layar menyorot bagian-bagian aplikasi (menu, topbar, tombol
  utama) dengan penjelasan rinci, lalu tur per fitur (mis. cara membuat order, menerima bayaran, membuka shift). Tiap
  tur bisa dilewati; semua tur dan setup awal bisa diulang dari Pengaturan. Tur menyesuaikan peran pengguna. *Rencana.*
- **K-207 Aplikasi umum.** Nama dan alamat toko tidak tertulis mati di kode (layar pembuka, halaman masuk); diambil
  dari data usaha hasil setup. Sebelum setup, layar memakai merek aplikasi BonsaiUrip dengan slogan umum. *Rencana.*
- **K-208 Buku SOP dan buku panduan.** Setelah K-205–K-207: buku SOP (standar penggunaan per peran: buka toko,
  transaksi, pengantaran, tutup shift, koreksi, cadangan) dan buku panduan (guide book) lengkap. Panduan cepat HTML
  (Setup v3) tetap ada sebagai ringkasan. *Rencana.*
- **K-209 Lupa password lewat email.** Pertanyaan pemilik: bisakah lupa password memakai kode verifikasi ke email.
  Jawaban: bisa bila komputer tersambung internet dan email pengirim toko (SMTP) sudah diatur; kode pemulihan tetap
  ada sebagai cara tanpa internet. **Pilihan pemilik (31 Okt): email + kode pemulihan.** Kode 6 angka ke email
  pengguna, berlaku 10 menit; kode pemulihan kertas tetap berlaku. *Rencana.*
- **K-210 Skrip buat Setup sekali klik.** Pemilik bisa membuat Setup .exe versi terbaru sendiri tanpa meminta
  pengembang: satu berkas yang diklik dua kali di folder repo, memeriksa prasyarat, membangun, dan membuka folder
  hasil. Bila ada bagian baru aplikasi yang perlu ikut paket, pengembang memperbarui skrip itu. Skrip berulang lain
  (uji penuh, nyalakan dev, perbarui database) dibuat dengan cara yang sama. *Rencana.*
- **K-211 Jalan keluar data lama tanpa akun yang bisa dipakai.** Pemasangan di atas data lama yang akunnya tidak bisa
  dimasuki harus punya jalan keluar yang aman dan jelas (bukan menghapus folder diam-diam). **Pilihan pemilik
  (31 Okt): keduanya.** (1) Menu Start › *Pulihkan akses Owner*: hanya dari akun Windows komputer itu, membuat
  password sementara dan kode pemulihan baru. (2) Setup menawarkan *Mulai dari nol*: data lama dipindah ke folder
  cadangan (bukan dihapus) dengan konfirmasi dua kali. *Rencana.*

Pilihan pemilik lain (31 Okt): setup awal mewajibkan data usaha inti (nama, jenis, alamat, telepon) dan akun Owner +
kode pemulihan; langkah lain boleh *Lewati, atur nanti* dengan pengingat di Dashboard. Tur tampil untuk tiap pengguna
sesuai perannya pada saat pertama masuk.

## Urutan pengerjaan

1. K-210 skrip buat Setup (cepat, langsung membantu pemilik).
2. K-207 + K-205 setup awal (API + layar), termasuk K-211.
3. K-206 tur fitur.
4. K-209 bila disetujui.
5. K-208 buku SOP dan panduan.
6. Lalu K-204 bagian 2 (HP/tablet).
