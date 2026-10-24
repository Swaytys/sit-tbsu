# 12 — Anomali Alur Kerja

Dokumen hidup (K-120). **Anomali** = cara memakai fitur yang tidak sesuai harapan sistem: salah ketik, urutan
kerja terbalik, lupa, terburu-buru, gangguan perangkat, atau kesengajaan. Untuk setiap anomali dicatat tiga
jawaban wajib:

- **Atasi** — bila sudah terjadi: jalan koreksi yang aman, tercatat, dan tidak menghapus jejak.
- **Cegah** — sebelum terjadi: alur, konfirmasi, kunci, peringatan.
- **Ajari** — penjelasan di layar, tombol "?", dan pesan galat yang menyebut langkah benar.

Kolom **Status**: *Ada* = sudah berjalan (bila disertai K-…, sejak keputusan itu); *F14* = dikerjakan di Fase 14 (K-121/K-122); *Usulan* = belum dijadwalkan.

---

## 1. Shift & Clerical Check

Uang tunai adalah bagian paling rawan: setiap kesalahan langsung menjadi selisih kas, dan selisih yang tidak bisa
dijelaskan merusak kepercayaan antara kasir dan pemilik.

### 1.1 Saat membuka shift

| # | Anomali | Akibat bila dibiarkan | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| S1 | Salah ketik modal awal (mis. 1.500.000 tertulis 150.000) | Selisih besar saat tutup, kasir dicurigai | Koreksi modal: bebas sebelum ada transaksi tunai; sesudahnya dengan kode atasan; tercatat sebagai kas *Koreksi modal ±* beralasan, angka lama tetap | Dialog konfirmasi "Buka shift dengan modal Rp …?" (Enter = ya, Esc = kembali); usulan modal dari uang ditinggal kemarin | Konfirmasi menulis angka dengan huruf besar; "?" menjelaskan cara koreksi | Ada (K-121) |
| S2 | Dialog buka shift tertutup tidak sengaja / Esc tidak bekerja sebelum isian diklik | Kasir bingung, mengetik di tempat lain | — | Isian otomatis terfokus; Esc selalu menutup; Enter tidak langsung membuka (ada konfirmasi) | Petunjuk tombol di bawah dialog | Ada (K-121) |
| S3 | Toko sudah ramai sebelum kasir selesai menghitung uang | Antrean macet, atau kasir asal mengetik angka | *Buka dulu, hitung nanti*: modal sementara = uang ditinggal kemarin; hitungan susulan menghitung modal sebenarnya = hitungan − (tunai masuk − tunai keluar sejak buka) | Pilihan *Sama dengan kemarin* (1 Enter) bila laci tidak disentuh semalam; staf tetap bisa mencatat order tanpa shift | "?" menjelaskan kapan memakai tiap cara dan contoh rumus hitung susulan; pengingat 60 menit | Ada (K-121) |
| S4 | Hitungan susulan tidak pernah dilakukan | Modal sementara dianggap benar; selisih semalam masuk ke selisih shift | Saat tutup, ditandai "hitung buka tidak dilakukan" di hasil dan tinjauan | Banner di semua halaman kasir sampai hitungan dikirim; lonceng; batas 60 menit | Banner menyebut sisa waktu dan tombolnya | Ada (K-121) |
| S5 | Uang laci berubah semalam (dipakai, ditambah) | Selisih muncul di shift yang tidak bersalah | Hitungan buka (sekarang/susulan) mencatat *selisih semalam* = hitungan − uang ditinggal kemarin, dilaporkan ke Owner | Uang ditinggal dicatat saat tutup | Hasil buka menyebut selisih semalam dengan jelas | Ada (K-121) |
| S6 | Lupa membuka shift, langsung mau menerima tunai | Uang tidak tercatat di laci mana pun | — | Pembayaran tunai ditolak tanpa shift (K1); dialog buka shift muncul sendiri di layar kasir | Pesan menyebut "Buka shift dulu" dengan tombolnya | Ada |
| S7 | Membuka shift baru padahal shift kemarin belum ditutup | Uang dua hari bercampur | Tutup shift lama dulu (hitung uang) | Shift lewat hari mengunci pencatatan (K9) | Banner merah menyebut nomor dan tanggal shift | Ada |

### 1.2 Selama shift

