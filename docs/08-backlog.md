# 08 — Backlog versi berikutnya

Dokumen hidup berisi usulan yang **sengaja tidak dikerjakan** di fase aktif (CLAUDE.md: fitur di luar fase dicatat
sebagai usulan). Sumber: masukan pemilik proyek dan temuan saat pengembangan. Urutan dalam sprint = prioritas
awal; diputuskan ulang sebelum sprint dimulai.

## Penomoran versi (usulan K-062)

| Versi | Isi | Rujukan |
|---|---|---|
| **v1.0.0 (MVP)** | M1: Fase 1–8. Dipakai toko untuk transaksi sungguhan. | docs/07 |
| v1.1–v1.4 | M2: Fase 9–12 (harga & promo, hutang pemasok, konsinyasi, multi-satuan). Skema sudah siap. | docs/07 |
| **v2.0.0** | Sprint A–F di bawah: produktivitas data, peran kustom, keuangan ringan, perbaikan, stok opname & pemilihan barang, POS & pintasan. | dokumen ini |
| **v3.0.0** | Pembukuan (akuntansi dagang) dan fitur skala (cabang, gudang). | dokumen ini |

---

## v2.0.0 — Sprint A: Produktivitas data

Tujuan: pekerjaan berulang pada banyak baris selesai sekali jalan; kesalahan kecil bisa diperbaiki tanpa
meninggalkan halaman; pekerjaan yang belum disimpan tidak hilang. Fungsi lengkap tetap di halaman utamanya;
fitur di sini adalah jalan pintas yang tunduk pada izin yang sama.

| # | Fitur | Catatan |
|---|---|---|
| A1 | **Pilih banyak baris + aksi massal** di tabel master (barang, pelanggan, pemasok, kategori, merk, satuan): aktifkan/nonaktifkan, ubah kategori/merk/stok minimum. | Satu transaksi; log per baris + ringkasan; konfirmasi menyebut jumlah baris. |
| A2 | **Edit massal harga**: pilih barang → ubah harga tier dengan nilai tetap, ± persen, ± rupiah, lalu pembulatan; pratinjau lama → baru sebelum simpan. | Hanya `master.harga.kelola`. Melepas tanda tinjau (H5). |
| A3 | **Edit cepat dari halaman lain** (mis. dari order penjualan/kasir): dialog ubah harga atau data barang tanpa keluar halaman, isi order tetap. | Admin/Owner boleh ubah harga; Staf/Kasir tidak (izin sama dengan halaman utama). |
| A4 | **Draf otomatis & pulihkan**: form panjang (order, penerimaan, form barang, import) menyimpan draf; saat dibuka lagi ditawarkan "pulihkan". | Draf disimpan di server per pengguna (bukan localStorage: CLAUDE.md melarang data bisnis di browser). |
| A5 | **Tambah barang massal (varian)**: isi data induk sekali (kategori, merk, satuan, harga dasar), lalu tabel baris varian yang hanya berbeda atribut (ukuran, warna), kode, dan harga. | Memakai `buatBarang()` yang sama dengan form dan import. |
| A6 | **Salin barang** ("buat dari barang ini"). | |
| A7 | **Tambah cepat referensi** dari form: kategori/merk/satuan baru langsung dari dropdown. | Butuh izin kelola referensi. |
| A8 | **Kotak cari (combobox)** untuk memilih barang/pelanggan/pemasok bila datanya ribuan. | Dropdown pemasok di form barang kini hanya memuat 100 pertama. |
| A9 | Pintasan keyboard global dan pencarian perintah (Ctrl+K). | |
| A10 | Batalkan (undo) singkat untuk aksi massal. | |
| A11 | **(masukan pemilik 2026-10-10) Promo v2**: satu promo untuk **banyak barang pilihan** (bukan hanya semua/satu kategori/satu barang); tabel promo yang bisa **diedit massal** (pilih banyak promo/barang → ubah potongan, masa, syarat); salin promo; syarat tambahan: nilai belanja barang itu (bukan total transaksi), hari/jam tertentu, potongan bertingkat menurut qty. | Dasar saat ini (K-097/K-098): promo per semua/kategori/barang dengan syarat qty, total belanja, pembeli, dan belanja pelanggan N hari; dipotong dari harga tier. Promo bertingkat butuh revisi PR4/PR8. |
| A12 | **(masukan pemilik 2026-10-12) Uang masuk non-tunai terdeteksi otomatis** lewat payment gateway (QRIS dinamis dan virtual account per transaksi): pembayaran ditandai *Sudah masuk* oleh sistem begitu dana diterima, beserta nominalnya. | Tidak ada jalur yang gratis dan resmi: API bank butuh kontrak, payment gateway memotong biaya per transaksi, layanan cek mutasi berlangganan (K-111). Dasarnya sudah ada: daftar rekening toko dan status pengecekan per pembayaran; gateway cukup mengisi status itu. Perlu keputusan pemilik soal biaya sebelum dikerjakan. |

