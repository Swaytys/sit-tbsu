# Keputusan Tinjauan Pemilik — 17 Oktober 2026

Melanjutkan penomoran dari `2026-10-14-pendukung-keputusan-tablet.md`. Sumbernya uji pemilik proyek di laptop
pengembang. Butir **(pemilik)** diputuskan pemilik (sebagian lewat pilihan yang diajukan Claude Code); butir
lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-114 — Tampilan muat di layar: deret tab, layar kasir separuh-separuh, rincian barang di area antrean

**Status:** mengubah tampilan; tidak mengubah aturan bisnis maupun skema.

**Latar:** (1) deret tab di Pengaturan (Harga & diskon, Promo, Keamanan, Persetujuan, Cadangan, Log) terpotong di
kanan layar laptop dan harus digeser; pemilik menyebut banyak halaman lain serupa. (2) Daftar hasil cari di layar
Penjualan Langsung/Pengantaran sempit, nama barang terpotong, dan ada gulir menyamping; rincian barang hanya satu
baris kecil di bawah daftar. (3) Papan antrean memakai ±55 % lebar layar.

**Keputusan:**

1. **Deret tab membungkus ke baris berikut** bila tidak muat (komponen `TabsList` bersama), sehingga semua tab
   terlihat tanpa digeser, di laptop maupun tablet.
2. **Tidak ada gulir menyamping di halaman** pada lebar laptop: tabel yang lebar disusun ulang (kolom dibungkus,
   kolom sekunder disatukan) dan diperiksa otomatis di lebar 1280, 1366, dan tablet (dikerjakan bersama Fase 14
   bagian tablet, K-113 butir 3). Tabel yang memanjang ke bawah tetap wajar.
3. **(pemilik) Layar kasir dibagi dua sama lebar:** papan antrean 1/2, transaksi 1/2.
4. **(pemilik) Rincian barang yang disorot di hasil cari tampil menutupi area papan antrean**, seperti lembar
   informasi di atasnya: foto besar, nama, kode/barcode, kategori, merk, titipan, stok tersedia/fisik/dipesan/
   minimum, status stok, stok rusak, harga per satuan dan kemasan untuk setiap tier aktif (beserta syarat
   belanjanya), dan seluruh atribut. Muncul saat barang disorot dengan panah atau kursor, hilang saat daftar
   ditutup. Antrean tidak dibutuhkan selama memilih barang, jadi ruangnya dipakai untuk informasi.
5. **Baris hasil cari dua tingkat** tanpa lebar tetap: nama (sampai dua baris) dan satuan di atas; atribut, harga,
   dan stok di bawah. Tidak ada gulir menyamping.

**Alasan:** kasir memilih barang dengan melihat ciri dan stoknya; informasi itu harus terbaca sekaligus. Area
antrean adalah ruang terbesar yang menganggur saat memilih barang.

*Ditolak:* jendela sembul (*tooltip*) kecil di samping kursor: menutupi daftar dan tidak bisa dipakai lewat
keyboard; gulir menyamping pada deret tab: pengguna tidak tahu ada tab tersembunyi.

---

### K-115 — Panduan printer struk dibuat umum untuk semua printer ESC/POS

**Status:** mengubah `docs/panduan/printer-struk.md` (v2) dan teks langkah di kartu Printer struk; jalur cetak
(K-103) tidak berubah.

**Latar:** pemilik menguji RPP02 di laptopnya: Windows menulis *Driver is unavailable* dan printer tidak bisa
dipakai. Pemilik juga meminta panduan yang berlaku untuk merek lain, karena printer toko bisa berbeda.

**Keputusan:**

1. **Panduan berlaku untuk printer struk thermal ESC/POS merek apa pun** (Bluetooth SPP dan kabel USB), dengan
   tabel cara mengenali jenis printer dan bagian "catatan per merek" yang diisi setiap kali sebuah merek diuji.
