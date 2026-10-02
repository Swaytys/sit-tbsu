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
| F4 | **Pengaturan › Printer**: aktif/nonaktif cetak struk otomatis per komputer kasir, pilih printer struk & printer A4, jumlah salinan, uji cetak. | Peramban tidak bisa memilih printer sendiri; butuh agen cetak lokal kecil (atau ESC/POS lewat Web Serial) — dinilai saat Sprint F. Sampai itu: `scripts/kasir/buka-kasir.cmd` (K-074). |
| F5 | Laci uang terbuka otomatis saat struk tunai dicetak (perintah ESC/POS lewat printer struk). | Bergantung F4. |

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
| Kas utama / bank utama | v2 Sprint C (C3). Rekening transfer untuk nota ikut C3. |
| Themes | v2 Sprint D (kenyamanan). |
| Metode persediaan FIFO | Tidak: HPP rata-rata tertimbang sudah dikunci (K-008). |
| Bisa keluar/proses meskipun stok minus | Tidak: stok tidak boleh negatif (docs/05 L2) karena merusak HPP dan kartu stok. |
| Gudang masuk/keluar utama | v3 (V3), toko saat ini satu lokasi. |
| Valuta utama | v3 (V4). |
| Bulan dan tahun proses | v3 (V2). |

## Riwayat

- 2026-09-30 — Dibuat dari masukan pemilik setelah Fase 3 (K-062).
