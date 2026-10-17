# 04 — Hak Akses

## 1. Model

- Ada 4 **peran** bertingkat: `STAF_PENJUALAN` ⊂ `KASIR` ⊂ `ADMIN` ⊂ `OWNER` (sesuai Use Case Diagram, K-019).
- Implementasi berbasis **izin**: setiap route API dan setiap menu memeriksa satu kode izin, bukan nama peran.
  Peran adalah kumpulan izin yang didefinisikan di `packages/shared/src/roles.ts`. Menambah atau memindahkan
  kemampuan cukup mengubah satu berkas itu, tanpa menyentuh route.
- Tidak ada editor peran di UI pada M1. Perubahan peran → izin dilakukan lewat kode dan migrasi kecil.
- Patokan bila sumber bertentangan: **Use Case Diagram** Laporan KP. Pengecualian yang disepakati: Kasir boleh
  melihat laporan penjualan tanpa HPP/laba (K-019).

## 2. Daftar izin

Format kode: `<modul>.<objek>.<aksi>`. Semua kode terdaftar di `packages/shared/src/permissions.ts`; route yang
memakai kode di luar daftar gagal typecheck.

### Sistem dan master

| Kode | Arti |
|---|---|
| `sistem.pengaturan.kelola` | Ubah profil toko, prefix nomor, ambang, batas diskon, dsb. |
| `sistem.log.lihat` | Lihat log aktivitas semua pengguna |
| `sistem.cadangan.kelola` | Lihat status cadangan data, cadangkan sekarang, uji pulih (K-084) |
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
| `master.import.jalankan` | Import Excel barang / saldo awal |

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
| `penjualan.diskon` | Memberi diskon baris/transaksi (dibatasi `konfigurasi.batas_diskon_<peran>`) |
| `penjualan.pembayaran.catat` | Catat pembayaran (termasuk DP, pelunasan, bayar saat terima) |
| `penjualan.surat_jalan.kelola` | Buat surat jalan, ubah status kirim, isi sopir/kendaraan |
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
| `persediaan.penyesuaian.kelola` | Buat penyesuaian: saldo awal, opname, koreksi, rusak |
| `persediaan.retur_pemasok.kelola` | (M2) Retur ke pemasok |
| `hutang.lihat` / `hutang.kelola` | (M2) Lihat / bayar hutang pemasok |
| `konsinyasi.kelola` | (M2) Penyelesaian konsinyasi |

### Kas

| Kode | Arti |
|---|---|
| `kas.shift.kelola_sendiri` | Buka/tutup shift sendiri (tiga cara buka, hitung susulan, hitung tutup dua langkah), catat kas masuk/keluar shift sendiri, koreksi modal shift sendiri sebelum ada transaksi tunai (sesudahnya dengan kode atasan, K-121), clerical shift sendiri |
| `kas.shift.lihat_semua` | Lihat semua shift dan clerical, menutup shift pengguna lain, menerima pengingat shift yang perlu ditutup (K-109), menyetujui koreksi modal (kode `KOREKSI_KAS`) dan mengoreksi modal kapan saja selama shift BUKA, menulis penjelasan selisih setelah shift ditutup (K-121) |
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

`✓` = izin dimiliki. Peran di kanan mewarisi semua izin peran di kirinya; kolom tetap ditulis lengkap agar
`roles.ts` bisa disalin langsung.