## v2.0.0 — Sprint B: Peran dan hak akses kustom

| # | Fitur | Catatan |
|---|---|---|
| B1 | **Owner membuat peran sendiri** dan memilih izin/halaman yang boleh diakses. Empat peran sekarang (Owner, Admin, Kasir, Staf Penjualan) menjadi templat bawaan yang bisa disalin. | Skema: tabel `peran`, `peran_izin`, `pengguna.id_peran`; migrasi data dari kolom `peran`. |
| B2 | Batas diskon dan pengaturan per peran ikut peran kustom. | `batas_diskon_persen_<PERAN>` pindah ke tabel peran. |
| B3 | Pengaman: Owner tidak bisa mencabut izin kelola peran dari dirinya sendiri; minimal satu Owner aktif. | Tes wajib. |

## v2.0.0 — Sprint C: Keuangan ringan (bukan akuntansi)

Sudah direncanakan di v1/M2: piutang pelanggan dan pembayaran bertahap/DP (Fase 5–7), hutang dan pembayaran
pemasok (Fase 10), kas masuk/keluar per shift (Fase 6).

| # | Fitur | Catatan |
|---|---|---|
| C1 | **Uang muka / deposit pelanggan**: saldo titipan yang dipakai untuk transaksi berikutnya. | Buku saldo per pelanggan (append-only). |
| C2 | **Pengeluaran operasional** di luar shift (listrik, gaji, sewa) dengan kategori sederhana. | |
| C3 | **Akun kas & bank** (kas utama, rekening bank) dan transfer antar-akun; saldo per akun. | Dari parameter "Kas utama/Bank utama" sistem lain. |
| C4 | Laporan arus kas sederhana per periode; pengingat jatuh tempo piutang/hutang (tautan WhatsApp). | |

## v2.0.0 — Sprint D: Penemuan dan perbaikan (improvement discovery)

Sprint pertama v2 dibuka dengan audit terarah; hasilnya daftar temuan berprioritas yang masuk ke sprint berikut.

| Area | Yang diaudit / temuan awal |
|---|---|
| Kecepatan | Import 2.000 baris ±20 dtk pratinjau + ±20 dtk simpan (diukur 2026-09-30) → proses batch, target < 5 dtk. Pencarian `ILIKE` cukup s.d. puluhan ribu barang (5.000 barang: 5–28 ms); indeks trigram bila > 50.000. Uji beban 50.000 barang dan 1 tahun transaksi. |
| Keamanan | Audit dependensi berkala, 2FA untuk Owner, daftar sesi per perangkat, kebijakan password, audit log ekspor data. |
| Data fisik | Arsip/partisi log aktivitas dan mutasi lama, ukuran database per tahun, kompresi gambar saat unggah (resize otomatis). |
| Kenyamanan | Uji dengan pengguna nyata (waktu per tugas), tema warna & mode gelap, ukuran huruf, aksesibilitas, cetak. |
| Ketahanan | Perilaku saat koneksi ke server putus (mini-PC toko), antrean ulang, pesan yang jelas. |

Usulan dari Fase 7 (laporan):

| # | Fitur | Catatan |
|---|---|---|
| D-L1 | **Analisis ABC/Pareto** di Laporan Produk Terlaris: kelas A (kumulatif ≤ 80%), B (≤ 95%), C, untuk prioritas stok & restock. | Kolom kumulatif sudah ada (K-079); tinggal klasifikasi + saringan per kelas. |
| D-L2 | **Kartu stok untuk barang nonaktif**: pemilih barang di laporan ikut menampilkan barang nonaktif yang masih punya riwayat mutasi. | Sekarang hanya barang aktif yang bisa dicari (tautan langsung tetap bisa). |
| D-L3 | **Laporan kas per shift / clerical periode**: rekap modal, penerimaan tunai, kas keluar, selisih per kasir per periode. | Data sudah ada (Fase 6); belum termasuk 10 laporan M1. |
| D-L4 | Laporan dibandingkan periode sebelumnya (bulan ini vs bulan lalu) dan grafik tren di dokumen laporan. | |

