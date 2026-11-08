# 04 — Hak Akses

## 1. Model

- Sejak V2 (K-225) ada 7 **peran** dengan **pemisahan tugas**, tidak lagi bertingkat penuh: Staf Penjualan, Kasir,
  Admin Persediaan (`ADMIN_PERSEDIAAN`), Petugas Gudang (`PETUGAS_GUDANG`), Administrator Sistem (`ADMIN_SISTEM`),
  Kepala Toko (`ADMIN`, kode lama dipertahankan agar data akun tetap utuh), dan Owner. Peran atas tidak otomatis
  memegang izin peran bawah: Kepala Toko memegang izin kasir dan administrasi persediaan plus persetujuan, tetapi
  tidak memegang akun pengguna, cadangan, dan akses perangkat (itu Administrator Sistem). Owner memegang semua izin.
  Sampai V1 (1.19.0) peran bertingkat `STAF_PENJUALAN` ⊂ `KASIR` ⊂ `ADMIN` ⊂ `OWNER` (K-019).
- Administrator Sistem hanya boleh membuat/mengubah akun Staf, Kasir, Admin Persediaan, dan Petugas Gudang; akun
  Kepala Toko, Administrator Sistem, dan Owner hanya diatur Owner (`PERAN_DIATUR_ADMIN_SISTEM`).
- Implementasi berbasis **izin**: setiap route API dan setiap menu memeriksa satu kode izin, bukan nama peran.
  Peran adalah kumpulan izin yang didefinisikan di `packages/shared/src/roles.ts`. Menambah atau memindahkan
  kemampuan cukup mengubah satu berkas itu, tanpa menyentuh route.
- **Izin efektif sebuah akun (K-243)** = izin bawaan perannya (`roles.ts`), lalu penyesuaian **peran khusus** bila
  akun memakainya, lalu penyesuaian **akun** itu sendiri (izin ditambah/dicabut). Hanya Owner (`sistem.izin.atur`)
  yang mengaturnya di Data Pengguna: menu baris *Atur izin* dan tombol *Peran khusus*. Detail di §3a.
- Izin bawaan per peran tetap diubah lewat kode (`roles.ts`). Owner tidak mengubah bawaan dari UI; ia membuat peran
  khusus atau penyesuaian per akun.
- Patokan bila sumber bertentangan: **Use Case Diagram** Laporan KP. Pengecualian yang disepakati: Kasir boleh
  melihat laporan penjualan tanpa HPP/laba (K-019).

## 2. Daftar izin

Format kode: `<modul>.<objek>.<aksi>`. Semua kode terdaftar di `packages/shared/src/permissions.ts`; route yang
memakai kode di luar daftar gagal typecheck.

### Sistem dan master

| Kode | Arti |
|---|---|
| `sistem.pengaturan.kelola` | Ubah profil toko, prefix nomor, ambang, dsb. |
| `sistem.log.lihat` | Lihat log aktivitas semua pengguna; menyalakan, melihat, dan mengekspor log interaksi penelitian (K-190). Mengirim kejadian interaksi milik sendiri cukup login (`requireLogin`), hanya saat Owner menyalakannya |
| `sistem.cadangan.kelola` | Lihat status cadangan data, cadangkan sekarang, uji pulih (K-084) |
| `sistem.data.kelola` | Pustaka data, ganti data aktif, ekspor/impor data, arsip tahunan (K-213, K-225) |
| `sistem.akses.kelola` | Akses HP/tablet: mode LAN toko, setujui/cabut perangkat, Tailscale (K-229, K-225) |
| `master.pengguna.kelola` | Tambah/ubah/nonaktifkan pengguna, reset password, cabut sesi |
| `master.barang.lihat` | Lihat daftar dan detail barang tanpa harga modal |
| `master.barang.lihat_hpp` | Lihat harga modal, HPP, harga beli terakhir, harga titip |
| `master.barang.kelola` | Tambah/ubah/nonaktifkan barang dan atributnya |
| `master.kategori.kelola` | Kelola kategori |
| `master.satuan.kelola` | Kelola satuan, jenis atribut, satuan jual |
| `master.harga.kelola` | Ubah harga jual per tier per barang; kelola master tier |
| `master.harga.tinjau` | (M2) Terapkan usulan harga dari markup |
| `master.pelanggan.lihat` | Lihat pelanggan |
| `master.pelanggan.kelola` | Tambah pelanggan; ubah data kontak dan nonaktifkan/aktifkan pelanggan yang sudah ada **dengan kode persetujuan atasan** (K-107) |
| `master.pelanggan.atur_kredit` | Atur golongan, term hari, dan limit kredit pelanggan (K-059); ubah/nonaktifkan pelanggan tanpa kode; kodenya menyetujui perubahan pelanggan dan melampaui limit kredit (K-107) |
| `master.pemasok.lihat` | Lihat pemasok |
| `master.pemasok.kelola` | Tambah/ubah/nonaktifkan pemasok |
| `master.armada.kelola` | Tambah/ubah/nonaktifkan kendaraan dan sopir (K-150); catat servis, batalkan catatan BBM/servis, statistik armada, pengingat servis/STNK/KIR (K-162). Daftar kendaraan/sopir dan catatan BBM dibaca pemegang `penjualan.surat_jalan.kelola`, yang juga boleh mencatat BBM |
| `master.import.jalankan` | Import Excel barang / saldo awal |
| `sistem.izin.atur` | Mengatur izin tambahan/dicabut per akun dan peran khusus (K-243). **Hanya Owner**, tidak bisa diberikan ke akun lain |

