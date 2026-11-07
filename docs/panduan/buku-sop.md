# Buku SOP BonsaiUrip

**Standar Operasional Prosedur penggunaan sistem penjualan dan persediaan BonsaiUrip**

| | |
|---|---|
| Nomor dokumen | SOP-BU-01 |
| Versi | 1.0 (aplikasi versi 1.16.0) |
| Berlaku sejak | 31 Oktober 2026 |
| Disusun oleh | Pengembang BonsaiUrip |
| Disahkan oleh | Pemilik usaha (Owner) |
| Pasangan dokumen | Buku Panduan (`manual-pengguna.md`), Panduan mulai pakai (menu Start), Panduan selisih stok |

## Daftar isi

- [Bagian A. Ketentuan umum](#bagian-a-ketentuan-umum)
- [Bagian B. Prosedur harian](#bagian-b-prosedur-harian): SOP-02 sampai SOP-08
- [Bagian C. Prosedur persediaan dan pembelian](#bagian-c-prosedur-persediaan-dan-pembelian): SOP-09 sampai SOP-12
- [Bagian D. Prosedur koreksi](#bagian-d-prosedur-koreksi): SOP-13 sampai SOP-15
- [Bagian E. Prosedur administrasi sistem](#bagian-e-prosedur-administrasi-sistem): SOP-01, SOP-16 sampai SOP-21
- [Lampiran](#lampiran): daftar periksa harian, mingguan, bulanan; matriks tanggung jawab; formulir kejadian

---

## Bagian A. Ketentuan umum

### A.1 Tujuan

Buku ini menetapkan cara baku memakai BonsaiUrip agar:

1. setiap transaksi tercatat lengkap, benar, dan atas nama orang yang mengerjakannya;
2. stok di aplikasi sama dengan stok di gudang, dan uang di aplikasi sama dengan uang di laci/rekening;
3. kesalahan diperbaiki dengan jejak yang jelas, bukan dihapus;
4. data usaha aman dari kehilangan (cadangan) dan dari orang yang tidak berhak (akun dan izin).

Buku Panduan menjelaskan **cara menekan tombol**; Buku SOP ini menetapkan **apa yang wajib dilakukan, oleh siapa,
kapan, dan apa buktinya**.

### A.2 Ruang lingkup

Berlaku untuk seluruh pengguna BonsaiUrip di toko: Owner, Admin, Kasir, dan Staf Penjualan, pada semua komputer
dan perangkat yang memakai aplikasi.

### A.3 Peran dan tanggung jawab

| Peran | Tanggung jawab utama |
|---|---|
| **Owner** (pemilik) | Setup awal; akun pengguna; persetujuan void/retur di atas batas; pengaturan; cadangan; membaca laporan dan log aktivitas; menetapkan kebijakan harga dan toleransi. |
| **Admin** | Data barang, harga, pelanggan, pemasok; penerimaan barang; order pembelian; penyesuaian stok dan opname; pengiriman; persetujuan sesuai izin; laporan. |
| **Kasir** | Shift (buka, kas masuk/keluar, tutup); penjualan langsung; menerima pembayaran order dan pengantaran; struk; pengembalian uang tunai. |
| **Staf Penjualan** | Mencatat order pembeli dengan benar dan lengkap; mengarahkan pembeli ke kasir. |

Matriks rinci ada di Lampiran L.4.

### A.4 Aturan dasar (berlaku untuk semua SOP)

1. **Satu orang, satu akun.** Dilarang memakai akun orang lain atau membagikan password. Setiap aksi tercatat atas
   nama pemilik akun di log aktivitas.
2. **Keluar saat meninggalkan komputer** yang dipakai bergantian (menu nama › Keluar).
3. **Transaksi tidak dihapus atau diedit.** Kesalahan diperbaiki dengan dokumen koreksi: void, retur, penyesuaian
   stok, atau koreksi modal shift, masing-masing dengan alasan yang benar.
4. **Uang tunai hanya diterima saat shift terbuka.** Uang yang keluar/masuk laci selain penjualan wajib dicatat
   sebagai kas masuk/keluar.
5. **Pembayaran non-tunai wajib memakai rekening penerima yang benar dan No. referensi dari bukti transfer**
   (m-banking/struk EDC/QRIS). Berlaku untuk semua peran, termasuk Owner.
6. **Stok berubah hanya lewat transaksi** (penjualan, penerimaan, retur, penyesuaian). Tidak ada "membetulkan angka
   stok" tanpa dokumen.
7. **Data master tidak dihapus**, melainkan dinonaktifkan. Pengecualian: data ganda yang belum pernah dipakai boleh
   dihapus oleh pemegang izin (aplikasi menolak bila sudah dipakai).
8. **Persetujuan atasan memakai kode sekali pakai** yang dikirim ke atasan. Dilarang menyerahkan kode kepada orang
   yang meminta persetujuan untuk dipakai di lain waktu.
9. **Kode pemulihan dan sandi cadangan** disimpan Owner di tempat aman, terpisah dari komputer. Keduanya tidak bisa
   diminta ulang dari pengembang.
10. Bila aplikasi menolak sebuah tindakan, **baca pesannya**: penolakan adalah pengaman, bukan galat. Jangan mencari
    jalan memutar; tanyakan Admin/Owner.

### A.5 Istilah

| Istilah | Arti |
|---|---|
| Shift | Masa kerja kasir dari buka sampai tutup; satu shift untuk seluruh toko. |
| Clerical check | Pencocokan uang hasil hitung dengan catatan aplikasi saat tutup shift. |
| Order | Pesanan yang dicatat staf penjualan dan dibayar di kasir. |
| Invoice | Bukti penjualan pengantaran/kredit. |
| Surat jalan (SJ) | Dokumen pengiriman barang; selalu berada di dalam satu rit. |
| Rit | Satu perjalanan kendaraan + sopir + jadwal. |
| Void | Pembatalan transaksi (biasanya di shift yang sama). |
| Retur | Pengembalian barang oleh pembeli (atau ke pemasok). |
| Penyesuaian | Dokumen perubahan stok di luar jual-beli: saldo awal, opname, koreksi. |
| HPP | Harga pokok (modal rata-rata) barang. |

---

## Bagian B. Prosedur harian

### SOP-02 Membuka toko dan membuka shift

| | |
|---|---|
| Pelaksana | Kasir (atau Admin/Owner yang bertugas di kasir) |
| Waktu | Setiap hari sebelum menerima uang pertama |
| Bukti | Nomor shift (SHF-…), rincian hitungan modal |

1. Nyalakan komputer dan printer struk. Buka BonsaiUrip (ikon desktop); tunggu ikon BonsaiUrip muncul di pojok
   kanan bawah.
2. Masuk dengan akun sendiri.
3. Buka *Shift & Clerical Check* › **Buka shift**.
4. Hitung uang di laci **per pecahan** (pilihan H). Bila uang tinggalan shift kemarin ditawarkan, cocokkan dengan
   isi laci; bila berbeda, hitung ulang dan isi angka sebenarnya.
5. Simpan. Catat nomor shift bila diminta Owner.
6. Periksa lonceng notifikasi: order disimpan yang jatuh tempo hari ini, pembayaran non-tunai yang belum dicek,
   void/retur menunggu.

**Larangan:** menerima uang sebelum shift dibuka; memakai "Buka dulu, hitung nanti" lebih dari batas waktu yang
ditetapkan Owner.

### SOP-03 Penjualan langsung di kasir

| | |
|---|---|
| Pelaksana | Kasir |
| Waktu | Setiap pembeli yang membayar langsung |
| Bukti | Struk (STR-…) |

1. *Penjualan Langsung*. Tekan **F2**, cari barang, masukkan qty dengan benar (mis. `2*semen`). Periksa satuan
   (sak, batang, meter).
2. Bila baris bertanda kuning *Qty tidak biasa*, tanyakan ulang pembeli sebelum melanjutkan.
3. **Bacakan ulang isi keranjang** kepada pembeli (barang, qty, total).
4. Tekan **F8** (bayar):
   - Tunai: ketik uang diterima; serahkan kembalian sesuai layar. Kembalian yang tidak diambil pembeli dicentang
     *Kembalian tidak diambil*.
   - Non-tunai: pilih rekening/EDC/QRIS yang benar dan isi No. referensi dari bukti pembayaran (SOP-07).
5. Simpan; serahkan struk. **Serahkan barang sambil mencocokkan dengan struk.**
6. Barang yang dibayar tetapi belum diambil tetap tercatat di *Belum diambil*; serahkan saat pembeli datang dan
   tandai sudah diambil.

**Larangan:** menjual tanpa mencatat; mengubah harga di luar aturan tier/promo; menunda pencatatan "nanti saja".

### SOP-04 Order penjualan (staf penjualan) dan pembayarannya

| | |
|---|---|
| Pelaksana | Staf Penjualan (mencatat), Kasir (menagih) |
| Bukti | Nomor order (ORD-…), struk/invoice |

1. Staf mencatat order di *Order Penjualan* (input cepat) dengan pelanggan bila terdaftar, barang, qty, dan jenis
   (ambil langsung / disimpan diambil nanti / diantar).
2. Staf membacakan ulang pesanan kepada pembeli, lalu mengirim order ke kasir.
3. Kasir membuka order dari antrean, memeriksa ulang dengan pembeli, lalu menagih (SOP-03 langkah 4–6).
4. Order yang tidak jadi dibayar sekarang: pilih **Simpan** (dengan tanggal ambil) atau **Batalkan** dengan alasan.
   Jangan membiarkan order menggantung di antrean.
5. Order disimpan yang lewat tanggal ambil (tampil di notifikasi): hubungi pembeli, lalu ambil atau batalkan.

### SOP-05 Penjualan pengantaran

| | |
|---|---|
| Pelaksana | Kasir/Admin |
| Bukti | Invoice (INV-…), bukti DP/pelunasan |

1. *Penjualan Pengantaran*: pilih pelanggan, **alamat kirim lengkap** dan No. HP penerima, barang dan qty.
2. Pilih cara bayar: **Lunas**, **DP** (catat jumlah uang muka), **Bayar nanti** (hanya pelanggan dengan limit
   kredit), atau **Saat terima** (ditagih sopir/admin saat barang diterima).
3. Simpan; cetak invoice bila diminta pembeli.
4. Pengiriman dilanjutkan dengan SOP-06.
5. Sisa tagihan menjadi piutang (SOP-08).

### SOP-06 Pengiriman barang (rit)

| | |
|---|---|
| Pelaksana | Admin/Kasir yang mengatur pengiriman; sopir dan petugas muat |
| Bukti | Nomor rit (TRP-…), surat jalan 2 rangkap bertanda tangan penerima |

1. *Logistik › Pengiriman*: buat **Rit baru** (kendaraan, sopir, jadwal) atau pakai rit rencana yang ada.
2. Masukkan invoice dari Backlog ke rit (seret kartu / Kirim dengan rit…) untuk membuat surat jalan.
3. Cetak surat jalan 2 rangkap: **asli disimpan toko** setelah ditandatangani penerima, **salinan untuk penerima**.
4. Muat barang **sesuai surat jalan**. Setelah satu surat jalan selesai dimuat, centang **Dimuat** pada kartunya.
5. Periksa bar muatan. Di atas 100% kapasitas: isi alasan dan pastikan aman. Di atas batas toleransi (bawaan 110%):
   aplikasi menolak; ganti kendaraan atau bagi ke rit lain. **Dilarang** memaksa muatan berlebih.
6. Tekan **Berangkat** setelah semua surat jalan dicentang.
7. Setelah kendaraan kembali, **Catat hasil** setiap surat jalan hari itu juga: diterima, kembali (dengan alasan),
   atau rusak (dengan alasan). Barang kembali/rusak diselesaikan menurut status bayar (aplikasi memandu: potong
   tagihan atau kembalikan uang; lihat SOP-14).
8. Simpan surat jalan asli bertanda tangan dalam map per tanggal.

### SOP-07 Pembayaran non-tunai dan pengecekan rekening

| | |
|---|---|
| Pelaksana | Kasir (mencatat), Admin/Owner (mengecek masuk rekening) |
| Bukti | No. referensi, mutasi rekening/laporan EDC/QRIS |

1. Saat pembeli membayar transfer/EDC/QRIS: minta bukti (layar m-banking, struk EDC, notifikasi QRIS).
2. Pilih **rekening penerima** yang sesuai dan ketik **No. referensi** persis seperti di bukti (4–40 huruf/angka).
3. Dilarang mengisi referensi asal-asalan atau menyalin referensi transaksi lain.
4. Admin/Owner setiap hari (paling lambat sebelum tutup shift berikutnya) membuka *Shift › Non-tunai*, mencocokkan
   dengan mutasi rekening, lalu menandai **Masuk** atau **Tidak masuk**.
5. Pembayaran **Tidak masuk** ditindaklanjuti hari itu: hubungi pembeli; catat penyelesaiannya.

### SOP-08 Piutang dan penagihan

| | |
|---|---|
| Pelaksana | Admin/Kasir (mencatat), Owner (kebijakan limit) |
| Waktu | Harian (jatuh tempo), mingguan (tinjauan) |

1. Pantau notifikasi *piutang jatuh tempo ≤ 3 hari* dan *piutang terlambat*.
2. Tagih pelanggan; setiap uang yang diterima dicatat di *Piutang* › pelanggan › **Bayar** (tunai saat shift
   terbuka, atau non-tunai dengan referensi).
3. Owner meninjau limit kredit pelanggan yang sering terlambat (Data Pelanggan › limit).
4. Dilarang mencatat pelunasan sebelum uang benar-benar diterima.

---

## Bagian C. Prosedur persediaan dan pembelian

### SOP-09 Penerimaan barang dari pemasok

| | |
|---|---|
| Pelaksana | Admin |
| Bukti | Faktur/nota pemasok, nomor penerimaan (RCV-…) |

1. **Hitung dan periksa fisik** barang yang datang terhadap faktur/surat jalan pemasok (jumlah, jenis, kondisi).
2. Barang kurang/rusak: catat di faktur pemasok dan hubungi pemasok; yang dicatat di aplikasi hanya yang benar-benar
   diterima dalam kondisi baik.
3. *Penerimaan Barang* › **Catat penerimaan** (atau dari order pembelian yang menunggu): pemasok, No. faktur, barang,
   qty, harga beli sesuai faktur.
4. Pembayaran: tunai (dari kas toko/transfer dengan No. referensi) atau kredit (masuk hutang pemasok).
5. Simpan faktur asli dalam map per pemasok/bulan.

### SOP-10 Order pembelian dan pemesanan ulang

| | |
|---|---|
| Pelaksana | Admin (menyusun), Owner (menyetujui kebijakan) |
| Waktu | Mingguan atau saat notifikasi stok kritis |

1. Buka *Stok Persediaan › Saran pesan*; tinjau barang yang disarankan dan jumlahnya.
2. Buat **Order pembelian** per pemasok, kirim ke pemasok, catat uang muka bila ada.
3. Saat barang datang, terima lewat SOP-09 dari order pembelian itu.

### SOP-11 Hutang pemasok

1. Pantau notifikasi hutang jatuh tempo/terlambat.
2. Bayar lewat *Hutang Pemasok* › **Bayar**: tunai (shift terbuka) atau transfer dengan No. referensi.
3. Simpan bukti pembayaran bersama faktur.

### SOP-12 Penyesuaian stok dan opname

| | |
|---|---|
| Pelaksana | Admin (mencatat), Owner (meninjau) |
| Waktu | Saldo awal: sekali saat mulai. Opname kecil: mingguan per kategori. Opname penuh: minimal setahun sekali sebelum tutup tahun. |
| Bukti | Nomor penyesuaian (ADJ-…), lembar hitung fisik bertanda tangan |

1. **Saldo awal** hanya sekali per barang saat mulai memakai aplikasi.
2. **Opname**: cetak/siapkan daftar barang, hitung fisik (dua orang bila memungkinkan), isi hasil hitung di
   *Penyesuaian* jenis Opname, periksa selisihnya, lalu selesaikan.
3. **Koreksi** (rusak, hilang, salah serah, salah input): ikuti *Panduan selisih stok* (`selisih-stok.md`) bagian 3;
   **alasan wajib jelas dan menyebut nomor transaksi bila diketahui**.
4. Owner meninjau daftar penyesuaian setiap minggu; selisih berulang pada barang/kasir yang sama ditindaklanjuti.

---

## Bagian D. Prosedur koreksi

### SOP-13 Void transaksi

| | |
|---|---|
| Pelaksana | Kasir (mengajukan), Admin/Owner (menyetujui di atas batas) |
| Waktu | Sebaiknya di shift yang sama dengan transaksi |

1. *Void Transaksi* › pilih transaksi › lingkup (seluruh transaksi atau baris) › **alasan sebenarnya**.
2. Bila perlu persetujuan, atasan menyetujui dengan kode sekali pakai yang dikirim kepadanya.
3. Kembalikan uang/terima barang kembali sesuai hasil void. Untuk transaksi yang sudah dikirim, void ditolak:
   gunakan retur.
4. Void yang menunggu persetujuan harus selesai (disetujui/ditolak) sebelum shift ditutup.

### SOP-14 Retur penjualan dan pengembalian uang

| | |
|---|---|
| Pelaksana | Kasir/Admin (mengajukan), Admin/Owner (menyetujui), Kasir/Admin (mengembalikan uang) |
| Bukti | Nomor retur (RTR-…), bukti pengembalian uang |

1. *Retur Penjualan* › **Ajukan retur**: transaksi, barang, qty, kondisi (kembali ke stok / rusak), alasan.
2. Penyelesaian uang mengikuti status bayar: belum bayar → tagihan dipotong; sudah bayar sebagian → potong tagihan
   atau kembalikan uang; lunas → kembalikan uang.
3. Pengembalian uang **tunai** hanya saat shift terbuka; **transfer** dicatat dengan rekening tujuan dan No.
   referensi setelah ditransfer. Yang menunggu ada di tab **Pengembalian uang**; cara pengembalian boleh diganti
   sebelum dikonfirmasi.
4. Barang rusak dipisahkan dari stok jual.

### SOP-15 Tutup shift dan clerical check

| | |
|---|---|
| Pelaksana | Kasir; Owner/Admin meninjau selisih |
| Waktu | Setiap akhir hari/pergantian kasir |
| Bukti | Nomor clerical check (CLC-…), rincian hitungan |

1. Pastikan semua transaksi hari itu sudah dicatat dan semua uang di laci berasal dari transaksi tercatat.
2. *Shift & Clerical Check* › **Tutup shift**: baca kotak **Sebelum menutup**. Selesaikan yang bertanda wajib (mis.
   void menunggu). Yang lain (non-tunai belum dicek, transaksi di luar shift) boleh dilanjutkan ke shift berikutnya
   setelah dicentang *Sudah saya periksa*.
3. Hitung uang **per pecahan**, kirim hitungan. Bila ada selisih di atas toleransi, hitung ulang sekali; bila tetap,
   tulis keterangan yang jujur (bantuan selisih menampilkan linimasa tunai).
4. Isi uang yang ditinggal untuk shift berikutnya; setorkan sisanya ke Owner dan catat sebagai kas keluar/setoran.
5. Tutup shift. Owner meninjau selisih di riwayat shift.
6. Aplikasi baru bisa dimatikan, diperbarui, atau dihapus setelah shift ditutup (aplikasi menolak selama shift
   terbuka). Komputer dimatikan setelah shift ditutup.

---

## Bagian E. Prosedur administrasi sistem

### SOP-01 Pemasangan dan setup awal

| | |
|---|---|
| Pelaksana | Owner (dibantu pengembang bila perlu) |
| Waktu | Sekali saat mulai; ulangi bila data usaha berubah |

1. Pasang dengan *Setup-BonsaiUrip.exe* (lihat `pasang-laptop.md`). Pada pemasangan ulang di atas data lama,
   pilih **Pakai data yang sudah ada** kecuali data lama memang data uji.
2. Kerjakan **Setup awal** sampai selesai: data usaha, cara berjualan, akun Owner (dengan email), kode pemulihan
   (dicetak dan disimpan), logo & struk, rekening, email toko, cadangan, akun karyawan, data awal.
3. Ikuti tur pengenalan; minta setiap karyawan mengikuti tur sesuai perannya saat pertama masuk.
4. Isi data master dan stok awal sebelum transaksi sungguhan pertama (SOP-12 saldo awal).
5. Lakukan satu hari uji coba (transaksi contoh), lalu nonaktifkan contoh data sebelum hari pertama sungguhan.

### SOP-16 Akun pengguna dan keamanan

| | |
|---|---|
| Pelaksana | Owner |
| Waktu | Saat karyawan masuk/keluar; tinjauan bulanan |

1. Karyawan baru: buat akun dengan peran sesuai tugas (*Data Pengguna* › Tambah). Password awal diserahkan langsung
   dan **wajib diganti** karyawan saat pertama masuk.
2. Karyawan keluar: **nonaktifkan akunnya hari itu juga** dan cabut sesinya.
3. Lupa password: karyawan memakai *Lupa password?* (kode email atau kode pemulihan) atau Owner/Admin me-reset.
   Owner yang kehilangan semua jalan masuk (password, email, kode pemulihan): **hubungi pengembang**. Pemulihan
   dikerjakan di komputer server dengan kode tantangan dan kode jawaban pengembang (K-232); tercatat di log.
   Saran: daftarkan email Owner yang aktif dan simpan kode pemulihan di dua tempat agar langkah ini tidak perlu.
4. Tinjau *Pengaturan › Log Aktivitas* minimal sebulan sekali: aksi koreksi, persetujuan, perubahan pengaturan,
   login gagal berulang.
5. Komputer server: akun Windows berpassword; layar terkunci saat ditinggal.

### SOP-17 Cadangan dan pemulihan data

| | |
|---|---|
| Pelaksana | Owner |
| Waktu | Otomatis harian; pemeriksaan mingguan; uji pulih otomatis bulanan |

1. Cadangan diatur di setup awal atau *Pengaturan › Cadangan* ke disk **terpisah** (flashdisk/hardisk eksternal
   yang selalu terpasang, atau drive lain), dengan sandi yang dicatat di kertas.
2. Setiap minggu: buka *Pengaturan › Cadangan*, pastikan cadangan terakhir **Berhasil** dan tidak ada notifikasi
   cadangan bermasalah.
3. Bila gagal (flashdisk tercabut/penuh): perbaiki penyebab, **Cadangkan sekarang**, pastikan berhasil.
4. Pemulihan dari cadangan dilakukan bersama pengembang; siapkan sandi cadangan.
5. Sebelum memperbarui aplikasi (SOP-20), cadangkan sekarang.
6. **Kelola data (Pengaturan › Data):** sebelum perubahan besar, *Simpan salinan ke Pustaka*. Mengganti data aktif
   (*Pakai data ini*) hanya oleh Owner, di luar jam transaksi, setelah semua shift ditutup. Data di Pustaka yang
   tidak dipakai lagi dihapus agar disk tidak penuh; pengaman otomatis dibiarkan (dipangkas otomatis).
7. **Pindah komputer:** ekspor berkas `.bonsai` bersandi, simpan sandinya bersama kode pemulihan, impor di komputer
   baru lewat setup awal › *Lanjutkan data yang sudah ada*. Hapus berkas `.bonsai` dari flashdisk setelah selesai.

### SOP-18 Data master: barang, harga, pelanggan, pemasok

1. Barang baru dicatat **sebelum** dijual/diterima: nama baku (merek + jenis + ukuran), satuan dan konversi, harga
   modal awal, harga jual per tier, data muatan bila diantar.
2. Perubahan harga jual mengikuti kebijakan Owner (harga dasar, markup, pembulatan); barang bertanda *Perlu tinjau
   harga* ditinjau Admin dalam 1 hari kerja.
3. Pelanggan dan pemasok: No. HP format benar; tidak membuat data ganda (aplikasi menolak data sama persis dan
   menawarkan data mirip).
4. Data yang tidak dipakai lagi dinonaktifkan, tidak dihapus.

### SOP-19 Laporan dan tutup buku

| Kapan | Laporan | Oleh |
|---|---|---|
| Harian | Penjualan hari ini, shift & selisih, non-tunai tidak masuk | Owner/Admin |
| Mingguan | Stok kritis & saran pesan, piutang jatuh tempo, penyesuaian stok | Admin, ditinjau Owner |
| Bulanan | Laba rugi, penjualan per barang/kasir, hutang pemasok, log aktivitas | Owner |
| Tahunan | Opname penuh, tutup tahun (*Pengaturan › Arsip tahunan*) | Owner |

Laporan dicetak/disimpan PDF dan diarsipkan per periode; dokumen pembukuan disimpan 10 tahun.

### SOP-20 Pembaruan aplikasi

1. Pembaruan hanya dari Setup yang diserahkan langsung oleh pengembang (atau dibuat dengan `pintasan\Buat-Setup.cmd`
   di komputer pengembangan).
2. Tutup shift; cadangkan sekarang; pastikan berhasil.
3. Jalankan Setup baru; pilih **Pakai data yang sudah ada**.
4. Setelah menyala: buka *Tentang aplikasi*, pastikan versi baru; lakukan satu transaksi uji kecil lalu void.
5. Catat tanggal pembaruan dan versinya.

### SOP-21 Penanganan masalah

1. Aplikasi tidak bisa dibuka: klik ikon BonsaiUrip lagi. Bila muncul jendela galat, foto jendelanya.
2. Peramban "tidak dapat dijangkau": pastikan ikon BonsaiUrip ada di pojok kanan bawah; bila tidak, buka lagi.
3. Selisih uang/stok: ikuti SOP-15 dan *Panduan selisih stok*; jangan menutupi selisih dengan transaksi fiktif.
4. **Listrik/komputer mati mendadak saat shift terbuka:** nyalakan komputer (BonsaiUrip menyala sendiri bila
   pilihan nyala otomatis dicentang). Ikuti bilah pemulihan: periksa transaksi terakhir di Riwayat, cocokkan struk
   kertas, catat ulang transaksi yang sedang diketik saat mati, hitung uang laci, lanjutkan atau tutup shift, lalu
   **Sudah saya periksa**. Catat kejadian di Formulir Kejadian.
5. Kejadian penting (data salah besar, dugaan penyalahgunaan akun, kehilangan perangkat) dicatat di Formulir
   Kejadian (Lampiran L.5) dan dilaporkan ke Owner hari itu juga.
6. Hubungi pengembang dengan menyertakan: foto layar, waktu kejadian, akun yang dipakai, dan catatan dari
   `%LOCALAPPDATA%\BonsaiUrip\log` bila diminta.

---

## Lampiran

### L.1 Daftar periksa harian

**Buka toko (Kasir)**

- [ ] Komputer, printer struk, aplikasi menyala (ikon di pojok kanan bawah)
- [ ] Masuk dengan akun sendiri
- [ ] Shift dibuka, modal dihitung per pecahan
- [ ] Notifikasi diperiksa (order disimpan, non-tunai, void/retur menunggu)

**Selama hari**

- [ ] Setiap penjualan dicatat sebelum barang diserahkan
- [ ] Keranjang dibacakan ulang ke pembeli
- [ ] Non-tunai dengan rekening dan No. referensi yang benar
- [ ] Kas masuk/keluar selain penjualan dicatat
- [ ] Hasil pengiriman dicatat saat kendaraan kembali

**Tutup toko (Kasir, Admin/Owner)**

- [ ] Void/retur menunggu diselesaikan
- [ ] Non-tunai hari ini dicek masuk rekening (Admin/Owner)
- [ ] Uang dihitung per pecahan, selisih dijelaskan
- [ ] Shift ditutup; setoran dicatat
- [ ] Aplikasi dimatikan (bila komputer dimatikan) atau dibiarkan menyala sesuai kebijakan toko

### L.2 Daftar periksa mingguan (Admin, ditinjau Owner)

- [ ] Cadangan terakhir berhasil
- [ ] Saran pesan ditinjau, order pembelian dibuat
- [ ] Piutang jatuh tempo ditagih
- [ ] Opname kecil satu kategori
- [ ] Barang *Perlu tinjau harga* diselesaikan
- [ ] Daftar penyesuaian stok minggu ini ditinjau Owner

### L.3 Daftar periksa bulanan (Owner)

- [ ] Laporan laba rugi dan penjualan bulan lalu dicetak/diarsipkan
- [ ] Log aktivitas ditinjau
- [ ] Akun pengguna ditinjau (karyawan keluar sudah nonaktif)
- [ ] Uji pulih cadangan otomatis berhasil
- [ ] Kendaraan: jadwal servis, STNK/KIR

### L.4 Matriks tanggung jawab (P = pelaksana, S = menyetujui/meninjau, I = diberi tahu)

| Kegiatan | Owner | Admin | Kasir | Staf |
|---|:-:|:-:|:-:|:-:|
| Setup awal, pengaturan | P | I | | |
| Akun pengguna | P | | I | I |
| Buka/tutup shift | S | S | P | |
| Penjualan langsung | | | P | |
| Order penjualan | | | P (tagih) | P (catat) |
| Penjualan pengantaran | | P | P | |
| Pengiriman (rit, hasil) | S | P | P | |
| Cek non-tunai masuk | P | P | I | |
| Penerimaan barang | S | P | | |
| Order pembelian | S | P | | |
| Penyesuaian/opname | S | P | | |
| Void/retur | S | S | P | |
| Data master | S | P | | |
| Cadangan | P | I | | |
| Laporan bulanan, log | P | I | | |

### L.5 Formulir kejadian

| Isian | |
|---|---|
| Tanggal dan jam | |
| Pelapor | |
| Akun/komputer yang terlibat | |
| Uraian kejadian | |
| Nomor dokumen terkait (STR/INV/RCV/ADJ/…) | |
| Tindakan yang sudah diambil | |
| Keputusan Owner | |
| Tanda tangan Owner | |

---

## Riwayat dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 31 Oktober 2026 | Disusun pertama kali (K-208), mengikuti aplikasi versi 1.16.0. |