2. **Langkah yang terlewat sebelumnya ditambahkan: membuat port COM keluar** di *Setelan Bluetooth lainnya ›
   Port COM › Tambah › Keluar*. Windows 11 tidak selalu membuatnya untuk perangkat yang dikenalnya sebagai
   printer; tanpa port itu printer tidak muncul di pemilih peramban. Status *Driver is unavailable* dijelaskan
   sebagai wajar, karena cetak langsung tidak memakai driver.
3. **"Tersambung terus" tidak diperlukan:** setiap struk membuka port, printer tersambung sendiri dalam 1–5 detik,
   lalu dilepas. Pilihan printer diingat peramban, jadi kasir tidak melakukan apa-apa saat mencetak.
4. Printer kabel USB tanpa port COM butuh driver *virtual COM* dari pembuatnya; printer yang hanya Bluetooth Low
   Energy tidak bisa cetak langsung (jendela cetak sebagai cadangan).

*Ditolak:* panduan terpisah per merek sekarang: belum ada merek lain yang bisa diuji; bagian "catatan per merek"
menampung temuan berikutnya.

---

### K-116 — Hitung kas per pecahan, modal berlanjut, toleransi, dan tutup shift yang membantu mencari selisih

**Status:** menambah aturan K15–K20 di docs/05 §10 (dikerjakan sesudah Fase 14 bagian 1); mengubah alur tutup
shift K-075 butir 3.

**Latar:** pemilik menilai alur tutup shift kurang membantu: keterangan selisih diminta sebelum kasir melihat
berapa selisihnya; layar hasil tidak menampilkan apa yang terjadi selama shift; tidak ada bantuan mencari sebab
selisih; dan uang receh membingungkan.

**Keputusan:**

1. **(pemilik) Hitung per pecahan (opsional).** Saat buka dan tutup shift kasir boleh mengisi jumlah lembar/keping
   per pecahan (Rp100.000 … koin Rp100); sistem menjumlah. Mengetik total langsung tetap bisa. Rincian pecahan
   disimpan bersama hitungan.
2. **(pemilik) Modal berlanjut.** Saat tutup shift kasir mencatat **uang ditinggal di laci** (modal kembalian
   untuk shift berikutnya) dan **uang disetor**. Saat shift berikutnya dibuka, modal awal terisi usulan dari uang
   ditinggal shift terakhir; selisih antara usulan dan hitungan buka dicatat (uang laci berubah di luar shift).
3. **(pemilik) Toleransi selisih receh.** Selisih yang nilai mutlaknya ≤ batas toleransi (pengaturan Owner,
   bawaan Rp 1.000) ditandai *selisih receh*: tetap tercatat, tidak dianggap masalah, keterangan tidak wajib.
4. **(pemilik) Hitung → hasil → keterangan.** Hitungan pertama kasir **terkunci dan tercatat** (hitung buta
   tetap terjaga: angka sistem baru tampil setelah kasir mengirim hitungannya). Lalu tampil hasil rekonsiliasi.
   Bila selisih di luar toleransi, kasir boleh **menghitung ulang satu kali** (kedua angka tercatat dan tampil ke
   atasan), lalu **keterangan wajib** sebelum shift ditutup.
5. **Ringkasan shift ("tinjauan shift")** di samping hasil: jumlah dan nilai transaksi per jenis (langsung,
   pengantaran), pembayaran per metode (tunai, transfer, EDC, QRIS), kas masuk/keluar manual, refund, void dan
   retur, serta linimasa kejadian tunai (setiap penerimaan dan pengeluaran tunai dengan jam, nomor, nominal).
6. **Bantuan mencari selisih:** sistem mencocokkan nilai selisih dengan kejadian di shift, mis. "selisih
   Rp 25.000 sama dengan kembalian STR-…", "sama dengan pembayaran tunai BYR-… yang mungkin seharusnya
   transfer", "sama dengan kas keluar tanpa bukti", "kelipatan pecahan Rp 50.000 (uang terselip?)", serta daftar
   periksa umum (kembalian salah, pembayaran non-tunai tercatat tunai, refund belum dicatat, uang setor belum
   dicatat). Petunjuk ini **saran**, bukan tuduhan, dan tidak mengubah data.

