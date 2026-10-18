# Keputusan Uji Pemilik Lanjutan — 18 Oktober 2026

Melanjutkan `2026-10-18-tinjauan-pemilik.md` (K-120–K-127). Sumbernya uji mandiri pemilik dan uji menurut
`docs/UJI-PEMILIK.md` (U17–U34). Butir **(pemilik)** diputuskan pemilik; butir lain keputusan teknis Claude Code.
Semua butir masuk lingkup v1.0.0 (Fase 14) kecuali disebut lain.

Format: **Keputusan** · **Alasan** · **Ditolak** (bila ada).

---

### K-128 — Bahasa layar ringkas

**Keputusan (pemilik):** semua teks layar (judul, pilihan, penjelasan dialog, "?", pesan galat, spanduk) memakai
kata yang efektif: makna tertangkap sekali baca, tetap tepat dan cukup rinci, tanpa kalimat bertele-tele.
Definisi dan aturan tidak berubah. Rincian panjang dipindah ke "?"; contoh angka lebih baik dari uraian rumus.

**Alasan:** penjelasan dialog buka shift dan layar lain terasa "terbata-bata"; kasir membaca sambil melayani.

---

### K-129 — Hot page pas satu layar

**Keputusan (pemilik):**
1. *Hot page* = halaman input yang sering dipakai dengan keyboard: Order Penjualan, Penjualan Langsung, Penjualan
   Pengantaran, Shift & Clerical Check. Halaman ini **pas satu layar tanpa gulir halaman** (hanya daftar di
   dalamnya yang bergulir) dan adaptif di resolusi apa pun.
2. Daftar hotkey di bawah layar diganti **satu tombol** yang melebar menampilkan hotkey (bukan pop up), tertutup
   sendiri saat fokus pindah, dan punya hotkey sendiri.
3. Order Penjualan: **Form order lengkap dihapus**; tab "Input cepat" dihapus. Input cepat menjadi tampilan utama;
   tombol **Daftar order** membuka daftar, **Esc** atau tombol Kembali kembali ke input.
4. Tombol yang terpotong/bertumpuk diperbaiki (U30: *Proses ke pembayaran* dan *Kirim ke antrean (F8)* tidak
   terlihat karena terpotong).

**Alasan:** menggulir memaksa pindah ke mouse; waktu dan tenaga terbuang.

---

### K-130 — Pemberitahuan tidak mengagetkan

**Keputusan (pemilik):**
1. Dialog buka shift **tidak muncul sendiri** saat halaman dibuka. Sebagai gantinya muncul kartu kecil di pojok
   kanan bawah (seperti notifikasi Windows/WA): klik = buka dialog; hilang sendiri setelah 60 detik.
2. Selama shift belum dibuka, menu samping menampilkan item **Buka shift** dengan tanda menyala, sebagai jalan
   cepat setelah kartu hilang.
3. Spanduk peringatan (lewat jam tutup, hitung susulan, shift sedang ditutup, shift terlewat) bisa **diperkecil**
   menjadi lencana beranimasi di tempat yang mudah dijangkau; klik lencana = spanduk tampil lagi.

---

### K-131 — Notifikasi lebih informatif

**Keputusan (pemilik):** tiap notifikasi menampilkan rincian singkat (mis. tiga item teratas: nomor, nama,
nilai/umur), daftar notifikasi **bisa digulir** (sebelumnya terpotong), dan dashboard punya bagian notifikasi.

---

### K-132 — Satu shift untuk toko

**Status:** menggantikan K1 dan K2 (docs/05 §10) yang mengikat shift ke satu pengguna.

**Keputusan (pemilik):** toko memakai satu laci, jadi **hanya ada satu shift terbuka untuk toko**. Shift dibuka dan
ditutup oleh siapa pun yang punya akses Shift & Clerical Check. Semua uang tunai (penjualan, refund, kas, bayar
pemasok) masuk shift toko yang sedang terbuka, siapa pun pencatatnya; setiap transaksi tetap mencatat
**siapa yang mencatat** untuk jejak. Pengguna tanpa akses shift (Staf) melihat **indikator status shift**
(terbuka/tutup) di tampilan.