Temuan tinjauan kode 10 Oktober 2026 yang sengaja tidak dikerjakan saat itu (K-100):

| # | Temuan | Catatan |
|---|---|---|
| D-K1 | **Komponen layar yang terlalu besar**: form barang (±1.100 baris), form order (±870), penyesuaian stok (±840), form promo (±830), layar POS (±810). Dipecah menjadi bagian form + hook saat komponen itu berikutnya diubah. | Tidak ada cacat fungsi; biayanya di keterbacaan dan risiko saat mengubah. Jangan dipecah tanpa alasan fungsi (risiko regresi). |
| D-K2 | **(selesai, K-101) Melampaui limit kredit dengan persetujuan di tempat.** Sebelumnya hanya pengguna yang sedang login dan memegang `master.pelanggan.atur_kredit` yang bisa melanjutkan; di toko satu perangkat kasir harus keluar dulu. Kini kasir memakai dialog *Persetujuan atasan* yang sama dengan retur/void. | Disetujui pemilik 2026-10-10; PT6 (docs/06) dan docs/04 §6 diperbarui. |
| D-K3 | **Daftar hutang dihitung di memori**: `daftarHutang` dan `hutangJatuhTempo` memuat semua hutang yang belum lunas lalu menyaring dan memotong halaman di server aplikasi. | Aman sampai ribuan dokumen terbuka; pindahkan saringan, halaman, dan ringkasan ke SQL bila hutang terbuka > ±5.000 dokumen. |
| D-K4 | **Cookie sesi `Secure` mengikuti `NODE_ENV=production`.** Untuk aplikasi desktop (Fase 13) yang membuka `http://localhost`, peramban modern menganggap localhost aman, tetapi perlu diuji di pembungkus desktop yang dipakai. | Dikerjakan bersama Fase 13.1. |
| D-K5 | **Berkas Excel raksasa setelah dibuka (zip bomb)**: batas 5 MB berlaku untuk berkas terkompresi. | Hanya Admin/Owner yang bisa mengunggah; batasi jumlah baris/lembar saat membaca bila import dibuka untuk peran lain. |
| D-K6 | **Penguncian akun bisa dipicu sengaja** (5 kali salah password atas nama orang lain, dari halaman masuk atau dialog persetujuan). | Tercatat di log beserta IP/sesi pengaju; Owner bisa membuka kunci. Terkait 2FA di baris Keamanan di atas. |
| D-K7 | `esbuild` lama di rantai `drizzle-kit` (hanya alat pengembangan). | Hilang saat `drizzle-kit` diperbarui; tidak berjalan di server toko. |
| D-K8 | Kolom kunci asing sekunder (yang tidak dipakai menyaring daftar atau laporan) tidak punya indeks sendiri; kolom utama (header, barang, pelanggan, kasir, shift, tanggal) sudah berindeks. | Tidak terasa pada skala toko; tambah indeks berdasarkan `EXPLAIN` saat uji beban Sprint D. |
| D-K9 | **Memori komputer server.** Saat diuji di komputer 7,7 GB yang memorinya hampir penuh, PostgreSQL sekali menjawab `out of memory`. Aplikasi kini menjawab 503 dengan pesan yang menyebut sebabnya, tetapi akar masalahnya di perangkat. | Server toko (dan komputer untuk versi desktop, Fase 13): RAM minimal 8 GB dengan aplikasi lain ditutup, disarankan 16 GB; tulis di panduan pasang. |
| D-K10 | **Persetujuan dengan membalas pesan** (atasan menekan Setuju/Tolak di Telegram, tanpa menyebutkan kode ke kasir) dan pemberitahuan pengajuan retur/void yang menunggu ke Telegram/email atasan. | Butuh server yang terus membaca pesan masuk bot; cocok setelah server online (v3). Dasarnya (bot, kontak atasan, K-102) sudah ada. |
| D-K11 | **Kode persetujuan lewat WhatsApp.** | Ditawarkan dan tidak dipilih pemilik (K-102): jalur resmi butuh verifikasi bisnis Meta dan templat berbayar; gateway tidak resmi berisiko blokir. Saluran baru cukup ditambahkan di `sistem/saluran`. |
| D-K12 | **Pembatalan pembayaran otomatis** untuk pembayaran non-tunai yang ditandai *Tidak masuk*: dokumen pembatalan yang mengurangi jumlah terbayar dan menghidupkan kembali sisa tagihan. | Sekarang *Tidak masuk* hanya tanda (K-111): penjualan tidak berubah, tindak lanjut oleh atasan (menagih pembeli, atau void/retur). Butuh dokumen koreksi baru karena `pembayaran_penjualan` hanya-tambah; dikerjakan bila kasusnya sering terjadi di toko. |