**Alasan:** kasir dan atasan perlu tahu *berapa* selisihnya sebelum menjelaskan *mengapa*; hitungan pertama yang
terkunci menjaga hitung buta tetap bermakna. Hitung per pecahan dan modal berlanjut adalah cara lazim sistem POS
ritel menangani uang receh tanpa memperlambat transaksi.

*Ditolak:* mencatat pembulatan kembalian per transaksi (memperlambat kasir di 200+ transaksi/hari); hitung ulang
tanpa batas (kasir bisa menyamakan angka tanpa mencari sebabnya).

---

### K-117 — Order ditunda dengan tanggal rencana; tutup shift dengan order yang belum selesai

**Status:** menambah status order `DITUNDA` dan aturan R11–R13 di docs/05 (dikerjakan sesudah K-116).

**Keputusan:**

1. **(pemilik) Order bisa ditunda** dengan tanggal dan jam rencana, untuk pembeli yang baru akan membayar beberapa
   jam atau hari kemudian. Order keluar dari antrean, tampil di daftar *Order ditunda*, dan **kembali ke antrean
   sendiri** saat waktunya tiba (dengan notifikasi). Bisa juga dibuka lebih awal secara manual.
2. **(pemilik) Tahan stok bisa dipilih** saat menunda: *tahan* (barang disisihkan untuk pembeli itu, paling lama
   7 hari, hanya Kasir ke atas) atau *tidak* (stok dicek ulang saat order dibuka kembali; bila kurang, kasir
   diberi tahu). Order ditunda yang lewat tanggal rencana tanpa diproses ikut aturan order basi.
3. **(pemilik) Tutup shift dengan order yang belum selesai:** sebelum menghitung uang, sistem menampilkan order
   yang masih dipegang kasir itu dan antrean yang menunggu, dengan pilihan per order: kembalikan ke antrean,
   tunda ke tanggal tertentu, atau batalkan (alasan wajib). Shift tetap boleh ditutup, karena antrean milik
   toko, bukan milik shift.

*Ditolak:* menolak tutup shift selama ada order (kasir terjebak bila pembeli tidak kembali); draf sebagai tempat
menyimpan order pembeli (draf adalah isian staf yang belum selesai, tidak terlihat kasir).

---

### K-118 — Dua dokumen yang selalu diperbarui: laporan fitur (keadaan sekarang) dan riwayat teknis

**Status:** aturan kerja dokumentasi; menambah `docs/11-riwayat-teknis.md`.

**Keputusan:**

1. **(pemilik) `docs/LAPORAN-FITUR-APLIKASI.md` = keadaan fitur saat ini**, diperbarui di setiap commit yang
   mengubah fitur, supaya selalu bisa diandalkan sebagai gambaran terkini.
2. **(pemilik) `docs/11-riwayat-teknis.md` = catatan teknis runtut dari awal sampai sekarang**: apa yang benar-benar
   dibangun di setiap tahap, kerangka teknisnya (modul, tabel, aturan, alur), dan alasan logisnya, ditulis
   berupa penjelasan, bukan sekadar poin. Ditambah di setiap commit yang membangun sesuatu.
3. `docs/keputusan/` tetap menjadi catatan *mengapa* (keputusan dan pilihan yang ditolak); kedua dokumen di atas
   merujuk ke sana.

---

### K-119 — Tes layar memakai database sendiri

**Status:** keputusan teknis; dikerjakan bersama Fase 14 bagian tablet.

**Latar:** layar Promo di laptop pemilik penuh "Promo E2E …", barang "… E2E …", dan penitip uji, karena tes layar
(Playwright) berjalan di database pengembangan yang juga dipakai pemilik mencoba aplikasi. Penyiapan tes juga
harus menonaktifkan tier pemilik dan menutup shift demo agar tes tidak gagal (K-106 butir 9, K-111).

**Keputusan:** server tes layar memakai database tersendiri `tbsu_e2e` yang dikosongkan, dimigrasi, dan diisi
data awal sebelum setiap putaran tes. Database pengembangan tidak lagi tersentuh tes. Data uji yang sudah
terlanjur ada di database pengembangan dinonaktifkan lewat aplikasi (data master tidak dihapus).