### Penjualan

| Kode | Arti |
|---|---|
| `penjualan.order.buat` | Buat order, kirim ke antrean, ubah order DRAFT miliknya |
| `penjualan.order.batal_sendiri` | Batalkan order buatannya sendiri yang masih MENUNGGU |
| `penjualan.order.batal` | Batalkan order siapa pun yang belum SELESAI |
| `penjualan.order.lihat_semua` | Lihat antrean dan riwayat order semua pengguna |
| `penjualan.order.lepas_paksa` | Melepas kunci order DIPROSES milik kasir lain (R8; K-070) |
| `penjualan.checkout` | Proses order menjadi penjualan (langsung dan pengantaran) |
| `penjualan.harga_manual` | Mengisi harga di luar tier |
| `penjualan.pembayaran.catat` | Catat pembayaran (termasuk DP, pelunasan, bayar saat terima) |
| `penjualan.surat_jalan.kelola` | Buat surat jalan, berangkatkan perjalanan, catat hasil pengantaran |
| `penjualan.riwayat.lihat` | Lihat daftar dan detail penjualan |
| `penjualan.piutang.lihat` | Lihat daftar piutang dan jatuh tempo |

### Retur, void

| Kode | Arti |
|---|---|
| `retur.ajukan` | Buat permintaan retur |
| `retur.setujui` | Setujui/tolak retur |
| `void.ajukan` | Buat permintaan void |
| `void.setujui` | Setujui/tolak void |

### Persediaan

| Kode | Arti |
|---|---|
| `persediaan.stok.lihat_tersedia` | Lihat angka stok tersedia saat mencari barang (untuk order) |
| `persediaan.stok.lihat` | Halaman persediaan penuh: fisik/dipesan/tersedia, mutasi, kartu stok, stok tertahan |
| `persediaan.penerimaan.kelola` | Catat penerimaan barang |
| `persediaan.opname.atur` | Menyusun daftar hitung opname harian dan menyelesaikan opname yang berselisih (K-240; Kepala Toko, Owner) |
| `persediaan.penyesuaian.kelola` | Buat penyesuaian: saldo awal, opname, koreksi, rusak |
| `persediaan.retur_pemasok.kelola` | (M2) Retur ke pemasok |
| `hutang.lihat` / `hutang.kelola` | (M2) Lihat / bayar hutang pemasok |
| `pembelian.setujui` | Menyetujui/menolak order pembelian sampai batas Kepala Toko, bukan buatan sendiri (K-225) |
| `pembelian.setujui_semua` | Menyetujui order pembelian di atas batas Kepala Toko dan yang memuat barang wajib disetujui Owner; menandai barang tersebut (K-225) |
| `konsinyasi.kelola` | (M2) Penyelesaian konsinyasi |

### Kas

| Kode | Arti |
|---|---|
| `kas.shift.kelola_sendiri` | Buka/tutup **shift toko** (satu untuk seluruh toko, K-132; tiga cara buka, hitung susulan, tutup dua langkah), catat kas masuk/keluar, koreksi modal sebelum ada transaksi tunai (sesudahnya dengan kode atasan, K-121), lihat riwayat shift dan pengajuan retur/void yang menunggu |
| `kas.shift.lihat_semua` | Melihat angka sistem shift yang belum dihitung, menerima pengingat Telegram/email shift yang perlu ditutup (K-109), menyetujui koreksi modal (kode `KOREKSI_KAS`) dan mengoreksi modal tanpa kode selama shift BUKA, menulis penjelasan selisih setelah shift ditutup (K-121) |
| `kas.rekening.lihat` | Melihat daftar rekening/EDC/QRIS toko untuk dipilih saat mencatat pembayaran atau refund (K-111) |
| `kas.nontunai.verifikasi` | Mengecek uang masuk pembayaran non-tunai dan menandai hasilnya (K-111) |

### Laporan dan dashboard

| Kode | Arti |
|---|---|
| `dashboard.dasar` | Kartu antrean order, pengiriman aktif, peringatan stok, aksi cepat |
| `dashboard.omzet` | Kartu penjualan hari ini, grafik penjualan |
| `laporan.penjualan` | Penjualan per periode, produk terlaris, detail invoice, retur, promo (tanpa HPP/laba jika tidak punya `lihat_hpp`) |
| `laporan.persediaan` | Stok rekap, kartu stok, stok minimum, nilai persediaan, riwayat harga beli (nilai persediaan dan riwayat harga beli juga butuh `laporan.laba`, K-081, K-087) |
| `laporan.laba` | Gross profit |
| `laporan.piutang` | Laporan piutang |
| `laporan.hutang` | (M2) Laporan hutang, konsinyasi |
| `laporan.ekspor` | Cetak PDF dan ekspor Excel untuk laporan yang boleh dilihat |

### Promo (M2)

| Kode | Arti |
|---|---|
| `promo.kelola` | Buat/ubah/nonaktifkan promo (menu Promo). Melepas promo pada baris transaksi memakai `penjualan.checkout`; pratinjau harga order memakai `penjualan.order.buat` (K-087) |

## 3. Matriks peran