| # | Anomali | Akibat | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| S8 | Pembayaran dicatat tunai padahal transfer (atau sebaliknya) | Selisih kas sebesar pembayaran itu | Bantuan selisih menunjuk pembayaran yang nominalnya sama; koreksi lewat void/retur | Cara bayar dipilih tegas (huruf T/B/E/Q); rekening dipilih dari daftar | Bantuan selisih menulis kemungkinan ini | Ada (bantuan K-121) |
| S9 | Kembalian salah | Selisih sebesar kembalian | Bantuan selisih menunjuk kembalian yang nilainya sama | Kembalian dihitung sistem dan tampil besar | Layar hasil menulis kembalian dengan huruf besar | Ada |
| S10 | Uang keluar laci tanpa dicatat (kasbon, beli bensin, setor) | Selisih kurang | Bantuan selisih menyarankan memeriksa kas keluar yang belum dicatat | Kas manual mudah dicatat; keterangan wajib | Daftar periksa umum di hasil tutup | Ada |
| S11 | Beberapa pengguna memakai laci yang sama | Laci terbagi ke beberapa shift, hitungan tidak bisa cocok | Sisa shift ganda lama wajib ditutup; pencatatan ditolak sampai tersisa satu | Satu shift toko (K-132); setiap catatan menyimpan pencatatnya | Indikator shift di topbar untuk semua peran | Ada (K-132) |
| S12 | Aplikasi ditutup/listrik padam saat shift berjalan | Tidak ada; data di server | Buka lagi, shift masih berjalan | Data disimpan di server per transaksi | — | Ada |

### 1.3 Saat menutup shift

| # | Anomali | Akibat | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| S13 | Salah hitung uang saat tutup | Selisih palsu | Hitung ulang **satu kali**; kedua hitungan tercatat dan tampil ke atasan | Hitung per pecahan (sistem menjumlah); hitungan pertama terkunci | "?" dan pesan hasil menjelaskan hitung ulang sekali | Ada (K-121) |
| S14 | Kasir melihat angka sistem lalu menyamakan hitungannya | Selisih tersembunyi (kecurangan) | Hitungan pertama tetap tercatat dan terlihat atasan | Hitung buta: angka sistem tampil setelah hitungan dikirim; hitung ulang dibatasi satu | — | Ada |
| S15 | Selisih receh karena pembulatan kembalian | Kasir harus menulis keterangan untuk Rp 200 | Ditandai *selisih receh* otomatis | Toleransi (bawaan Rp 1.000) | Hasil menulis "selisih receh, dalam toleransi" | Ada (K-121) |
| S16 | Keterangan selisih diisi sebelum tahu berapa selisihnya | Keterangan tidak bermakna | — | Keterangan diminta **setelah** hasil tampil | Hasil + bantuan selisih tampil di samping isian keterangan | Ada (K-121) |
| S17 | Menutup shift padahal masih ada order yang dipegang kasir | Order tergantung | Pilihan per order: kembalikan ke antrean, simpan, ke draf, batalkan | Daftar order tampil sebelum menghitung | Teks menjelaskan akibat tiap pilihan | Ada (K-122) |
| S18 | Uang yang ditinggal untuk besok tidak dicatat | Modal besok harus dihitung ulang dari nol | — | Isian *uang ditinggal di laci* saat tutup (terisi sebesar modal, boleh diubah, boleh 0) | Penjelasan bahwa angka ini jadi usulan modal besok | Ada (K-121) |
| S19 | Kasir lupa menutup shift sampai malam / besok | Uang dua hari bercampur | Admin/Owner menutup dari Semua shift (alur dua langkah yang sama) | Pengingat jam tutup, lonceng, Telegram atasan; kunci saat ganti hari | Banner biru/kuning/merah | Ada (K-109) |
| S20 | Selisih ditemukan sebabnya setelah shift ditutup | Angka salah selamanya | Admin/Owner menambah *penjelasan selisih* (terjelaskan), angka tetap | — | Riwayat menampilkan penjelasan | Ada (K-121) |
| S21 | Pencatatan uang masuk saat shift sedang dihitung | Hitungan tidak cocok | — | Status *Dihitung* menolak pencatatan uang baru | Pesan: "Shift sedang ditutup; selesaikan dulu" | Ada (K-121) |
| S22 | Pembeli datang setelah shift ditutup | Penjualan tidak bisa dicatat, atau dicatat ke shift yang salah | Buka shift baru, *Pakai uang kemarin* (1 Enter) | Order dan non-tunai tetap bisa tanpa shift | Pesan "Shift toko belum dibuka" + tombol buka | Ada (K-140) |
| S23 | Pembeli tidak mengambil kembalian | Laci lebih dari catatan | — | Pilihan *Kembalian tidak diambil* (K) di layar bayar; dicatat kas masuk khusus | Label di layar bayar | Ada (K-141) |
| S24 | Retur/void diajukan di satu shift, disetujui di shift berikutnya | Uang refund dikira hilang | Refund tercatat di shift saat disetujui | Kotak *Tutup shift* menampilkan pengajuan yang menunggu | Teks: uang belum keluar dari laci | Ada (K-142) |
| S25 | Salah hitung saat hitung susulan | Modal awal salah | Hitung ulang sekali; setelah disimpan: Koreksi modal | Hasil ditampilkan dengan angka sebelum disimpan; koreksi modal dikunci sampai disimpan | Contoh angka di "?" | Ada (K-134) |
| S26 | Dialog kode atasan tertutup sebelum kode diketik | Kode baru terkirim lagi, atasan bingung | Permintaan yang masih berlaku dilanjutkan | Satu permintaan menunggu per urusan | Teks "berlaku sampai …" | Ada (K-136) |