---

## v2.0.0 — Sprint E: Stok opname dan pemilihan barang (masukan pemilik 2026-10-02)

| # | Fitur | Catatan |
|---|---|---|
| E1 | **Modul Stok Opname tersendiri**: jadwal opname per periode (semua barang atau bergilir per kategori), pengingat di lonceng notifikasi dan dashboard saat jadwal tiba. | Dokumen tetap `ADJ` jenis OPNAME (ledger tidak berubah); modul menambah jadwal & pemantauan. |
| E2 | **Cakupan opname**: daftar barang aktif yang belum teropname dalam periode berjalan, persentase cakupan, barang yang dikecualikan beserta alasan dan siapa yang mengecualikan. | Transparansi: tidak ada barang yang diam-diam terlewat. |
| E3 | **Grafik & riwayat selisih**: selisih per periode (qty dan rupiah), barang yang sering selisih, akurasi stok per kategori. | Data dari dokumen OPNAME yang sudah selesai. |
| E4 | **Pemilih barang grafis**: jelajah barang per kategori/merk dalam kartu bergambar, saring atribut (ukuran, warna), untuk saat nama barang lupa. Dipakai di penerimaan, penyesuaian, order, kasir. | Pelengkap kotak cari (`PilihBarang`), bukan pengganti; keyboard tetap utama di kasir. |

## v2.0.0 — Sprint F: POS, pintasan keyboard, dan printer (masukan pemilik 2026-10-03)

| # | Fitur | Catatan |
|---|---|---|
| F1 | **Halaman Pengaturan › Pintasan keyboard**: daftar semua tombol (layar kasir, pengantaran, input order cepat, umum) dan **bisa diganti** per aksi; deteksi bentrok antar-tombol; tombol "kembalikan bawaan". | Disimpan di konfigurasi toko (berlaku semua komputer) atau per pengguna; F1/F6/F7/F10–F12 tidak bisa dipakai (dicadangkan peramban, K-073). |
| F2 | **Pintasan umum di semua halaman**: urungkan (Ctrl+Z), ulangi (Ctrl+Y / Ctrl+Shift+Z), simpan (Ctrl+S), cari (Ctrl+K), hapus ke "keranjang sampah"/pulihkan, pindah tab halaman, tutup dialog — juga bisa diganti di F1. | Urungkan/ulangi berlaku untuk perubahan yang belum disimpan; dokumen yang sudah tersimpan tetap dikoreksi lewat dokumen baru (CLAUDE.md aturan 3). |
| F3 | **Panduan tombol yang bisa dibuka/ditutup** kapan saja (mis. tombol `?`) di Order Penjualan, layar kasir, dan pengantaran: ringkasan alur + daftar tombol; pilihan "jangan tampilkan lagi" per pengguna. | Bilah tombol bawah (K-073) tetap ada dan bisa disembunyikan. |
| F7 | **(masukan pemilik 2026-10-10) Tombol "?" di setiap halaman** sebagai tutor: cara pakai halaman, arti istilah/lencana, dan langkah umum; isi bisa dicari. | Dasarnya sudah ada (komponen `Penjelasan`, K-099) di Harga Jual, Kelola tier, dan Promo; tinggal ditulis untuk halaman lain. Terkait F3 dan tutorial awal Fase 13.4. |
| F4 | **(sebagian selesai, K-103 dan K-105: struk langsung ke printer thermal ESC/POS, pilih printer terpandu, uji cetak, cetak tebal; sisa: **printer per jenis dokumen** (struk, label, invoice/surat jalan, laporan) dan cetak tanpa jendela untuk dokumen A4, jumlah salinan, logo di struk langsung, memilih printer menurut namanya; semuanya menjadi syarat aplikasi desktop Fase 13.1, K-112)** **Pengaturan › Printer**: aktif/nonaktif cetak struk otomatis per komputer kasir, pilih printer struk & printer A4, jumlah salinan, uji cetak. | Peramban tidak bisa memilih printer sendiri; butuh agen cetak lokal kecil (atau ESC/POS lewat Web Serial) — dinilai saat Sprint F. Sampai itu: `scripts/kasir/buka-kasir.cmd` (K-074). |
| F5 | **(selesai, K-103)** Laci uang terbuka otomatis saat struk tunai dicetak (perintah ESC/POS lewat printer struk). | Bergantung F4. |
| F6 | **(masukan pemilik 2026-10-09) Tata letak POS bisa diatur pengguna**: daftar barang, papan antrean, panel bayar, dan hasil cari bisa diperlebar/dipersempit dengan menarik pembatas; ukuran diingat per komputer; tombol "kembalikan tata letak". | Preferensi tampilan (boleh `localStorage`). Cetak senyap & pilihan "tanya dulu/tidak cetak" sudah ada sejak K-095. |
| F8 | **(masukan pemilik 2026-10-12) Katalog bergambar di layar penjualan**: kisi kartu barang dengan foto besar, kategori, atribut, harga per satuan, stok, dan tanda promo; bisa dijelajahi tanpa mengetik dan disaring per kategori/atribut; klik kartu = tambah ke keranjang. Termasuk membuat gambar kecil (thumbnail) saat foto diunggah agar katalog ringan. | Dasarnya sudah ada (K-108): cari per atribut dan kategori, tombol **Daftar**, dan foto kecil di hasil cari. Katalog adalah pelengkap, bukan pengganti kotak cari; keyboard tetap jalur tercepat di kasir. Dikerjakan bersama E4 (pemilih barang grafis). |