`✓` = izin dimiliki. Tabel ini disalin dari `packages/shared/src/roles.ts` (V2, K-225); bila berbeda, `roles.ts` yang
berlaku dan tabel ini diperbarui.

| Izin | Staf | Kasir | Adm. Persediaan | Gudang | Adm. Sistem | Kepala Toko | Owner |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| sistem.pengaturan.kelola | | | | | | ✓ | ✓ |
| sistem.log.lihat | | | | | | | ✓ |
| sistem.cadangan.kelola | | | | | ✓ | | ✓ |
| sistem.data.kelola | | | | | | | ✓ |
| master.pengguna.kelola | | | | | ✓ | | ✓ |
| master.barang.lihat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| master.barang.lihat_hpp | | | ✓ | | | ✓ | ✓ |
| master.barang.kelola | | | ✓ | | | ✓ | ✓ |
| master.kategori.kelola | | | ✓ | | | ✓ | ✓ |
| master.satuan.kelola | | | ✓ | | | ✓ | ✓ |
| master.harga.kelola | | | ✓ | | | ✓ | ✓ |
| master.harga.tinjau | | | ✓ | | | ✓ | ✓ |
| master.pelanggan.lihat | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| master.pelanggan.kelola | ✓ | ✓ | | | | ✓ | ✓ |
| master.pelanggan.atur_kredit | | | | | | ✓ | ✓ |
| master.pemasok.lihat | | | ✓ | | | ✓ | ✓ |
| master.pemasok.kelola | | | ✓ | | | ✓ | ✓ |
| master.armada.kelola | | | ✓ | | | ✓ | ✓ |
| master.import.jalankan | | | ✓ | | | ✓ | ✓ |
| sistem.izin.atur | | | | | | | ✓ |
| sistem.akses.kelola | | | | | ✓ | | ✓ |
| pembelian.setujui | | | | | | ✓ | ✓ |
| pembelian.setujui_semua | | | | | | | ✓ |
| penjualan.order.buat | ✓ | ✓ | | | | ✓ | ✓ |
| penjualan.order.batal_sendiri | ✓ | ✓ | | | | ✓ | ✓ |
| penjualan.order.batal | | ✓ | | | | ✓ | ✓ |
| penjualan.order.lihat_semua | | ✓ | | | | ✓ | ✓ |
| penjualan.order.lepas_paksa | | | | | | ✓ | ✓ |
| penjualan.checkout | | ✓ | | | | ✓ | ✓ |
| penjualan.harga_manual | | | | | | ✓ | ✓ |
| penjualan.pembayaran.catat | | ✓ | | | | ✓ | ✓ |
| penjualan.surat_jalan.kelola | | | ✓ | ✓ | | ✓ | ✓ |
| penjualan.riwayat.lihat | | ✓ | ✓ | | | ✓ | ✓ |
| penjualan.piutang.lihat | | ✓ | | | | ✓ | ✓ |
| retur.ajukan | | ✓ | | | | ✓ | ✓ |
| retur.setujui | | | | | | ✓ | ✓ |
| void.ajukan | | ✓ | | | | ✓ | ✓ |
| void.setujui | | | | | | ✓ | ✓ |
| persediaan.stok.lihat_tersedia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| persediaan.stok.lihat | | | ✓ | ✓ | | ✓ | ✓ |
| persediaan.penerimaan.kelola | | | ✓ | | | ✓ | ✓ |
| persediaan.penyesuaian.kelola | | | ✓ | | | ✓ | ✓ |
| persediaan.opname.atur | | | | | | ✓ | ✓ |
| persediaan.retur_pemasok.kelola | | | ✓ | | | ✓ | ✓ |
| hutang.lihat | | | ✓ | | | ✓ | ✓ |
| hutang.kelola | | | | | | ✓ | ✓ |
| konsinyasi.kelola | | | ✓ | | | ✓ | ✓ |
| kas.shift.kelola_sendiri | | ✓ | | | | ✓ | ✓ |
| kas.shift.lihat_semua | | | | | | ✓ | ✓ |
| kas.rekening.lihat | | ✓ | | | | ✓ | ✓ |
| kas.nontunai.verifikasi | | | | | | ✓ | ✓ |
| dashboard.dasar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dashboard.omzet | | ✓ | | | | ✓ | ✓ |
| laporan.penjualan | | ✓ | | | | ✓ | ✓ |
| laporan.persediaan | | | ✓ | | | ✓ | ✓ |
| laporan.laba | | | | | | ✓ | ✓ |
| laporan.piutang | | ✓ | | | | ✓ | ✓ |
| laporan.hutang | | | ✓ | | | ✓ | ✓ |
| laporan.ekspor | | ✓ | ✓ | | | ✓ | ✓ |
| promo.kelola | | | | | | ✓ | ✓ |

Staf Penjualan tidak melihat omzet, harga modal, laporan, maupun halaman persediaan penuh. Ia melihat stok
tersedia di layar order karena tugasnya mengecek ketersediaan barang untuk pembeli.

Sejak K-243 Kasir bawaan **tidak** memegang `penjualan.surat_jalan.kelola` (surat jalan, rit, armada): di toko
besar pengantaran diurus Admin Persediaan/Petugas Gudang. Toko yang mendelegasikan pengantaran ke kasir memberi
izin itu per akun atau lewat peran khusus (mis. "Kasir Pengantaran"). Akun Kasir yang sudah ada sebelum K-243
diberi izin itu lewat migrasi `0055` agar tidak ada yang tiba-tiba kehilangan tugasnya; Owner bisa mencabutnya.