---

## 2. Order penjualan

| # | Anomali | Akibat | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| O1 | Pembeli pergi (lupa dompet) setelah order masuk antrean | Antrean penuh order mati; stok tertahan | Kembalikan order ke draf (reservasi dilepas, barang tetap tersimpan) | — | Pilihan di tiket antrean dan layar kasir | Ada (K-122) |
| O2 | Pembeli memesan untuk diambil beberapa hari lagi | Order menumpuk di antrean | Simpan order (nama, HP, tanggal ambil wajib; stok ditahan ≤ 14 hari) | Daftar order disimpan terpisah dari antrean | Notifikasi lewat tanggal | Ada (K-122) |
| O3 | Pembeli lain mengambil barang yang sedang di draf pembeli pertama | Pembeli pertama kecewa | Hapus lagi dari order ini, atau buka draf pembeli pertama | Peringatan "barang ini ada di draf …" saat stok tidak cukup untuk semuanya | Pesan menyebut draf, pembeli, pembuat, qty | Ada (K-122) |
| O4 | Order dibuat dua kali untuk pembeli yang sama | Stok tertahan dua kali | Batalkan salah satu (alasan) | Peringatan draf (O3) | — | Ada (K-122, peringatan draf) |
| O5 | Staf lupa mengirim order; isian hilang | Order harus diketik ulang | Draf otomatis (K-095) | — | — | Ada |

---

## 3. Penjualan, retur, void

| # | Anomali | Akibat | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| P1 | Salah barang/qty setelah dibayar | Stok dan uang salah | Void (shift yang sama) atau retur | Konfirmasi "Mulai dari awal"; daftar barang terlihat saat bayar | Pesan void/retur menyebut syaratnya | Ada |
| P2 | Pengajuan retur/void salah input | Dokumen salah disetujui | Batalkan pengajuan selama menunggu (K-099) | Kode atasan memuat rincian | — | Ada |
| P3 | Uang transfer tidak benar-benar masuk | Penjualan dianggap lunas | Tandai *Tidak masuk*, tagih pembeli | Cek uang non-tunai harian (K-111) | Lonceng *belum dicek* | Ada |
| P4 | Promo happy hour/hari tertentu dibuat dengan jam terbalik atau melewati tengah malam | Promo tidak pernah berlaku | Ubah jamnya | Jam selesai wajib setelah jam mulai (validasi dan CHECK DB) | Contoh "13:00–15:00" di form | Ada (K-163) |
| P5 | Kasir mengetik qty tanpa barang gratis (beli 10 gratis 1, pembeli bawa 11) | Gratis tidak terhitung | Ubah qty | Penjelasan di form: qty = semua yang dibawa | Teks bantuan di bagian Manfaat | Ada sebagian (K-163) |
| P6 | Promo lama dijadikan dasar promo baru dengan menyalin manual | Isian beda/terlupa | — | Templat kampanye: simpan dan pakai ulang isian | Menu ⋯ › Simpan sebagai templat | Ada (K-163) |
| P7 | Catatan bertanggal tahun yang sudah ditutup | Arsip tidak sama dengan database | Buka kembali tahun (Owner, alasan), koreksi, tutup ulang | Isian bertanggal tahun ditutup ditolak; Periksa arsip mendeteksi selisih | Pesan menyebut tahun ditutup | Ada (K-165) |
| P8 | Tahun ditutup padahal masih ada order/shift/retur setengah jalan | Dokumen menggantung di tahun terkunci | — | Tutup tahun ditolak dengan daftar penghalang | Penghalang tampil di kartu tahun | Ada (K-165) |
| P9 | Pembaruan aplikasi merusak data lama | Data hilang/aplikasi mati | Mundur otomatis ke versi lama; pulihkan cadangan sebelum pembaruan | Uji migrasi pada salinan sebelum migrasi asli; server dihentikan sebelum cadangan | Versi dan status migrasi di Tentang aplikasi | Ada (K-166) |

