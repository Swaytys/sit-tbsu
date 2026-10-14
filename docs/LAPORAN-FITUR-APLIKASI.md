# Laporan Inventaris Fitur Aplikasi — BonsaiUrip (SIT TBSU)

Sistem Informasi Terintegrasi Penjualan & Persediaan UD. Sumber Urip, Peterongan, Jombang.

- **Disusun:** 14 Oktober 2026, dari kode di repo `sit-tbsu`, cabang `main` (commit `42fe18d`, 198 commit).
- **Tujuan:** bahan Proposal Tugas Akhir kualitatif (evaluasi penerapan dengan konstruk DeLone & McLean).
  Ditulis agar bisa dibaca utuh oleh pembaca, termasuk AI lain, yang **tidak** punya akses ke kode.
- **Sifat:** inventaris faktual. Tidak ada kode yang diubah untuk menyusunnya.
- **Dokumen hidup:** diperbarui setiap kali ada fitur baru (lihat Riwayat di akhir).

## Cara membaca label bukti

| Label | Arti |
|---|---|
| `[KODE: path:baris]` | Diperiksa langsung di kode. Path relatif terhadap akar repo. |
| `[KONFIG: path]` | Dari berkas konfigurasi, variabel lingkungan, atau data awal (nilai bawaan yang bisa diubah). |
| `[DOK: path]` | Dari dokumen proyek di repo (`docs/`, `CLAUDE.md`): keputusan atau aturan yang dicatat, bukan dibaca dari kode. |
| `[TANYA n]` | Tidak bisa dipastikan dari kode; dikumpulkan sebagai pertanyaan di bagian 13. |

Singkatan path: `api/` = `apps/api/src/`, `web/` = `apps/web/src/`, `shared/` = `packages/shared/src/`.
Contoh: `[KODE: api/modules/persediaan/ledger.ts:161]` berarti `apps/api/src/modules/persediaan/ledger.ts` baris 161.

Kata "K-nnn" merujuk ke catatan keputusan di `docs/keputusan/`; ringkasannya di `docs/10-ringkasan-keputusan.md`.

---

## 1. Ringkasan aplikasi

1. **Tujuan:** aplikasi internal (bukan toko online) untuk mencatat penjualan, persediaan, kas, piutang, dan
   hutang toko bahan bangunan UD. Sumber Urip, dipakai empat peran: Owner, Admin, Kasir, Staf Penjualan
   `[DOK: CLAUDE.md]`. Nama tampil: **BonsaiUrip** `[DOK: docs/keputusan/2026-09-19-keputusan-tambahan.md]`.
2. **Jenis:** aplikasi **web** yang dibuka di peramban (Chrome/Edge disarankan); bukan PWA, bukan aplikasi
   ponsel, belum ada versi desktop `[DOK: docs/keputusan/2026-09-19-keputusan-fondasi.md, K-001]`. Tidak ada
   service worker maupun manifest PWA di kode web `[KODE: apps/web/index.html:5]` (hanya meta viewport).
3. **Tech stack (versi dikunci):** TypeScript 6.0.3; frontend React 19.3.0 + Vite 8.3.0 + Tailwind CSS 4.3.3 +
   komponen shadcn/ui (Radix) + React Router 8.4.0 + TanStack Query 5.103.2 + React Hook Form 7.88.0; backend
   Hono 4.13.8 di Node.js (≥ 24.11, dikunci 24.21.0) + Drizzle ORM 0.45.3; validasi Zod 4.6.5 dipakai bersama
   backend–frontend; hash password argon2 0.45.1; hitungan desimal decimal.js 10.6.0; Excel exceljs 4.4.0; email
   nodemailer 10.0.14; tes Vitest 5.0.1 dan Playwright 1.63.0; pengelola paket pnpm 12.6.0 (monorepo)
   `[KONFIG: pnpm-workspace.yaml]` `[KONFIG: package.json:5-7]`.
4. **Database:** PostgreSQL 17 (relasional), 48 tabel, skema dikelola lewat 19 berkas migrasi SQL (`0000`–`0018`)
   `[KODE: apps/api/src/db/schema/*.ts]` `[KODE: apps/api/src/db/migrations/]`.
5. **Deploy (rancangan):** server aplikasi + database di **satu komputer Windows di toko**; produksi melayani API
   dan tampilan web dari satu port HTTPS (443) dengan sertifikat CA lokal toko; dinyalakan otomatis oleh Task
   Scheduler; diperbarui lewat skrip PowerShell `[DOK: docs/keputusan/2026-10-04-deploy-cadangan.md, K-082]`
   `[KODE: apps/api/src/app.ts:136]`. Apakah sudah terpasang di toko: `[TANYA 1]`.
6. **Keterhubungan perangkat:** semua perangkat (komputer kasir, perangkat staf) membuka alamat server yang sama
   lewat jaringan lokal toko; tidak ada sinkronisasi antar-perangkat karena datanya hanya satu (di server).
   Pemilik bisa mengakses dari luar toko lewat **Tailscale** (VPN) `[DOK: K-082]`.
7. **Real-time:** antrean order memakai **Server-Sent Events** (server mengirim tanda "berubah", layar memuat ulang
   datanya) `[KODE: api/lib/siaran.ts:16]` `[KODE: api/modules/penjualan/order/routes.ts:50]`
   `[KODE: web/api/penjualan.ts:351]`, dengan cadangan **polling** tiap 60 detik
   `[KODE: web/api/penjualan.ts:343]`. Notifikasi lonceng dimuat ulang tiap 60 detik
   `[KODE: web/api/persediaan.ts:246]`; status shift tiap 5 menit `[KODE: web/api/penjualan.ts:153]`.
8. **Status pengembangan:** Fase 1–12 selesai (M1 = v1.0.0, M2 = v1.1–v1.4), disusul tinjauan pemilik 8–12
   Oktober 2026 (keputusan K-092–K-112) `[DOK: docs/07-roadmap.md]`. Belum ada tag rilis di git
   `[KODE: git tag kosong]`.
9. **Pengujian otomatis:** 325 tes layanan API (dengan database PostgreSQL sungguhan, bukan tiruan), 20 tes paket
   bersama, 63 tes ujung-ke-ujung (Playwright) — semuanya lulus pada 12–13 Oktober 2026 `[KODE: hasil pnpm test
   dan playwright]`.

---

## 2. Arsitektur & perangkat

### 2.1 Lapisan

| Lapisan | Isi | Bukti |
|---|---|---|
| Tampilan (web) | Halaman React per menu, dimuat per rute (lazy) | `[KODE: web/routes.tsx:23-55]` |
| Kontrak bersama | Enum status, daftar izin, peran, skema validasi Zod, helper uang/qty | `[KODE: shared/roles.ts:9-83]` `[KODE: shared/permissions.ts]` |
| API | 192 endpoint REST di bawah `/api`, dikelompokkan per modul | `[KODE: api/app.ts:52-88]` |
| Logika bisnis | Hanya di `api/modules/*/service.ts` | `[DOK: CLAUDE.md, aturan arsitektur 1]` |
| Penulisan stok | Satu pintu `catatMutasi()` dengan kunci baris (`SELECT … FOR UPDATE`) | `[KODE: api/modules/persediaan/ledger.ts:161]` |
| Database | PostgreSQL, tabel transaksi hanya-tambah (koreksi lewat dokumen baru) | `[DOK: CLAUDE.md, aturan 3]` |

### 2.2 Pemakaian per perangkat

| Perangkat | Pemakaian yang dirancang | Bukti |
|---|---|---|
| Komputer/laptop kasir | Layar utama: Penjualan Langsung, Pengantaran, Shift; bisa dijalankan penuh dengan keyboard (F2 cari, F8 bayar, F9 mulai dari awal, huruf T/B/E/Q/C untuk cara bayar) dan juga diklik | `[KODE: web/features/pos/layar-pos.tsx:90]` `[KODE: web/features/pos/panel-bayar-pos.tsx:33-53]` |
| Printer thermal kasir | Struk dikirim langsung sebagai perintah ESC/POS lewat Web Serial (hanya Chrome/Edge); selain itu lewat jendela cetak peramban | `[KODE: web/lib/printer-thermal.ts]` `[KODE: shared/escpos.ts]` |
| Perangkat staf penjualan | Halaman Order Penjualan (input cepat). Tampilan dirancang **desktop-first** (lebar 1280 px, masih bisa 1024 px/tablet); tidak ada tata letak khusus ponsel | `[DOK: CLAUDE.md, bagian UI]` |
| HP Owner dari luar toko | Membuka aplikasi lewat Tailscale; tampilan sama dengan desktop | `[DOK: docs/panduan/manual-pengguna.md, Owner]` |

- **Responsif:** ada penyesuaian lebar untuk layar sempit (mis. tombol di kepala halaman turun ke baris berikut)
  `[KODE: web/components/layout/layout.tsx:56]`, tetapi pemakaian di ponsel tidak menjadi target. Perangkat yang
  benar-benar dipakai staf di toko: `[TANYA 2]`.
- **Jaringan putus:** tidak ada mode offline (tidak ada service worker, tidak ada penyimpanan data bisnis di
  peramban) `[DOK: CLAUDE.md, bagian Jangan]`. Karena server ada di toko, **internet putus tidak menghentikan**
  pemakaian di jaringan lokal; yang berhenti hanya akses dari luar, kiriman kode Telegram/email, dan cadangan ke
  cloud `[DOK: K-082, K-102]`. Bila jaringan lokal atau server mati, aplikasi tidak bisa dipakai; layar
  menampilkan pesan galat `[KODE: web/features/umum/halaman-galat.tsx]`. Siaran antrean tersambung ulang sendiri
  `[KODE: web/api/penjualan.ts:349]`.

### 2.3 Pekerjaan berkala di server

| Pekerjaan | Interval | Bukti |
|---|---|---|
| Order basi (batal otomatis bila diaktifkan) dan lepas kunci order kedaluwarsa | 15 menit | `[KODE: api/index.ts:52]` `[KODE: api/modules/penjualan/order/service.ts:675]` |
| Pengingat shift yang lewat jam tutup atau lewat hari | 5 menit | `[KODE: api/index.ts:62]` `[KODE: api/modules/kas/shift/service.ts:370]` |
| Cadangan harian dan uji pulih bulanan | dicek tiap 10 menit | `[KODE: api/index.ts:72-76]` `[KODE: api/modules/sistem/cadangan/service.ts:528]` |

---

## 3. Peran pengguna & hak akses

### 3.1 Model

- Peran = kumpulan izin; peran bertingkat **Staf Penjualan ⊂ Kasir ⊂ Admin ⊂ Owner** (setiap peran mewarisi izin
  peran di bawahnya) `[KODE: shared/roles.ts:5-83]`.
- **Penegakan di server:** setiap endpoint memasang `requirePermission('kode.izin')`
  `[KODE: api/middleware/require-permission.ts:39]`; server **menolak menyala** bila ada endpoint tanpa
  deklarasi izin, kecuali daftar publik (login, health) `[KODE: api/app.ts:143-153]`
  `[KODE: api/middleware/require-permission.ts:69]`.
- **Penegakan di tampilan:** menu disembunyikan bila izinnya tidak ada `[KODE: web/lib/menu.ts:186-195]`; halaman
  dibungkus penjaga izin `[KODE: web/routes.tsx:59-78]`. Penyembunyian di layar hanya kenyamanan; API tetap
  penjaga utama.
- **Data sensitif** (harga modal, HPP, laba, harga titip) disaring **di server** menurut izin
  `master.barang.lihat_hpp` / `laporan.laba` `[KODE: api/modules/master/barang/service.ts:76]`
  `[KODE: api/modules/penjualan/penjualan/service.ts:91]` `[KODE: api/modules/laporan/umum.ts:24]`.