### 3a. Izin per akun dan peran khusus (K-243)

| Hal | Aturan |
|---|---|
| Urutan hitung | bawaan peran → peran khusus (tambah lalu cabut) → akun (tambah lalu cabut). Dihitung ulang tiap permintaan API, jadi perubahan berlaku langsung tanpa login ulang. |
| Owner | Selalu memegang semua izin; akun Owner tidak bisa diatur (HTTP 409). Peran khusus tidak bisa berdasar Owner. |
| Izin khusus Owner | `sistem.izin.atur`, `sistem.data.kelola`, `pembelian.setujui_semua` (`IZIN_KHUSUS_OWNER`) tidak bisa ditambahkan ke akun atau peran khusus mana pun (ditolak 400) dan selalu dibuang dari hitungan non-Owner. |
| Penyimpanan | Yang disimpan hanya **selisih** terhadap bawaan (`izin_tambah`, `izin_cabut` jsonb), dirapikan server: tambahan yang sudah dimiliki bawaan dan cabutan yang tidak dimiliki dibuang; kode tak dikenal ditolak. Perubahan bawaan peran di versi berikutnya tetap ikut berlaku. |
| Peran khusus | Nama unik (tanpa beda huruf besar/kecil), peran dasar non-Owner, keterangan opsional. Hanya bisa dipasang ke akun berperan sama dengan peran dasarnya. Peran dasar tidak bisa diganti selama dipakai akun. Data master: dinonaktifkan, tidak dihapus; nonaktif = akun pemakainya kembali ke bawaan peran. |
| Peran akun diganti | Peran khusus dan penyesuaian akun dikosongkan (berlaku untuk peran lama). |
| Pemakai izin efektif | Sesi (route, menu), pemilik kode persetujuan (K-102/K-245), penerima pemberitahuan Telegram/email. |
| Log | `PENGGUNA_IZIN_UBAH`, `PERAN_KUSTOM_BUAT`, `PERAN_KUSTOM_UBAH`, `PERAN_KUSTOM_STATUS` dengan ringkasan izin ditambah/dicabut. |
| Siapa | Ubah: `sistem.izin.atur` (Owner). Daftar peran khusus dibaca pengelola akun (`master.pengguna.kelola`). |

## 4. Menu ↔ izin

| Menu (sidebar) | Izin yang membuka | Catatan |
|---|---|---|
| Dashboard | `dashboard.dasar` | Kartu omzet & grafik hanya bila `dashboard.omzet` |
| Data Master › Data Barang | `master.barang.kelola` | Staf/Kasir mencari barang lewat layar order, bukan menu ini. Cetak label dan satuan jual (harga tetap satuan jual butuh `master.harga.kelola`; K-090, K-091) |
| Data Master › Data Pelanggan | `master.pelanggan.lihat` | |
| Data Master › Data Pemasok | `master.pemasok.lihat` | |
| Data Master › Data Pengguna | `master.pengguna.kelola` | Label "Owner Only" seperti mockup. *Atur izin* dan *Peran khusus* bila `sistem.izin.atur` (K-243) |
| Data Master › Referensi Barang | `master.kategori.kelola` | Satu halaman bertab: Kategori, Merk, Satuan, Atribut |
| Data Master › Harga Jual | `master.harga.kelola` | Tier dan harga per barang; tab Tinjau Harga butuh `master.harga.tinjau` + `master.barang.lihat_hpp` (K-086) |
| Transaksi › Order Penjualan | `penjualan.order.buat` | Staf hanya melihat order miliknya kecuali `order.lihat_semua` |
| Transaksi › Penjualan Langsung | `penjualan.checkout` | |
| Transaksi › Penjualan Pengantaran | `penjualan.checkout` | Daftar invoice, detail, surat jalan, pembayaran |
| Transaksi › Piutang | `penjualan.piutang.lihat` | |
| Transaksi › Retur Penjualan | `retur.ajukan` | Tab "Persetujuan" bila `retur.setujui` |
| Transaksi › Void Transaksi | `void.ajukan` | Tab "Persetujuan" bila `void.setujui` |
| Persediaan › Penerimaan Barang | `persediaan.penerimaan.kelola` | |
| Persediaan › Stok Persediaan | `persediaan.stok.lihat` | Tab posisi stok, mutasi, kartu stok, stok tertahan, stok rusak, penyesuaian |
| Persediaan › Retur ke Pemasok (M2) | `persediaan.retur_pemasok.kelola` | Daftar, form, detail, cetak nota retur (K-088) |
| Persediaan › Hutang Pemasok (M2) | `hutang.lihat` | Tombol bayar bila `hutang.kelola` (K-088) |
| Persediaan › Konsinyasi (M2) | `konsinyasi.kelola` | Posisi per pemasok, setoran KSG, nota setoran; bayar lewat `hutang.kelola` (K-089) |
| Kas › Shift & Clerical Check | `kas.shift.kelola_sendiri` | Tab "Semua Shift" bila `kas.shift.lihat_semua`; tab "Cek uang non-tunai" bila `kas.nontunai.verifikasi` (K-111) |
| Laporan | `laporan.penjualan` atau `laporan.persediaan` | Daftar laporan disaring per izin |
| Hasil Penjualan (K-126) | `laporan.penjualan` | Laba kotor dan margin hanya untuk `laporan.laba` (disaring API) |
| Order Pembelian (K-125) | `persediaan.penerimaan.kelola` | Harga beli, total perkiraan, dan uang muka hanya untuk `master.barang.lihat_hpp` (disaring API) |
| Pengaturan | `sistem.pengaturan.kelola` | Tab "Log Aktivitas" dan "Log interaksi" bila `sistem.log.lihat`; tab "Cadangan" bila `sistem.cadangan.kelola`; tab "Promo" bila `promo.kelola` (menu Promo dipindah ke sini, K-110); tab "Pembayaran" = rekening toko (K-111) |