---

## 4. Pengantaran (K-149–K-151)

| # | Anomali | Akibat | Atasi | Cegah | Ajari | Status |
|---|---|---|---|---|---|---|
| A1 | Satu truk dipakai dua surat jalan berbeda rute pada saat bersamaan | Jadwal kacau; sopir "dua tempat" | — | Kendaraan dan sopir yang sedang jalan tidak bisa dipilih (dicek service + indeks unik; dua keberangkatan bersamaan diserialkan kunci baris) | Pilihan bertanda "sedang jalan (TRP-…)" | Ada |
| A2 | Hasil antar lupa dicatat; kendaraan terkunci terus | Kendaraan tidak bisa berangkat lagi | Catat hasil dari kartu *Di jalan* | Kartu perjalanan menguning setelah 6 jam atau ganti hari | Pesan "catat hasilnya agar kendaraan & sopir bebas" | Ada |
| A3 | Hasil dicatat dua kali (dua kasir bersamaan) | Retur/stok ganda | — | Surat jalan dikunci; hasil unik per surat jalan; kedua kali ditolak "sudah dicatat" | — | Ada |
| A4 | Jumlah hasil tidak sama dengan qty kirim | Barang "hilang" dari catatan | — | Diterima dihitung otomatis = kirim − (kembali + rusak + ditolak); angka merah bila lebih; API menolak | Kolom *Diterima* tampil langsung | Ada |
| A5 | Barang kembali utuh lalu terlupa | Pembeli tidak menerima barangnya | Kirim ulang dari kolom *Backlog* di papan Pengiriman | Sisa otomatis masuk kolom itu dengan tanda *Kirim ulang* | Toast setelah simpan hasil | Ada |
| A6 | Barang ditolak/rusak dikirim ulang padahal retur masih menunggu atasan | Barang terkirim ganda | Putusan atasan menentukan | Qty dengan retur menunggu tidak dihitung "belum dikirim" | Ringkasan hasil menandai "menunggu atasan" | Ada |
| A7 | Retur biasa dibuat untuk barang yang masih di surat jalan | Stok masuk padahal barang di truk | Catat hasil dulu atau batalkan surat jalan | Retur ditolak dengan pesan itu | Pesan menyebut jalan keluarnya | Ada |
| A8 | Rusak di jalan, tetapi stok pengganti habis | Tidak bisa tukar | Pilih *Tagihan dikurangi*, atau tambah stok lalu catat | Ditolak dengan saran | Pesan menyebut sisa stok | Ada |
| A9 | Invoice sudah lunas lalu barang ditolak | Uang pembeli harus kembali | Pilih tunai (uang shift) atau transfer | API meminta cara pengembalian bila nilai melebihi sisa tagihan | Isian muncul di dialog | Ada |
| A10 | Kendaraan/sopir dinonaktifkan saat sedang jalan | Perjalanan tak bisa diselesaikan rapi | — | Ditolak sampai hasil dicatat | Pesan menyebut nomor perjalanan | Ada |
| A12 | Barang dimuat melebihi daya angkut kendaraan | Rem/ban/sumbu berbahaya, pelanggaran ODOL | Pakai kendaraan lain atau bagi dua rit | Berangkat ditolak bila berat > daya angkut | Panel muatan menjelaskan sebab dan saran | Ada (K-161) |
| A13 | Barang sedikit melebihi bak (ditumpuk/menjulur) | Barang jatuh, kendaraan tidak stabil | Periksa setelah dimuat | Alasan tertulis wajib (tercatat di rit dan log); jauh melebihi ditolak | Contoh alasan di isian | Ada (K-161) |
| A14 | Berat/ukuran barang atau bak belum diisi | Muatan tidak bisa diperiksa | Lengkapi data | Peringatan "belum punya berat/ukuran" di panel muatan | Petunjuk tempat mengisinya; saring *Data muatan belum lengkap* lalu *Isi lewat Excel* untuk banyak barang | Ada (K-161) |
| A15 | Surat jalan dibuat tetapi tidak dimasukkan ke rit mana pun | Barang tidak pernah berangkat | Seret ke grup rit | Kotak *Belum direncanakan* dengan garis putus-putus di kolom Dijadwalkan; tombol Berangkat hanya ada di grup rit | Teks "belum bisa berangkat. Seret ke grup rit." | Ada (K-160) |
| A16 | Dua orang mengubah rit yang sama (satu memberangkatkan, satu memindah kartu) | Kartu masuk rit yang sudah jalan | Muat ulang halaman | Baris rit dikunci; aksi pada rit yang bukan rencana lagi ditolak; papan menyegarkan tiap 30 detik | Pesan "sudah berangkat; muat ulang halaman" | Ada (K-160) |
| A17 | Rit rencana dibatalkan padahal barang sudah dinaikkan | Barang di truk tanpa rit | Masukkan ke rit lain atau keluarkan barangnya | Surat jalan tidak ikut batal, kembali ke *Belum direncanakan* dengan status Dimuat | Lencana *Dimuat* tetap terlihat | Ada (K-160) |
| A18 | Kartu terseret ke kolom yang salah | Surat jalan batal tanpa sengaja | — | Seret ke Backlog hanya membuka dialog batal (alasan wajib), tidak langsung membatalkan | Dialog menjelaskan akibatnya | Ada (K-160) |
| A19 | Odometer salah ketik (lebih kecil dari sebelumnya, atau angka susulan tidak urut) | km tempuh dan km/L kacau | Batalkan catatan yang salah, catat ulang | Ditolak dengan angka pembanding; diperiksa menurut urutan tanggal | Pesan menyebut angka sebelumnya dan cara memperbaikinya | Ada (K-162) |
| A20 | Servis terlupa | Kendaraan rusak di jalan | Catat servis | Pengingat 500 km / 14 hari sebelumnya, merah bila terlewat, di daftar kendaraan dan notifikasi | Teks "Jadwal servis belum diatur" mengajak mengisi jadwal | Ada (K-162) |
| A21 | STNK/KIR habis tetapi kendaraan tetap dipakai | Tilang, kendaraan ditahan | Perpanjang surat, ubah tanggal di data kendaraan | Pengingat 30 hari; pilihan kendaraan bertanda *KIR habis* (keputusan tetap di atasan) | Notifikasi menyebut plat | Ada (K-162) |
| A22 | Struk BBM dicatat dua kali | Biaya ganda | Batalkan salah satunya | Daftar BBM per kendaraan menampilkan tanggal, odometer, liter berdampingan | Catatan batal tetap terlihat dengan alasannya | Ada sebagian (tanpa deteksi otomatis) |
| A11 | Plat/nama sopir diketik beda-beda | Data ganda, riwayat terpecah | Ubah data master | Plat dirapikan huruf besar + satu spasi, unik; nama sopir unik tanpa beda huruf | Contoh format di form | Ada |