## v3.0.0 — Pembukuan dan skala

| # | Fitur | Catatan |
|---|---|---|
| V1 | Akuntansi dagang: bagan akun, jurnal otomatis dari transaksi, buku besar, neraca, laba rugi. | |
| V2 | Tutup periode ("bulan dan tahun proses"): transaksi periode tertutup tidak bisa diubah/dibatalkan. | |
| V3 | Multi-gudang/lokasi dan cabang ("gudang masuk/keluar utama"). | |
| V4 | Multi-valuta. | Saat ini Rupiah saja. |

---

## Tinjauan parameter pengaturan dari sistem lain (2026-09-30)

| Parameter | Keputusan |
|---|---|
| Nama perusahaan, alamat, telp | Sudah ada (Pengaturan › Profil toko). |
| Logo perusahaan (gambar) | Selesai (K-065): Pengaturan › Profil toko › Logo toko; tampil di sidebar. |
| Slip memakai nama / logo perusahaan | Selesai (K-065): dua opsi kop struk; dipakai saat cetak struk (Fase 5). |
| Jumlah baris per halaman | Selesai (K-065): Pengaturan › Operasional; berlaku di semua tabel data. |
| Kas utama / bank utama | Sebagian selesai (K-111): daftar rekening toko (bank, EDC, QRIS) di Pengaturan › Pembayaran dan pengecekan uang masuk. Saldo per akun dan transfer antar-akun tetap v2 Sprint C (C3). |
| Themes | v2 Sprint D (kenyamanan). |
| Metode persediaan FIFO | Tidak: HPP rata-rata tertimbang sudah dikunci (K-008). |
| Bisa keluar/proses meskipun stok minus | Tidak: stok tidak boleh negatif (docs/05 L2) karena merusak HPP dan kartu stok. |
| Gudang masuk/keluar utama | v3 (V3), toko saat ini satu lokasi. |
| Valuta utama | v3 (V4). |
| Bulan dan tahun proses | v3 (V2). |

## Riwayat

- 2026-09-30 — Dibuat dari masukan pemilik setelah Fase 3 (K-062).
- 2026-10-04 — Sprint D: usulan laporan D-L1–D-L4 dari Fase 7.
- 2026-10-09 — Sprint F: F6 tata letak POS yang bisa diatur (masukan pemilik).
- 2026-10-10 — Sprint A: A11 promo v2 (masukan pemilik, K-098).
- 2026-10-10 — Sprint F: F7 tombol "?" di setiap halaman (masukan pemilik, K-099).
- 2026-10-10 — Sprint D: temuan tinjauan kode D-K1–D-K9 (K-100).
- 2026-10-10 — D-K2 dikerjakan (K-101, disetujui pemilik).
- 2026-10-11 — F4 sebagian dan F5 selesai (K-103); D-K10, D-K11 dari K-102.
- 2026-10-11 — F4: penyiapan printer terpandu (K-105); nama printer baru bisa ditampilkan di aplikasi desktop (Fase 13.1).
- 2026-10-12 — A12 payment gateway dan D-K12 pembatalan pembayaran otomatis (K-111); F8 katalog bergambar (K-108); F4: printer per jenis dokumen menjadi syarat Fase 13.1 (K-112); baris "Kas utama / bank utama" diperbarui.