## 5. Data sensitif

Field berikut hanya dikirim API bila pemanggil punya `master.barang.lihat_hpp` (atau `laporan.laba` untuk laporan):
`harga_modal_masuk`, `hpp_rata2`, `harga_beli_terakhir`, `hpp_saat_transaksi`, `harga_titip`, `laba`, `margin`,
`nilai_persediaan`. Penyaringan dilakukan di service/serializer, bukan di komponen React. Tes wajib: Kasir memanggil
`GET /api/barang/:id` tidak menerima field-field tersebut.

Field yang **tidak pernah** dikirim API: `password_hash`, `token_hash` sesi, `SESSION_SECRET`.

## 6. Persetujuan (retur, void, dan limit kredit)

Retur dan void hanya berefek (stok, kas, tagihan) setelah DISETUJUI. Ada empat cara disetujui; caranya disimpan
di `cara_persetujuan` dokumen dan di log (K-017, K-099):

| Cara | Kapan | Tercatat atas nama |
|---|---|---|
| `SENDIRI` | Pengaju punya izin `*.setujui` (Admin/Owner): dokumen langsung DISETUJUI (K-017). Pilihan sadar untuk toko kecil yang owner-nya juga admin; risikonya tidak ada pemisahan tugas untuk Admin. | pengaju |
| `DI_TEMPAT` | Pengaju tanpa izin (Kasir) meminta **kode sekali pakai** yang dikirim sistem ke Telegram/email tiap Admin/Owner, lalu mengetik kode yang disebutkan atasan (K-102). Untuk toko satu perangkat dan atasan yang tidak di tempat: kasir tidak perlu keluar dan tidak ada password atasan yang diketik di komputer kasir. | atasan pemilik kode |
| `BATAS_BEBAS` | Nilai dokumen, dijumlah dengan retur (atau void) lain yang MENUNGGU/DISETUJUI atas **penjualan yang sama**, tidak melebihi `konfigurasi.batas_retur_tanpa_persetujuan` / `batas_void_tanpa_persetujuan` (bawaan 0 = selalu butuh atasan). | pengaju |
| `AKUN_ATASAN` | Selain itu dokumen MENUNGGU; muncul di tab *Menunggu persetujuan* dan notifikasi Admin/Owner, lalu disetujui atasan dari akunnya sendiri. | atasan |

Aturan kode sekali pakai (K-102, menggantikan password atasan di layar kasir dari K-099/K-101):

- Retur/void diajukan dulu (MENUNGGU); pengaju lalu meminta kode. Isi pesan untuk atasan disusun server dari
  dokumen tersimpan: pengaju, nomor, barang, nilai, alasan. Untuk limit kredit: pelanggan, limit, piutang
  berjalan, dan tagihan baru (dibaca dari database, bukan dari teks kiriman peramban).
- Tiap atasan yang berwenang (izin `retur.setujui` / `void.setujui` / `master.pelanggan.atur_kredit`) dan punya
  kontak (Telegram terhubung atau email) menerima **kode 6 angka yang berbeda**; kode yang dipakai menentukan
  `id_penyetuju`. Pengaju sendiri tidak pernah menjadi penerima.
- Kode terikat pada satu dokumen (atau satu pelanggan + nilai tagihan baru: checkout menolak bila tagihannya
  lebih besar), hanya bisa diminta dan dipakai pengaju itu, berlaku 10 menit, sekali pakai; meminta kode baru
  membatalkan yang lama; 5 kali salah ketik membatalkan kode (tiap salah ketik `PERSETUJUAN_GAGAL`).
- Permintaan kode: paling banyak 5 per 5 menit per pengaju → `TERLALU_BANYAK_PERCOBAAN` (429). Pengiriman
  dicatat `PERSETUJUAN_KODE_KIRIM` (kepada siapa, lewat apa; tanpa kodenya).
- Hanya hash kode yang disimpan. Wewenang atasan diperiksa lagi saat kode dipakai. Kode ditandai terpakai di
  transaksi yang sama dengan persetujuannya. Galat memakai HTTP 400/409, bukan 401, agar sesi pengaju tidak
  dianggap berakhir.
- Refund tunai keluar dari laci shift **pengguna yang login di perangkat itu** (pengaju pada `DI_TEMPAT` dan
  `BATAS_BEBAS`; penyetuju pada `AKUN_ATASAN`). Mutasi stok dan `id_penyetuju` atas nama yang menyetujui.