---

## Riwayat

- 2026-10-18 — v1: anomali Shift & Clerical Check (S1–S21), order penjualan (O1–O5), penjualan/retur/void (P1–P3)
  (K-120).
- 2026-10-18 — Status S1–S5, S8–S10, S13–S16, S18, S20, S21 menjadi *Ada* setelah gelombang shift K-121 selesai;
  S17 menunggu K-122.
- 2026-10-18 — O1–O4 dan S17 menjadi *Ada* (order disimpan, kembali ke draf, peringatan draf lain, pilihan order saat tutup shift; K-122).
- 2026-10-18 — S11 diperbarui; S22–S26 (setelah tutup, kembalian tidak diambil, retur lintas shift, salah hitung susulan, dialog kode) (K-132–K-142).
- 2026-10-23 — Bagian 4 pengantaran A1–A11 (K-149–K-151).
- 2026-10-24 — Shift ganda kini mustahil (indeks unik, K-155); pembayaran non-tunai tanpa rekening terdaftar/referensi dicegah (K-154).
- 2026-10-24 — A12–A14 muatan kendaraan (K-161).
- 2026-10-24 — A14 menjadi *Ada* (saring belum lengkap + isi massal Excel).
- 2026-10-24 — A19–A22 catatan BBM/servis dan pengingat (K-162).
- 2026-10-24 — P4–P6 kampanye promo (K-163).
- 2026-10-24 — P7–P9 arsip tahunan dan pembaruan aman (K-165, K-166).
- 2026-10-24 — A15–A18 rit rencana dan papan Pengiriman (K-160); A5 menunjuk kolom Backlog.
