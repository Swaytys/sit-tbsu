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
| `master.pengguna.kelola` | Tambah/ubah/nonaktifkan pengguna, reset password, cabut sesi |
| `master.barang.lihat` | Lihat daftar dan detail barang tanpa harga modal |
| `master.barang.lihat_hpp` | Lihat harga modal, HPP, harga beli terakhir, harga titip |
| `master.barang.kelola` | Tambah/ubah/nonaktifkan barang dan atributnya |
| `master.kategori.kelola` | Kelola kategori |
| `master.satuan.kelola` | Kelola satuan, jenis atribut, satuan jual |
| `master.harga.kelola` | Ubah harga jual per tier per barang; kelola master tier |
| `master.harga.tinjau` | (M2) Terapkan usulan harga dari markup |
| `master.pelanggan.lihat` | Lihat pelanggan |
| `master.pelanggan.kelola` | Tambah/ubah/nonaktifkan pelanggan (data kontak) |
| `master.pelanggan.atur_kredit` | Atur tier harga default, term hari, dan limit kredit pelanggan (K-059) |
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
| `penjualan.tier.ubah` | Mengganti tier harga pada baris saat order/checkout |
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
| `kas.shift.kelola_sendiri` | Buka/tutup shift sendiri, catat kas masuk/keluar shift sendiri, clerical shift sendiri |
| `kas.shift.lihat_semua` | Lihat semua shift dan clerical, buka kembali shift (dengan alasan tercatat) |

### Laporan dan dashboard

| Kode | Arti |
|---|---|
| `dashboard.dasar` | Kartu antrean order, pengiriman aktif, peringatan stok, aksi cepat |
| `dashboard.omzet` | Kartu penjualan hari ini, grafik penjualan |
| `laporan.penjualan` | Penjualan per periode, produk terlaris, detail invoice, retur (tanpa HPP/laba jika tidak punya `lihat_hpp`) |
| `laporan.persediaan` | Stok rekap, kartu stok, stok minimum, nilai persediaan |
| `laporan.laba` | Gross profit |
| `laporan.piutang` | Laporan piutang |
| `laporan.hutang` | (M2) Laporan hutang, konsinyasi |
| `laporan.ekspor` | Cetak PDF dan ekspor Excel untuk laporan yang boleh dilihat |

### Promo (M2)

| Kode | Arti |
|---|---|
| `promo.kelola` | Buat/ubah/nonaktifkan promo |

## 3. Matriks peran

`✓` = izin dimiliki. Peran di kanan mewarisi semua izin peran di kirinya; kolom tetap ditulis lengkap agar
`roles.ts` bisa disalin langsung.

| Izin | Staf | Kasir | Admin | Owner |
|---|:-:|:-:|:-:|:-:|
| sistem.pengaturan.kelola | | | ✓ | ✓ |
| sistem.log.lihat | | | | ✓ |
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
| penjualan.tier.ubah | | ✓ | ✓ | ✓ |
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
| Data Master › Data Barang | `master.barang.kelola` | Staf/Kasir mencari barang lewat layar order, bukan menu ini |
| Data Master › Data Pelanggan | `master.pelanggan.lihat` | |
| Data Master › Data Pemasok | `master.pemasok.lihat` | |
| Data Master › Data Pengguna | `master.pengguna.kelola` | Label "Owner Only" seperti mockup |
| Data Master › Referensi Barang | `master.kategori.kelola` | Satu halaman bertab: Kategori, Merk, Satuan, Atribut |
| Data Master › Harga Jual | `master.harga.kelola` | Tier dan harga per barang; M2 menambah tab Tinjau Harga |
| Transaksi › Order Penjualan | `penjualan.order.buat` | Staf hanya melihat order miliknya kecuali `order.lihat_semua` |
| Transaksi › Penjualan Langsung | `penjualan.checkout` | |
| Transaksi › Penjualan Pengantaran | `penjualan.checkout` | Daftar invoice, detail, surat jalan, pembayaran |
| Transaksi › Piutang | `penjualan.piutang.lihat` | |
| Transaksi › Retur Penjualan | `retur.ajukan` | Tab "Persetujuan" bila `retur.setujui` |
| Transaksi › Void Transaksi | `void.ajukan` | Tab "Persetujuan" bila `void.setujui` |
| Persediaan › Penerimaan Barang | `persediaan.penerimaan.kelola` | |
| Persediaan › Stok Persediaan | `persediaan.stok.lihat` | Tab posisi stok, mutasi, kartu stok, stok tertahan, penyesuaian |
| Persediaan › Hutang Pemasok (M2) | `hutang.lihat` | |
| Persediaan › Konsinyasi (M2) | `konsinyasi.kelola` | |
| Kas › Shift & Clerical Check | `kas.shift.kelola_sendiri` | Tab "Semua Shift" bila `kas.shift.lihat_semua` |
| Laporan | `laporan.penjualan` atau `laporan.persediaan` | Daftar laporan disaring per izin |
| Promo (M2) | `promo.kelola` | |
| Pengaturan | `sistem.pengaturan.kelola` | Tab "Log Aktivitas" bila `sistem.log.lihat` |

## 5. Data sensitif

Field berikut hanya dikirim API bila pemanggil punya `master.barang.lihat_hpp` (atau `laporan.laba` untuk laporan):
`harga_modal_masuk`, `hpp_rata2`, `harga_beli_terakhir`, `hpp_saat_transaksi`, `harga_titip`, `laba`, `margin`,
`nilai_persediaan`. Penyaringan dilakukan di service/serializer, bukan di komponen React. Tes wajib: Kasir memanggil
`GET /api/barang/:id` tidak menerima field-field tersebut.

Field yang **tidak pernah** dikirim API: `password_hash`, `token_hash` sesi, `SESSION_SECRET`.

## 6. Persetujuan (retur dan void)

- Pengaju dengan izin `*.setujui` (Admin/Owner) → dokumen langsung DISETUJUI, dengan `id_pengaju` = `id_penyetuju`
  dan dicatat di log (K-017). Ini pilihan sadar untuk toko kecil yang owner-nya juga admin; risikonya adalah
  tidak ada pemisahan tugas untuk Admin. Owner dapat memantau lewat log dan laporan retur/void.
- Pengaju tanpa izin `*.setujui` (Kasir) → status MENUNGGU; muncul di tab Persetujuan dan notifikasi Admin/Owner.
  Penyetuju harus login dengan akunnya sendiri (tidak ada dropdown "diotorisasi oleh", tidak ada PIN di M1).
- Penyetuju boleh menolak dengan alasan; permintaan tetap tersimpan (append-only).
- Void tambahan: hanya untuk penjualan pada shift yang masih terbuka; penjualan yang sudah punya surat jalan
  berstatus DIKIRIM/SELESAI atau sudah punya retur tidak bisa di-void (`STATUS_TIDAK_VALID`).

## 7. Sesi, login, password

| Aturan | Nilai default | Sumber |
|---|---|---|
| Panjang password minimum | 8 karakter | `konfigurasi.password_min` |
| Hash | argon2id (memori 64 MB, iterasi 3, paralel 1) | kode |
| Idle timeout | 60 menit tanpa request → sesi berakhir | `.env SESSION_IDLE_MENIT` |
| Batas absolut sesi | 12 jam sejak login | `.env SESSION_ABSOLUT_JAM` |
| Gagal login | 5 kali berturut → akun dikunci 15 menit; rate limit IP 20 percobaan/menit | `konfigurasi.login_maks_gagal`, `login_kunci_menit` |
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