- Saluran: token bot Telegram dan akun SMTP diisi di Pengaturan › Persetujuan (`sistem.pengaturan.kelola`);
  nilainya tidak pernah dikembalikan API atau dilog. Email dan Telegram tiap pengguna diatur pemilik akun
  sendiri di Akun saya (untuk pengelola pengaturan juga tampil sebagai Langkah 2 di Pengaturan › Persetujuan);
  kode tautan Telegram hanya diketahui pemilik akun yang sedang login.
- Uji saluran (`POST /api/saluran/uji`, `sistem.pengaturan.kelola`, K-105): satu saluran per permintaan, ke
  kontak pengguna yang login saja (tidak bisa mengirim ke alamat lain), selalu pengiriman sungguhan, dan
  jawabannya menyebut apa yang kurang tanpa memuat token atau sandi.
- Tanpa internet/saluran: retur/void tetap lewat `AKUN_ATASAN` atau `BATAS_BEBAS`; limit kredit hanya bisa
  dilanjutkan Admin/Owner yang login.
- **Perubahan data pelanggan (K-107):** jenis kode `UBAH_PELANGGAN` untuk pengguna tanpa
  `master.pelanggan.atur_kredit` yang mengubah data kontak pelanggan yang sudah ada, menonaktifkan, atau
  mengaktifkannya kembali (menambah pelanggan baru tidak butuh kode). Pesan untuk atasan memuat rincian
  perubahan (kolom, nilai lama, nilai baru). Kode terikat pada pelanggan dan **isian yang persis sama**
  (`permintaan_persetujuan.sidik`): kode untuk satu perubahan tidak bisa dipakai untuk perubahan lain. Tanpa
  kode ditolak 403. Log perubahan menyebut atasan pemilik kode.
- **Koreksi modal shift (K-121):** jenis kode `KOREKSI_KAS` (izin `kas.shift.lihat_semua`) untuk kasir yang
  membetulkan modal awal setelah ada transaksi tunai di shiftnya. Kode terikat pada shift dan modal benar yang
  diajukan (`sidik`); tanpa kode ditolak 403 dengan `butuhKode`. Keterangan kas koreksi menyebut atasan pemilik kode.
- **Limit kredit (PT6):** penjualan tetap atas nama kasir; log `PENJUALAN_LIMIT_OVERRIDE` atas nama atasan
  pemilik kode. Tidak ada status MENUNGGU: tanpa persetujuan, penjualan tidak tersimpan.

Aturan lain:

- Penyetuju boleh menolak dengan alasan; permintaan tetap tersimpan (append-only).
- **Batalkan pengajuan (K-099):** dokumen yang masih MENUNGGU boleh ditarik pengajunya (atau pemegang
  `*.setujui`) dengan alasan → status DIBATALKAN, tanpa efek, log `RETUR_BATAL`/`VOID_BATAL`. Dokumen yang sudah
  DISETUJUI **tidak bisa diubah atau dibalik**: kekurangan = retur tambahan; kelebihan = penjualan baru. Tidak ada
  jalur "retur lalu dibatalkan".
- Void tambahan: hanya untuk penjualan pada shift yang masih terbuka; penjualan yang sudah punya surat jalan
  berstatus DIKIRIM/SELESAI atau sudah punya retur tidak bisa di-void (`STATUS_TIDAK_VALID`).

### 6a. Persetujuan order pembelian (K-225)

Aturannya di docs/05 §21 PO10–PO14. Ringkasan wewenang:

| Siapa | Boleh |
|---|---|
| Pembuat order (`persediaan.penerimaan.kelola`) | Menyusun draf, **Ajukan persetujuan**, mengirim order yang tidak wajib disetujui atau sudah DISETUJUI, membatalkan |
| Kepala Toko (`pembelian.setujui`) | Setujui/Tolak order yang diajukan sampai batas Kepala Toko, **bukan buatannya sendiri**, tanpa barang khusus |
| Owner (`pembelian.setujui_semua`) | Semua order (termasuk buatannya sendiri dan di atas batas); boleh langsung mengirim draf tanpa diajukan; menandai barang "pembelian wajib disetujui Owner" |

Penyetuju memakai **akunnya sendiri** (notifikasi lonceng `PO_MENUNGGU_PERSETUJUAN`), atau dari jauh dengan **kode
sekali pakai** (K-245, jenis `ORDER_PEMBELIAN`): pembuat order menekan *Minta kode*, kode dikirim ke Telegram/email
penyetuju yang berwenang (Owner bila order perlu Owner), kode terikat pada order dan isinya, dan order tercatat
disetujui atas nama pemilik kode. Penerimaan dari order dicatat orang lain selain pembuatnya (PO25, bisa dimatikan); pembelian tanpa order dibatasi
(PO24); keduanya tidak berlaku untuk Owner. Semua aturan dicek di API: peran lain
ditolak 403, mengirim order yang wajib disetujui ditolak 409.

## 7. Sesi, login, password

