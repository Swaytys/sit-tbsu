# Keputusan Tinjauan Pemilik — 18 Oktober 2026

Melanjutkan penomoran dari `2026-10-17-tinjauan-pemilik.md`. Sumbernya uji pemilik proyek (printer RPP02 berhasil,
saran pesan, layar kasir) dan pertanyaan tentang alur yang tidak sesuai harapan sistem. Butir **(pemilik)**
diputuskan pemilik (sebagian lewat pilihan yang diajukan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-120 — Anomali alur kerja: setiap fitur wajib mengatasi, mencegah, dan mengajari

**Status:** prinsip kerja; berlaku untuk semua fitur sejak v1.0.0. Katalognya `docs/12-anomali-alur-kerja.md`.

**Keputusan (pemilik):** *anomali* = cara pemakaian sebuah fitur yang tidak sesuai harapan sistem (salah ketik,
urutan kerja terbalik, lupa, terburu-buru, disengaja). Setiap fitur wajib menjawab tiga hal untuk setiap anomali
yang mungkin: **(1) mengatasi** bila sudah terjadi (jalan koreksi yang aman dan tercatat), **(2) mencegah** (alur,
konfirmasi, kunci, peringatan sebelum terjadi), **(3) mengajari** (penjelasan di layar, "?", pesan galat yang
menyebut langkah benar). Analisis dimulai dari Shift & Clerical Check (paling rawan uang), lalu fitur lain.

---

### K-121 — Shift: buka tiga cara, hitung per pecahan, hitung menyusul, koreksi modal, tutup dua langkah

**Status:** merinci dan menggantikan K-116 (bagian buka/tutup shift); aturan K15–K24 di docs/05 §10.

**Keputusan:**

1. **(pemilik) Buka shift tiga cara dalam satu dialog**, dengan konfirmasi sebelum benar-benar membuka (Enter = ya,
   Esc = kembali) dan Esc menutup dialog tanpa harus mengklik isian dulu:
   - *Sama dengan uang ditinggal kemarin* — modal awal = uang yang dicatat ditinggal di laci saat shift terakhir
     ditutup; satu Enter + konfirmasi.
   - *Hitung sekarang* — per pecahan (lembar/keping) atau ketik total.
   - *Buka dulu, hitung nanti* — untuk toko yang sudah ramai sebelum kasir selesai menghitung. Shift langsung
     buka dengan modal sementara = uang ditinggal kemarin; kasir wajib menyelesaikan hitungan dalam 60 menit
     (pengaturan; diingatkan di layar dan lonceng). Saat hitungan dikirim, sistem menghitung **modal sebenarnya
     saat buka = hasil hitungan − (tunai masuk − tunai keluar sejak shift dibuka)**, sehingga uang yang sudah
     diterima dan kembalian yang sudah diberikan ikut diakui. Selisih dengan uang ditinggal kemarin dicatat
     sebagai *koreksi modal (hitung susulan)* dan dilaporkan ke Owner sebagai "selisih semalam".
2. **Modal berlanjut:** saat tutup shift kasir mengisi **uang ditinggal di laci**; sisanya dianggap disetor. Angka
   itu menjadi usulan modal shift berikutnya (toko memakai satu laci).
3. **(pemilik) Koreksi modal:** modal awal tidak pernah diubah; koreksi dicatat sebagai kas *Koreksi modal +/−*
   beserta alasan. Sebelum ada transaksi tunai di shift itu, kasir boleh mengoreksi sendiri (tercatat di log).
   Sesudahnya, koreksi butuh kode sekali pakai dari Admin/Owner (jenis `KOREKSI_KAS`, terikat shift dan nilai
   baru) atau dilakukan Admin/Owner sendiri.
4. **(pemilik) Tutup dua langkah:** (a) kasir mengirim hitungan (per pecahan atau total) — hitungan pertama
   **terkunci dan tercatat**; shift masuk status *Dihitung* (pencatatan uang baru ditolak sampai shift selesai
   ditutup); (b) tampil hasil rekonsiliasi, tinjauan shift, dan bantuan mencari selisih; bila selisih di luar
   toleransi kasir boleh **menghitung ulang satu kali** (kedua hitungan tercatat), lalu **keterangan wajib**;
   kasir mengisi uang ditinggal di laci, lalu shift ditutup.
5. **(pemilik) Toleransi selisih receh** (bawaan Rp 1.000, pengaturan Owner/Admin): selisih dalam batas ini tetap
   tercatat tetapi ditandai *selisih receh* dan keterangan tidak wajib.
6. **Tinjauan shift** (hasil rekonsiliasi dan riwayat): transaksi per jenis, pembayaran per metode, kas manual,
   koreksi modal, refund, void, retur, dan linimasa tunai (setiap uang tunai masuk/keluar laci dengan jam, nomor,
   dan nominal, termasuk kembalian).
7. **Bantuan mencari selisih:** sistem mencocokkan nilai selisih dengan kejadian di shift (satu pembayaran tunai,
   kembalian, pembayaran non-tunai yang mungkin sebenarnya tunai, kas manual, refund, kelipatan pecahan uang) dan
   menampilkan daftar periksa umum. Saran, bukan tuduhan; tidak mengubah data.
8. **Penjelasan selisih oleh atasan:** setelah shift ditutup angka tidak bisa diubah; Admin/Owner bisa menambahkan
   *penjelasan* dan menandai selisih *terjelaskan* (siapa, kapan tercatat).
9. **Tutup shift dengan order yang belum selesai:** sebelum menghitung, sistem menampilkan order yang masih
   dipegang kasir itu dengan pilihan per order: kembalikan ke antrean, simpan (K-122), kembalikan ke draf, atau
   batalkan. Order yang tidak dipilih tetap kembali ke antrean seperti sekarang.
10. **Admin/Owner menutup shift orang lain** memakai alur dua langkah yang sama.

**Alasan:** toko tidak boleh tertahan oleh hitungan uang, tetapi setiap rupiah yang masuk/keluar laci tetap harus
bisa dijelaskan. Rumus hitung susulan membuat urutan kerja "layani dulu, hitung kemudian" tetap menghasilkan modal
yang benar.

*Ditolak:* mengubah angka modal awal secara langsung (menghapus jejak); hitung ulang tanpa batas; mengunci
penjualan sampai kasir selesai menghitung.

---

### K-122 — Order penjualan: disimpan untuk diambil nanti, kembali ke draf, peringatan barang di draf lain

**Status:** menggantikan K-117 butir 1–2 (order ditunda dengan tahan stok opsional).

**Keputusan:**

1. **(pemilik) Order disimpan** (status `DISIMPAN`): untuk pembeli yang pesan sekarang dan membayar/mengambil
   nanti. Wajib nama pembeli, No. HP, dan tanggal rencana ambil (paling lama 14 hari). **Stok ditahan** (masuk
   stok dipesan) sampai order dibayar atau dibatalkan. Order disimpan tidak tampil di antrean, melainkan di daftar
   *Order disimpan*; bisa dimasukkan kembali ke antrean kapan saja. Lewat tanggal rencana: notifikasi untuk
   menghubungi pembeli, tidak dibatalkan otomatis.
2. **(pemilik) Kembalikan ke draf:** order di antrean bisa dikembalikan ke draf (mis. pembeli lupa membawa dompet).
   Reservasi stok dilepas (sama dengan batal), tetapi daftar barangnya tetap tersimpan sebagai draf sehingga tidak
   perlu diketik ulang. Draf tidak wajib nama pembeli.
3. **(pemilik) Pilihan "Buka draf otomatis"** per pengguna di Order Penjualan (bawaan nyala): bila nyala, draf
   terakhir dimuat saat halaman dibuka (perilaku sekarang); bila mati, form selalu kosong dan draf dibuka dari
   daftar. Preferensi tampilan, disimpan di peramban.
4. **(pemilik) Peringatan barang yang ada di draf lain:** saat barang ditambahkan dan barang itu juga ada di draf
   (milik siapa pun) sementara stok tersedia tidak cukup untuk keduanya, muncul pemberitahuan singkat yang
   menyebut draf itu (nomor, pembeli bila ada, qty) dengan pilihan **Buka draf itu** (lanjutkan transaksi pembeli
   yang datang lebih dulu) atau **Tetap tambahkan**.
5. **Panel rincian barang** juga di Order Penjualan (input cepat), seperti di layar kasir (K-114).

---

### K-123 — Pencarian sebagian, label keterjualan, angka stok yang menonjol, panel yang lebih lengkap

**Status:** menggantikan K-108 butir 1 bagian "angka atribut dicocokkan utuh". **Selesai 24 Okt.** Rincian teknis label:
LARIS = 20 % teratas nilai penjualan barang yang terjual; LAMBAT = terjual tetapi nilainya di bawah median barang
yang terjual; TIDAK_LAKU = tidak terjual 30 hari; BARU = dibuat < 30 hari (mengalahkan label lain); selebihnya tanpa
label. Status saran pesan di panel belum ditampilkan (lihat Saran Pesan).

**Keputusan:**

1. **(pemilik) Atribut dicari sebagian**, tidak harus utuh: "1" menemukan 10 dan 12,5; "c" menemukan cm. Urutan
   relevansi tetap: cocok utuh di nama/kode/barcode paling atas, lalu cocok utuh di atribut, lalu cocok sebagian.
2. **(pemilik) Label keterjualan** di samping nama barang (hasil cari, panel rincian, Data Barang) dari penjualan
   30 hari terakhir: **Laris** (termasuk 20 % barang dengan nilai penjualan tertinggi), **Lambat** (terjual
   sedikit), **Tidak laku** (tidak terjual 30 hari), **Baru** (dimiliki kurang dari 30 hari). Dihitung server dan
   disimpan sementara di memori (dihitung ulang paling lama tiap 10 menit).
3. **(pemilik) Angka stok di daftar hasil cari** (Order, Penjualan Langsung, Pengantaran) tebal dan berwarna
   merah supaya cepat terbaca. Aturan umum keterbacaan: informasi yang sering dibaca dan menentukan tindakan
   (stok, total, kembalian, sisa tagihan, jatuh tempo, selisih kas) memakai ukuran minimal 14 px, tebal, dan warna
   yang kontras, tanpa membuat layar ramai.
4. **(pemilik) Panel rincian barang** diberi tombol tutup kecil di pojok kanan atas (dan Esc), serta informasi
   penjualan: label keterjualan, terjual 30 hari, rata-rata per hari, terakhir terjual, status saran pesan.

---

### K-124 — Cetak: setelan tersimpan, laci uang, logo, kepekatan, dokumen A4 tanpa jendela cetak

**Keputusan:**

1. **Setelan printer struk tidak perlu diulang** setelah aplikasi ditutup: pilihan disimpan di peramban komputer
   itu dan izin port diingat Chrome/Edge untuk alamat aplikasi. Perlu diulang hanya bila data peramban dibersihkan,
   memakai peramban/profil/alamat lain, atau printer dipasangkan ulang (nomor COM berganti).
2. **Laci uang** dijelaskan di layar: laci kas elektronik yang dicolokkan ke printer struk (kabel RJ11) terbuka
   sendiri saat struk penjualan tunai dicetak. Printer genggam seperti RPP02 tidak punya colokan laci, jadi
   pilihan ini dibiarkan mati.
3. **(pemilik) Logo di struk:** logo toko dicetak di atas struk sebagai gambar hitam-putih (ESC/POS raster),
   dengan pilihan nyala/mati dan pratinjau.
4. **(pemilik) Kepekatan cetak:** pilihan Normal / Tebal / Paling tebal. *Tebal* = cetak dua kali + huruf tebal;
   *Paling tebal* menambah perintah waktu pemanasan kepala cetak yang dikenali banyak printer thermal murah.
   Ketajaman tetap bergantung pada baterai, kertas, dan kebersihan kepala cetak (dijelaskan di panduan).
5. **(pemilik) Invoice, surat jalan, laporan tanpa setel ulang:** ukuran dan arah kertas tiap jenis dokumen diatur
   sekali di Pengaturan (invoice dan surat jalan bawaan **A4 lanskap**; laporan mengikuti formatnya). Agar tercetak
   langsung tanpa jendela cetak ke printer A4: komputer kasir membuka aplikasi lewat *mode kasir*
   (`buka-kasir.cmd`, Chrome `--kiosk-printing`) dan printer A4 dijadikan printer bawaan Windows; struk tetap lewat
   jalur ESC/POS sehingga tidak bentrok. Panduan langkah demi langkah ditulis.
6. **(pemilik) Cetak otomatis per jenis dokumen** setelah transaksi: struk (sudah ada), invoice pengantaran, dan
   surat jalan — masing-masing *Langsung cetak / Tanya dulu / Tidak dicetak*.

---

### K-125 — Order pembelian ke pemasok masuk v1.0.0

**Status:** membatalkan sebagian K-038 ("PO/pembelian penuh" tidak dibuat). Rancangan rinci menyusul setelah riset
alur standar; dikerjakan sebagai bagian Fase 14.

**Keputusan (pemilik):** toko mencatat **order pembelian** (PO) sebelum barang datang, seperti order penjualan
sebelum checkout. Alasannya: (a) lama kirim pemasok yang sebenarnya hanya bisa diketahui dari tanggal pesan dan
tanggal datang, dan angka ini menentukan ketepatan saran pesan; (b) ada pemasok yang harus dipesan jauh hari
(pre-order) dan ada yang minta dibayar dulu; (c) barang yang sudah dipesan tetapi belum datang harus mengurangi
saran pesan agar tidak dipesan dua kali. Garis besar alur standar: draf PO → dikirim ke pemasok → dikonfirmasi
pemasok (tanggal janji kirim) → (uang muka bila diminta) → penerimaan barang terhadap PO, boleh sebagian →
selesai/ditutup; PO bisa dibatalkan sebelum barang diterima.

---

### K-126 — Halaman Hasil Penjualan

**Keputusan (pemilik):** halaman baru di menu Transaksi untuk melihat kinerja penjualan tanpa membuka Laporan,
seperti Stok Persediaan untuk barang. Isi (rinci menyusul): ringkasan periode (omzet, jumlah transaksi, rata-rata
nilai transaksi, laba kotor bagi yang berizin, perbandingan periode lalu), riwayat transaksi, per barang (terlaris,
ABC), per kategori, per pelanggan, per kasir/staf, per jam dan hari, per metode bayar, promo dan diskon, retur dan
void. Angka sensitif disaring izin seperti laporan.

---

### K-127 — Rekomendasi pemesanan ulang: beberapa metode, dihitung saat diminta

**Status:** melengkapi K-113.

**Keputusan:**

1. **(pemilik) Metode bisa dipilih:** **A** rata-rata jual + lama kirim (sekarang); **B** statistik — stok pengaman
   = Z × simpangan baku penjualan harian × √lama kirim, dengan tingkat layanan pilihan (90/95/98 %), butuh riwayat
   minimal 30 hari; **C** jumlah tetap (min–maks) per barang yang diisi pengguna; **D** perkiraan tren (pemulusan
   eksponensial ganda) untuk barang yang penjualannya naik/turun.
2. **(pemilik) Dihitung saat diminta, disimpan sementara:** hasil tiap metode disimpan di memori server (dihapus saat
   server dimatikan, kedaluwarsa 10 menit atau saat ada penjualan/penerimaan baru); berpindah metode menghitung
   metode itu bila belum ada di memori, dengan tanda "menghitung…".
3. **Lama kirim aktual** dari order pembelian (K-125): rata-rata (tanggal terima − tanggal pesan) per pemasok
   menggantikan isian manual bila sudah ada minimal 3 PO; barang yang sudah dipesan tetapi belum datang
   mengurangi saran.
4. **(pemilik) Penjelasan "?"** memuat cara kerja, manfaat, dan batasan tiap metode (kapan cocok, kapan menyesatkan).