**Alasan:** shift per pengguna membuat satu laci terbagi ke beberapa hitungan; tidak sesuai kenyataan toko.

*Ditolak:* shift per kasir (sebelumnya).

---

### K-133 — Tutup shift dengan order yang belum selesai

**Keputusan (pemilik):** sebelum menghitung, kotak *Tutup shift* menampilkan **semua order yang belum selesai**
(menunggu di antrean dan sedang diproses) dengan pilihan per order: ke antrean (biarkan), simpan untuk nanti,
ke draf, batalkan. Order disimpan ditampilkan sebagai informasi. (U34: sebelumnya hanya order yang sedang dipegang
kasir yang tampil, sehingga order di antrean tidak terlihat.)

---

### K-134 — Hitung nanti dan koreksi modal diperjelas

**Keputusan:**
1. Hitung susulan memakai pola yang sama dengan tutup shift: **hitung → hasil → hitung ulang sekali bila beda →
   simpan**. Hasil ditampilkan dengan angka, bukan rumus: *Laci sekarang Rp 650.000 − uang masuk sejak buka
   Rp 150.000 = modal saat buka Rp 500.000; kemarin ditinggal Rp 500.000 → cocok*.
2. Modal sementara = uang ditinggal kemarin hanya **angka sementara**; angka sebenarnya ditentukan hitungan.
   Beda = *selisih semalam*, dilaporkan ke Owner.
3. Uang penjualan dan kembalian yang sudah tercampur **tidak perlu dipisah**: hitung semua uang di laci; sistem
   sudah mencatat uang masuk dan kembalian sejak buka.
4. **Koreksi modal tidak tersedia** selama hitung susulan belum dikirim (hitungan itulah yang menentukan modal).
   Setelah tersimpan, salah hitung dibetulkan lewat Koreksi modal (kode atasan bila sudah ada transaksi tunai).
5. Menambah uang laci di tengah shift (mis. receh habis) memakai jenis kas **Tambah uang laci** (dulu "Tambahan
   dari owner"); bukan penjualan.

---

### K-135 — Hitung per pecahan lebih cepat

**Keputusan (pemilik):** tiap pecahan punya tombol **−/+** (tidak ikut urutan Tab karena keyboard cukup mengetik
angka), tombol **Hapus** per baris dan **Hapus semua**, dengan hotkey. Berlaku di semua layar hitung uang.

---

### K-136 — Kode atasan bisa dilanjutkan

**Keputusan:** bila dialog kode ditutup sebelum kode dimasukkan, membuka lagi aksi yang sama **melanjutkan
permintaan yang masih berlaku** (kode tidak dikirim ulang) dengan keterangan "kode dikirim pukul …, berlaku
sampai …"; tombol *Kirim kode baru* tetap ada. Untuk satu urusan hanya ada satu permintaan menunggu (permintaan
lama otomatis tidak berlaku).

**Alasan:** U21: keluar dari dialog memaksa minta kode baru; atasan menerima banyak kode untuk urusan yang sama.

---

### K-137 — Data bersih dan pencegahan data ganda

**Keputusan (pemilik):**
1. Setiap isian punya **aturan penulisan ketat** dengan perbaikan otomatis dan pesan yang mengajari. No. HP:
   kode negara dipilih (bawaan +62), nomor diketik **tanpa 0 di depan**, hanya angka, paling banyak 15 angka
   (batas nomor internasional); bila diketik `0851…` sistem membuang 0 dan memberi tahu. Nama: spasi dirapikan.
2. **Cegah data ganda** pelanggan, pemasok, barang, dan data master lain: sebelum menyimpan, sistem mencari data
   yang sama/mirip (nama, No. HP, kode, barcode) dan menawarkan memakai data yang ada.
3. **Tangani data aneh yang sudah lolos**: pemindaian data ganda/format salah yang sudah tersimpan, dengan saran
   perbaikan dan pemberitahuan.
4. Dialog *Simpan untuk nanti* bisa **memilih pelanggan yang ada**; nama atau No. HP yang sama persis dengan
   pelanggan terdaftar otomatis memakai data pelanggan itu (dengan pemberitahuan).