| Aturan | Nilai default | Sumber |
|---|---|---|
| Panjang password minimum | 8 karakter | `konfigurasi.password_min` |
| Hash | argon2id (memori 64 MB, iterasi 3, paralel 1) | kode |
| Idle timeout | 60 menit tanpa request → sesi berakhir | `.env SESSION_IDLE_MENIT` |
| Batas absolut sesi | 12 jam sejak login | `.env SESSION_ABSOLUT_JAM` |
| Gagal login | 5 kali berturut → akun dikunci 15 menit; rate limit IP 20 percobaan/menit (persetujuan di tempat: 20/menit per pengaju, §6) | `konfigurasi.login_maks_gagal`, `login_kunci_menit` |
| Nonaktifkan pengguna | Semua sesinya dicabut saat itu juga | kode |
| Reset password | Owner mengisi password baru; pengguna wajib mengganti saat login berikutnya (`wajib_ganti_password`) | kode |
| Owner terakhir | Tidak bisa dinonaktifkan atau diturunkan perannya bila ia satu-satunya Owner aktif | kode |
| Tombol masuk cepat per peran | Hanya `NODE_ENV=development`; memakai akun seed dengan password seed | kode |
| Akun pertama (K-191) | Bila belum ada pengguna sama sekali, halaman *Buat akun pertama* membuat akun **Owner** (nama, username, password) lalu langsung masuk; tidak ada password bawaan. Setelah ada satu pengguna, rute ini ditolak 409. Dua permintaan bersamaan diantrekan (kunci advisory). Produksi: seed tidak membuat Owner bila `SEED_OWNER_PASSWORD` kosong | kode |
| Perangkat LAN (K-229) | Lewat HTTPS mode LAN toko, semua API (kecuali `/api/health`, `/api/perangkat/daftar`, `/api/perangkat/status`) ditolak 403 `PERANGKAT_BELUM_DISETUJUI` sampai perangkat (cookie `bu_perangkat`, token acak disimpan sebagai hash) disetujui pemegang `sistem.pengaturan.kelola`; bisa ditolak/dicabut. Server utama desktop hanya mendengar 127.0.0.1 | kode |
| Ganti/buat data toko dari halaman masuk (K-219) | Rute publik `/api/auth/data-toko/*` mensyaratkan username + password Owner aktif di setiap permintaan; dibatasi seperti login, salah password menghitung kunci akun | kode |
| Pemulihan Owner terakhir (K-232) | Hanya dengan kode jawaban pengembang (Ed25519) untuk kode tantangan komputer server; tercatat di log | kode |
| Kode pemulihan (K-191) | 20 huruf/angka acak (± 99 bit), disimpan hash argon2id di `pengguna.kode_pemulihan_hash`, tampil sekali. Dibuat otomatis untuk akun pertama; pengguna mana pun bisa membuat ulang di *Akun saya* dengan konfirmasi password (kode lama batal). **Lupa password**: username + kode + password baru → password diganti, kunci akun dibuka, semua sesi dicabut, kode lama hangus dan kode baru diberikan. Gagal = pesan umum "Username atau kode pemulihan salah." + log `PENGGUNA_PULIHKAN_GAGAL`; batas laju sama dengan login | kode |

**Rute publik** (tanpa login, CLAUDE.md aturan 5): `GET /api/health`, `POST /api/auth/login`, dan sejak K-191
`GET /api/auth/penyiapan` (apakah perlu akun pertama), `POST /api/auth/akun-pertama` (hanya selama belum ada
pengguna), `POST /api/auth/pulihkan` (lupa password dengan kode pemulihan). Selain itu semua rute wajib
`requirePermission`/`requireLogin`; server menolak menyala bila ada rute tanpa deklarasi.

## 8. Log aktivitas

Dicatat untuk setiap aksi mutasi dan setiap login/logout: `waktu`, `id_pengguna`, `aksi` (mis. `PENJUALAN_CHECKOUT`,
`VOID_SETUJUI`, `BARANG_UBAH`), `entitas`, `id_entitas`, `ringkasan` (nilai lama → baru untuk perubahan master,
nomor dokumen untuk transaksi), `ip`. Log tidak bisa diubah atau dihapus dari aplikasi. Hanya Owner yang melihat
(`sistem.log.lihat`), termasuk mengekspornya ke Excel (`GET /api/log-aktivitas/ekspor`, saringan cari/aksi/tanggal,
maks. 50.000 baris, dicatat LAPORAN_EKSPOR, K-113). Retensi: tidak dihapus pada M1.

## Riwayat

- 2026-11-09 — K-243: izin per akun dan peran khusus (§1, §3a); izin `sistem.izin.atur` (Owner); Kasir bawaan tanpa
  `penjualan.surat_jalan.kelola` (akun kasir lama tetap memegangnya lewat migrasi 0055).
- 2026-11-07 — V2 K-225: 7 peran dengan pemisahan tugas (§1, matriks §3 baru); izin `sistem.data.kelola`,
  `sistem.akses.kelola`, `pembelian.setujui`, `pembelian.setujui_semua`; persetujuan order pembelian (§6a).
- 2026-09-19 — v1. Konflik hak akses antar-sumber diselesaikan (K-019): Laporan untuk Kasir = penjualan tanpa HPP;
  Data Pemasok = Admin/Owner; Kelola pengguna = Owner.
- 2026-09-30 — Membaca satuan (`GET /api/satuan`) memakai `master.barang.lihat`; rute milik sendiri (logout, profil,
  ganti password) memakai `requireLogin()`; akun demo masuk cepat hanya mode pengembangan (K-054).
- 2026-09-30 — Izin baru `master.pelanggan.atur_kredit` (Admin/Owner): tier default, term hari, limit kredit
  pelanggan. Staf/Kasir tetap mengelola data kontak pelanggan (K-059). Menu Kategori, Satuan & Atribut memakai
  `master.kategori.kelola`; kategori dan satuan dibaca dengan `master.barang.lihat` (K-057).