| Izin | Staf | Kasir | Admin | Owner |
|---|:-:|:-:|:-:|:-:|
| sistem.pengaturan.kelola | | | ✓ | ✓ |
| sistem.log.lihat | | | | ✓ |
| sistem.cadangan.kelola | | | | ✓ |
| master.pengguna.kelola | | | | ✓ |
| master.barang.lihat | ✓ | ✓ | ✓ | ✓ |
| master.barang.lihat_hpp | | | ✓ | ✓ |
| master.barang.kelola | | | ✓ | ✓ |
| master.kategori.kelola | | | ✓ | ✓ |
| master.satuan.kelola | | | ✓ | ✓ |
| master.harga.kelola | | | ✓ | ✓ |
| master.harga.tinjau | | | ✓ | ✓ |
| master.pelanggan.lihat | ✓ | ✓ | ✓ | ✓ |
| master.pelanggan.kelola | ✓ | ✓ | ✓ | ✓ |
| master.pelanggan.atur_kredit | | | ✓ | ✓ |
| master.pemasok.lihat | | | ✓ | ✓ |
| master.pemasok.kelola | | | ✓ | ✓ |
| master.import.jalankan | | | ✓ | ✓ |
| penjualan.order.buat | ✓ | ✓ | ✓ | ✓ |
| penjualan.order.batal_sendiri | ✓ | ✓ | ✓ | ✓ |
| penjualan.order.batal | | ✓ | ✓ | ✓ |
| penjualan.order.lihat_semua | | ✓ | ✓ | ✓ |
| penjualan.order.lepas_paksa | | | ✓ | ✓ |
| penjualan.checkout | | ✓ | ✓ | ✓ |
| penjualan.harga_manual | | | ✓ | ✓ |
| penjualan.diskon | | ✓ | ✓ | ✓ |
| penjualan.pembayaran.catat | | ✓ | ✓ | ✓ |
| penjualan.surat_jalan.kelola | | ✓ | ✓ | ✓ |
| penjualan.riwayat.lihat | | ✓ | ✓ | ✓ |
| penjualan.piutang.lihat | | ✓ | ✓ | ✓ |
| retur.ajukan | | ✓ | ✓ | ✓ |
| retur.setujui | | | ✓ | ✓ |
| void.ajukan | | ✓ | ✓ | ✓ |
| void.setujui | | | ✓ | ✓ |
| persediaan.stok.lihat_tersedia | ✓ | ✓ | ✓ | ✓ |
| persediaan.stok.lihat | | | ✓ | ✓ |
| persediaan.penerimaan.kelola | | | ✓ | ✓ |
| persediaan.penyesuaian.kelola | | | ✓ | ✓ |
| persediaan.retur_pemasok.kelola | | | ✓ | ✓ |
| hutang.lihat / hutang.kelola | | | ✓ | ✓ |
| konsinyasi.kelola | | | ✓ | ✓ |
| kas.shift.kelola_sendiri | | ✓ | ✓ | ✓ |
| kas.shift.lihat_semua | | | ✓ | ✓ |
| kas.rekening.lihat | | ✓ | ✓ | ✓ |
| kas.nontunai.verifikasi | | | ✓ | ✓ |
| dashboard.dasar | ✓ | ✓ | ✓ | ✓ |
| dashboard.omzet | | ✓ | ✓ | ✓ |
| laporan.penjualan | | ✓ | ✓ | ✓ |
| laporan.persediaan | | | ✓ | ✓ |
| laporan.laba | | | ✓ | ✓ |
| laporan.piutang | | ✓ | ✓ | ✓ |
| laporan.hutang | | | ✓ | ✓ |
| laporan.ekspor | | ✓ | ✓ | ✓ |
| promo.kelola | | | ✓ | ✓ |

Staf Penjualan tidak melihat omzet, harga modal, laporan, maupun halaman persediaan penuh. Ia melihat stok
tersedia di layar order karena tugasnya mengecek ketersediaan barang untuk pembeli.

## 4. Menu ↔ izin

| Menu (sidebar) | Izin yang membuka | Catatan |
|---|---|---|
| Dashboard | `dashboard.dasar` | Kartu omzet & grafik hanya bila `dashboard.omzet` |
| Data Master › Data Barang | `master.barang.kelola` | Staf/Kasir mencari barang lewat layar order, bukan menu ini. Cetak label dan satuan jual (harga tetap satuan jual butuh `master.harga.kelola`; K-090, K-091) |
| Data Master › Data Pelanggan | `master.pelanggan.lihat` | |
| Data Master › Data Pemasok | `master.pemasok.lihat` | |
| Data Master › Data Pengguna | `master.pengguna.kelola` | Label "Owner Only" seperti mockup |
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
| Pengaturan | `sistem.pengaturan.kelola` | Tab "Log Aktivitas" bila `sistem.log.lihat`; tab "Cadangan" bila `sistem.cadangan.kelola`; tab "Promo" bila `promo.kelola` (menu Promo dipindah ke sini, K-110); tab "Pembayaran" = rekening toko (K-111) |

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

## 8. Log aktivitas

Dicatat untuk setiap aksi mutasi dan setiap login/logout: `waktu`, `id_pengguna`, `aksi` (mis. `PENJUALAN_CHECKOUT`,
`VOID_SETUJUI`, `BARANG_UBAH`), `entitas`, `id_entitas`, `ringkasan` (nilai lama → baru untuk perubahan master,
nomor dokumen untuk transaksi), `ip`. Log tidak bisa diubah atau dihapus dari aplikasi. Hanya Owner yang melihat
(`sistem.log.lihat`). Retensi: tidak dihapus pada M1.

## Riwayat

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