- **Tidak ada aksi "hapus"** untuk data bisnis: data master dinonaktifkan, transaksi dikoreksi dengan dokumen baru
  (void, retur, penyesuaian). Endpoint DELETE hanya untuk gambar barang, logo toko, dan tautan Telegram akun
  sendiri `[KODE: api/modules/master/barang/routes.ts:82]` `[KODE: api/modules/sistem/pengaturan/routes.ts:46]`
  `[KODE: api/modules/sistem/saluran/routes.ts:50]`.

### 3.2 Matriks peran × modul

Keterangan: L = lihat, T = tambah, U = ubah, N = nonaktifkan, S = setujui, C = cetak/ekspor, — = tidak ada akses.
Sumber izin: `[KODE: shared/roles.ts:9-76]`; izin per endpoint: daftar di Lampiran A.

| Modul / aksi | Staf Penjualan | Kasir | Admin | Owner |
|---|---|---|---|---|
| Dashboard | L (tanpa omzet) | L + omzet | L + omzet | L + omzet |
| Data Barang (halaman kelola) | — (hanya cari barang di transaksi) | — (sama) | L T U N, lihat HPP | L T U N, lihat HPP |
| Referensi Barang (kategori, merk, satuan, atribut) | L (lewat form) | L | L T U N | L T U N |
| Harga Jual, tier, Tinjau Harga | — | — | L U, terapkan/abaikan | sama |
| Promo (Pengaturan › Promo) | — | — | L T U N | L T U N |
| Data Pelanggan | L T; U N **dengan kode atasan** | sama dengan Staf | L T U N, atur limit/term/golongan | sama |
| Data Pemasok | — | — | L T U N | L T U N |
| Data Pengguna | — | — | — | L T U N, reset password, cabut sesi |
| Order Penjualan | T U kirim, batal milik sendiri | + lihat semua, batal | + lepas kunci paksa | sama |
| Penjualan Langsung / Pengantaran (checkout) | — | T, diskon (batas %), C struk/invoice | + harga manual | sama |
| Pembayaran & Piutang | — | L T (terima pembayaran) | sama | sama |
| Surat jalan | — | T U (status), batal | sama | sama |
| Retur penjualan / Void | — | T (ajukan), batal pengajuan sendiri; S dengan kode atasan | + S, tolak | sama |
| Shift & clerical check | — | shift sendiri: buka, kas, tutup | + lihat & tutup shift semua kasir | sama |
| Rekening toko | — | L (memilih saat bayar) | L T U N | sama |
| Cek uang non-tunai | — | — | L, tandai Sudah/Tidak masuk | sama |
| Penerimaan barang, stok, penyesuaian/opname, retur ke pemasok | — (stok tersedia tampil di cari barang) | — | L T | sama |
| Hutang pemasok, konsinyasi | — | — | L T (bayar, setoran) | sama |
| Laporan penjualan, piutang, produk terlaris, daftar harga | — | L C | L C | L C |
| Laporan persediaan, laba kotor, nilai persediaan, hutang | — | — | L C | L C |
| Pengaturan (profil, penomoran, operasional, pembayaran, harga & diskon, persetujuan) | — | — | L U | L U |
| Pengaturan › Cadangan, Log aktivitas | — | — | — | L, jalankan cadangan/uji pulih |

Catatan matriks:
- Batas diskon manual per peran bawaan: Staf 0 %, Kasir 0 %, Admin 100 %, Owner 100 % `[KONFIG: apps/api/src/db/data-awal.ts:130-152]`
  `[KODE: api/modules/penjualan/harga-baris.ts:114]`.
- Retur/void bernilai di bawah batas tanpa persetujuan (bawaan Rp 0) langsung disetujui
  `[KONFIG: apps/api/src/db/data-awal.ts:154-165]`.
- Persetujuan atasan untuk Kasir/Staf dilakukan dengan **kode sekali pakai** yang dikirim server ke Telegram/email
  Admin/Owner `[KODE: api/modules/sistem/kode-persetujuan/service.ts:61,174,237]`.

---

## 4. Daftar modul & fitur

Kolom "Perangkat utama" adalah rancangan, bukan pengamatan lapangan. Semua fitur berstatus **BERFUNGSI** menurut
tes otomatis kecuali disebut lain; "SEBAGIAN" berarti ada bagian yang belum diuji di perangkat sungguhan atau
bergantung konfigurasi.

### 4.1 Akses & sistem

**F1. Login, sesi, ganti password** | Auth | semua | semua
- Fungsi: masuk dengan username/password; pengguna baru wajib ganti password; sesi berakhir bila diam 60 menit
  atau setelah 12 jam; akun terkunci 15 menit setelah 5 kali salah.
- Input → Proses → Output: username, password → verifikasi argon2id, buat token acak, simpan hash token →
  cookie sesi `httpOnly`.
- Tabel: `pengguna`, `sesi_login`, `log_aktivitas`.
- Bukti: `[KODE: api/modules/auth/service.ts:164]` `[KODE: api/lib/password.ts:1]`
  `[KODE: api/modules/auth/service.ts:138-139]` `[KONFIG: apps/api/src/env.ts:16-17]`
  `[KONFIG: apps/api/src/db/data-awal.ts:178-189]`.
- Status: BERFUNGSI.

**F2. Kelola pengguna** | Data Pengguna | Owner | desktop
- Fungsi: tambah akun karyawan (kode USR otomatis), ubah, nonaktifkan (sesi langsung dicabut), reset password,
  cabut sesi.
- Tabel: `pengguna`, `sesi_login`.
- Bukti: `[KODE: api/modules/master/pengguna/routes.ts:26-61]`. Status: BERFUNGSI.

**F3. Pengaturan toko** | Pengaturan | Admin, Owner | desktop
- Fungsi: tab Profil toko (nama, alamat, logo), Struk & printer, Penomoran (prefix dokumen), Operasional
  (baris per halaman, ambang restock, batas order, jadwal shift, batas tanpa persetujuan), Pembayaran (rekening
  toko), Harga & diskon (dasar markup, pembulatan, batas diskon per peran), Promo, Keamanan, Persetujuan
  (Telegram/email), Cadangan (Owner), Log aktivitas (Owner).
- Tabel: `konfigurasi`, `rekening_toko`, `promo`, `cadangan`, `log_aktivitas`.
- Bukti: `[KODE: web/features/pengaturan/halaman-pengaturan.tsx:61-71]` `[KODE: api/modules/sistem/pengaturan/routes.ts:28-46]`.
- Status: BERFUNGSI.

**F4. Penomoran dokumen otomatis** | Sistem | otomatis
- Fungsi: nomor `PREFIX-YYMMDD-NNN` urut per hari (ORD, STR, INV, SJ, BYR, RTR, VD, RCV, ADJ, RTP, KSG, PBP, SHF,
  CLC) dan kode master 5 digit (BRG-00001, PLG-00001, …), diterbitkan di dalam transaksi dengan kunci baris.
- Tabel: `penghitung_nomor`.
- Bukti: `[KODE: api/modules/sistem/penomoran.ts:44,57]` `[DOK: K-022, K-045]`. Status: BERFUNGSI.

**F5. Log aktivitas** | Pengaturan › Log aktivitas | Owner | desktop
- Fungsi: mencatat 103 jenis aksi (login, perubahan master, transaksi, persetujuan, cetak ulang, ekspor laporan)
  beserta pelaku, waktu, entitas, nomor dokumen, ringkasan, data lama/baru, IP; ditampilkan dengan cari dan
  saring per aksi.
- Tabel: `log_aktivitas`.
- Bukti: `[KODE: shared/log.ts]` `[KODE: api/modules/sistem/log-aktivitas.ts:24]`
  `[KODE: apps/api/src/db/schema/sistem.ts:114-140]` `[KODE: api/modules/sistem/log/routes.ts:19-21]`.
- Status: BERFUNGSI (tampil di layar; **tidak ada tombol ekspor** log).

**F6. Notifikasi (lonceng)** | Topbar | semua (isi disaring izin) | semua
- Fungsi: 14 jenis pengingat: order basi, stok habis, stok kritis, piutang terlambat, piutang jatuh tempo ≤ 3 hari,
  void/retur menunggu, cadangan bermasalah, hutang terlambat/jatuh tempo, shift saya/shift kasir perlu ditutup,
  pembayaran non-tunai belum dicek, non-tunai tidak masuk.
- Bukti: `[KODE: shared/schemas/notifikasi.ts:7-20]` `[KODE: api/modules/sistem/notifikasi/service.ts:14]`.
- Status: BERFUNGSI.

**F7. Persetujuan atasan dengan kode sekali pakai** | Retur, Void, Limit kredit, Pelanggan | Kasir/Staf meminta,
Admin/Owner menerima | desktop + Telegram/email atasan
- Fungsi: server membuat kode 6 angka berbeda untuk tiap atasan, dikirim lewat bot Telegram toko dan/atau email
  (SMTP) beserta rincian permintaan; berlaku 10 menit, sekali pakai, batal setelah 5 kali salah, terikat satu
  dokumen/perubahan; kode hanya disimpan sebagai hash.
- Tabel: `permintaan_persetujuan`, `kode_persetujuan`.
- Bukti: `[KODE: api/modules/sistem/kode-persetujuan/service.ts:61,174,237]`
  `[KODE: api/modules/sistem/saluran/service.ts:102]`.
- Status: BERFUNGSI (Telegram dan email sudah dicoba pemilik di lingkungan pengembangan) `[DOK: docs/keputusan/2026-10-12-tinjauan-pemilik.md]`.

**F8. Cadangan data dan uji pulih** | Pengaturan › Cadangan | Owner | server
- Fungsi: cadangan harian terenkripsi (pg_dump + restic) ke disk lokal dan cloud, retensi 7 harian/4 mingguan/12
  bulanan/5 tahunan, uji pulih otomatis tiap tanggal 1, tombol cadangkan sekarang.
- Tabel: `cadangan`.
- Bukti: `[KODE: api/modules/sistem/cadangan/service.ts:323,458,528]` `[DOK: K-084]`.
- Status: SEBAGIAN — berfungsi di tes; bergantung pada pemasangan restic/rclone di server toko `[TANYA 1]`.

### 4.2 Data master