- 2026-09-30 — Barang dibaca semua peran (`master.barang.lihat`) dengan field sensitif disaring; menambah/mengubah
  barang juga butuh `master.barang.lihat_hpp`, menambah barang butuh `master.harga.kelola`; markup default tier
  hanya untuk `master.barang.lihat_hpp` (K-060).
- 2026-09-30 — Menu "Kategori, Satuan & Atribut" menjadi **Referensi Barang** (`/referensi`) dengan tab Merk baru;
  merk dibaca `master.barang.lihat`, dikelola `master.kategori.kelola` (K-063).
- 2026-10-01 — `GET /api/pengaturan/tampilan` dan `GET /api/pengaturan/logo` memakai `requireLogin()` (nama toko,
  logo, baris per halaman dipakai semua peran); unggah/hapus logo memakai `sistem.pengaturan.kelola` (K-065).
- 2026-10-02 — Izin baru `penjualan.order.lepas_paksa` (Admin, Owner) untuk melepas kunci order kasir lain (K-070).
- 2026-10-04 — §2: Laporan Nilai Persediaan memerlukan `laporan.persediaan` dan `laporan.laba` (K-081).
- 2026-10-04 — Izin `sistem.cadangan.kelola` (Owner) untuk Pengaturan › Cadangan (K-084).
- 2026-10-04 — Tinjau Harga (API dan tab) memerlukan `master.harga.tinjau` dan `master.barang.lihat_hpp`; persen markup
  per barang dan margin hanya untuk `master.barang.lihat_hpp`; mengubah harga otomatis barang butuh
  `master.harga.kelola` (K-086).
- 2026-10-04 — §2: Laporan Promo (`laporan.penjualan`), Laporan Riwayat Harga Beli (`laporan.persediaan` +
  `laporan.laba`); lepas promo per baris butuh `penjualan.checkout`; izin harga manual/tier/diskon diuji hanya untuk
  nilai yang diubah pelaku (K-087).
- 2026-10-07 — Menu Retur ke Pemasok dan Hutang Pemasok, tab Stok rusak; melampaui limit kredit memakai `master.pelanggan.atur_kredit` (K-088).
- 2026-10-07 — Menu Konsinyasi dan Laporan Konsinyasi (`laporan.hutang`) (K-089).
- 2026-10-07 — Cetak label, Daftar Harga (`laporan.penjualan`), satuan jual (K-090, K-091).
- 2026-10-10 — §6 persetujuan di tempat, batas tanpa persetujuan, batalkan pengajuan; izin `penjualan.tier.ubah` dihapus (tier selalu otomatis) (K-099).
- 2026-10-10 — §6, §7: batas laju persetujuan di tempat 20/menit per pengaju (K-100).
- 2026-10-10 — §6: persetujuan di tempat untuk melampaui limit kredit (K-101).
- 2026-10-11 — §6: password atasan di layar kasir diganti kode sekali pakai lewat Telegram/email (K-102).
- 2026-10-11 — §6: uji saluran per jenis (K-105).
- 2026-10-12 — §2–§4: izin `kas.rekening.lihat`, `kas.nontunai.verifikasi`; arti izin pelanggan; menu Promo masuk Pengaturan; §6 kode `UBAH_PELANGGAN` (K-107, K-109, K-110, K-111).
- 2026-10-18 — §2, §6: arti izin shift diperluas (hitung dua langkah, koreksi modal, penjelasan selisih); kode `KOREKSI_KAS` (K-121).
- 2026-10-18 — Order disimpan dan kembali ke draf memakai izin `penjualan.order.buat` dengan pemeriksaan pemilik/kunci di service (pembuat, pemegang `penjualan.checkout`, atau kasir pemegang kunci; docs/05 R11–R13); daftar draf lain per barang untuk peringatan (R14) (K-122).
- 2026-10-18 — Satu shift toko (K-132): arti izin shift diperbarui; `GET /api/shift/status` (semua pengguna login, indikator topbar) dan `GET /api/persetujuan/:id` (pengaju melanjutkan permintaan kode, K-136).
- 2026-10-23 — Izin `penjualan.diskon` dihapus: diskon manual tidak ada lagi, potongan hanya lewat Promo (K-146).
- 2026-10-23 — Izin `master.armada.kelola` (Admin, Owner); `penjualan.surat_jalan.kelola` mencakup berangkat dan catat hasil (K-149, K-150).
- 2026-10-24 — K-162: catatan BBM (kasir+), servis/batal/statistik (`master.armada.kelola`).
- 2026-10-28 — K-181 `GET /api/info-cepat` (login; izin per jenis dokumen sama dengan halaman detail). K-176 `GET /api/retur/refund-transfer`, `POST /api/retur/:id/transfer` (`retur.setujui`). K-168 `/api/penyiapan` (`sistem.pengaturan.kelola`).
- 2026-10-26 — K-191: akun pertama dan kode pemulihan (lupa password); tiga rute publik baru di §7. K-190: log interaksi
  penelitian (`sistem.log.lihat` untuk mengatur/melihat; mengirim kejadian sendiri cukup login).
- 2026-10-24 — K-165 arsip tahunan (`sistem.cadangan.kelola`); K-137 pemeriksaan data dan rapikan No. HP (`sistem.pengaturan.kelola`).
