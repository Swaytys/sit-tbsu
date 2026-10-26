# 10 — Ringkasan Keputusan (K-001 s.d. K-167)

Dokumen ini merangkum **seluruh keputusan** yang dicatat di folder `keputusan/` selama pengembangan BonsaiUrip
(SIT TBSU): **167 keputusan dalam 31 berkas**, dari 19 September sampai 18 Oktober 2026.

Yang dirangkum di sini adalah **apa yang diputuskan** dan **apa yang berlaku sekarang**. Alasan lengkap, pilihan
yang ditolak, dan rincian teknis tetap ada di berkas keputusan aslinya. Bila ringkasan ini berbeda dengan berkas
keputusan atau dengan dokumen `01`–`06`, yang benar adalah berkas keputusan dan dokumen itu.

Isi dokumen:

1. [Cara membaca](#1-cara-membaca)
2. [Garis waktu](#2-garis-waktu)
3. [Tiga konsep yang paling banyak berubah](#3-tiga-konsep-yang-paling-banyak-berubah)
4. [Yang berlaku sekarang, per topik](#4-yang-berlaku-sekarang-per-topik)
5. [Keputusan yang diganti atau diubah](#5-keputusan-yang-diganti-atau-diubah)
6. [Daftar lengkap K-001 s.d. K-167](#6-daftar-lengkap-k-001-sd-k-167)
7. [Yang dijadwalkan sesudah ini](#7-yang-dijadwalkan-sesudah-ini)

---

## 1. Cara membaca

- **K-nnn** adalah nomor keputusan. Nomornya berurutan lintas berkas dan tidak pernah dipakai ulang.
- Berkas keputusan bersifat **hanya-tambah**: keputusan lama tidak diedit. Bila sebuah keputusan tidak lagi
  berlaku, keputusan baru yang menggantikannya menuliskan "menggantikan K-nnn". Karena itu, untuk mengetahui
  aturan yang berlaku hari ini, jangan membaca satu keputusan saja; lihat bagian 4 dan bagian 5 dokumen ini.
- Kolom **Status** di daftar lengkap (bagian 6) memakai nilai berikut:

  | Status | Artinya |
  |---|---|
  | Berlaku | Masih dipakai persis seperti diputuskan. |
  | Berlaku; dirinci / dilengkapi K-nnn | Masih dipakai; keputusan berikutnya menambah rincian tanpa membatalkannya. |
  | Sebagian diganti K-nnn | Sebagian isinya sudah tidak berlaku; sisanya masih. Bila butirnya disebut ("butir 1–3 diganti"), butir lain tetap berlaku. |
  | Diganti K-nnn | Seluruhnya sudah tidak berlaku. |
  | Selesai | Keputusan sementara yang sudah dituntaskan dan tidak perlu diingat lagi. |

- Keputusan yang berasal langsung dari pemilik proyek ditandai **(pemilik)** di berkas aslinya. Sejak K-092
  hampir semua keputusan lahir dari tinjauan pemilik setelah mencoba aplikasinya.
- Kode seperti `K9`, `PR10`, `PT6`, `H7` adalah nomor **aturan bisnis** di `05-aturan-bisnis-inti.md` dan
  `06-harga-piutang-hutang.md`. Keputusan menjelaskan *mengapa*; kedua dokumen itu memuat aturannya secara utuh.

---

## 2. Garis waktu

| Tanggal | Tahap | Keputusan | Yang diputuskan |
|---|---|---|---|
| 19 Sep | Fase 0 — Fondasi | K-001–K-049 | Bentuk aplikasi, teknologi, dan aturan dasar: stok, HPP, harga, diskon, retur, void, shift, hak akses, penomoran, ruang lingkup M1/M2. |
| 29 Sep | Fase 1 — Setup lingkungan | K-050–K-053 | Versi perangkat lunak dikunci; cara membuktikan skema database sama dengan rancangan. |
| 30 Sep | Fase 2 — Akses dasar | K-054–K-055 | Login, sesi, penjaga izin, kelola pengguna, pengaturan, log aktivitas. |
| 30 Sep | Fase 3 — Data master | K-056–K-065 | Barang, harga per tier, pelanggan, pemasok, merk, import dan ekspor Excel, logo toko. |
| 1–2 Okt | Fase 4 — Inti persediaan | K-066–K-069 | Penerimaan barang, penyesuaian, stok opname, kartu stok, peringatan stok. |
| 2–3 Okt | Fase 5 — Penjualan | K-070–K-074 | Order dan reservasi stok, checkout, surat jalan, piutang, antrean kasir, layar kasir serba keyboard, cetak struk. |
| 3 Okt | Fase 6 — Koreksi dan kontrol | K-075–K-077 | Shift dan clerical check, void, retur. |
| 4 Okt | Fase 7 — Laporan dan dashboard | K-078–K-081 | Laporan bergaya dokumen formal, tafsiran angka, dashboard per peran. |
| 4 Okt | Fase 8 — Pengerasan dan deploy | K-082–K-085 | Server di komputer toko, akses dari luar, keamanan, cadangan data, lima alur kritis. |
| 4–5 Okt | Fase 9 — Harga dan promo | K-086–K-087 | Mesin harga jual (markup, harga otomatis, Tinjau Harga) dan promo. |
| 7 Okt | Fase 10 — Hutang pemasok | K-088 | Hutang pemasok, retur ke pemasok, stok rusak, limit kredit, umur piutang dan hutang. |
| 7 Okt | Fase 11 — Konsinyasi | K-089 | Setoran barang titipan ke pemasok. |
| 7 Okt | Fase 12 — Label dan satuan jual | K-090–K-091 | Label barcode, Daftar Harga, satuan jual per barang. |
| 8 Okt | Tinjauan pemilik atas Fase 9–12 | K-092–K-093 | Siapa menanggung barang titipan yang rusak; pratinjau laporan, label thermal, qty di kotak cari. |
| 9 Okt | Tinjauan pemilik | K-094–K-096 | Harga otomatis menjadi bawaan, kemasan, draf order otomatis, pilihan cetak struk. |
| 10 Okt | Tinjauan pemilik: konsep harga dan persetujuan | K-097–K-099, K-101 | Tier harga menurut nilai belanja, promo menurut pembeli, persetujuan atasan di tempat, batas tanpa persetujuan. |
| 10 Okt | Tinjauan kode | K-100 | Pengerasan dan perapian kode tanpa mengubah aturan bisnis. |
| 11 Okt | Tinjauan pemilik | K-102–K-105 | Kode persetujuan sekali pakai lewat Telegram/email, struk langsung ke printer thermal, pengantaran tanpa order, penyiapan terpandu. |
| 12 Okt | Tinjauan pemilik | K-106–K-112 | Perapian tampilan, persetujuan ubah pelanggan, cari barang lewat atribut, aturan shift, anggaran promo, rekening toko dan cek uang non-tunai, cetak per jenis dokumen. |
| 14 Okt | Masukan dosen dan jawaban pemilik | K-113 | Rekomendasi pemesanan ulang, tablet untuk staf, ekspor log; Fase 14. |
| 17 Okt | Uji pemilik di laptop | K-114–K-119 | Tampilan muat, panduan printer umum, rencana tutup shift baru, order ditunda, dokumen riwayat teknis, database tes sendiri. |
| 18 Okt | Uji pemilik (printer RPP02 berhasil) dan uji lanjutan | K-120–K-145 | Prinsip anomali (atasi, cegah, ajari); shift tiga cara buka dan tutup dua langkah; order disimpan dan kembali ke draf; pencarian sebagian dan label keterjualan; cetak A4 tanpa jendela; order pembelian dan Hasil Penjualan masuk v1.0.0; metode rekomendasi pesan. |

Hubungan dengan versi (K-062): **v1.0.0** = akhir M1 (Fase 1–8); **v1.1–v1.4** = M2 (Fase 9–12); usulan sesudahnya
dikumpulkan di `08-backlog.md` sebagai v2.0.0 dan v3.0.0.

---

## 3. Tiga konsep yang paling banyak berubah

Tiga hal ini beberapa kali diputuskan ulang oleh pemilik setelah mencoba hasilnya. Urutannya penting karena
keputusan lama masih tertulis di berkasnya.

**Harga jual (tier)**

| Urutan | Keputusan | Konsep |
|---|---|---|
| 1 | K-011 | Tiap pelanggan punya tier bawaan; kasir boleh memilih tier per baris; sistem hanya menyarankan. |
| 2 | K-094 | Tier baris dipilih otomatis menurut jumlah beli (qty) barang itu. |
| 3 | K-097 | Tier pelanggan dihapus; tier hanya menurut qty; harga khusus pembeli pindah ke Promo. |
| 4 | K-098 | **Tier menurut total nilai belanja satu transaksi**, untuk semua barang; promo dipotong dari harga tier. |
| 5 | K-099 | Pilihan tier manual dihapus seluruhnya; tier aktif wajib punya syarat "Mulai belanja". **Ini yang berlaku.** |

**Persetujuan atasan (retur, void, limit kredit, ubah pelanggan)**

| Urutan | Keputusan | Konsep |
|---|---|---|
| 1 | K-017 | Atasan menyetujui dengan login di akunnya sendiri; tidak ada PIN. |
| 2 | K-099, K-101 | Toko hanya punya satu perangkat: atasan mengetik nama pengguna dan password-nya di layar kasir. |
| 3 | K-102 | Password atasan tidak lagi diketik di komputer kasir. Sistem mengirim **kode sekali pakai** ke Telegram/email atasan. **Ini yang berlaku.** |
| 4 | K-105 | Cara menyiapkan Telegram dan email dijadikan langkah terpandu; tombol uji selalu mengirim sungguhan. |
| 5 | K-107 | Kode yang sama dipakai untuk mengubah atau menonaktifkan pelanggan oleh Kasir/Staf. |

**Cetak struk**

| Urutan | Keputusan | Konsep |
|---|---|---|
| 1 | K-071 | Struk dicetak lewat jendela cetak peramban. |
| 2 | K-074 | Jendela cetak dilewati dengan membuka Chrome/Edge dalam mode cetak-senyap (`buka-kasir.cmd`). |
| 3 | K-095 | Pilihan: langsung cetak, tanya dulu, atau tidak dicetak. |
| 4 | K-103 | **Struk dikirim langsung ke printer thermal** (perintah ESC/POS), tanpa jendela cetak. **Ini jalur utama.** |
| 5 | K-105 | Penyiapan printer menjadi lima langkah terpandu; struk selalu potret dan bisa dicetak tebal. |
| 6 | K-112 | Memilih printer per jenis dokumen tidak bisa dilakukan peramban; menjadi syarat aplikasi desktop. |

---

## 4. Yang berlaku sekarang, per topik

### 4.1 Dasar aplikasi

- Aplikasi web yang dibuka di peramban, satu server dan satu database, dipakai bersamaan dari beberapa perangkat
  (K-001–K-003). Nama tampil **BonsaiUrip**, badan usaha "UD. Sumber Urip" (K-044).
- Uang selalu rupiah bulat; kuantitas boleh pecahan sampai tiga angka di belakang koma (0,5 m³ pasir); tidak ada
  hitungan yang memakai angka pecahan mengambang (K-013, K-058).
- **Transaksi tidak pernah diubah atau dihapus.** Kesalahan dikoreksi dengan dokumen baru: void, retur, atau
  penyesuaian. Data master (barang, pelanggan, pemasok, rekening) dinonaktifkan, tidak dihapus (K-021).
- Nomor dokumen berbentuk `PREFIX-YYMMDD-NNN`, urut per hari (K-022, K-045).
- Waktu disimpan dalam UTC dan ditampilkan dalam zona Asia/Jakarta; tanggal operasional memakai tanggal Jakarta
  (K-042).
- Bila mockup dan Laporan KP berbeda pada struktur atau logika, Laporan KP yang diikuti (K-032).
- Yang sengaja tidak dibuat: PPN, pesanan pembelian (PO) penuh, multi-gudang, batch dan kedaluwarsa, komisi
  sales, akuntansi penuh, nomor seri, kupon dan poin, WhatsApp, mode offline, aplikasi ponsel, editor peran (K-038).

### 4.2 Barang dan persediaan

- Stok punya tiga angka: **fisik**, **dipesan**, dan **tersedia** (fisik − dipesan). Order yang menunggu atau
  sedang diproses menahan stok; draf tidak (K-006, K-070).
- Semua perubahan stok lewat satu pintu (buku mutasi/ledger), sehingga kartu stok selalu bisa ditelusuri
  (K-060, K-070).
- HPP memakai **rata-rata tertimbang** dan diperbarui setiap penerimaan; tiap baris penjualan menyimpan HPP saat
  itu (K-008).
- Stok fisik tidak boleh diturunkan di bawah jumlah yang sedang ditahan order; order penahannya disebut di pesan
  (K-048).
- Status stok empat tingkat: Habis, Kritis, Perlu restock, Aman (K-023, K-068).
- Penerimaan barang selalu bertanggal hari ini. Pembelian tunai langsung lunas; pembelian tempo menjadi hutang
  (K-066).
- Stok opname: lembar hitung untuk semua barang atau satu kategori. Barang yang tidak dihitung **dikecualikan
  dengan alasan**, bukan dihapus dari lembar (K-067, K-069).
- **Stok rusak** dicatat terpisah; tidak dihitung sebagai stok jual maupun nilai persediaan. Keluar lewat retur ke
  pemasok atau pemusnahan (K-030, K-088).
- Kategori, merk, satuan, dan jenis atribut adalah data pilihan di halaman Referensi Barang (K-057, K-063).
- **Kemasan** (satuan jual): satuan dasar barang = satuan terkecil yang dijual; kemasan berisi lebih dari satu
  satuan dasar dan dijual dalam jumlah bulat. Satu barang boleh muncul di beberapa baris bila satuannya berbeda
  (K-091, K-094, K-095).
- Import Excel barang hanya **menambah** barang baru; baris yang salah bisa diperbaiki di layar; data barang bisa
  diekspor (K-056, K-061, K-064). Saldo awal stok juga bisa diimpor (K-067).
- Label barcode (kertas gulungan thermal atau A4) dan Daftar Harga dicetak dari aplikasi (K-090, K-093, K-094).

### 4.3 Harga jual

- Dasar harga = **harga beli terakhir**; harga jual = dasar + markup, dibulatkan ke atas ke kelipatan Rp 100
  (K-009, K-010).
- **Harga otomatis** menyala untuk semua barang: bila modal naik, harga jual langsung ikut naik; bila turun,
  harga tidak diturunkan sendiri melainkan menunggu ditinjau di tab Tinjau Harga (K-086, K-094).
- **Tier harga ditentukan total nilai belanja satu transaksi**, otomatis, untuk semua barang. Kasir tidak bisa
  memilih tier (K-098, K-099).
- Tier selain harga dasar selalu berarti "modal + markup tier" untuk semua barang. Hanya harga dasar yang boleh
  diisi rupiah tetap atau markup sendiri per barang (K-098).
- Tier yang aktif (selain harga dasar) wajib punya syarat "Mulai belanja" (K-099).
- Belanja lebih banyak tidak pernah membuat sebuah barang lebih mahal daripada harga dasarnya (K-098).
- Harga modal boleh belum diketahui saat barang dibuat; barang itu belum bisa dijual sampai punya harga (K-095).
- Harga manual (hasil tawar) hanya boleh Admin/Owner dan tercatat di log (K-011, K-099).
- Keterangan "Belanja Rp … lagi untuk harga …" ditampilkan menonjol di layar penjualan (K-106).

### 4.4 Promo dan diskon

- Diskon manual per baris dan per transaksi dibatasi menurut peran (K-012, K-070).
- Promo diterapkan otomatis, satu promo per baris. Urutannya: harga tier, lalu promo, lalu diskon manual
  (K-012, K-098).
- Sasaran barang: semua, satu kategori, atau satu barang. Sasaran pembeli: semua, satu **golongan pelanggan**,
  atau pelanggan tertentu. Syarat: minimal qty, minimal belanja, atau "pelanggan sudah belanja Rp X dalam N hari
  terakhir" (K-012, K-097).
- Promo tidak berlaku pada baris harga manual. Promo yang membuat harga jatuh di bawah modal dilewati bila
  penjualnya Staf atau Kasir (K-087).
- Aturan potongan dikunci setelah promo dipakai di penjualan (K-087).
- Promo diatur di **Pengaturan › Promo**. Daftarnya menampilkan jumlah potongan yang sudah diberikan (K-110).
- **Anggaran promo**: bila sisa anggaran lebih kecil dari potongan sebuah baris, baris itu dipotong sebesar
  sisanya; setelah habis, promo tidak dipakai lagi. Void mengembalikan anggaran; retur tidak (K-110).
- **Batas per pembeli**: potongan paling banyak untuk satu pembeli dari satu promo, supaya satu pembeli tidak
  menghabiskan anggaran. Pelanggan terdata dihitung dari semua transaksinya; pembeli umum dihitung per transaksi
  (K-110).

### 4.5 Penjualan

- Tiga pintu: **Order Penjualan** (Staf membuat order yang masuk antrean), **Penjualan Langsung** (kasir), dan
  **Penjualan Pengantaran** (invoice dan surat jalan). Pengantaran bisa dibuat langsung tanpa order (K-070,
  K-073, K-104).
- Antrean order tampil sebagai tiket bernomor, urut waktu masuk; order yang terlalu lama (bawaan 24 jam) ditandai
  basi dan diberitahukan (K-007, K-073).
- Isian order yang belum dikirim tersimpan otomatis sebagai draf dan tidak menahan stok (K-095, K-096).
- Layar kasir bisa dijalankan penuh dengan keyboard, dan **setiap tombol pintas juga bisa diklik** (K-073, K-104).
- **Cari barang**: semua kata yang diketik harus cocok, boleh di nama, kode, barcode, merk, kategori, atau
  atribut (contoh: `pipa 3 inch putih`). Ada pilihan kategori, tombol **Daftar** untuk melihat barang tanpa
  mengetik, dan foto kecil di hasil cari. Qty bisa diketik sekaligus: `3*semen` (K-093, K-108).
- **Cara bayar dipilih tegas** bila pembeli boleh belum lunas: Lunas, DP, Bayar nanti, atau Saat terima (K-104).
- **Bayar campuran**: satu tagihan dibayar dengan beberapa cara; tiap bagian bisa dihapus dan pesan galat tampil
  tepat di bawah kotak bayar (K-025, K-106).
- Tombol **Mulai dari awal** (F9) selalu bertanya dulu. Order dari antrean tidak dihapus, hanya dikembalikan ke
  antrean (K-106).
- Pelanggan pengantaran wajib punya No. HP dan alamat kirim (K-104).
- Satu invoice boleh dikirim dengan beberapa surat jalan; stok dipotong saat checkout, bukan saat dikirim
  (K-024, K-072).
- Penjualan langsung mencatat apakah barang sudah diambil atau belum (K-026).

- **Order disimpan** untuk pembeli yang mengambil nanti: wajib nama, No. HP, tanggal ambil paling lama 14 hari;
  stoknya ditahan, tidak masuk antrean, diingatkan bila lewat tanggal (tidak batal otomatis). Order di antrean,
  di kasir, atau disimpan bisa **dikembalikan ke draf** (stok dilepas, barang tetap) (K-122).
- Saat barang ditambahkan, staf diperingatkan bila barang itu juga ada di draf lain dan stoknya tidak cukup untuk
  semuanya (K-122).

### 4.6 Pembayaran non-tunai

- Metode pembayaran: Tunai, Transfer, EDC, dan **QRIS** (K-025, K-111).
- Rekening bank, mesin EDC, dan QRIS milik toko didaftarkan sekali di **Pengaturan › Pembayaran**. Kasir
  **memilih** dari daftar, tidak mengetik nomor rekening (K-111).
- Setiap pembayaran non-tunai dimulai dengan status **Belum dicek**. Admin/Owner mencocokkannya dengan mutasi
  bank, rekap EDC, atau riwayat QRIS di **Shift & Clerical Check › Cek uang non-tunai**, lalu menandai Sudah masuk
  atau Tidak masuk (K-111).
- Tanda "Tidak masuk" tidak mengubah penjualan; tindak lanjutnya dilakukan orang: menagih pembeli, atau
  mengoreksi lewat void/retur (K-111).
- Pemantauan otomatis uang masuk tidak tersedia secara gratis dan resmi; pilihan berbayar (payment gateway)
  dicatat untuk v2.0.0 (K-111).
- Refund lewat transfer memilih rekening toko dari daftar yang sama (K-111).

### 4.7 Pelanggan, piutang, dan limit kredit

- Penjualan yang belum lunas menjadi piutang dengan tanggal jatuh tempo (K-027, K-071). Umur piutang
  dikelompokkan: belum jatuh tempo, 1–30, 31–60, 61–90, dan lebih dari 90 hari (K-088).
- **Limit kredit** diperiksa saat checkout yang tidak lunas. Bila terlampaui, Kasir butuh kode atasan; Admin/Owner
  bisa melanjutkan sendiri (K-088, K-102).
- Term dan limit kredit hanya diatur Admin/Owner (K-059). Pelanggan baru memakai limit bawaan toko (K-104).
- Kasir dan Staf **bebas menambah** pelanggan baru, tetapi **mengubah, menonaktifkan, atau mengaktifkan kembali**
  pelanggan yang sudah ada butuh kode atasan. Kodenya terikat pada perubahan yang dibaca atasan (K-107).
- Daftar Data Pelanggan menampilkan limit kredit dan sisanya, tagihan berjalan, serta jatuh tempo terdekat
  (K-107).
- Golongan pelanggan (Distributor, Kontraktor, dan sebagainya) hanya dipakai sebagai sasaran promo, bukan penentu
  tier harga (K-097).

### 4.8 Shift dan kas

- **Satu shift untuk toko** (satu laci): dibuka/ditutup siapa pun yang berizin; semua uang tunai masuk shift itu
  dengan nama pencatatnya; status shift terlihat semua peran (K-132). Pembeli setelah tutup: buka shift baru
  (K-140). Kembalian yang tidak diambil dicatat kas masuk khusus (K-141).
- Semua uang tunai terikat pada shift. Kasir membuka shift dengan modal awal, mencatat kas masuk/keluar
  non-penjualan, lalu menutupnya dengan **menghitung uang lebih dulu** sebelum angka sistem tampil (K-018, K-071,
  K-075).
- **Buka shift tiga cara** dengan konfirmasi: sama dengan uang ditinggal kemarin, hitung sekarang (per pecahan),
  atau buka dulu lalu hitung nanti. Hitung susulan menghitung modal sebenarnya = hitungan − uang tunai bersih sejak
  buka, sehingga toko bisa melayani sebelum laci selesai dihitung (K-121).
- **Modal awal tidak pernah diubah**; salah ketik dibetulkan lewat *koreksi modal* beralasan: bebas sebelum ada
  transaksi tunai, sesudahnya dengan kode atasan (K-121).
- **Tutup dua langkah**: hitungan pertama terkunci; hasil, tinjauan shift, dan bantuan mencari selisih tampil
  sesudahnya; hitung ulang sekali; keterangan wajib di luar toleransi receh (bawaan Rp 1.000); uang ditinggal di
  laci menjadi usulan modal besok. Admin/Owner bisa menambah penjelasan selisih setelah tutup (K-121).
- Setiap fitur dianalisis anomalinya (atasi, cegah, ajari) di `12-anomali-alur-kerja.md` (K-120).
- **Sistem tidak pernah menutup shift sendiri**, karena menutup shift berarti menghitung uang di laci (K-109).
- **Shift terlewat mengunci**: shift yang masih buka dari hari sebelumnya membuat pemiliknya tidak bisa mencatat
  penjualan, pembayaran, kas, atau refund sampai shift itu ditutup (K-109).
- **Jadwal shift** (jam buka dan tutup) diatur Admin/Owner di Pengaturan › Operasional. Jadwal dibekukan ke shift
  saat shift dibuka; perubahan hanya berlaku untuk shift yang dibuka sesudahnya (K-109).
- Lewat jam tutup hanya **peringatan**: pembeli yang datang terlambat tetap dilayani. Atasan diberi tahu lewat
  lonceng dan Telegram/email, paling banyak sekali sehari per shift (K-109).
- Admin/Owner bisa menutup shift orang lain dari tab Semua shift (K-075, K-109).

### 4.9 Retur dan void

- **Void** membatalkan penjualan yang baru terjadi: hanya bila shift-nya belum ditutup, barang belum dikirim, dan
  belum ada retur (K-016, K-076). Baris barang titipan yang sudah disetor ke pemasok tidak bisa di-void (K-089).
- **Retur** punya tiga penyelesaian: uang dikembalikan, tukar barang sama (tukar guling), atau potong tagihan.
  Barang berkondisi baik kembali ke stok jual; rusak atau cacat masuk stok rusak (K-015, K-077).
- Uang yang dikembalikan tidak pernah melebihi yang sudah dibayar (K-077).
- Daftar transaksi yang bisa diretur langsung tampil tanpa mencari. Potong tagihan hanya ditawarkan bila transaksi
  itu masih punya sisa tagihan, dan sisanya ditampilkan (K-106).
- **Batas tanpa persetujuan**: retur atau void yang nilainya di dalam batas (bawaan Rp 0) langsung disetujui;
  batas dihitung per penjualan sehingga tidak bisa diakali dengan memecah pengajuan (K-099).
- Pengajuan yang masih menunggu boleh ditarik; yang sudah disetujui tidak bisa dibalik (K-099).
- Refund tunai keluar dari laci shift pengguna yang sedang login di perangkat itu (K-099).

### 4.10 Persetujuan atasan

- Pengaju yang sendirinya Admin/Owner langsung disetujui dan tercatat (K-017).
- Untuk Kasir/Staf, atasan menyetujui dengan salah satu cara: dari akunnya sendiri, atau dengan **kode sekali
  pakai** yang dikirim sistem ke Telegram dan/atau email atasan (K-102).
- Sifat kode: enam angka, berbeda untuk tiap atasan, berlaku 10 menit, sekali pakai, batal setelah 5 kali salah,
  dan terikat pada satu dokumen atau satu perubahan (K-102, K-107).
- Dipakai untuk: retur, void, melampaui limit kredit, dan mengubah/menonaktifkan pelanggan (K-102, K-107).
- Cara persetujuan tersimpan di dokumennya dan tampil di riwayat (K-099).
- Tanpa internet, persetujuan tetap bisa lewat akun atasan atau lewat batas tanpa persetujuan (K-102).
- Penyiapan Telegram dan email berupa langkah bernomor; tombol uji selalu mengirim pesan sungguhan dan melaporkan
  hasil apa adanya (K-105).

### 4.11 Pemasok, hutang, dan konsinyasi

- Pembelian tempo membentuk hutang; pembayaran dicatat per dokumen; umur hutang dikelompokkan seperti piutang
  (K-028, K-088).
- Retur ke pemasok punya menu sendiri; bisa mengurangi hutang, diganti barang, atau dikembalikan uangnya (K-088).
- **Konsinyasi (barang titipan)**: kepemilikan ditentukan per barang; stok titipan tidak masuk nilai persediaan
  toko (K-029).
- Setoran ke penitip dihitung dari barang titipan yang terjual sampai tanggal yang dipilih (K-089).
- Retur pelanggan atas barang titipan, apa pun kondisinya, mengurangi setoran. Barang titipan yang rusak
  diselesaikan dengan dua pilihan: dikembalikan ke penitip (penitip menanggung) atau dimusnahkan (toko mengganti)
  (K-092).
- Barang yang sama bisa didaftarkan sebagai "versi titipan" dengan stok dan harga terpisah (K-094).

### 4.12 Laporan dan dashboard

- Setiap laporan disusun sebagai dokumen formal: kop toko, judul, periode, ikhtisar, tabel, catatan, dan tanda
  tangan. Tampilan layar, cetak/PDF, dan Excel berasal dari satu sumber yang sama (K-078).
- Baris total menghitung seluruh data periode, bukan hanya halaman yang sedang tampil (K-033).
- Pratinjau laporan digambar seukuran kertas aslinya (K-093).
- Daftar laporan berupa pohon tiga kelompok (Persediaan, Penjualan, Keuangan) yang bisa dibuka dan ditutup
  (K-078, K-106).
- Kasir melihat laporan penjualan tanpa HPP dan laba; laporan nilai persediaan hanya untuk yang berizin melihat
  nilai (K-081).
- Dashboard berbeda per peran; Staf tidak melihat omzet (K-039, K-080).

### 4.13 Cetak

- **Struk**: dikirim langsung ke printer thermal lewat Chrome/Edge, tanpa jendela cetak. Bila printer gagal,
  penjualan tetap tersimpan dan kasir ditawari jendela cetak (K-103, K-105).
- Pilihan setelah bayar: langsung cetak, tanya dulu, atau tidak dicetak (K-095).
- **Invoice, surat jalan, dan laporan** dicetak A4 lewat jendela cetak peramban. Ukuran dan arah kertas sudah
  ditentukan tiap dokumen (K-071, K-078, K-112).
- Peramban mengingat printer terakhir dan tidak mengizinkan aplikasi memilih printer. Pengaturan printer per jenis
  dokumen menjadi syarat aplikasi desktop (K-112).

### 4.14 Hak akses dan keamanan

- Empat peran (Owner, Admin, Kasir, Staf Penjualan); tiap peran adalah kumpulan izin. Setiap alamat API wajib
  menyatakan izinnya, dan server menolak menyala bila ada yang terlewat (K-019, K-054).
- Harga modal, HPP, laba, dan harga titip disaring di server, bukan hanya disembunyikan di layar (K-020).
- Password disimpan sebagai hash; sesi memakai cookie yang tidak bisa dibaca skrip; login dibatasi lajunya dan
  akun terkunci setelah beberapa kali salah (K-054).
- Pengguna baru wajib mengganti password saat login pertama; kelola pengguna hanya Owner (K-055).
- Semua aksi yang mengubah data dicatat di log aktivitas; log hanya dilihat Owner (K-037, K-055).
- Token bot Telegram dan sandi email disimpan di server dan tidak pernah dikirim kembali ke layar; kode
  persetujuan hanya disimpan sebagai hash (K-102).
- Pengerasan dasar: header keamanan, batas ukuran kiriman, audit dependensi, batas waktu koneksi database
  (K-083, K-100).

### 4.15 Server, cadangan, dan pengujian

- Aplikasi dan database berjalan di satu komputer Windows di toko, lewat HTTPS di jaringan toko; pemilik
  mengakses dari luar lewat Tailscale (K-082).
- Cadangan otomatis harian, terenkripsi, ke disk kedua dan cloud, dengan uji pulih bulanan (K-084).
- Lima alur kritis wajib lulus sebelum server toko diperbarui (K-085).
- Setiap aturan bisnis punya tes otomatis dengan database sungguhan. Tes layar tidak pernah mengirim pesan
  Telegram/email sungguhan dan tidak bergantung pada tier harga yang sedang diaktifkan pemilik (K-106, K-107).
- **Aturan menulis petunjuk**: setiap bantuan dan panduan ditulis langkah demi langkah sampai tidak menyisakan
  pertanyaan (K-105).

---

## 5. Keputusan yang diganti atau diubah

| Keputusan lama | Diganti / diubah oleh | Yang berubah |
|---|---|---|
| K-010 (harga otomatis hanya pilihan per barang) | K-086, K-094 | Harga otomatis menjadi bawaan semua barang: naik langsung, turun ditinjau. |
| K-011 (tier bawaan pelanggan, dipilih kasir, saran qty) | K-094 → K-097 → K-098 → K-099 | Tier ditentukan total nilai belanja transaksi, selalu otomatis. |
| K-017 (penyetuju harus login di akunnya; tanpa PIN) | K-099 → K-102 | Ditambah persetujuan dengan kode sekali pakai. Bagian "pengaju Admin/Owner langsung disetujui" tetap berlaku. |
| K-022 (daftar prefix nomor) | K-045 | Ditambah prefix `PBP` untuk pembayaran ke pemasok. |
| K-025 (metode Tunai, Transfer, EDC; rekening diketik) | K-111 | Ditambah QRIS; rekening dipilih dari daftar rekening toko; pembayaran non-tunai dicek. |
| K-041 (nama tampil "SIT Sumber Urip") | K-044 | Nama tampil menjadi BonsaiUrip. |
| K-047 (tier bawaan wajib harga tetap) | K-094 | Tier bawaan boleh ikut markup. |
| K-051 (`GET /api/satuan` sementara tanpa izin) | K-054 | Izin dipasang di Fase 2; keputusan sementara selesai. |
| K-059 (tier, term, limit pelanggan hanya Admin/Owner) | K-097, K-107 | Tier pelanggan dihapus. Term dan limit tetap Admin/Owner; perubahan data lain oleh Kasir/Staf butuh kode atasan. |
| K-065 (pengaturan struk di Profil toko) | K-103 | Dipindah ke tab Struk & printer. |
| K-073 butir 11 (rekening bawaan di Pengaturan › Operasional) | K-111 | Diganti daftar rekening toko di Pengaturan › Pembayaran. |
| K-073 (F9 langsung membatalkan) | K-106 | F9 menjadi "Mulai dari awal" dan selalu bertanya dulu. |
| K-074 (cetak-senyap lewat `buka-kasir.cmd`) | K-103 | Menjadi cadangan; jalur utama adalah kirim langsung ke printer thermal. |
| K-076 butir 3 (refund tunai dari laci penyetuju) | K-099 | Refund tunai keluar dari laci pengguna yang login di perangkat itu. |
| K-079 butir 7 (umur piutang menyusul) | K-088 | Kelompok umur piutang dan hutang ditetapkan. |
| K-086 butir 1–2 (barang baru tidak otomatis; harga Normal wajib tetap) | K-094 | Keduanya dibalik. |
| K-087 (saran tier, tidak memaksa) | K-094 → K-098 → K-099 | Tier ditentukan sistem; tidak ada saran maupun pilihan. |
| K-089 butir 3 (hanya retur kondisi baik mengurangi setoran) | K-092 | Retur barang titipan apa pun kondisinya mengurangi setoran. |
| K-091 butir 3 (satu barang satu baris) | K-095 | Satu barang boleh beberapa baris bila satuannya berbeda. |
| K-094 butir 3 (tier otomatis menurut qty) | K-098 | Diganti tier menurut nilai belanja. |
| K-097 butir 1–3 (tier menurut qty; tier dan promo tidak digabung) | K-098 | Tier menurut nilai belanja; promo dipotong dari harga tier. Butir 4–6 tetap berlaku. |
| K-098 butir 3 (tier tanpa syarat bisa dipilih kasir) | K-099 | Tidak ada tier pilihan kasir. |
| K-099 butir 1 dan 4 (password atasan diketik di layar kasir) | K-102 | Diganti kode sekali pakai. |
| K-101 (limit kredit dengan password atasan di tempat) | K-102 | Diganti kode sekali pakai. |
| K-108 butir 1 (angka atribut dicocokkan utuh) | K-123 | Atribut dicocokkan sebagian ("1" menemukan 10, "c" menemukan cm). |
| K-116 (rencana tutup shift baru) | K-121 | Dirinci menjadi tiga cara buka, hitung susulan, koreksi modal, tutup dua langkah. |
| K-117 butir 1–2 (order ditunda, tahan stok opsional) | K-122 | Order *disimpan* selalu menahan stok, wajib nama, HP, dan tanggal ambil ≤ 14 hari. |
| K-038 sebagian (order pembelian tidak dibuat) | K-125 | Order pembelian ke pemasok masuk v1.0.0. |

---

## 6. Daftar lengkap K-001 s.d. K-167

### 6.1 Fondasi — `2026-09-19-keputusan-fondasi.md`

| K | Keputusan | Status |
|---|---|---|
| K-001 | Aplikasi web di peramban, satu server dan satu database; bukan berkas `.exe`. | Berlaku (aplikasi desktop direncanakan terpisah, lihat bagian 7) |
| K-002 | Teknologi: TypeScript, React, Hono, Drizzle, PostgreSQL, dalam satu repo. | Berlaku; versi dikunci K-050 |
| K-003 | PostgreSQL; rancangan skema v3 menjadi migrasi pertama. | Berlaku |
| K-004 | Alat kerja: chat arsitek untuk keputusan, Claude Code untuk menulis kode; penghubungnya `CLAUDE.md` dan `docs/`. | Berlaku |
| K-005 | Aturan nama berkas dokumen (bernomor untuk dokumen hidup, bertanggal untuk keputusan). | Berlaku |
| K-006 | Stok tiga angka; order menahan stok (reservasi). | Berlaku; dirinci K-070 |
| K-007 | Order basi ditandai dan diberitahukan; batal otomatis hanya bila diaktifkan. | Berlaku |
| K-008 | HPP rata-rata tertimbang; tiap baris penjualan menyimpan HPP saat itu. | Berlaku |
| K-009 | Dasar markup = harga beli terakhir. | Berlaku |
| K-010 | Harga jual disimpan, bukan dihitung ulang diam-diam; perubahan modal masuk Tinjau Harga. | Sebagian diganti K-086, K-094 |
| K-011 | Tier harga: tier bawaan pelanggan, pilihan tier per baris, saran menurut qty. | Diganti K-094 → K-097 → K-098 → K-099 |
| K-012 | Diskon manual dibatasi per peran; promo otomatis satu per baris. | Berlaku; dilengkapi K-087, K-097, K-098, K-110 |
| K-013 | Uang = rupiah bulat; kuantitas tiga desimal; tanpa angka pecahan mengambang. | Berlaku |
| K-014 | Satuan berdimensi, atribut barang, dan beberapa satuan jual per barang. | Berlaku; dirinci K-091, K-094 |
| K-015 | Retur: uang kembali, tukar barang, atau potong tagihan; kondisi baik/rusak/cacat. | Berlaku; dirinci K-077, K-092 |
| K-016 | Void: hanya penjualan di shift yang belum ditutup, belum dikirim, tanpa retur. | Berlaku; dirinci K-076 |
| K-017 | Penyetuju login dengan akunnya sendiri; pengaju Admin/Owner langsung disetujui. | Sebagian diganti K-099 → K-102 |
| K-018 | Shift kasir, kas shift, dan clerical check dengan hitung buta. | Berlaku; dirinci K-075, K-109 |
| K-019 | Hak akses berbasis izin; peran = kumpulan izin. | Berlaku |
| K-020 | Data sensitif disaring di server. | Berlaku |
| K-021 | Transaksi tidak diubah/dihapus; master dinonaktifkan; masuk cepat hanya di mode pengembangan. | Berlaku |
| K-022 | Bentuk nomor dokumen dan daftar prefix. | Berlaku; ditambah K-045 |
| K-023 | Empat status stok. | Berlaku; dirinci K-068 |
| K-024 | Satu invoice boleh punya beberapa surat jalan. | Berlaku; dirinci K-072 |
| K-025 | Metode bayar Tunai, Transfer, EDC; COD bukan metode; bayar campuran. | Berlaku; dilengkapi K-111 |
| K-026 | Penjualan langsung mencatat barang sudah diambil atau belum. | Berlaku |
| K-027 | Piutang dengan jatuh tempo; term dan limit per pelanggan. | Berlaku; dirinci K-072, K-088, K-107 |
| K-028 | Hutang pemasok dan retur ke pemasok (dikerjakan di M2). | Berlaku; dirinci K-088 |
| K-029 | Konsinyasi: kepemilikan per barang, setoran per pemasok. | Berlaku; dirinci K-089, K-092 |
| K-030 | Stok rusak dicatat terpisah. | Berlaku; dirinci K-088 |
| K-031 | Dua milestone: M1 (Fase 1–8) dan M2 (Fase 9–12). | Berlaku; versi di K-062 |
| K-032 | Laporan KP diutamakan di atas mockup. | Berlaku |
| K-033 | Total laporan menghitung seluruh periode. | Berlaku |
| K-034 | Aturan penamaan, kode master lima digit, format tanggal dan uang. | Berlaku |
| K-035 | PostgreSQL dipasang lewat installer resmi; Docker hanya pilihan. | Berlaku |
| K-036 | Kategori sebagai tabel; barcode boleh kosong. | Berlaku |
| K-037 | Log aktivitas dan sesi login disimpan di database. | Berlaku |
| K-038 | Daftar hal yang sengaja tidak dibuat. | Berlaku |
| K-039 | Dashboard per peran; cadangan harian; tempat server diputuskan di Fase 8. | Berlaku; dirinci K-080, K-082, K-084 |
| K-040 | Import Excel untuk barang dan saldo awal stok. | Berlaku; dirinci K-061, K-064, K-067 |
| K-041 | Nama repo, nama tampil, nama cookie, awalan alamat API. | Sebagian diganti K-044 |
| K-042 | Waktu disimpan UTC, ditampilkan Asia/Jakarta. | Berlaku |
| K-043 | Bahasa Indonesia; layar komputer diutamakan; kasir bisa serba keyboard. | Berlaku; dirinci K-073 |

### 6.2 Tambahan fondasi — `2026-09-19-keputusan-tambahan.md`

| K | Keputusan | Status |
|---|---|---|
| K-044 | Nama tampil aplikasi: BonsaiUrip. | Berlaku |
| K-045 | Prefix `PBP` untuk pembayaran ke pemasok. | Berlaku |
| K-046 | Rancangan skema diuji di PostgreSQL sebelum dipakai. | Berlaku |
| K-047 | Setiap barang punya harga untuk setiap tier sejak dibuat. | Sebagian diganti K-094 |
| K-048 | Stok fisik tidak boleh turun di bawah stok yang dipesan. | Berlaku |
| K-049 | Skema v3.1: catatan void, retur, dan refund pada tagihan penjualan. | Berlaku |

### 6.3 Fase 1, Setup — `2026-09-29-setup-fase-1.md`

| K | Keputusan | Status |
|---|---|---|
| K-050 | Versi Node.js, pnpm, PostgreSQL, dan semua paket dikunci di satu tempat. | Berlaku |
| K-051 | Daftar satuan sementara bisa dibaca tanpa izin selama Fase 1. | Selesai (izin dipasang, K-054) |
| K-052 | Skema di kode dibuktikan sama dengan migrasi lewat perbandingan otomatis. | Berlaku |
| K-053 | Penyesuaian kecil struktur repo dan data awal. | Berlaku |

### 6.4 Fase 2, Akses dasar — `2026-09-30-akses-dasar.md`

| K | Keputusan | Status |
|---|---|---|
| K-054 | Login, sesi, batas laju login, dan penjaga izin yang menolak alamat tanpa izin. | Berlaku |
| K-055 | Kelola pengguna (Owner), halaman Pengaturan per bagian, log aktivitas. | Berlaku |

### 6.5 Fase 3, Data master — `2026-09-30-data-master.md`

| K | Keputusan | Status |
|---|---|---|
| K-056 | Tanda "perlu tinjau harga" sejak awal; No. HP wajib; import hanya menambah barang baru. | Berlaku |
| K-057 | Aturan kategori, satuan, dan jenis atribut. | Berlaku; halamannya menjadi Referensi Barang (K-063) |
| K-058 | Satu sumber aturan pembulatan uang dan hitungan kuantitas. | Berlaku |
| K-059 | Tier, term, dan limit kredit pelanggan hanya diatur Admin/Owner. | Sebagian diganti K-097, K-107 |
| K-060 | Aturan teknis barang, harga, tier, kode, dan gambar barang. | Berlaku; bagian harga diubah K-086, K-094, K-098 |
| K-061 | Import Excel barang dengan pratinjau; simpan semua atau tidak sama sekali. | Berlaku; dirinci K-064 |
| K-062 | Penomoran versi, backlog, rancangan cadangan, hasil uji skala. | Berlaku |
| K-063 | Merk menjadi data master; halaman Referensi Barang. | Berlaku |
| K-064 | Import v2: baris salah diperbaiki di layar; templat ringkas/lengkap; ekspor data barang. | Berlaku; kolom harga tier lain diabaikan sejak K-098 |
| K-065 | Logo toko, pilihan kop struk, jumlah baris per halaman. | Berlaku; pengaturan struk pindah tab (K-103) |

### 6.6 Fase 4, Persediaan — `2026-10-01-persediaan.md`

| K | Keputusan | Status |
|---|---|---|
| K-066 | Penerimaan barang: tanggal hari ini, tunai langsung lunas, bukti terima. | Berlaku |
| K-067 | Penyesuaian stok, lembar opname, import saldo awal. | Berlaku; dilengkapi K-069 |
| K-068 | Posisi stok, kartu stok, nilai persediaan, notifikasi dan kartu peringatan stok. | Berlaku |
| K-069 | Barang di lembar opname dikecualikan dengan alasan, bukan dihapus. | Berlaku |

### 6.7 Fase 5, Penjualan — `2026-10-02-penjualan.md`

| K | Keputusan | Status |
|---|---|---|
| K-070 | Order, reservasi stok, hak mengubah order, kunci order oleh kasir. | Berlaku |
| K-071 | Checkout dalam satu transaksi; jenis pembayaran; buka shift; cetak struk dan invoice. | Berlaku; dilengkapi K-075, K-111 |
| K-072 | Surat jalan bertahap, halaman Piutang, notifikasi jatuh tempo. | Berlaku |
| K-073 | Alur kasir cepat: antrean tiket, input order cepat, keyboard penuh, siaran langsung. | Berlaku; butir rekening diganti K-111, F9 diubah K-106 |
| K-074 | Cetak struk tanpa jendela cetak lewat mode cetak-senyap peramban. | Berlaku sebagai cadangan; jalur utama K-103 |

### 6.8 Fase 6, Koreksi — `2026-10-03-koreksi.md`

| K | Keputusan | Status |
|---|---|---|
| K-075 | Shift, kas manual dan otomatis, hitung buta, Admin/Owner boleh menutup shift kasir lain. | Berlaku; dilengkapi K-109 |
| K-076 | Syarat void, nominal void, dan refund. | Berlaku; laci refund diubah K-099 |
| K-077 | Nilai retur dan tiga penyelesaiannya. | Berlaku; tampilan dirapikan K-106 |

### 6.9 Fase 7, Laporan — `2026-10-04-laporan.md`

| K | Keputusan | Status |
|---|---|---|
| K-078 | Laporan sebagai dokumen formal; satu sumber untuk layar, cetak, dan Excel. | Berlaku; dilengkapi K-093, K-106 |
| K-079 | Tafsiran angka laporan (retur, void, laba kotor, stok rekap, kartu stok). | Berlaku; umur piutang ditetapkan K-088 |
| K-080 | Dashboard per peran. | Berlaku |
| K-081 | Izin laporan; nilai persediaan butuh dua izin. | Berlaku |

### 6.10 Fase 8, Deploy — `2026-10-04-deploy-cadangan.md`

| K | Keputusan | Status |
|---|---|---|
| K-082 | Server di komputer Windows toko, HTTPS lokal, akses luar lewat Tailscale. | Berlaku |
| K-083 | Pengerasan keamanan dasar dan daftar periksanya. | Berlaku; ditinjau ulang K-100 |
| K-084 | Cadangan terenkripsi harian ke dua tujuan, uji pulih bulanan, skrip pemulihan. | Berlaku |
| K-085 | Lima alur kritis yang wajib lulus sebelum server diperbarui. | Berlaku |

### 6.11 Fase 9, Harga dan promo — `2026-10-04-harga-promo.md`

| K | Keputusan | Status |
|---|---|---|
| K-086 | Mesin harga jual: markup, pemicu, harga otomatis (naik langsung, turun ditinjau), Tinjau Harga, margin. | Berlaku; butir 1–2 diganti K-094 |
| K-087 | Promo dan batas modal, diskon lintas peran, pratinjau harga oleh server, laporan promo. | Berlaku; saran tier diganti K-094 → K-099, urutan promo diubah K-098 |

### 6.12 Fase 10–12 — berkas bertanggal 2026-10-07

| K | Keputusan | Status |
|---|---|---|
| K-088 | Hutang pemasok, retur ke pemasok, stok rusak, pemusnahan, limit kredit, umur piutang/hutang. | Berlaku; cara melampaui limit diubah K-102 |
| K-089 | Setoran konsinyasi, koreksi retur, halaman dan laporan Konsinyasi. | Berlaku; butir 3 sebagian diganti K-092 |
| K-090 | Label barcode Code 128 dan laporan Daftar Harga. | Berlaku; label thermal K-093 |
| K-091 | Satuan jual per barang dan harganya; transaksi dalam satuan jual. | Berlaku; butir 3 diganti K-095, disederhanakan K-094 |

### 6.13 Tinjauan pemilik 8–9 Oktober

| K | Keputusan | Status |
|---|---|---|
| K-092 | Barang titipan yang diretur atau rusak: siapa yang menanggung. | Berlaku |
| K-093 | Pratinjau laporan seukuran kertas, label thermal, saringan mutasi, qty di kotak cari, alur konsinyasi lebih jelas. | Berlaku |
| K-094 | Harga otomatis menjadi bawaan; harga dasar boleh ikut markup; kemasan; cetak thermal seukuran gulungan; versi titipan. | Berlaku, kecuali tier menurut qty (diganti K-098) |
| K-095 | Draf order otomatis; pilihan cetak struk; beberapa satuan untuk satu barang; harga modal belum diketahui. | Berlaku |
| K-096 | Tombol "Simpan draf & order baru" dan tombol qty −/+. | Berlaku |

### 6.14 Tinjauan pemilik dan tinjauan kode 10 Oktober

| K | Keputusan | Status |
|---|---|---|
| K-097 | Harga hanya menurut qty; harga khusus pembeli lewat promo; golongan pelanggan. | Butir 1–3 diganti K-098; butir 4–6 berlaku |
| K-098 | Tier menurut total nilai belanja transaksi; promo dipotong dari harga tier. | Berlaku; butir 3 diganti K-099 |
| K-099 | Persetujuan di tempat, batas tanpa persetujuan, batalkan pengajuan, tier selalu otomatis, perbaikan tampilan kasir. | Butir 1 dan 4 diganti K-102; lainnya berlaku |
| K-100 | Tinjauan kode menyeluruh: pengerasan dan satu sumber untuk pola berulang. | Berlaku |
| K-101 | Melampaui limit kredit dengan password atasan di layar kasir. | Diganti K-102 |

### 6.15 Tinjauan pemilik 11 Oktober — `2026-10-11-tinjauan-pemilik.md`

| K | Keputusan | Status |
|---|---|---|
| K-102 | Persetujuan atasan dengan kode sekali pakai lewat Telegram/email. | Berlaku; dilengkapi K-105, K-107 |
| K-103 | Struk langsung ke printer thermal; tab Struk & printer. | Berlaku; dilengkapi K-105 |
| K-104 | Pengantaran tanpa order; pelanggan bisa diklik; cara bayar tegas; limit kredit bawaan; cetakan tanpa notifikasi. | Berlaku |
| K-105 | Penyiapan terpandu untuk saluran kode dan printer; uji kirim yang jujur; aturan menulis petunjuk. | Berlaku |

### 6.16 Tinjauan pemilik 12 Oktober — `2026-10-12-tinjauan-pemilik.md`

| K | Keputusan | Status |
|---|---|---|
| K-106 | Perapian tampilan: data akun lama dibuang saat login, judul halaman tidak terhimpit, form sejajar, keterangan tier menonjol, pohon laporan, retur, bayar campuran, "Mulai dari awal". | Berlaku |
| K-107 | Posisi kredit di daftar pelanggan; ubah/nonaktif pelanggan oleh Kasir/Staf butuh kode atasan. | Berlaku |
| K-108 | Cari barang lewat atribut dan kategori; daftar tanpa mengetik; foto kecil; katalog bergambar dijadwalkan v2.0.0. | Berlaku |
| K-109 | Shift terlewat mengunci pencatatan; jadwal buka/tutup; pengingat; tutup shift orang lain dari layar. | Berlaku |
| K-110 | Promo pindah ke Pengaturan; jumlah potongan yang diberikan; anggaran; batas per pembeli. | Berlaku |
| K-111 | Rekening toko, metode QRIS, dan pengecekan uang masuk non-tunai. | Berlaku |
| K-112 | Printer per jenis dokumen menjadi syarat aplikasi desktop. | Berlaku (tanpa perubahan kode) |

### 6.17 Pendukung keputusan dan tablet 14 Oktober — `2026-10-14-pendukung-keputusan-tablet.md`

| K | Keputusan | Status |
|---|---|---|
| K-113 | Fase 14: rekomendasi pemesanan ulang (rata-rata jual + lead time), tampilan tablet untuk layar staf, ekspor log ke Excel; bentuk deploy belum final. | Berlaku (rekomendasi selesai 17 Okt; ekspor log selesai 24 Okt; tablet menyusul) |

### 6.18 Tinjauan pemilik 17 Oktober — `2026-10-17-tinjauan-pemilik.md`

| K | Keputusan | Status |
|---|---|---|
| K-114 | Tampilan muat di layar: tab membungkus, kasir separuh-separuh, rincian barang di area antrean. | Berlaku |
| K-115 | Panduan printer umum untuk semua printer ESC/POS; langkah port COM keluar. | Berlaku |
| K-116 | Hitung kas per pecahan, modal berlanjut, toleransi receh, hitungan pertama terkunci, tinjauan shift, bantuan mencari selisih. | Dirinci oleh K-121 (selesai 18 Okt) |
| K-117 | Order ditunda dengan tanggal rencana (tahan stok bisa dipilih); tutup shift dengan order yang belum selesai. | Butir 1–2 diganti K-122 |
| K-118 | Laporan fitur diperbarui tiap commit; riwayat teknis `docs/11`. | Berlaku |
| K-119 | Tes layar memakai database sendiri. | Berlaku (rencana) |

### 6.19 Tinjauan pemilik 18 Oktober — `2026-10-18-tinjauan-pemilik.md`

| K | Keputusan | Status |
|---|---|---|
| K-120 | Prinsip anomali alur kerja: setiap fitur wajib mengatasi, mencegah, dan mengajari; katalog `docs/12`. | Berlaku |
| K-121 | Shift: buka tiga cara, hitung per pecahan, hitung susulan, koreksi modal, tutup dua langkah, toleransi receh, uang ditinggal, tinjauan, bantuan selisih, penjelasan atasan. | Berlaku (selesai 18 Okt) |
| K-122 | Order disimpan (nama, HP, tanggal ambil ≤ 14 hari, tahan stok), kembali ke draf, buka draf otomatis, peringatan barang di draf lain, panel rincian di Order. | Berlaku (selesai 18 Okt) |
| K-123 | Pencarian atribut sebagian, label keterjualan, angka stok merah tebal, teks kecil penting lebih jelas, panel dengan tombol tutup dan info penjualan. | Berlaku (selesai 24 Okt) |
| K-124 | Cetak: setelan tersimpan, penjelasan laci uang, logo di struk, kepekatan, dokumen A4 dengan setelan bawaan, cetak otomatis per jenis dokumen. | Berlaku (selesai 24 Okt) |
| K-125 | Order pembelian ke pemasok masuk v1.0.0. | Berlaku (selesai 24 Okt: `keputusan/2026-10-24-rancangan-order-pembelian.md`, docs/05 §21) |
| K-126 | Halaman Hasil Penjualan. | Berlaku (selesai 24 Okt; docs/05 §20) |
| K-127 | Rekomendasi pesan beberapa metode (rata-rata, statistik Z, min–maks, tren), cache memori, lead time aktual dari order pembelian. | Berlaku (selesai 24 Okt, termasuk lama kirim aktual dari order pembelian) |

---

### 6.20 Uji pemilik lanjutan 18 Oktober — `2026-10-18-uji-pemilik-lanjutan.md`

| K | Keputusan | Status |
|---|---|---|
| K-128 | Bahasa layar ringkas: kata efektif, makna cepat, tetap rinci. | Berlaku |
| K-129 | Hot page pas satu layar tanpa gulir; daftar hotkey jadi satu tombol; hapus form order lengkap dan tab Input cepat. | Berlaku (selesai 24 Okt) |
| K-130 | Pemberitahuan tidak mengagetkan: kartu pojok kanan bawah, item Buka shift di menu, spanduk bisa diperkecil jadi lencana. | Berlaku (selesai 24 Okt, K-152/K-156) |
| K-131 | Notifikasi lebih rinci, bisa digulir, ada di dashboard. | Berlaku (selesai 24 Okt) |
| K-132 | Satu shift untuk toko; siapa pun berizin buka/tutup; indikator untuk Staf. | Berlaku (selesai 18 Okt) |
| K-133 | Tutup shift menampilkan semua order belum selesai dengan pilihan per order. | Berlaku (selesai 18 Okt) |
| K-134 | Hitung susulan dua langkah dengan hasil berangka; koreksi modal setelah disimpan; "Tambah uang laci". | Berlaku (selesai 18 Okt) |
| K-135 | Hitung per pecahan dengan −/+, kosongkan, hotkey. | Berlaku (selesai 18 Okt) |
| K-136 | Kode atasan bisa dilanjutkan; satu permintaan menunggu per urusan. | Berlaku (selesai 18 Okt) |
| K-137 | Data bersih: format ketat, No. HP kode negara tanpa 0, cegah data ganda, pindai data lama. | Berlaku (selesai 24 Okt) |
| K-138 | Tampilkan siapa penginput di halaman bersama. | Berlaku (selesai 24 Okt) |
| K-139 | Saringan status daftar order; order disimpan jatuh tempo tetap tampil. | Berlaku (selesai 24 Okt) |
| K-140 | Pembeli setelah tutup: buka shift baru (1 Enter). | Berlaku |
| K-141 | Kembalian tidak diambil dicatat kas masuk khusus, bukan penjualan. | Berlaku (selesai 18 Okt) |
| K-142 | Retur/void menunggu tampil saat tutup shift; refund tercatat di shift saat disetujui. | Berlaku (selesai 18 Okt) |
| K-143 | F9 kasir: pilihan A/S/D dipertahankan, label tombol diperjelas. | Berlaku (selesai 24 Okt) |
| K-144 | Diskon manual dipertahankan, terbatas % per peran; di atas batas dengan kode atasan. | Diganti K-146 |
| K-145 | Pengaturan hotkey per pengguna setelah v1.0.0 lain selesai. | Berlaku (rencana) |

---

### 6.21 Pengantaran dan FMS 23 Oktober — `2026-10-23-pengantaran-fms.md`

| K | Keputusan | Status |
|---|---|---|
| K-146 | Diskon manual dihapus; potongan hanya lewat Promo; form order lengkap dihapus. | Berlaku (selesai 23 Okt) |
| K-147 | Istilah "uang shift" menggantikan "uang laci". | Berlaku (selesai 23 Okt) |
| K-148 | Koreksi modal hanya setelah hitung susulan disimpan. | Berlaku |
| K-149 | Hasil pengantaran per barang: diterima, kembali utuh, rusak di jalan, ditolak; dicatat admin/kasir. | Berlaku (selesai 23 Okt) |
| K-150 | FMS inti: master kendaraan dan sopir, status sedang jalan, riwayat trip. | Berlaku (selesai 23 Okt) |
| K-151 | Rusak di jalan ditanggung toko; pembeli pilih kiriman pengganti atau tagihan dikurangi. | Berlaku (selesai 23 Okt) |

---

### 6.22 Hasil uji 23 Oktober dan FMS lanjutan — `2026-10-24-masukan-uji-dan-fms-lanjutan.md`

| K | Keputusan | Status |
|---|---|---|
| K-152 | Tata letak tidak saling menimpa di semua lebar/zoom; diperiksa otomatis. | Berlaku (selesai 24 Okt) |
| K-153 | Teks panjang di tempat sempit bisa dibuka-tutup. | Berlaku (selesai 24 Okt) |
| K-154 | Non-tunai hanya ke rekening penerimaan terdaftar (termasuk e-wallet); No. referensi wajib. | Berlaku (selesai 24 Okt) |
| K-155 | Satu shift toko dijamin indeks unik database. | Berlaku (selesai 24 Okt) |
| K-156 | Pengingat bisa diciutkan jadi lencana; dialog buka shift tidak muncul sendiri; bilah pintasan bisa diciutkan. | Berlaku (selesai 24 Okt) |
| K-157 | Tombol bayar campuran tampil sebagai tombol. | Berlaku (selesai 24 Okt) |
| K-158 | Pengaturan "Harga dasar" dengan penjelasan Average/LIFO/FIFO dan kalkulator. | Berlaku (selesai 24 Okt) |
| K-159 | Cadangan: salin alamat folder, penjelasan server toko vs cloud. | Berlaku (selesai 24 Okt) |
| K-160 | Halaman Pengiriman tersendiri (menu Logistik), papan kartu order kirim, grup per rit. | Berlaku (selesai 24 Okt) |
| K-161 | Dimensi & berat barang, kapasitas kendaraan, peringatan muatan bertingkat (ODOL). | Berlaku (selesai 24 Okt; pengingat STNK/KIR ikut K-162) |
| K-162 | FMS pendukung: utilisasi, rit, STNK/KIR, servis, BBM. | Berlaku (selesai 24 Okt) |
| K-163 | Editor kampanye promo: syarat + manfaat, jam-menit, banyak barang, templat. | Berlaku (bagian 1 selesai 24 Okt; voucher/kupon/atribut menyusul) |
| K-164 | Kunci idempoten kiriman uang dan cek versi data master. | Berlaku (selesai 24 Okt) |
| K-165 | Arsip/tutup buku tahunan; dokumen pembukuan disimpan 10 tahun. | Berlaku (selesai 24 Okt; data tetap di satu database, tahun dikunci + berkas arsip) |
| K-166 | Alur pembaruan aplikasi yang aman bagi data lama. | Berlaku (selesai 24 Okt) |
| K-167 | Pencarian universal di topbar (Ctrl+K). | Berlaku (selesai 24 Okt) |
| K-168 | Mode demo terpisah; panduan penyiapan pertama dengan 5 contoh data asli per jenis. | Berlaku (rencana; `keputusan/2026-10-25-masukan-sebelum-deploy.md`) |
| K-169 | Atribut dimensi/berat dan data muatan satu sumber, dengan aturan dimensi vs volume. | Berlaku (rencana) |
| K-170 | Notifikasi dan lencana barang di order pengantaran yang belum punya data muatan. | Berlaku (rencana) |
| K-171 | Hot page langsung/pengantaran: gulir panel dan pindah fokus dengan tombol, elemen lebih ringkas. | Berlaku (sebagian 25 Okt: ikon pengganti "Menghitung…") |
| K-172 | Lencana topbar responsif, tidak meluap. | Berlaku (selesai 25 Okt) |
| K-173 | Kartu Pengiriman: info cepat, nomor antrean, warna hasil pembagian, penanda hari, saringan. | Berlaku (rencana) |
| K-174 | Surat jalan hanya dibuat di dalam rit (kendaraan dan sopir sudah pasti); keluar/batal rit membatalkan surat jalan; cetak atau simpan PDF semua surat jalan saat berangkat. | Berlaku (selesai 26 Okt) |
| K-175 | Detail yang dibuka dari Pengiriman kembali ke Pengiriman. | Berlaku (selesai 25 Okt) |
| K-176 | Penyelesaian hasil pengantaran: alasan, potong tagihan, tugas transfer pengembalian, penanda kartu. | Berlaku (rencana) |
| K-177 | Seret kartu Pengiriman dengan keyboard benar-benar berfungsi. | Berlaku (rencana) |
| K-178 | BBM dan servis kendaraan ditunda ke v4/v5; tab disembunyikan. | Berlaku (selesai 25 Okt) |
| K-179 | Order pembelian yang menunggu tampil di Penerimaan Barang. | Berlaku (selesai 25 Okt) |
| K-180 | Isian otomatis (No. HP dari pelanggan) dan saran alasan sesuai konteks. | Berlaku (sebagian 25 Okt) |
| K-181 | Tombol info cepat (pop-up) di setiap kode pada elemen interaktif. | Berlaku (rencana) |
| K-182 | Laporan: menu di atas, pratinjau per halaman A4 besar. | Berlaku (rencana) |
| K-183 | Pemeriksaan data diperluas selain No. HP. | Berlaku (rencana) |
| K-184 | Harga dasar FIFO; penjelasan latest cost bukan LIFO. | Berlaku (rencana) |
| K-185 | Promo: kelompok sasaran AND bertingkat; jenis beli N potong Rp X; penjelasan "?" diperjelas. | Berlaku (rencana) |
| K-186 | Peringatan menutup aplikasi saat shift terbuka; peramban terbuka otomatis saat Windows mulai. | Berlaku (selesai 25 Okt) |
| K-187 | Surat jalan dicetak 2 rangkap (asli arsip toko, salinan penerima) dengan keterangan per lembar. | Berlaku (selesai 25 Okt) |
| K-188 | Pemasang tanpa terminal (klik dua kali, isian di jendela, akun DB sendiri, jalan keluar lupa password postgres); setup .exe lengkap menyusul. | Berlaku (v2 selesai 26 Okt: Setup mandiri dengan PostgreSQL bawaan, tanpa Administrator) |
| K-189 | Logo BonsaiUrip (bonsai di papan kayu) untuk ikon tab, sidebar, halaman masuk. | Berlaku (selesai 25 Okt) |
| K-190 | Log aktivitas: ekspor Excel sudah ada; tambahan log interaksi rinci (klik, halaman, durasi, pencarian, galat) untuk penelitian, terpisah dari log audit, tanpa isi ketikan, bisa dinyalakan Owner dan diekspor. | Berlaku (rencana, sebelum turun lapangan) |
| K-191 | Setup v3: splash bermerek, buat akun pertama (tanpa password bawaan), lupa password/pemulihan, ikon tray untuk keluar, pilih lokasi pasang, tutorial, keamanan Windows. | Berlaku (rencana; akun pertama dan lupa password ikut backlog sistem, sisanya setelah backlog selesai) |

---

## 7. Yang dijadwalkan sesudah ini

Hal-hal berikut sudah diputuskan **tidak dikerjakan sekarang** dan dicatat supaya tidak hilang. Rinciannya di
`08-backlog.md`.

| Hal | Asal | Dijadwalkan |
|---|---|---|
| Aplikasi desktop (versi build): cetak tanpa jendela untuk semua dokumen dan pengaturan printer per jenis dokumen. | K-103, K-112 | Fase 13; urutan pekerjaannya belum dikonfirmasi pemilik |
| Katalog bergambar: kisi kartu barang dengan foto, kategori, atribut, harga, stok, dan tanda promo. | K-108 | v2.0.0 |
| Payment gateway (uang masuk terdeteksi otomatis). | K-111 | v2.0.0 |
| Pembatalan pembayaran otomatis untuk pembayaran yang ditandai "Tidak masuk". | K-111 | v2.0.0 |
| Promo v2: satu promo untuk banyak barang, edit massal, potongan bertingkat. | K-098 | v2.0.0 |
| Tombol "?" di setiap halaman. | K-099 | v2.0.0 |
| Tata letak layar kasir yang bisa diatur pengguna. | K-095 | v2.0.0 |
| Persetujuan dengan membalas pesan Telegram; kode lewat WhatsApp. | K-102 | v2.0.0 / v3.0.0 |
| Peran dan izin buatan Owner; keuangan ringan; modul stok opname tersendiri. | K-062 | v2.0.0 |
| Pembukuan (akuntansi dagang), multi-gudang, cabang. | K-038, K-062 | v3.0.0 |

---

## Riwayat

- 2026-10-12 — Dibuat atas permintaan pemilik: ringkasan K-001 s.d. K-112.
- 2026-10-14 — K-113 ditambahkan (garis waktu, daftar lengkap 6.17).
- 2026-10-17 — K-114–K-119 ditambahkan (daftar lengkap 6.18).
- 2026-10-18 — K-120–K-127 ditambahkan (daftar lengkap 6.19, garis waktu, 4.8 shift, bagian 5).
- 2026-10-18 — K-121 dan K-122 selesai dibangun (status 6.19, 4.5).
- 2026-10-18 — K-128–K-145 ditambahkan (6.20; 4.8 satu shift toko).
- 2026-10-23 — K-146–K-151 (6.21).
- 2026-10-23 — K-149–K-151 selesai (pengantaran per barang, kendaraan & sopir, perjalanan).
- 2026-10-24 — K-152–K-167 (6.22).
- 2026-10-24 — K-164 dan K-167 selesai.
- 2026-10-24 — K-161 bagian 1 selesai (data muatan, pratinjau dan penegakan muatan saat berangkat).
- 2026-10-24 — K-160 selesai (papan Pengiriman, rit rencana); K-161 bagian 2 selesai (isi massal data muatan lewat Excel).
- 2026-10-24 — K-162 selesai (catatan BBM/servis, pengingat servis & STNK/KIR, statistik armada).
- 2026-10-24 — K-163 bagian 1 selesai (kampanye promo).
- 2026-10-24 — K-165 (arsip tahunan) dan K-166 (pembaruan aman, versi aplikasi) selesai.
- 2026-10-24 — Sisa gelombang 3–4 selesai: K-129, K-130, K-131, K-137, K-138, K-139, K-143.
- 2026-10-24 — K-123 selesai (cari atribut sebagian, label keterjualan, stok menonjol, panel rincian).
- 2026-10-25 — Masukan sebelum deploy dicatat sebagai K-168–K-186.