---

### K-138 — Jejak siapa yang menginput

**Keputusan (pemilik):** di halaman yang dipakai bersama (order antrean/draf/disimpan, pengajuan retur/void,
dan halaman sejenis) setiap item menampilkan **siapa yang menginput**.

---

### K-139 — Saringan daftar order

**Keputusan (pemilik):** daftar order punya saringan status (bawaan: semua). Order disimpan yang **tanggal
ambilnya hari ini atau sudah lewat tetap tampil** walau tersaring, sebagai pengingat; bisa disembunyikan untuk
hari itu.

---

### K-140 — Transaksi setelah shift ditutup

**Keputusan (pemilik):** pembeli yang datang (atau minta diantar) setelah shift ditutup dilayani dengan **membuka
shift baru** hari itu: satu Enter memakai uang yang tadi ditinggal di laci, lalu konfirmasi. Penjualan tercatat
tanggal hari itu di shift baru. Order dan pembayaran non-tunai tetap bisa dicatat tanpa shift (aturan yang ada).

*Ditolak:* penjualan masuk hitungan shift besok (uang semalam tanpa shift, laporan kas tidak cocok tanggal); tunai
ditolak sampai buka manual.

---

### K-141 — Kembalian tidak diambil

**Keputusan (pemilik):** layar bayar punya pilihan **Kembalian tidak diambil**. Uangnya tercatat sebagai kas masuk
khusus shift (bukan penjualan): omzet dan laba tidak berubah, laci tetap cocok saat tutup, total tampil di
tinjauan shift.

*Ditolak:* tip dipisah tanpa dicatat (selisih bila lupa); diakui sebagai penjualan (nota tidak cocok dengan uang).

---

### K-142 — Retur/void yang menunggu melewati pergantian shift

**Keputusan:** uang refund baru keluar dari laci saat retur/void **disetujui**, dan dicatat di shift yang terbuka
saat itu (T6, V5) — jadi pengajuan yang disetujui di shift berikutnya tercatat benar di shift berikutnya. Supaya
tidak terlupa, kotak *Tutup shift* dan tinjauan shift menampilkan **pengajuan retur/void yang masih menunggu**
(nomor, nilai refund tunai) sebagai informasi, bukan selisih; notifikasi tetap ada.

---

### K-143 — Kasir: F9 untuk order yang terbuka

**Keputusan (pemilik, U31 OK):** pilihan A/S/D dipertahankan. Tombol di layar kasir untuk order yang terbuka
diberi label jelas (*Tunda / kembalikan* + F9). Tidak ada tombol khusus per skenario (mis. "lupa dompet").

---

### K-144 — Diskon manual per baris dipertahankan, terbatas

**Keputusan (pemilik):** diskon manual (D1–D6) tetap ada untuk tawar-menawar. Staf/Kasir hanya bila batas %
peran mereka dinaikkan Owner (bawaan 0%); potongan di atas batas bisa diminta dengan **kode atasan** (seperti
limit kredit). Semua potongan tercatat di log dan tampil di laporan.

---

### K-145 — Pengaturan hotkey per pengguna

**Keputusan (pemilik):** setelah pekerjaan v1.0.0 lain selesai, pengguna bisa mengganti hotkey penting (layar
kasir, order, shift) di pengaturan. Hotkey tetap tampil di tombol daftar hotkey (K-129).

---

## Urutan pengerjaan

1. Perbaikan cepat: tombol terpotong (U30), notifikasi bisa digulir + rinci, kode atasan dilanjutkan, hitung per
   pecahan (K-135).
2. Satu shift untuk toko (K-132) beserta K-133, K-134, K-140, K-141, K-142, indikator shift untuk Staf.
3. Pemberitahuan tidak mengagetkan (K-130) dan hot page pas layar (K-129), saringan order (K-139), jejak penginput
   (K-138), K-143.
4. Data bersih (K-137) dan diskon dengan kode (K-144).
5. Lanjut K-123, K-124, K-127, K-126, K-125, tablet, ekspor log, lalu K-145.