**F9. Data Barang** | Data Master | Admin, Owner | desktop
- Fungsi: tambah/ubah/nonaktifkan barang: kode, nama, kategori, merk, satuan dasar, atribut (ukuran, warna,
  berat, …), stok minimum, gambar, kepemilikan (milik toko / titipan pemasok), harga modal awal (boleh "belum
  tahu"), harga otomatis, kemasan (satuan jual lain, mis. dus isi 12).
- Tabel: `barang`, `barang_atribut`, `barang_satuan_jual`, `harga_barang`, `persediaan`.
- Bukti: `[KODE: api/modules/master/barang/service.ts:424,489,635,662]` `[KODE: api/modules/master/barang/routes.ts:28-82]`.
- Status: BERFUNGSI.

**F10. Import/ekspor Excel barang** | Data Barang | Admin, Owner | desktop
- Fungsi: unduh templat (ringkas/lengkap) → unggah → pratinjau per baris (baris salah bisa diperbaiki di layar) →
  simpan semua atau tidak sama sekali; hanya menambah barang baru; ekspor data barang.
- Bukti: `[KODE: api/modules/master/import/routes.ts:22-48]`. Status: BERFUNGSI.

**F11. Referensi Barang** | Data Master | Admin, Owner | desktop
- Fungsi: kategori, merk, satuan (berdimensi, dengan konversi sesama dimensi), jenis atribut.
- Tabel: `kategori`, `merk`, `satuan`, `jenis_atribut`.
- Bukti: `[KODE: api/modules/master/kategori/routes.ts:13-28]` `[KODE: api/modules/master/satuan/routes.ts:14-29]`.
- Status: BERFUNGSI.

**F12. Data Pelanggan** | Data Master | semua peran (dengan batas) | desktop
- Fungsi: kode PLG otomatis, No. HP wajib, alamat, golongan (untuk promo), term pembayaran, limit kredit. Daftar
  menampilkan **posisi kredit**: limit dan sisanya, tagihan berjalan, jatuh tempo terdekat. Kasir/Staf bebas
  menambah; mengubah/menonaktifkan butuh kode atasan yang terikat pada isi perubahan (sidik SHA-256).
- Tabel: `pelanggan`, `golongan_pelanggan`, `permintaan_persetujuan`.
- Bukti: `[KODE: api/modules/master/pelanggan/service.ts:51,232]` `[KODE: api/modules/master/pelanggan/routes.ts:31-78]`.
- Status: BERFUNGSI.

**F13. Data Pemasok** | Data Master | Admin, Owner | desktop
- Tabel: `pemasok`. Bukti: `[KODE: api/modules/master/pemasok/routes.ts:13-28]`. Status: BERFUNGSI.

**F14. Cetak label barcode** | Data Barang › Cetak label | Admin, Owner | desktop + printer label/thermal
- Fungsi: label berbarcode Code 128 (barcode pabrik atau kode barang) dengan nama dan harga, kertas thermal
  57/58/80 mm atau label A4.
- Bukti: `[KODE: shared/code128.ts]` `[KODE: web/routes.tsx]` (rute `barang/label`). Status: BERFUNGSI.

### 4.3 Harga & promo

**F15. Harga jual per tier dan harga otomatis** | Harga Jual | Admin, Owner | desktop
- Fungsi: harga dasar (Normal) tiap barang = Rp tetap, markup tier, atau markup sendiri; tier lain (mis. Grosir)
  selalu modal + markup tier dan berlaku menurut **total nilai belanja** satu transaksi; harga otomatis naik bila
  modal naik, turun menunggu ditinjau.
- Tabel: `tingkat_harga`, `harga_barang`, `barang`, `persediaan`.
- Bukti: `[KODE: api/modules/master/harga/service.ts:62,112,468]` `[KODE: api/modules/penjualan/harga-baris.ts:174]`.
- Status: BERFUNGSI.

**F16. Tinjau Harga** | Harga Jual › Tinjau Harga | Admin, Owner | desktop
- Fungsi: daftar barang yang dasar modalnya berubah dengan usulan harga dan margin; terapkan atau abaikan.
- Bukti: `[KODE: api/modules/master/harga/service.ts:576,630,712]`. Status: BERFUNGSI.

**F17. Promo** | Pengaturan › Promo | Admin, Owner (buat); semua (menerima) | desktop
- Fungsi: potongan persen atau rupiah per satuan; sasaran barang (semua/kategori/satu barang) dan pembeli
  (semua/golongan/pelanggan tertentu); syarat min qty, min belanja, belanja pelanggan N hari; masa berlaku;
  **anggaran promo** dan **batas per pembeli**; jumlah potongan yang sudah diberikan.
- Tabel: `promo`, `promo_pelanggan`, `penjualan_detail` (kolom `id_promo`, `diskon_promo`).
- Bukti: `[KODE: api/modules/promo/hitung.ts:116]` `[KODE: api/modules/promo/repo.ts:164]` `[KODE: api/modules/promo/routes.ts:13-28]`.
- Status: BERFUNGSI.

### 4.4 Penjualan

**F18. Order Penjualan (input cepat dan form lengkap)** | Transaksi | Staf, Kasir, Admin, Owner | desktop/tablet
- Fungsi: staf mencatat pesanan (ketik `3*semen` untuk qty), memilih pelanggan bila ada, lalu mengirim ke antrean
  kasir; order menahan stok (reservasi); isian yang belum dikirim tersimpan sebagai draf; "Mulai dari awal" (F9)
  dengan konfirmasi.
- Input → Proses → Output: barang + qty → harga, tier, promo dihitung server (pratinjau) → order MENUNGGU dengan
  nomor antrean; `stok_dipesan` naik.
- Tabel: `order_penjualan`, `order_penjualan_detail`, `persediaan`.
- Bukti: `[KODE: api/modules/penjualan/order/service.ts:372,468,517]` `[KODE: api/modules/persediaan/ledger.ts:264]`.
- Status: BERFUNGSI.

**F19. Cari barang** | semua layar transaksi | semua | desktop
- Fungsi: cari per kata di nama, kode, barcode, merk, kategori, atribut (mis. `pipa 3 inch putih`), urut
  relevansi; saring kategori; tombol **Daftar** untuk melihat barang tanpa mengetik; foto kecil; stok tersedia.
- Bukti: `[KODE: api/modules/master/barang/repo.ts:101,128]` `[KODE: web/features/pos/cari-barang-pos.tsx]`.
- Status: BERFUNGSI.

**F20. Antrean order (papan FIFO)** | Penjualan Langsung, Pengantaran | Kasir+ | desktop
- Fungsi: tiket bernomor, terlama disorot, lama menunggu berwarna; kasir membuka order lalu boleh mengubah isinya
  saat bayar; diperbarui real-time (SSE).
- Bukti: `[KODE: api/modules/penjualan/order/service.ts:115,535]` `[KODE: api/modules/penjualan/order/routes.ts:43-50]`.
- Status: BERFUNGSI.

**F21. Penjualan Langsung (kasir/POS)** | Transaksi | Kasir+ | komputer kasir
- Fungsi: checkout dari antrean atau langsung; cara bayar Tunai, Transfer, EDC, QRIS, bayar campuran; pembeli
  terdata boleh DP/bayar nanti; struk otomatis; tanda barang belum diambil.
- Input → Proses → Output: barang, pembeli, pembayaran → satu transaksi DB: penjualan + detail (snapshot harga &
  HPP), lepas reservasi, mutasi stok keluar, pembayaran, cek limit kredit → struk `STR-…`.
- Tabel: `penjualan`, `penjualan_detail`, `pembayaran_penjualan`, `mutasi_persediaan`, `persediaan`, `kas_shift`.
- Bukti: `[KODE: api/modules/penjualan/penjualan/service.ts:304]` `[KODE: api/modules/penjualan/pembayaran.ts:52]`.
- Status: BERFUNGSI.

**F22. Penjualan Pengantaran (invoice)** | Transaksi | Kasir+ | komputer kasir
- Fungsi: dari order antrean atau dibuat langsung; alamat kirim, ongkir; cara bayar Lunas/DP/Bayar nanti/Saat
  terima; invoice `INV-…` A4.
- Bukti: sama dengan F21 (`checkout`) `[DOK: K-104]`. Status: BERFUNGSI.

**F23. Surat jalan** | Detail penjualan | Kasir+ | desktop
- Fungsi: satu invoice boleh beberapa surat jalan (kirim bertahap); status dicetak → dimuat → dikirim (sopir
  wajib) → diterima; batal sebelum berangkat; status pengiriman invoice dihitung ulang.
- Tabel: `surat_jalan`, `surat_jalan_detail`.
- Bukti: `[KODE: api/modules/penjualan/surat-jalan/service.ts:36,49,110,193,248]`. Status: BERFUNGSI.

**F24. Piutang** | Transaksi › Piutang | Kasir+ | desktop
- Fungsi: daftar tagihan belum lunas dengan jatuh tempo dan umur; terima pembayaran; ringkasan per pelanggan.
- Bukti: `[KODE: api/modules/penjualan/piutang/repo.ts:85]` `[KODE: api/modules/penjualan/penjualan/service.ts:526]`.
- Status: BERFUNGSI.

**F25. Limit kredit pelanggan** | checkout | Kasir (butuh kode atasan), Admin/Owner | desktop
- Fungsi: checkout tidak lunas ditolak bila piutang berjalan + tagihan baru > limit, kecuali disetujui atasan.
- Bukti: `[KODE: api/modules/penjualan/penjualan/service.ts:442-447]`. Status: BERFUNGSI.

### 4.5 Koreksi transaksi

**F26. Retur penjualan** | Transaksi › Retur | Kasir mengajukan, Admin/Owner menyetujui | desktop
- Fungsi: 20 transaksi terbaru langsung tampil; penyelesaian uang dikembalikan, tukar barang sama (tukar guling),
  atau potong tagihan (hanya bila ada sisa tagihan); kondisi baik/rusak/cacat; persetujuan atasan; pengajuan bisa
  dibatalkan selama menunggu.
- Tabel: `retur_penjualan`, `retur_penjualan_detail`, `mutasi_persediaan`, `kas_shift`.
- Bukti: `[KODE: api/modules/koreksi/retur/service.ts:112,176,467,509,530,562]`. Status: BERFUNGSI.

**F27. Void transaksi** | Transaksi › Void | Kasir mengajukan, Admin/Owner menyetujui | desktop
- Fungsi: membatalkan barang/transaksi di shift yang masih buka, belum dikirim, belum diretur; stok kembali;
  kelebihan bayar dikembalikan.
- Tabel: `void_transaksi`, `void_transaksi_detail`.
- Bukti: `[KODE: api/modules/koreksi/void/service.ts:91,277,405]`. Status: BERFUNGSI.

### 4.6 Kas

**F28. Shift kasir dan clerical check** | Shift & Clerical Check | Kasir+ | komputer kasir
- Fungsi: buka shift dengan modal awal; kas manual (kasbon, setor/tarik owner, masuk/keluar lain); tutup shift
  dengan **hitung buta** (uang fisik diketik sebelum angka sistem tampil); selisih wajib keterangan; shift yang
  lewat hari mengunci pencatatan; jadwal buka/tutup dengan pengingat; Admin/Owner menutup shift kasir lain.
- Tabel: `shift_kasir`, `kas_shift`, `clerical_check`.
- Bukti: `[KODE: api/modules/kas/shift/service.ts:84,108,266,297,370]`. Status: BERFUNGSI.

**F29. Rekening toko dan metode QRIS** | Pengaturan › Pembayaran | Admin/Owner kelola; Kasir memilih | desktop
- Fungsi: daftar rekening bank, mesin EDC, QRIS milik toko dengan satu bawaan per jenis; kasir memilih (tidak
  mengetik) saat bayar.
- Tabel: `rekening_toko`, `pembayaran_penjualan.id_rekening`.
- Bukti: `[KODE: api/modules/kas/rekening/service.ts:153]` `[KODE: api/modules/kas/rekening/routes.ts:16-36]`.
- Status: BERFUNGSI.

**F30. Cek uang masuk non-tunai** | Shift & Clerical Check › Cek uang non-tunai | Admin, Owner | desktop
- Fungsi: tiap pembayaran transfer/EDC/QRIS berstatus Belum dicek → dicocokkan manual dengan mutasi bank →
  Sudah masuk / Tidak masuk (wajib catatan); ringkasan jumlah & total per rekening.
- Bukti: `[KODE: api/modules/kas/nontunai/service.ts:39,46,87]`.
- Status: BERFUNGSI (pengecekan **manual**; tidak tersambung ke bank).

### 4.7 Persediaan & pemasok

**F31. Penerimaan barang** | Persediaan | Admin, Owner | desktop
- Fungsi: barang datang dari pemasok (pembelian tunai/tempo atau titipan); stok dan HPP rata-rata diperbarui; tempo
  membentuk hutang; bukti terima dicetak.
- Tabel: `penerimaan_barang`, `penerimaan_barang_detail`, `mutasi_persediaan`, `persediaan`, `pembayaran_pemasok`.
- Bukti: `[KODE: api/modules/persediaan/penerimaan/service.ts:79]`. Status: BERFUNGSI.

**F32. Penyesuaian stok dan stok opname** | Stok Persediaan › Penyesuaian | Admin, Owner | desktop
- Fungsi: saldo awal (bisa import Excel), koreksi, barang rusak, pemusnahan, lembar opname per semua barang/
  kategori; barang yang tidak dihitung dikecualikan dengan alasan.
- Tabel: `penyesuaian_stok`, `penyesuaian_stok_detail`, `mutasi_persediaan`.
- Bukti: `[KODE: api/modules/persediaan/penyesuaian/service.ts:174,285,465]`. Status: BERFUNGSI.

**F33. Posisi stok, mutasi, kartu stok, stok rusak, stok tertahan** | Stok Persediaan | Admin, Owner | desktop
- Bukti: `[KODE: api/modules/persediaan/stok/routes.ts:14-25]` `[KODE: api/modules/persediaan/stok/repo.ts:50]`.
- Status: BERFUNGSI.

**F34. Retur ke pemasok** | Persediaan | Admin, Owner | desktop
- Fungsi: potong hutang, ganti barang, uang kembali, atau pengembalian titipan; nota retur dicetak.
- Tabel: `retur_pemasok`, `retur_pemasok_detail`.
- Bukti: `[KODE: api/modules/persediaan/retur-pemasok/routes.ts:13-19]`. Status: BERFUNGSI.

**F35. Hutang pemasok** | Persediaan | Admin, Owner | desktop
- Fungsi: daftar hutang dengan umur, bayar (tunai dari laci shift atau transfer).
- Tabel: `pembayaran_pemasok`, `penerimaan_barang`.
- Bukti: `[KODE: api/modules/hutang/service.ts:62,199]`. Status: BERFUNGSI.

**F36. Konsinyasi (barang titipan)** | Persediaan | Admin, Owner | desktop
- Fungsi: setoran per pemasok sampai tanggal tertentu (terjual × harga titip, dikurangi retur), nota setoran,
  bayar setoran.
- Tabel: `penyelesaian_konsinyasi`, `penyelesaian_konsinyasi_detail`.
- Bukti: `[KODE: api/modules/konsinyasi/service.ts:57,181]`. Status: BERFUNGSI.

### 4.8 Laporan, dashboard, cetak

**F37. Laporan (15 jenis)** — rincian di bagian 7. Status: BERFUNGSI.

**F38. Dashboard per peran** | Dashboard | semua | semua
- Fungsi: penjualan hari ini vs kemarin dan grafik 7 hari (hanya yang berizin omzet), antrean order, pengiriman
  aktif, persetujuan menunggu (Admin/Owner), peringatan stok, aktivitas terkini.
- Bukti: `[KODE: api/modules/dashboard/service.ts:21-63]` `[KODE: api/modules/dashboard/routes.ts:11-18]`.
- Status: BERFUNGSI.

**F39. Cetak struk, invoice, surat jalan** | layar transaksi | Kasir+ | komputer kasir + printer
- Fungsi: struk thermal 58/80 mm (langsung ESC/POS atau jendela cetak), invoice dan surat jalan A4, cetak ulang
  tercatat di log.
- Bukti: `[KODE: web/lib/printer-thermal.ts]` `[KODE: web/lib/struk-escpos.ts]` `[KODE: api/modules/penjualan/penjualan/service.ts:580]`.
- Status: SEBAGIAN — jalur cetak langsung ke printer thermal baru diuji dengan printer tiruan; uji pada printer
  toko belum dilaporkan `[TANYA 3]`.

---

## 5. Logika bisnis penting

### 5a. Alur order → checkout

1. Staf membuat order (status DRAFT tidak menahan stok). Saat dikirim (`kirimOrder`), status MENUNGGU, order
   mendapat nomor antrean, dan `stok_dipesan` barang naik lewat `ubahReservasi()`
   `[KODE: api/modules/penjualan/order/service.ts:517]` `[KODE: api/modules/persediaan/ledger.ts:264]`.
2. Kasir membuka order dari papan antrean → status DIPROSES dan order dikunci untuk kasir itu
   `[KODE: api/modules/penjualan/order/service.ts:535]`. Kunci kedaluwarsa dilepas oleh job 15 menit
   `[KODE: api/modules/penjualan/order/service.ts:675]`.
3. Checkout dalam **satu transaksi database**: buat penjualan + detail (menyimpan harga dan HPP saat itu), lepas
   reservasi, catat mutasi stok keluar per baris, catat pembayaran, hitung status pembayaran, cek limit kredit,
   tulis log `[KODE: api/modules/penjualan/penjualan/service.ts:304]`.
4. Order yang menunggu lebih lama dari `batas_umur_order_jam` (bawaan 24 jam) ditandai **basi** (notifikasi);
   dibatalkan otomatis hanya bila `auto_batal_order_basi` dinyalakan (bawaan mati)
   `[KONFIG: apps/api/src/db/data-awal.ts:106-117]` `[KODE: api/modules/penjualan/order/service.ts:685-700]`.

Status dokumen `[KODE: shared/enums.ts:122-161]`:

| Dokumen | Status |
|---|---|
| Order | DRAFT → MENUNGGU → DIPROSES → SELESAI, atau BATAL |
| Penjualan (transaksi) | SELESAI, VOID_SEBAGIAN, VOID |
| Pembayaran penjualan | BELUM_BAYAR, DP, LUNAS |
| Pengiriman invoice | BELUM, SEBAGIAN, SELESAI |
| Surat jalan | DIPROSES → DIMUAT → DIKIRIM → SELESAI, atau BATAL |
| Retur / void | MENUNGGU → DISETUJUI / DITOLAK / DIBATALKAN |

### 5b. Penjualan langsung vs pengantaran; retur; surat jalan; status

| Aspek | Penjualan langsung | Penjualan pengantaran |
|---|---|---|
| Nomor | `STR-YYMMDD-NNN` | `INV-YYMMDD-NNN` |
| Dokumen | Struk thermal | Invoice A4 + surat jalan |
| Stok dipotong | Saat checkout | Saat checkout (bukan saat dikirim) `[DOK: K-024]` |
| Pengambilan | Diambil / belum diambil `[KODE: api/modules/penjualan/penjualan/service.ts:547]` | Lewat surat jalan bertahap |
| Cara bayar bila belum lunas | DP / bayar nanti (pembeli terdata) | DP / bayar nanti / saat terima |

- **Tagihan:** `tagihan = total neto − total void − total retur`; `dibayar bersih = total dibayar − total refund`;
  `sisa = tagihan − dibayar bersih` `[KODE: api/modules/penjualan/pembayaran.ts:33-37]`.
- **Status pembayaran:** LUNAS bila tagihan 0 atau dibayar bersih ≥ tagihan; BELUM_BAYAR bila dibayar bersih 0;
  selain itu DP `[KODE: api/modules/penjualan/pembayaran.ts:40-44]`.
- **Retur:** nilai baris = harga satuan efektif (subtotal ÷ qty, dibulatkan) × qty retur
  `[KODE: api/modules/koreksi/retur/service.ts:213-214]`; uang kembali tidak melebihi yang sudah dibayar; barang
  kondisi baik kembali ke stok jual, rusak/cacat ke stok rusak `[DOK: K-077]`.
- **Void:** nominal = Σ subtotal baris yang di-void; bila seluruh baris di-void = seluruh sisa tagihan
  `[KODE: api/modules/koreksi/void/service.ts:226,314]`.
- **Surat jalan:** qty kirim ≤ qty − retur − qty di surat jalan lain yang belum batal
  `[KODE: api/modules/penjualan/surat-jalan/service.ts:36]`; status pengiriman invoice disinkronkan setiap
  perubahan `[KODE: api/modules/penjualan/surat-jalan/service.ts:49]`.

### 5c. Mutasi stok

- Stok punya tiga angka: **fisik**, **dipesan**, **tersedia = fisik − dipesan** `[DOK: K-006]`.
- **Satu-satunya penulis stok** adalah `catatMutasi()`, di dalam transaksi DB dengan kunci baris persediaan
  `[KODE: api/modules/persediaan/ledger.ts:161]`. Setiap mutasi menyimpan saldo setelahnya dan HPP setelahnya di
  tabel `mutasi_persediaan` `[KODE: apps/api/src/db/schema/persediaan.ts:274]`.
- **Bertambah:** saldo awal, penerimaan, retur penjualan (baik), void, penyesuaian plus. **Berkurang:** penjualan,
  barang pengganti tukar, retur ke pemasok, penyesuaian minus, pemusnahan.
- **Kapan diperbarui:** seketika, di transaksi yang sama dengan dokumennya (bukan proses batch)
  `[DOK: CLAUDE.md, aturan 15]`. Layar lain melihat angka baru saat memuat ulang data (antrean lewat SSE).
- Stok fisik tidak boleh turun di bawah stok yang dipesan; pesan menyebut order penahannya
  `[KODE: api/modules/persediaan/ledger.ts:196-206]`.
- **HPP rata-rata tertimbang:** `HPP baru = bulat((qty lama × HPP lama + qty masuk × harga masuk) ÷ (qty lama +
  qty masuk))`, hanya untuk barang masuk berkondisi baik; barang titipan HPP = harga titip
  `[KODE: shared/money.ts:73-83]` `[KODE: api/modules/persediaan/ledger.ts:208-215]`.
- **Status stok:** HABIS bila fisik ≤ 0; KRITIS bila fisik < minimum; PERLU_RESTOCK bila fisik ≤ minimum × (1 +
  ambang%); selain itu AMAN; ambang bawaan 20 % `[KODE: api/modules/persediaan/stok/repo.ts:50-57]`
  `[KONFIG: apps/api/src/db/data-awal.ts:94]`.

### 5d. Rekomendasi jumlah pemesanan ulang (reorder)

**BELUM ADA.** Kode tidak memiliki fungsi yang menghitung jumlah yang sebaiknya dipesan ulang (tidak ditemukan
rumus EOQ, rata-rata penjualan harian, lead time, atau saran qty beli) `[KODE: pencarian "reorder", "rekomendasi",
"saran" di api/ dan shared/ tanpa hasil logika]`. Fitur ini juga tidak tercatat di backlog
`[DOK: docs/08-backlog.md]`.

Yang **sudah ada** dan bisa menjadi dasar keputusan pemesanan ulang secara manual:

| Fitur | Isi | Siapa | Bukti |
|---|---|---|---|
| Stok minimum per barang | Diisi manual di Data Barang (bawaan dari pengaturan) | Admin/Owner | `[KONFIG: apps/api/src/db/data-awal.ts:100]` |
| Status stok 4 tingkat | Rumus di 5c | Admin/Owner (Stok Persediaan); semua peran (kartu dashboard) | `[KODE: api/modules/persediaan/stok/repo.ts:50]` |
| Notifikasi lonceng | Hanya **HABIS** dan **KRITIS** (PERLU_RESTOCK tidak masuk lonceng) | yang berizin stok | `[KODE: shared/schemas/notifikasi.ts:8-9]` |
| Kartu "Peringatan stok" di dashboard | Jumlah HABIS/KRITIS/PERLU_RESTOCK + 5 barang teratas | semua peran | `[KODE: api/modules/dashboard/routes.ts:18]` |
| Laporan Stok Minimum | Fisik, dipesan, tersedia, stok minimum, **selisih (fisik − minimum)**, status | Admin/Owner | `[KODE: api/modules/laporan/stok-minimum.ts:92,151-164]` |
| Laporan Produk Terlaris | Qty terjual, nilai, kontribusi, kumulatif (dasar analisis Pareto) | Kasir+ | `[KODE: api/modules/laporan/produk-terlaris.ts]` |
| Laporan Riwayat Harga Beli | Harga per penerimaan, terendah/tertinggi/rata-rata per pemasok | Admin/Owner | `[KODE: api/modules/laporan/riwayat-harga-beli.ts]` |

Apakah proposal mengharapkan fitur reorder: `[TANYA 4]`.

### 5e. Promo dan diskon

- **Pembuatan:** Admin/Owner di Pengaturan › Promo (lihat F17). Aturan potongan dikunci setelah promo terpakai;
  anggaran dan batas per pembeli boleh diubah `[DOK: K-087, K-110]`.
- **Penerapan otomatis**, satu promo per baris: kandidat yang berlaku (tanggal) dan cocok (barang, pembeli,
  syarat) diurutkan potongan terbesar → tanggal mulai terbaru → id terbesar; promo yang membuat harga di bawah
  modal **dilewati** bila penjualnya Staf/Kasir, lalu promo aman berikutnya dipakai
  `[KODE: api/modules/promo/hitung.ts:116-150]`.
- **Rumus potongan:** persen = bulat(qty × harga × persen ÷ 100), dibatasi batas potongan baris; nominal =
  bulat(qty × potongan per satuan); selalu 0 ≤ potongan ≤ bruto `[KODE: api/modules/promo/hitung.ts:90-100]`.
- **Urutan harga baris:** harga tier transaksi → potongan promo dari harga tier itu → diskon manual
  `[KODE: api/modules/penjualan/harga-baris.ts:204]` `[DOK: K-098]`.
- **Anggaran & batas per pembeli:** potongan dibatasi sisa anggaran/sisa batas; promo berbatas dikunci saat checkout
  agar dua kasir tidak memakai sisa yang sama `[KODE: api/modules/promo/hitung.ts:41-48]`
  `[KODE: api/modules/promo/repo.ts:164]`.
- **Bagaimana tampil di layar:** tidak ada pop-up "tawarkan promo". Potongan promo **tampil langsung** sebagai baris
  hijau di bawah barang dan total sudah terpotong; bila ada promo lebih besar yang tidak berlaku karena batas
  modal, baris diberi tanda `[KODE: api/modules/penjualan/harga-baris.ts:466]`.
- **Menerima/menolak:** kasir bisa **melepas** promo satu baris (tombol/huruf P) dan memasangnya lagi; pelepasan
  hanya untuk pemegang izin checkout dan tercatat `PENJUALAN_PROMO_LEPAS` `[KODE: api/modules/penjualan/harga-baris.ts:398]`
  `[KODE: shared/log.ts]`.
- **Saran yang mendorong pembelian:** keterangan "**Belanja Rp X lagi untuk harga [tier]**" tampil menonjol (kotak
  kuning, angka merah) di layar penjualan, dihitung dari tier terdekat yang belum tercapai
  `[KODE: api/modules/penjualan/harga-baris.ts:174-196]` `[KODE: web/components/info-tier-belanja.tsx:13]`.
- **Tercatat:** setiap baris penjualan menyimpan `id_promo` dan `diskon_promo`; laporan Promo merangkum potongan per
  promo; daftar promo menampilkan potongan yang sudah diberikan `[KODE: api/modules/laporan/promo.ts]`.
- **Diskon manual** per baris dan per transaksi dibatasi persen per peran (Kasir bawaan 0 %)
  `[KODE: api/modules/penjualan/harga-baris.ts:114,247]`.

### 5f. Harga

- **Dasar markup** = harga beli terakhir (bisa diganti ke HPP rata-rata lewat pengaturan); sebelum ada penerimaan
  = harga modal awal `[KODE: api/modules/master/harga/service.ts:62]` `[KONFIG: apps/api/src/db/data-awal.ts:118]`.
- **Harga markup** = bulat ke atas ke kelipatan Rp 100 dari (dasar × (1 + markup%))
  `[KODE: shared/money.ts:35-54]` `[KONFIG: apps/api/src/db/data-awal.ts:124]`.
- **Tier transaksi:** dari tier aktif yang syarat "Mulai belanja"-nya tercapai oleh total nilai belanja (dihitung
  dengan harga tier dasar), dipakai yang syaratnya tertinggi; tidak tercapai → tier dasar
  `[KODE: api/modules/penjualan/harga-baris.ts:174-196]`. Kasir tidak bisa memilih tier `[DOK: K-099]`.
- **Siapa melihat harga modal/HPP/laba:** hanya pemegang `master.barang.lihat_hpp` atau `laporan.laba` (Admin,
  Owner); disaring di server (lihat 3.1). Harga jual terlihat semua peran.
- **Harga manual** (hasil tawar) hanya Admin/Owner, tercatat `PENJUALAN_HARGA_MANUAL` `[KODE: shared/roles.ts:52]`.

### 5g. Notifikasi dan peringatan

Selain lonceng (F6): peringatan shift di atas halaman (biru 15 menit sebelum jam tutup, kuning lewat jam tutup,
merah bila shift lewat hari) `[KODE: web/components/layout/peringatan-shift.tsx:43-46]`; pesan Telegram/email ke
atasan untuk shift yang perlu ditutup (paling banyak sekali sehari per shift)
`[KODE: api/modules/kas/shift/service.ts:370]`; dialog limit kredit terlampaui `[KODE: web/features/pos/layar-pos.tsx:465]`.

---

## 6. Fitur yang mendukung pengambilan keputusan

| Peran | Keputusan yang dibantu | Informasi yang disajikan sistem | Fitur/layar |
|---|---|---|---|
| Staf Penjualan | Mengonfirmasi ketersediaan ke pembeli | Stok **tersedia** (sudah dikurangi order lain) di hasil cari | Order Penjualan, cari barang |
| Staf Penjualan | Memilih barang alternatif | Cari per atribut/kategori, daftar per kategori, foto kecil | Cari barang (F19) |
| Staf / Kasir | Menyarankan pembeli menambah belanja | "Belanja Rp X lagi untuk harga [tier]" | Order, Penjualan Langsung |
| Kasir | Memberi/melepas promo | Potongan promo per baris, tanda promo tidak berlaku di bawah modal | Penjualan Langsung |
| Kasir | Mengizinkan pembeli berhutang | Limit, piutang berjalan, tagihan baru; butuh kode atasan bila lewat | Dialog limit kredit |
| Kasir | Urutan melayani | Antrean FIFO, lama menunggu berwarna | Papan antrean |
| Admin/Owner | Menyetujui retur/void/ubah pelanggan | Rincian permintaan di pesan Telegram/email | Kode persetujuan |
| Admin/Owner | Kapan dan barang apa yang dibeli ulang | Status stok, stok minimum, selisih, produk terlaris, riwayat harga beli per pemasok | Stok Persediaan, laporan (lihat 5d) |
| Admin/Owner | Menaikkan/menurunkan harga jual | Usulan harga, margin, dasar modal baru | Tinjau Harga |
| Admin/Owner | Menagih pelanggan | Umur piutang, jatuh tempo terdekat, posisi kredit per pelanggan | Piutang, Data Pelanggan, laporan Piutang |
| Admin/Owner | Membayar pemasok | Umur hutang, jatuh tempo | Hutang Pemasok, laporan Hutang |
| Admin/Owner | Menilai kejujuran kas | Selisih clerical check per shift; uang non-tunai sudah/tidak masuk | Shift & Clerical Check |
| Admin/Owner | Efektivitas promo | Potongan diberikan, rasio potongan, penjualan bruto/bersih per promo | Laporan Promo, Pengaturan › Promo |
| Owner | Kinerja usaha | Omzet harian, grafik 7 hari, laba kotor dan margin, nilai persediaan | Dashboard, laporan Laba Kotor, Nilai Persediaan |

---

## 7. Laporan & dashboard

Semua laporan disusun server sebagai dokumen formal (kop toko, judul, periode, ikhtisar, tabel, catatan, tanda
tangan) dan dirender sama untuk layar, cetak/PDF (lewat peramban), dan Excel `[DOK: K-078]`. Filter periode:
hari ini, kemarin, minggu ini, bulan ini, bulan lalu, tahun ini, atau rentang tanggal (maks 366 hari)
`[DOK: K-078, K-079]`. Ekspor Excel butuh `laporan.ekspor` (Kasir+) dan tercatat `LAPORAN_EKSPOR`; cetak tercatat
`[KODE: api/modules/laporan/routes.ts:155-169]`. Katalog dan izin: `[KODE: shared/schemas/laporan.ts:58-182]`.

| Laporan | Grup | Kolom utama | Izin (peran) | Bukti |
|---|---|---|---|---|
| Stok Rekap | Persediaan | Saldo awal, masuk (penerimaan, retur & void, lainnya), keluar (penjualan, lainnya), saldo akhir | persediaan (Admin+) | `[KODE: api/modules/laporan/stok-rekap.ts]` |
| Kartu Stok | Persediaan | Tanggal, dokumen, keterangan, masuk, keluar, saldo; versi nilai (qty × harga, HPP) untuk yang berizin | persediaan (Admin+) | `[KODE: api/modules/laporan/kartu-stok.ts]` |
| Stok Minimum | Persediaan | Fisik, dipesan, tersedia, minimum, selisih, status | persediaan (Admin+) | `[KODE: api/modules/laporan/stok-minimum.ts:151-164]` |
| Nilai Persediaan | Persediaan | Qty, HPP rata-rata, nilai; titipan dan barang rusak terpisah | persediaan + laba (Admin+) | `[KODE: api/modules/laporan/nilai-persediaan.ts]` |
| Riwayat Harga Beli | Persediaan | Harga per penerimaan, perubahan, terendah/tertinggi/rata-rata per pemasok | persediaan + laba (Admin+) | `[KODE: api/modules/laporan/riwayat-harga-beli.ts]` |
| Penjualan | Penjualan | Jumlah transaksi, omzet, retur, penjualan bersih; rincian per transaksi | penjualan (Kasir+) | `[KODE: api/modules/laporan/penjualan-periode.ts]` |
| Produk Terlaris | Penjualan | Peringkat, qty, nilai, kontribusi, kumulatif | penjualan (Kasir+) | `[KODE: api/modules/laporan/produk-terlaris.ts]` |
| Detail Invoice | Penjualan | Baris barang, pembayaran, retur, void, surat jalan satu transaksi | penjualan (Kasir+) | `[KODE: api/modules/laporan/detail-invoice.ts]` |
| Retur Penjualan | Penjualan | Barang, qty, kondisi, harga, nilai | penjualan (Kasir+) | `[KODE: api/modules/laporan/retur-penjualan.ts]` |
| Promo | Penjualan | Per promo: transaksi, baris, bruto, potongan, bersih, rasio; per barang | penjualan (Kasir+) | `[KODE: api/modules/laporan/promo.ts]` |
| Daftar Harga | Penjualan | Barang aktif per kategori dengan harga per tier (katalog untuk pelanggan) | penjualan (Kasir+) | `[KODE: api/modules/laporan/daftar-harga.ts]` |
| Laba Kotor | Keuangan | Qty bersih, penjualan, HPP, laba kotor, margin | laba (Admin+) | `[KODE: api/modules/laporan/laba-kotor.ts]` |
| Piutang | Keuangan | Invoice, jatuh tempo, tagihan, dibayar, sisa, umur | piutang (Kasir+) | `[KODE: api/modules/laporan/piutang.ts]` |
| Hutang Usaha | Keuangan | Dokumen, faktur, jatuh tempo, total, dibayar, potong retur, sisa, umur | hutang (Admin+) | `[KODE: api/modules/laporan/hutang.ts]` |
| Konsinyasi | Keuangan | Per pemasok: nilai stok titipan, belum disetor, sisa hutang; daftar setoran | hutang (Admin+) | `[KODE: api/modules/laporan/konsinyasi.ts]` |

Ekspor data selain laporan: data barang `[KODE: api/modules/master/import/routes.ts:26]`, harga jual
`[KODE: api/modules/master/harga/routes.ts:47]`, posisi stok `[KODE: api/modules/persediaan/stok/routes.ts:17]`.

**Dashboard:** lihat F38.

---

## 8. Jejak data untuk dokumentasi penelitian

| Jejak | Tabel / kolom | Isi | Bisa diekspor dari aplikasi? |
|---|---|---|---|
| Log aktivitas | `log_aktivitas`: `waktu`, `id_pengguna`, `username_percobaan`, `aksi` (103 jenis), `entitas`, `id_entitas`, `nomor_dokumen`, `ringkasan`, `data_lama`, `data_baru` (JSON), `ip` `[KODE: apps/api/src/db/schema/sistem.ts:114-130]` | Siapa melakukan apa, kapan, dari mana; nilai sebelum/sesudah | Tidak (hanya tampil di Pengaturan › Log aktivitas dengan cari/saring); bisa diambil lewat kueri database `[TANYA 5]` |
| Riwayat login | `log_aktivitas` aksi `LOGIN_SUKSES`, `LOGIN_GAGAL`, `LOGOUT`; `sesi_login` (sesi aktif, waktu terakhir aktif, IP, peramban) `[KODE: apps/api/src/db/schema/sistem.ts:89]` | Frekuensi dan waktu pemakaian per pengguna | Tidak langsung |
| Waktu transaksi | `penjualan`, `order_penjualan`, `pembayaran_penjualan`, dsb.: `tanggal`/`waktu` (timestamptz UTC), `tanggal_operasional` (tanggal Jakarta), `dibuat_pada` | Kapan order dibuat, dikirim ke antrean, diproses, dibayar | Ya, lewat laporan Penjualan/Detail Invoice (Excel) |
| Riwayat stok | `mutasi_persediaan`: barang, waktu, jenis mutasi, kondisi, qty masuk/keluar, saldo setelah, HPP satuan/setelah, rujukan dokumen, pengguna `[KODE: apps/api/src/db/schema/persediaan.ts:274]` | Setiap perubahan stok dengan dokumennya | Ya: Kartu Stok, Stok Rekap (Excel) |
| Riwayat harga jual | `log_aktivitas` aksi `HARGA_UBAH`, `HARGA_TINJAU_TERAPKAN/ABAIKAN` dengan data lama/baru | Perubahan harga dan penyebabnya (manual/otomatis) | Tidak langsung |
| Riwayat harga beli | `penerimaan_barang_detail` | Harga beli per penerimaan | Ya: laporan Riwayat Harga Beli |
| Persetujuan | `permintaan_persetujuan` (jenis, pengaju, nilai, ringkasan, status, penyetuju, waktu); `retur_penjualan`/`void_transaksi` (`cara_persetujuan`: sendiri, akun atasan, di tempat, batas bebas) | Siapa menyetujui apa dan caranya | Sebagian (riwayat di layar Retur/Void) |
| Kas & kejujuran | `shift_kasir`, `kas_shift`, `clerical_check` (uang fisik, saldo sistem, selisih, keterangan) | Selisih kas per shift | Di layar Shift; laporan kas per shift belum ada (backlog D-L3) |
| Pengecekan non-tunai | `pembayaran_penjualan`: `status_verifikasi`, `diverifikasi_oleh`, `diverifikasi_pada`, `catatan_verifikasi` | Kapan uang transfer dicek dan hasilnya | Di layar Cek uang non-tunai |
| Cetak & ekspor | `log_aktivitas` aksi `CETAK_ULANG`, `LAPORAN_EKSPOR` | Pemakaian laporan dan dokumen | Tidak langsung |
| Cadangan | `cadangan` | Riwayat cadangan dan uji pulih | Di layar Pengaturan › Cadangan |

---

## 9. Aspek kualitas sistem yang terlihat dari kode

| Aspek | Yang ada di kode | Bukti |
|---|---|---|
| Validasi input | Skema Zod yang sama dipakai API dan form web; pesan galat berbahasa Indonesia per kolom | `[KODE: shared/schemas/]` `[DOK: CLAUDE.md, aturan 10]` |
| Integritas data | CHECK constraint di database dari enum yang sama; transaksi DB untuk setiap dokumen; kunci baris saat mengubah stok, nomor dokumen, shift, promo berbatas; tabel transaksi hanya-tambah | `[KODE: api/modules/persediaan/ledger.ts:50,161]` `[KODE: api/modules/sistem/penomoran.ts:44]` |
| Uang & kuantitas | Uang bilangan bulat rupiah; qty desimal 3 angka lewat decimal.js; pembulatan setengah ke atas | `[KODE: shared/money.ts:22-40]` |
| Penanganan galat | Galat dipetakan ke kode HTTP dan pesan yang aman (409 konflik/kebuntuan "coba lagi", 503 database tidak tersedia), detail teknis hanya di log server; halaman galat di web | `[KODE: api/middleware/error-handler.ts:103]` `[KODE: web/features/umum/halaman-galat.tsx]` |
| Kecepatan | Paginasi server di daftar data | `[KODE: api/lib/paginasi.ts:4-19]` |
| | Indeks database pada kolom pencarian/saringan utama (mis. log per waktu, pengguna, entitas) | `[KODE: apps/api/src/db/schema/sistem.ts:136-138]` |
| | Konfigurasi di-cache di memori server; data layar di-cache TanStack Query | `[DOK: K-054]` |
| | Uji skala 5.000 barang: cari 5–28 ms | `[DOK: K-062]` |
| Keamanan login/sesi | argon2id; token sesi acak disimpan sebagai hash; cookie httpOnly/SameSite; idle 60 menit, maks 12 jam; batas 20 percobaan login/menit/IP; kunci akun 15 menit setelah 5 kali salah | `[KODE: api/lib/password.ts:1]` `[KODE: api/middleware/auth.ts:21]` `[KODE: api/middleware/batas-percobaan.ts:21]` `[KONFIG: apps/api/src/env.ts:16-17]` |
| Keamanan lain | CSRF, header keamanan (CSP, anti-frame), batas ukuran kiriman 1 MB, semua kueri berparameter (Drizzle) | `[KODE: api/app.ts:94-116]` `[DOK: docs/09-keamanan.md]` |
| Cadangan | Lihat F8 | `[KODE: api/modules/sistem/cadangan/service.ts]` |
| Pengujian | Tes layanan dengan database sungguhan untuk setiap aturan bisnis; tes izin (403); 63 tes ujung-ke-ujung, 5 alur kritis wajib lulus sebelum server diperbarui | `[DOK: CLAUDE.md, aturan 12]` `[DOK: K-085]` |

---

## 10. Layar yang sebaiknya di-screenshot untuk lampiran

| No | Layar (menu) | Peran untuk login | Perangkat | Yang ditunjukkan |
|---|---|---|---|---|
| 1 | Halaman login | — | desktop | Identitas aplikasi |
| 2 | Dashboard | Owner, lalu Staf | desktop | Perbedaan isi per peran (omzet hanya Owner) |
| 3 | Order Penjualan › Input cepat | Staf | desktop/tablet | Cari barang, stok tersedia, "Belanja Rp X lagi…" |
| 4 | Penjualan Langsung dengan papan antrean | Kasir | komputer kasir | Antrean FIFO, keranjang, promo hijau |
| 5 | Panel bayar (transfer dengan rekening, bayar campuran) | Kasir | komputer kasir | Cara bayar, rekening dipilih |
| 6 | Struk tercetak (foto) | Kasir | printer thermal | Hasil cetak |
| 7 | Penjualan Pengantaran + invoice + surat jalan | Kasir | desktop | Alur pengantaran |
| 8 | Dialog kode persetujuan + pesan Telegram di HP atasan | Kasir + Owner | desktop + HP | Pengendalian persetujuan |
| 9 | Retur Penjualan (daftar transaksi + form) | Kasir | desktop | Koreksi transaksi |
| 10 | Shift & Clerical Check: tutup shift (hitung buta) | Kasir | komputer kasir | Kontrol kas |
| 11 | Cek uang non-tunai | Admin | desktop | Verifikasi transfer |
| 12 | Data Barang + form barang | Admin | desktop | Master barang, atribut, kemasan |
| 13 | Harga Jual + Kelola tier + Tinjau Harga | Admin | desktop | Pengaturan harga |
| 14 | Pengaturan › Promo (daftar dengan potongan diberikan) | Admin | desktop | Promo dan anggarannya |
| 15 | Stok Persediaan (posisi stok berstatus, kartu stok) | Admin | desktop | Persediaan |
| 16 | Data Pelanggan (kolom posisi kredit) | Admin | desktop | Piutang per pelanggan |
| 17 | Laporan: pohon daftar + pratinjau Laporan Penjualan, Laba Kotor, Stok Minimum | Owner | desktop | Laporan formal |
| 18 | Pengaturan › Log aktivitas | Owner | desktop | Jejak audit |
| 19 | Pengaturan › Cadangan | Owner | desktop | Keamanan data |
| 20 | Lonceng notifikasi terbuka | Admin | desktop | Peringatan |

---

## 11. Fitur yang direncanakan / belum ada / keterbatasan yang diketahui

**Dijadwalkan (backlog v2.0.0 dan sesudahnya)** `[DOK: docs/08-backlog.md]` `[DOK: docs/07-roadmap.md]`:
- Aplikasi desktop (versi build), cetak tanpa jendela untuk semua dokumen, printer per jenis dokumen (Fase 13;
  lingkup belum dikonfirmasi).
- Katalog barang bergambar di layar penjualan (F8).
- Deteksi otomatis uang masuk lewat payment gateway (A12); pembatalan pembayaran otomatis (D-K12).
- Promo v2: banyak barang dalam satu promo, edit massal, potongan bertingkat (A11).
- Peran dan izin buatan Owner (Sprint B); keuangan ringan: deposit pelanggan, pengeluaran operasional, akun kas &
  bank (Sprint C).
- Modul stok opname terjadwal, cakupan dan grafik selisih opname (Sprint E).
- Laporan kas per shift (D-L3), analisis ABC (D-L1), perbandingan periode (D-L4).
- Tombol "?" di setiap halaman (F7), tata letak POS yang bisa diatur (F6), pintasan yang bisa diganti (F1–F3).
- Pembukuan/akuntansi, multi-gudang, cabang (v3.0.0).

**Belum ada dan tidak dijadwalkan:** rekomendasi jumlah pemesanan ulang (5d); mode offline; tata letak ponsel;
PPN; pesanan pembelian (PO) ke pemasok; batch/kedaluwarsa; WhatsApp `[DOK: K-038]`.

**Keterbatasan yang diketahui:**
- Cetak langsung ke printer thermal hanya di Chrome/Edge; di Firefox struk lewat jendela cetak `[DOK: K-103]`.
- Jendela cetak peramban mengingat printer terakhir; aplikasi web tidak bisa memilih printer per dokumen `[DOK: K-112]`.
- Pengecekan uang non-tunai manual; tanda "Tidak masuk" tidak mengubah penjualan `[DOK: K-111]`.
- Log aktivitas tidak bisa diekspor dari aplikasi (bagian 8).
- Penguncian akun bisa dipicu sengaja oleh orang yang tahu username (diterima, tercatat di log) `[DOK: docs/09-keamanan.md, butir 27]`.

**TODO di kode:** tidak ditemukan penanda TODO/FIXME aktif; komponen "halaman segera" (untuk menu yang belum
dibangun) ada tetapi semua menu sudah punya halaman `[KODE: web/routes.tsx:23-55]` `[KODE: web/features/umum/halaman-segera.tsx]`.

---

## 12. Riwayat perubahan singkat (dari git log)

| Tanggal | Yang selesai |
|---|---|
| 19 Sep 2026 | Fase 0: dokumen fondasi, keputusan K-001–K-049 (sebelum repo kode) |
| 29 Sep | Fase 1: setup lingkungan |
| 30 Sep | Fase 2–3: login, izin, pengguna, pengaturan, log; data master (barang, harga, pelanggan, pemasok, merk), import Excel |
| 1–2 Okt | Fase 4: ledger stok, penerimaan, penyesuaian, opname, kartu stok |
| 2–3 Okt | Fase 5: order, antrean, checkout, pengantaran, surat jalan, piutang, cetak struk |
| 3 Okt | Fase 6: shift dan clerical check, void, retur |
| 4 Okt | Fase 7–8: laporan dan dashboard; mode produksi, keamanan, cadangan, alur kritis (akhir M1 = v1.0.0) |
| 4–7 Okt | Fase 9–12: mesin harga & promo, hutang, retur pemasok, stok rusak, limit kredit, konsinyasi, label barcode, satuan jual (akhir M2) |
| 8–10 Okt | Tinjauan pemilik: harga otomatis, kemasan, draf order, tier menurut nilai belanja, promo per pembeli, persetujuan di tempat; tinjauan kualitas kode |
| 11 Okt | Kode persetujuan Telegram/email, struk langsung ke printer thermal, pengantaran tanpa order, penyiapan terpandu |
| 12–13 Okt | Perapian tampilan, persetujuan ubah pelanggan, cari lewat atribut, aturan shift, anggaran promo, rekening toko dan cek non-tunai |

Sumber: `git log --merges` (198 commit; commit pertama 29 Sep 2026). Rincian per keputusan:
`docs/10-ringkasan-keputusan.md`.

---

## 13. Daftar [TANYA]

1. Apakah server sudah dipasang dan dipakai di komputer toko (produksi), atau aplikasi masih diuji di laptop
   pengembang? Sejak tanggal berapa, dan apakah cadangan otomatis ke cloud sudah aktif?
2. Perangkat apa yang dipakai staf penjualan di toko (komputer, tablet, atau HP)? Kode dirancang untuk layar
   desktop/tablet, belum untuk ponsel.
3. Apakah cetak struk langsung ke printer thermal (EPPOS RPP02) sudah berhasil diuji di toko?
4. Proposal menyebut "rekomendasi jumlah pemesanan ulang". Fitur ini **belum ada**. Apakah ingin dimasukkan sebagai
   fitur yang dievaluasi (berarti perlu dibangun), atau proposal cukup memakai fitur yang ada (status stok, stok
   minimum, laporan stok minimum, produk terlaris)?
5. Untuk triangulasi data, apakah perlu fitur ekspor log aktivitas ke Excel, atau cukup diambil langsung dari
   database oleh pengembang?
6. Berapa jumlah pengguna sungguhan per peran dan perkiraan jumlah barang/transaksi harian di toko? Data ini tidak
   ada di kode.
7. Apakah Telegram/email persetujuan akan dipakai di toko, atau atasan lebih sering menyetujui dari akunnya
   sendiri?

---

## Lampiran A — Daftar endpoint API dan izinnya

Format: `berkas:baris METODE alamat izin`. `LOGIN` = cukup login (data milik sendiri). Login dan masuk cepat tidak
butuh izin tetapi dibatasi laju; masuk cepat hanya ada di mode pengembangan `[KODE: api/app.ts:132,146]`.
Path berkas relatif terhadap `apps/api/src/modules/`. Jumlah: 192 endpoint (+ `GET /api/health`,
`GET /api/notifikasi` [LOGIN], `GET /api/log-aktivitas` [sistem.log.lihat]).

```
auth/routes.ts:27 POST /api/auth/login (publik, batas laju)
auth/routes.ts:32 POST /api/auth/logout LOGIN
auth/routes.ts:37 GET /api/auth/saya LOGIN
auth/routes.ts:41 POST /api/auth/ganti-password LOGIN
auth/routes.ts:56 POST /api/auth/masuk-cepat (hanya mode pengembangan)
auth/routes.ts:68 GET /api/auth/pesan-uji LOGIN
dashboard/routes.ts:11 GET /api/dashboard/ringkasan dashboard.dasar
dashboard/routes.ts:14 GET /api/dashboard/aktivitas dashboard.dasar
dashboard/routes.ts:18 GET /api/dashboard/peringatan-stok dashboard.dasar
hutang/routes.ts:14 GET /api/hutang/ hutang.lihat
hutang/routes.ts:17 GET /api/hutang/penerimaan-pemasok/:idPemasok hutang.lihat
hutang/routes.ts:23 GET /api/hutang/:jenis/:id/pembayaran hutang.lihat
hutang/routes.ts:36 POST /api/hutang/bayar hutang.kelola
kas/nontunai/routes.ts:13 GET /api/pembayaran-nontunai/ kas.nontunai.verifikasi
kas/nontunai/routes.ts:16 POST /api/pembayaran-nontunai/:id/verifikasi kas.nontunai.verifikasi
kas/rekening/routes.ts:16 GET /api/rekening/ kas.rekening.lihat
kas/rekening/routes.ts:27 POST /api/rekening/ sistem.pengaturan.kelola
kas/rekening/routes.ts:31 PATCH /api/rekening/:id sistem.pengaturan.kelola
kas/rekening/routes.ts:36 PATCH /api/rekening/:id/status sistem.pengaturan.kelola
kas/shift/routes.ts:20 GET /api/shift/saya kas.shift.kelola_sendiri
kas/shift/routes.ts:21 POST /api/shift/buka kas.shift.kelola_sendiri
kas/shift/routes.ts:25 POST /api/shift/kas kas.shift.kelola_sendiri
kas/shift/routes.ts:29 GET /api/shift/ kas.shift.kelola_sendiri
kas/shift/routes.ts:32 GET /api/shift/:id kas.shift.kelola_sendiri
kas/shift/routes.ts:35 POST /api/shift/:id/tutup kas.shift.kelola_sendiri
konsinyasi/routes.ts:23 GET /api/konsinyasi/ringkasan konsinyasi.kelola
konsinyasi/routes.ts:24 GET /api/konsinyasi/pratinjau konsinyasi.kelola
konsinyasi/routes.ts:30 GET /api/konsinyasi/ konsinyasi.kelola
konsinyasi/routes.ts:33 GET /api/konsinyasi/:id konsinyasi.kelola
konsinyasi/routes.ts:36 POST /api/konsinyasi/ konsinyasi.kelola
koreksi/retur/routes.ts:32 GET /api/retur/kandidat retur.ajukan
koreksi/retur/routes.ts:38 GET /api/retur/ retur.ajukan
koreksi/retur/routes.ts:41 GET /api/retur/:id retur.ajukan
koreksi/retur/routes.ts:44 POST /api/retur/ retur.ajukan
koreksi/retur/routes.ts:48 POST /api/retur/:id/setujui retur.setujui
koreksi/retur/routes.ts:65 POST /api/retur/:id/minta-kode retur.ajukan
koreksi/retur/routes.ts:69 POST /api/retur/:id/setujui-kode retur.ajukan
koreksi/retur/routes.ts:86 POST /api/retur/:id/batal retur.ajukan
koreksi/retur/routes.ts:101 POST /api/retur/:id/tolak retur.setujui
koreksi/void/routes.ts:32 GET /api/void/kandidat void.ajukan
koreksi/void/routes.ts:38 GET /api/void/ void.ajukan
koreksi/void/routes.ts:41 GET /api/void/:id void.ajukan
koreksi/void/routes.ts:44 POST /api/void/ void.ajukan
koreksi/void/routes.ts:48 POST /api/void/:id/setujui void.setujui
koreksi/void/routes.ts:64 POST /api/void/:id/minta-kode void.ajukan
koreksi/void/routes.ts:68 POST /api/void/:id/setujui-kode void.ajukan
koreksi/void/routes.ts:85 POST /api/void/:id/batal void.ajukan
koreksi/void/routes.ts:100 POST /api/void/:id/tolak void.setujui
laporan/routes.ts:51 GET /api/laporan/stok-rekap laporan.persediaan
laporan/routes.ts:58 GET /api/laporan/kartu-stok laporan.persediaan
laporan/routes.ts:65 GET /api/laporan/stok-minimum laporan.persediaan
laporan/routes.ts:72 GET /api/laporan/nilai-persediaan laporan.laba (+ laporan.persediaan)
laporan/routes.ts:80 GET /api/laporan/penjualan laporan.penjualan
laporan/routes.ts:87 GET /api/laporan/produk-terlaris laporan.penjualan
laporan/routes.ts:94 GET /api/laporan/detail-invoice laporan.penjualan
laporan/routes.ts:100 GET /api/laporan/detail-invoice/:id laporan.penjualan
laporan/routes.ts:103 GET /api/laporan/retur-penjualan laporan.penjualan
laporan/routes.ts:110 GET /api/laporan/laba-kotor laporan.laba
laporan/routes.ts:117 GET /api/laporan/piutang laporan.piutang
laporan/routes.ts:124 GET /api/laporan/promo laporan.penjualan
laporan/routes.ts:127 GET /api/laporan/riwayat-harga-beli laporan.laba (+ laporan.persediaan)
laporan/routes.ts:135 GET /api/laporan/daftar-harga laporan.penjualan
laporan/routes.ts:142 GET /api/laporan/konsinyasi laporan.hutang
laporan/routes.ts:149 GET /api/laporan/hutang laporan.hutang
laporan/routes.ts:155 GET /api/laporan/ekspor/:kode laporan.ekspor (+ izin laporannya)
laporan/routes.ts:169 POST /api/laporan/cetak laporan.ekspor
master/barang/routes.ts:28 GET /api/barang/ master.barang.lihat
master/barang/routes.ts:31 GET /api/barang/:id master.barang.lihat
master/barang/routes.ts:34 POST /api/barang/ master.barang.kelola
master/barang/routes.ts:38 PATCH /api/barang/:id master.barang.kelola
master/barang/routes.ts:43 PUT /api/barang/:id/satuan-jual master.barang.kelola
master/barang/routes.ts:57 PATCH /api/barang/:id/status master.barang.kelola
master/barang/routes.ts:69 GET /api/barang/:id/gambar master.barang.lihat
master/barang/routes.ts:77 POST /api/barang/:id/gambar master.barang.kelola
master/barang/routes.ts:82 DELETE /api/barang/:id/gambar master.barang.kelola
master/golongan-pelanggan/routes.ts:13 GET /api/golongan-pelanggan/ master.pelanggan.lihat
master/golongan-pelanggan/routes.ts:19 POST /api/golongan-pelanggan/ master.pelanggan.atur_kredit
master/golongan-pelanggan/routes.ts:23 PATCH /api/golongan-pelanggan/:id master.pelanggan.atur_kredit
master/golongan-pelanggan/routes.ts:34 PATCH /api/golongan-pelanggan/:id/status master.pelanggan.atur_kredit
master/harga/routes.ts:39 PUT /api/harga-barang/ master.harga.kelola
master/harga/routes.ts:43 PUT /api/harga-barang/otomatis master.harga.kelola
master/harga/routes.ts:47 GET /api/harga-barang/ekspor master.harga.kelola
master/harga/routes.ts:51 GET /api/harga-barang/tinjau master.harga.tinjau
master/harga/routes.ts:58 POST /api/harga-barang/tinjau/terapkan master.harga.tinjau
master/harga/routes.ts:68 POST /api/harga-barang/tinjau/abaikan master.harga.tinjau
master/import/routes.ts:22 GET /api/import/barang/templat master.import.jalankan
master/import/routes.ts:26 GET /api/import/barang/ekspor master.import.jalankan
master/import/routes.ts:30 POST /api/import/barang/baca master.import.jalankan
master/import/routes.ts:34 POST /api/import/barang/pratinjau master.import.jalankan
master/import/routes.ts:48 POST /api/import/barang master.import.jalankan
master/jenis-atribut/routes.ts:18 GET /api/jenis-atribut/ master.barang.lihat
master/jenis-atribut/routes.ts:24 POST /api/jenis-atribut/ master.satuan.kelola
master/jenis-atribut/routes.ts:28 PATCH /api/jenis-atribut/:id master.satuan.kelola
master/jenis-atribut/routes.ts:39 PATCH /api/jenis-atribut/:id/status master.satuan.kelola
master/kategori/routes.ts:13 GET /api/kategori/ master.barang.lihat
master/kategori/routes.ts:19 POST /api/kategori/ master.kategori.kelola
master/kategori/routes.ts:23 PATCH /api/kategori/:id master.kategori.kelola
master/kategori/routes.ts:28 PATCH /api/kategori/:id/status master.kategori.kelola
master/merk/routes.ts:13 GET /api/merk/ master.barang.lihat
master/merk/routes.ts:19 POST /api/merk/ master.kategori.kelola
master/merk/routes.ts:23 PATCH /api/merk/:id master.kategori.kelola
master/merk/routes.ts:28 PATCH /api/merk/:id/status master.kategori.kelola
master/pelanggan/routes.ts:31 GET /api/pelanggan/ master.pelanggan.lihat
master/pelanggan/routes.ts:38 GET /api/pelanggan/bawaan master.pelanggan.kelola
master/pelanggan/routes.ts:39 POST /api/pelanggan/ master.pelanggan.kelola
master/pelanggan/routes.ts:44 POST /api/pelanggan/:id/minta-kode master.pelanggan.kelola
master/pelanggan/routes.ts:60 PATCH /api/pelanggan/:id master.pelanggan.kelola (+ kode atasan bila tanpa atur_kredit)
master/pelanggan/routes.ts:78 PATCH /api/pelanggan/:id/status master.pelanggan.kelola (+ kode atasan bila tanpa atur_kredit)
master/pemasok/routes.ts:13 GET /api/pemasok/ master.pemasok.lihat
master/pemasok/routes.ts:19 POST /api/pemasok/ master.pemasok.kelola
master/pemasok/routes.ts:23 PATCH /api/pemasok/:id master.pemasok.kelola
master/pemasok/routes.ts:28 PATCH /api/pemasok/:id/status master.pemasok.kelola
master/pengguna/routes.ts:26 GET /api/pengguna/ master.pengguna.kelola
master/pengguna/routes.ts:29 POST /api/pengguna/ master.pengguna.kelola
master/pengguna/routes.ts:33 PATCH /api/pengguna/:id master.pengguna.kelola
master/pengguna/routes.ts:38 POST /api/pengguna/:id/nonaktifkan master.pengguna.kelola
master/pengguna/routes.ts:46 POST /api/pengguna/:id/aktifkan master.pengguna.kelola
master/pengguna/routes.ts:50 POST /api/pengguna/:id/reset-password master.pengguna.kelola
master/pengguna/routes.ts:61 POST /api/pengguna/:id/cabut-sesi master.pengguna.kelola
master/satuan/routes.ts:14 GET /api/satuan/ master.barang.lihat
master/satuan/routes.ts:20 POST /api/satuan/ master.satuan.kelola
master/satuan/routes.ts:24 PATCH /api/satuan/:id master.satuan.kelola
master/satuan/routes.ts:29 PATCH /api/satuan/:id/status master.satuan.kelola
master/tingkat-harga/routes.ts:18 GET /api/tingkat-harga/ master.barang.lihat
master/tingkat-harga/routes.ts:21 POST /api/tingkat-harga/ master.harga.kelola
master/tingkat-harga/routes.ts:25 PATCH /api/tingkat-harga/:id master.harga.kelola
master/tingkat-harga/routes.ts:36 PATCH /api/tingkat-harga/:id/status master.harga.kelola
penjualan/order/routes.ts:43 GET /api/order/antrean penjualan.checkout
penjualan/order/routes.ts:50 GET /api/order/antrean/siaran penjualan.order.buat
penjualan/order/routes.ts:73 GET /api/order/ penjualan.order.buat
penjualan/order/routes.ts:76 GET /api/order/:id penjualan.order.buat
penjualan/order/routes.ts:80 POST /api/order/pratinjau penjualan.order.buat
penjualan/order/routes.ts:83 POST /api/order/ penjualan.order.buat
penjualan/order/routes.ts:92 PUT /api/order/:id penjualan.order.buat
penjualan/order/routes.ts:101 POST /api/order/:id/kirim penjualan.order.buat
penjualan/order/routes.ts:107 POST /api/order/:id/proses penjualan.checkout
penjualan/order/routes.ts:113 POST /api/order/:id/lepas penjualan.order.batal_sendiri
penjualan/order/routes.ts:119 POST /api/order/:id/batal penjualan.order.batal_sendiri
penjualan/penjualan/routes.ts:29 GET /api/penjualan/ penjualan.riwayat.lihat
penjualan/penjualan/routes.ts:32 GET /api/penjualan/:id penjualan.riwayat.lihat
penjualan/penjualan/routes.ts:35 POST /api/penjualan/checkout penjualan.checkout
penjualan/penjualan/routes.ts:40 POST /api/penjualan/limit-kredit/minta-kode penjualan.checkout
penjualan/penjualan/routes.ts:49 POST /api/penjualan/:id/pembayaran penjualan.pembayaran.catat
penjualan/penjualan/routes.ts:64 POST /api/penjualan/:id/surat-jalan penjualan.surat_jalan.kelola
penjualan/penjualan/routes.ts:79 POST /api/penjualan/:id/diambil penjualan.checkout
penjualan/penjualan/routes.ts:85 POST /api/penjualan/:id/cetak-ulang penjualan.riwayat.lihat
penjualan/surat-jalan/routes.ts:18 GET /api/surat-jalan/ penjualan.surat_jalan.kelola
penjualan/surat-jalan/routes.ts:21 GET /api/surat-jalan/:id penjualan.surat_jalan.kelola
penjualan/surat-jalan/routes.ts:24 POST /api/surat-jalan/:id/status penjualan.surat_jalan.kelola
penjualan/surat-jalan/routes.ts:39 POST /api/surat-jalan/:id/batal penjualan.surat_jalan.kelola
persediaan/penerimaan/routes.ts:13 GET /api/penerimaan/ persediaan.penerimaan.kelola
persediaan/penerimaan/routes.ts:16 GET /api/penerimaan/:id persediaan.penerimaan.kelola
persediaan/penerimaan/routes.ts:19 POST /api/penerimaan/ persediaan.penerimaan.kelola
persediaan/penyesuaian/routes.ts:25 GET /api/penyesuaian/saldo-awal/templat persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:28 POST /api/penyesuaian/saldo-awal/impor persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:33 GET /api/penyesuaian/ persediaan.stok.lihat
persediaan/penyesuaian/routes.ts:36 GET /api/penyesuaian/:id persediaan.stok.lihat
persediaan/penyesuaian/routes.ts:39 POST /api/penyesuaian/ persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:43 POST /api/penyesuaian/lembar-opname persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:52 PUT /api/penyesuaian/:id persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:57 POST /api/penyesuaian/:id/selesai persediaan.penyesuaian.kelola
persediaan/penyesuaian/routes.ts:65 POST /api/penyesuaian/:id/batal persediaan.penyesuaian.kelola
persediaan/retur-pemasok/routes.ts:13 GET /api/retur-pemasok/ persediaan.retur_pemasok.kelola
persediaan/retur-pemasok/routes.ts:16 GET /api/retur-pemasok/:id persediaan.retur_pemasok.kelola
persediaan/retur-pemasok/routes.ts:19 POST /api/retur-pemasok/ persediaan.retur_pemasok.kelola
persediaan/stok/routes.ts:14 GET /api/stok/ persediaan.stok.lihat
persediaan/stok/routes.ts:17 GET /api/stok/ekspor persediaan.stok.lihat
persediaan/stok/routes.ts:21 GET /api/stok/tertahan persediaan.stok.lihat
persediaan/stok/routes.ts:22 GET /api/stok/mutasi persediaan.stok.lihat
persediaan/stok/routes.ts:25 GET /api/stok/kartu/:id persediaan.stok.lihat
promo/routes.ts:13 GET /api/promo/ promo.kelola
promo/routes.ts:16 GET /api/promo/:id promo.kelola
promo/routes.ts:19 POST /api/promo/ promo.kelola
promo/routes.ts:23 PATCH /api/promo/:id promo.kelola
promo/routes.ts:28 PATCH /api/promo/:id/status promo.kelola
sistem/cadangan/routes.ts:10 GET /api/cadangan/ sistem.cadangan.kelola
sistem/cadangan/routes.ts:11 POST /api/cadangan/jalankan sistem.cadangan.kelola
sistem/cadangan/routes.ts:15 POST /api/cadangan/uji-pulih sistem.cadangan.kelola
sistem/pengaturan/routes.ts:28 GET /api/pengaturan/ sistem.pengaturan.kelola
sistem/pengaturan/routes.ts:29 PATCH /api/pengaturan/ sistem.pengaturan.kelola
sistem/pengaturan/routes.ts:33 GET /api/pengaturan/tampilan LOGIN
sistem/pengaturan/routes.ts:34 GET /api/pengaturan/logo LOGIN
sistem/pengaturan/routes.ts:42 POST /api/pengaturan/logo sistem.pengaturan.kelola
sistem/pengaturan/routes.ts:46 DELETE /api/pengaturan/logo sistem.pengaturan.kelola
sistem/saluran/routes.ts:29 GET /api/saluran/ sistem.pengaturan.kelola
sistem/saluran/routes.ts:30 PATCH /api/saluran/ sistem.pengaturan.kelola
sistem/saluran/routes.ts:34 POST /api/saluran/uji LOGIN
sistem/saluran/routes.ts:37 GET /api/saluran/saya LOGIN
sistem/saluran/routes.ts:40 PATCH /api/saluran/saya LOGIN
sistem/saluran/routes.ts:44 POST /api/saluran/saya/telegram/tautan LOGIN
sistem/saluran/routes.ts:47 POST /api/saluran/saya/telegram/periksa LOGIN
sistem/saluran/routes.ts:50 DELETE /api/saluran/saya/telegram LOGIN
```

## Lampiran B — Daftar tabel database (48)

| Berkas skema | Tabel (baris deklarasi) |
|---|---|
| `apps/api/src/db/schema/sistem.ts` | konfigurasi:37, penghitung_nomor:51, pengguna:61, sesi_login:89, log_aktivitas:114, cadangan:146 |
| `…/master.ts` | kategori:41, merk:56, satuan:69, jenis_atribut:95, pemasok:119, tingkat_harga:136, golongan_pelanggan:178, pelanggan:191, barang:224, barang_atribut:288, barang_satuan_jual:321, harga_barang:351, promo:402, promo_pelanggan:488 |
| `…/persediaan.ts` | persediaan:41, penerimaan_barang:79, penerimaan_barang_detail:139, penyesuaian_stok:184, penyesuaian_stok_detail:213, mutasi_persediaan:274 |
| `…/penjualan.ts` | order_penjualan:46, order_penjualan_detail:116, penjualan:180, penjualan_detail:269, surat_jalan:349, surat_jalan_detail:390, pembayaran_penjualan:416 |
| `…/kas.ts` | rekening_toko:34, shift_kasir:60, kas_shift:107, clerical_check:158 |
| `…/koreksi.ts` | retur_penjualan:42, retur_penjualan_detail:111, void_transaksi:172, void_transaksi_detail:236, permintaan_persetujuan:275, kode_persetujuan:347 |
| `…/transaksi-pemasok.ts` | retur_pemasok:28, retur_pemasok_detail:73, penyelesaian_konsinyasi:106, penyelesaian_konsinyasi_detail:152, pembayaran_pemasok:193 |

---

## Riwayat

- 2026-10-14 — v1: inventaris disusun dari kode di `main` commit `42fe18d` (K-001–K-112).
