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
| `[TANYA n]` / `[JAWAB n]` | Tidak bisa dipastikan dari kode; ditanyakan dan dijawab pemilik di bagian 13. |

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
   `[KODE: apps/api/src/app.ts:136]`. **Belum terpasang di toko:** per 14 Oktober 2026 aplikasi masih dikembangkan dan diuji di laptop pengembang. Bentuk deploy akhir (server lokal di komputer toko seperti rancangan K-082, atau hosting cloud/remote) akan dipilih pemilik toko `[JAWAB 1]`.
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
| API | 194 endpoint REST di bawah `/api`, dikelompokkan per modul | `[KODE: api/app.ts:52-88]` |
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
  dipakai di toko: **laptop/komputer** (kasir, admin, owner) dan **tablet** (staf penjualan), keduanya membuka server yang sama sehingga data saling terlihat seketika `[JAWAB 2]`. Tampilan yang nyaman di tablet menjadi kebutuhan **penting** yang akan dikerjakan (bagian 11).
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
| Penjualan Langsung / Pengantaran (checkout) | — | T, C struk/invoice | + harga manual | sama |
| Pembayaran & Piutang | — | L T (terima pembayaran) | sama | sama |
| Surat jalan, berangkat, catat hasil antar | — | T U (dimuat, berangkat, hasil), batal | sama | sama |
| Catatan BBM / servis, statistik armada | — | T BBM, L | + T servis, batal catatan, L statistik | sama |
| Papan Pengiriman (rit rencana) | — | L T U (rit baru, isi, pindah, dimuat, berangkat), batal rit | sama | sama |
| Kendaraan & sopir | — | L (memilih saat berangkat), riwayat perjalanan | L T U N | sama |
| Retur penjualan / Void | — | T (ajukan), batal pengajuan sendiri; S dengan kode atasan | + S, tolak | sama |
| Shift & clerical check | — (melihat status shift di topbar) | shift toko: buka, kas, koreksi modal (setelah ada transaksi tunai: kode atasan), tutup | + angka sistem sebelum dihitung, setujui koreksi modal, penjelasan selisih | sama |
| Rekening toko | — | L (memilih saat bayar) | L T U N | sama |
| Cek uang non-tunai | — | — | L, tandai Sudah/Tidak masuk | sama |
| Penerimaan barang, stok, penyesuaian/opname, retur ke pemasok | — (stok tersedia tampil di cari barang) | — | L T | sama |
| Hutang pemasok, konsinyasi | — | — | L T (bayar, setoran) | sama |
| Laporan penjualan, piutang, produk terlaris, daftar harga | — | L C | L C | L C |
| Laporan persediaan, laba kotor, nilai persediaan, hutang | — | — | L C | L C |
| Pengaturan (profil, penomoran, operasional, pembayaran, harga & diskon, persetujuan) | — | — | L U | L U |
| Pengaturan › Cadangan, Log aktivitas | — | — | — | L, jalankan cadangan/uji pulih |

Catatan matriks:
- Diskon manual tidak ada (K-146, 23 Okt); potongan harga hanya lewat Promo.
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
  toko), Harga (dasar markup, pembulatan), Promo, Keamanan, Persetujuan
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
  saring per aksi; ekspor Excel dengan rentang tanggal (K-113).
- Tabel: `log_aktivitas`.
- Bukti: `[KODE: shared/log.ts]` `[KODE: api/modules/sistem/log-aktivitas.ts:24]`
  `[KODE: apps/api/src/db/schema/sistem.ts:114-140]` `[KODE: api/modules/sistem/log/routes.ts:19-21]`.
- Status: BERFUNGSI (ekspor Excel ditambahkan 24 Okt; tes `log.test.ts`).

**F52. Log interaksi penelitian** | Pengaturan › Log interaksi | Owner (atur, lihat, ekspor); semua pengguna
(dicatat bila menyala) | desktop
- Fungsi: data pemakaian untuk mengukur *penggunaan sistem* dan *kepuasan pengguna* (DeLone & McLean): halaman yang
  dibuka dan lamanya, elemen yang diklik (label), tombol pintasan, dialog dibuka/ditutup dan lamanya, pencarian
  (jumlah hasil), dan galat yang tampil, per pengguna dan per sesi tab. Isi ketikan tidak pernah dicatat; deret angka
  panjang disamarkan. Dinyalakan Owner (bawaan mati) dengan tingkat rincian; pengguna diberi tahu sekali per sesi.
  Ekspor Excel/CSV untuk diolah (mis. waktu menyelesaikan alur order → bayar dari urutan kejadian satu sesi).
- Input → Proses → Output: kejadian di peramban → dikumpulkan dan dikirim berkelompok (15 detik/50 kejadian/tab
  disembunyikan) → disaring server (setelan, penyamaran, waktu) → tabel, ringkasan, berkas ekspor.
- Tabel: `log_interaksi`; konfigurasi `log_interaksi_aktif`, `log_interaksi_tingkat`.
- Bukti: `[KODE: web/lib/pencatat-interaksi.ts]`, `[KODE: web/components/layout/pencatat-interaksi.tsx]`,
  `[KODE: api/modules/sistem/interaksi/]`, `[KODE: web/features/pengaturan/tab-interaksi.tsx]`; `[DOK: K-190]`;
  tes `interaksi.test.ts`, e2e `interaksi.spec.ts`. Status: BERFUNGSI.

**F53. Akun pertama dan lupa password** | Halaman masuk; Akun saya | publik (akun pertama, lupa password);
semua pengguna (kode pemulihan sendiri) | desktop
- Fungsi: pemakaian pertama tanpa password bawaan: halaman *Buat akun pertama* membuat Owner dan langsung masuk
  (hanya selama belum ada pengguna). Kode pemulihan sekali pakai (tampil sekali; salin/unduh/cetak) untuk *Lupa
  password?*: username + kode + password baru, sesi lama dicabut, kode baru diberikan. Tanpa kode: reset oleh
  Owner/Admin di Data Pengguna.
- Tabel: kolom `pengguna.kode_pemulihan_hash`, `kode_pemulihan_dibuat_pada` (migrasi 0035).
- Bukti: `[KODE: api/modules/auth/pemulihan.ts]`, `[KODE: web/features/auth/halaman-akun-pertama.tsx]`,
  `[KODE: web/features/auth/kartu-kode-pemulihan.tsx]`; `[DOK: docs/04 §7, K-191]`; tes `pemulihan.test.ts`.
  Status: BERFUNGSI.

**F54. Panduan penyiapan pertama dan contoh data** | Panduan penyiapan (Dashboard, Pengaturan) | Admin, Owner |
desktop
- Fungsi: daftar 9 langkah menyiapkan toko (profil, rekening, akun karyawan, barang, stok awal, pelanggan,
  pemasok, kendaraan & sopir, printer struk) berstatus otomatis dari data, dengan petunjuk dan tautan ke layar
  terkait; pengingat di Dashboard. Contoh data bernama wajar per jenis untuk mencoba, dinonaktifkan sekali klik.
- Tabel: konfigurasi `contoh_data`, `penyiapan_ditandai`, `penyiapan_disembunyikan`; data master biasa.
- Bukti: `[KODE: api/modules/sistem/penyiapan/]`, `[KODE: web/features/penyiapan/]`; `[DOK: K-168]`; tes
  `penyiapan.test.ts`, e2e `penyiapan.spec.ts`. Status: BERFUNGSI.

**F6. Notifikasi (lonceng)** | Topbar | semua (isi disaring izin) | semua
- Fungsi: 17 jenis pengingat: order basi, stok habis, stok kritis, barang perlu dipesan (K-113), piutang terlambat, piutang jatuh tempo ≤ 3 hari,
  void/retur menunggu, cadangan bermasalah, hutang terlambat/jatuh tempo, shift saya/shift kasir perlu ditutup,
  hitung uang shift susulan belum dikirim (K-121), order disimpan lewat tanggal ambil (K-122),
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
- Status: SEBAGIAN — berfungsi di tes; bergantung pada pemasangan restic/rclone di server; cadangan ke cloud akan diaktifkan saat deploy `[JAWAB 1]`.

**F45. FMS pendukung: BBM, servis, pengingat, statistik armada** | Logistik › Kendaraan & Sopir (tab BBM, Servis,
Statistik) | Kasir (catat BBM), Admin/Owner (servis, batal, statistik) | desktop
- Fungsi: catatan BBM (liter, rupiah, odometer, isi penuh) dan servis (jenis, biaya, bengkel); odometer tidak boleh
  mundur menurut tanggal; catatan salah dibatalkan dengan alasan. Pengingat servis berkala (km/bulan) dan STNK/KIR di
  daftar kendaraan, notifikasi, dan pilihan kendaraan. Statistik per kendaraan (rit, muatan, pemakaian daya angkut,
  lama di jalan, tepat jadwal, BBM, servis, km tempuh, km/L, biaya per km) dan per sopir (rit, tepat jadwal, surat
  jalan bermasalah).
- Input → Proses → Output: struk BBM/nota servis → validasi + kunci baris kendaraan → catatan, pengingat, statistik.
- Tabel: `catatan_bbm`, `catatan_servis`, `kendaraan.servis_tiap_km/bulan` (migrasi 0028).
- Bukti: `[KODE: api/modules/master/armada/catatan.ts]`, `[KODE: api/modules/master/armada/statistik.ts]`,
  `hitungKesehatan` di `[KODE: api/modules/master/armada/service.ts]`; `[DOK: docs/05 S15, docs/13 §5, K-162]`; tes
  `fms.test.ts`, e2e `fms.spec.ts`. Status: BERFUNGSI.

**F44. Pencarian universal** | topbar (Ctrl+K) | semua (hasil disaring izin) | desktop
- Fungsi: satu kotak cari untuk halaman, barang, pelanggan, pemasok, dan nomor dokumen; panah + Enter membuka hasil;
  halaman daftar menerima kata cari dari alamat (`?cari=`).
- Bukti: `[KODE: api/modules/sistem/cari/service.ts]`, `[KODE: web/components/layout/kotak-cari.tsx]`;
  `[DOK: K-167]`; e2e `cari.spec.ts`. Status: BERFUNGSI.

**F46. Arsip tahunan / tutup tahun** | Pengaturan › Arsip tahunan | Owner | desktop
- Fungsi: tutup tahun yang sudah lewat (ditolak bila ada dokumen setengah jalan); tahun dikunci dari pencatatan
  bertanggal tahun itu; semua transaksi tahun itu (termasuk void, retur, mutasi, log) + potret master ditulis utuh ke
  berkas arsip ber-SHA-256 yang ikut dicadangkan; periksa keutuhan dan kesamaan dengan database; unduh; buka kembali
  dengan alasan. Data tidak dipindah sehingga semua layar/laporan tetap membaca tahun lama.
- Tabel: `tutup_tahun` (migrasi 0031).
- Bukti: `[KODE: api/modules/sistem/arsip/service.ts]`, `[KODE: api/modules/sistem/arsip/tabel.ts]`;
  `[DOK: docs/05 §18, K-165]`; tes `arsip.test.ts`, e2e `arsip.spec.ts`. Status: BERFUNGSI.

**F47. Pembaruan aplikasi yang aman dan versi aplikasi** | server; menu pengguna › Tentang aplikasi | Owner/teknisi;
semua (lihat versi) | server/desktop
- Fungsi: skrip pembaruan menghentikan server, mencadangkan, menguji migrasi pada salinan database (menolak bila data
  lama berkurang), memigrasi, menyalakan dan memeriksa; mundur otomatis ke versi lama bila gagal. Versi, status
  migrasi, dan catatan perubahan tampil di aplikasi.
- Bukti: `[KODE: api/db/uji-migrasi-salinan.ts]`, `[KODE: scripts/server/perbarui-server.ps1]`,
  `[KODE: shared/versi.ts]`; `[DOK: K-166]`; tes `uji-migrasi-salinan.test.ts`, `health.test.ts`. Status: BERFUNGSI
  (uji migrasi penuh butuh hak CREATEDB di server).

**F48. Data bersih dan pencegahan data ganda** | semua form master; Pengaturan › Pemeriksaan data | semua (form),
Admin/Owner (pemeriksaan) | desktop
- Fungsi: No. HP format internasional dengan kode negara (0 di depan dibuang otomatis); nama dirapikan; menyimpan
  pelanggan/pemasok/barang yang mirip data lain (nama setelah dirapikan, No. HP) ditolak dengan daftar data mirip
  kecuali ditegaskan berbeda; pemindaian data lama (dobel, format salah) dan rapikan No. HP sekaligus.
- Bukti: `[KODE: shared/nohp.ts]`, `[KODE: api/modules/master/mirip.ts]`,
  `[KODE: api/modules/sistem/pemeriksaan-data/service.ts]`; `[DOK: docs/05 §19, K-137]`; tes `mitra.test.ts`,
  `pemeriksaan-data.test.ts`. Status: BERFUNGSI.

**F49. Pengaturan cetak: logo, kepekatan, kertas, cetak otomatis** | Pengaturan › Struk & printer | Admin/Owner
(kertas & cetak otomatis), tiap komputer kasir (printer) | desktop
- Fungsi: logo toko dicetak di struk thermal sebagai gambar hitam-putih dengan pratinjau; kepekatan Normal /
  Tebal / Paling tebal; penjelasan laci uang; ukuran dan arah kertas invoice, surat jalan, dan dokumen lain
  (bawaan A4 lanskap); invoice pengantaran dan surat jalan dicetak langsung, ditanya dulu, atau tidak dicetak
  setelah dibuat; langkah cetak A4 tanpa jendela (mode kasir).
- Bukti: `[KODE: shared/escpos.ts]`, `[KODE: web/lib/logo-struk.ts]`, `[KODE: web/lib/cetak-otomatis.ts]`,
  `[KODE: web/features/pengaturan/form-dokumen.tsx]`; `[DOK: K-124]`; tes `escpos.test.ts`, `pengaturan.test.ts`.
  Status: BERFUNGSI.

**F50. Hasil Penjualan** | Transaksi › Hasil Penjualan | Kasir, Admin, Owner (laba: Admin/Owner) | desktop
- Fungsi: kinerja penjualan satu periode tanpa membuka Laporan: omzet, jumlah transaksi, rata-rata, penjualan
  bersih, laba kotor dan margin (berizin), void; perbandingan dengan periode lalu; grafik omzet harian; barang
  terlaris dengan kelas ABC; per kategori, pelanggan, kasir, jam, hari, cara bayar; promo; retur dan void.
- Input → Proses → Output: periode → fungsi hitung laporan yang sama + kueri per kasir/jam/hari/cara bayar →
  halaman ringkasan (docs/05 §20 HP1–HP5).
- Bukti: `[KODE: api/modules/hasil-penjualan/service.ts]` `[KODE: web/features/hasil-penjualan/halaman-hasil-penjualan.tsx]`;
  `[DOK: K-126]`; tes `hasil-penjualan.test.ts`, e2e `hasil-penjualan.spec.ts`. Status: BERFUNGSI.

**F51. Order pembelian ke pemasok** | Persediaan › Order Pembelian | Admin, Owner | desktop
- Fungsi: pesanan ke pemasok sebelum barang datang: draf, kirim (nomor PO, cetak A4, salin teks WhatsApp),
  konfirmasi pemasok (tanggal janji, perubahan qty/harga), uang muka, penerimaan barang dari PO (boleh sebagian,
  uang muka otomatis menjadi pembayaran faktur), tutup sisa/batal dengan pengembalian uang muka; mengurangi saran
  pesan dan menghasilkan lama kirim aktual; notifikasi PO terlambat.
- Input → Proses → Output: barang + qty + harga perkiraan → status DRAF…SELESAI (docs/05 §21 PO1–PO9) →
  penerimaan, hutang, saran pesan.
- Tabel: `order_pembelian`, `order_pembelian_detail`, `alokasi_uang_muka`, `penerimaan_barang(_detail)`,
  `pembayaran_pemasok`.
- Bukti: `[KODE: api/modules/persediaan/order-pembelian/service.ts]`
  `[KODE: web/features/order-pembelian/halaman-order-pembelian.tsx]`; `[DOK: K-125]`; tes `order-pembelian.test.ts`,
  e2e `order-pembelian.spec.ts`. Status: BERFUNGSI.

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
  modal naik, turun menunggu ditinjau. Dasar modal: rata-rata tertimbang, harga beli terakhir, atau **stok tertua
  dulu (FIFO)** dari lapisan barang masuk (K-184) `[KODE: api/modules/persediaan/ledger.ts]`.
- Tabel: `tingkat_harga`, `harga_barang`, `barang`, `persediaan`.
- Bukti: `[KODE: api/modules/master/harga/service.ts:62,112,468]` `[KODE: api/modules/penjualan/harga-baris.ts:174]`.
- Status: BERFUNGSI.

**F16. Tinjau Harga** | Harga Jual › Tinjau Harga | Admin, Owner | desktop
- Fungsi: daftar barang yang dasar modalnya berubah dengan usulan harga dan margin; terapkan atau abaikan.
- Bukti: `[KODE: api/modules/master/harga/service.ts:576,630,712]`. Status: BERFUNGSI.

**F17. Promo** | Pengaturan › Promo | Admin, Owner (buat); semua (menerima) | desktop
- Fungsi: kampanye promo (K-163): waktu berlaku sampai jam-menit, hari tertentu dan jam harian (happy hour);
  sasaran semua barang, beberapa barang/kategori/merk sekaligus, atau **kombinasi** (kelompok kategori DAN merk DAN
  barang, antar kelompok ATAU; K-185); manfaat potongan persen, rupiah per satuan, **harga khusus** (harga jadi),
  **beli X gratis Y** (barang sama), atau **beli N potong Rp X** per kelipatan (K-185); sasaran pembeli (semua/golongan/pelanggan tertentu);
  syarat min qty, min belanja, belanja pelanggan N hari; **anggaran promo** dan **batas per pembeli**; jumlah
  potongan yang sudah diberikan; **templat kampanye** untuk dipakai ulang.
- Tabel: `promo`, `promo_sasaran`, `promo_pelanggan`, `penjualan_detail` (kolom `id_promo`, `diskon_promo`).
- Belum: voucher, kupon undian, sasaran atribut (K-163 bagian 2).
- Bukti: `[KODE: api/modules/promo/hitung.ts:116]` `[KODE: api/modules/promo/repo.ts:164]` `[KODE: api/modules/promo/routes.ts:13-28]`.
- Status: BERFUNGSI.

### 4.4 Penjualan

**F18. Order Penjualan (input cepat dan form lengkap)** | Transaksi | Staf, Kasir, Admin, Owner | desktop/tablet
- Fungsi: staf mencatat pesanan (ketik `3*semen` untuk qty), memilih pelanggan bila ada, lalu mengirim ke antrean
  kasir; order menahan stok (reservasi); isian yang belum dikirim tersimpan sebagai draf (bisa diatur: *Buka draf
  otomatis*); "Mulai dari awal" (F9) dengan konfirmasi. Sejak 18 Okt (K-122): **order disimpan** untuk diambil
  nanti (F7; wajib nama, No. HP, tanggal ambil ≤ 14 hari; stok ditahan; daftar *Disimpan* terpisah dari antrean;
  pengingat lewat tanggal), **kembali ke draf** dari antrean/kasir/disimpan (stok dilepas, barang tetap),
  **peringatan barang yang juga ada di draf lain** bila stok tidak cukup (biarkan / hapus / buka draf itu), dan
  panel rincian barang saat memilih barang.
- Input → Proses → Output: barang + qty → harga, tier, promo dihitung server (pratinjau) → order MENUNGGU dengan
  nomor antrean; `stok_dipesan` naik.
- Tabel: `order_penjualan`, `order_penjualan_detail`, `persediaan`.
- Bukti: `[KODE: api/modules/penjualan/order/service.ts:549,591,752,822,863]` `[KODE: api/modules/persediaan/ledger.ts:264]`
  `[KODE: web/features/order/dialog-simpan-order.tsx]` `[KODE: web/features/order/pilihan-order.tsx]`
  `[TES: api/modules/penjualan/order.test.ts R11–R14]` `[TES: web/e2e/order-simpan.spec.ts]`.
- Status: BERFUNGSI.

**F19. Cari barang** | semua layar transaksi | semua | desktop
- Fungsi: cari per kata di nama, kode, barcode, merk, kategori, atribut (mis. `pipa 3 inch putih`; atribut
  boleh sebagian, K-123), urut relevansi; saring kategori; tombol **Daftar** untuk melihat barang tanpa mengetik;
  foto kecil; stok tersedia (tebal merah); label keterjualan Laris/Lambat/Tidak laku/Baru dari penjualan 30 hari
  (`[KODE: api/modules/master/barang/keterjualan.ts]`); panel rincian dengan info penjualan.
- Bukti: `[KODE: api/modules/master/barang/repo.ts:101,128]` `[KODE: web/features/pos/cari-barang-pos.tsx]`.
- Status: BERFUNGSI.

**F20. Antrean order (papan FIFO)** | Penjualan Langsung, Pengantaran | Kasir+ | desktop
- Fungsi: tiket bernomor, terlama disorot, lama menunggu berwarna; kasir membuka order lalu boleh mengubah isinya
  saat bayar; diperbarui real-time (SSE).
- Bukti: `[KODE: api/modules/penjualan/order/service.ts:115,535]` `[KODE: api/modules/penjualan/order/routes.ts:43-50]`.
- Status: BERFUNGSI.

**F21. Penjualan Langsung (kasir/POS)** | Transaksi | Kasir+ | komputer kasir
- Fungsi: checkout dari antrean atau langsung; cara bayar Tunai, Transfer, EDC, QRIS, bayar campuran; pembeli
  terdata boleh DP/bayar nanti; struk otomatis; tanda barang belum diambil. Layar dibagi dua sama lebar (antrean |
  transaksi); barang yang disorot di hasil cari tampil rinci (foto, stok, harga per satuan/kemasan per tier,
  atribut) menutupi area antrean `[KODE: web/features/pos/panel-detail-barang.tsx]` (K-114). Pas layar: Alt+←/→
  pindah panel, PgUp/PgDn menggulir panel aktif, bilah pintasan di baris tab, kotak tier ringkas
  `[KODE: web/features/pos/layar-pos.tsx]` (K-171).
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
- Fungsi: satu invoice boleh beberapa surat jalan (kirim bertahap); status dibuat → dimuat → di jalan (lewat
  perjalanan) → hasil dicatat; batal sebelum berangkat; status pengiriman invoice dihitung ulang dari qty yang
  benar-benar diterima pembeli (K-149).
- Surat jalan direncanakan dan diberangkatkan lewat papan *Logistik › Pengiriman* (F42, 24 Okt; menggantikan tab
  *Pengiriman aktif* 23 Okt). Dari detail invoice masih bisa berangkat langsung (S9).
- **Catat hasil per barang** (K-149, K-151): diterima / kembali utuh (dikirim ulang, stok tetap) / rusak di jalan
  (ditanggung toko: kirim pengganti = retur tukar, atau tagihan dikurangi) / ditolak pembeli (retur otomatis,
  potong tagihan atau uang kembali). Retur mengikuti aturan persetujuan yang sama dengan retur biasa.
- K-176: hasil per barang wajib beralasan (kembali: kirim ulang / kelebihan / salah barang / pembeli batal; rusak: di
  jalan / saat dicek); kembali selain kirim ulang mengurangi tagihan otomatis; refund transfer menjadi tugas
  *menunggu → sudah ditransfer* dengan bukti; penanda hasil di kartu Pengiriman. K-192: nilai barang kembali/rusak
  diselesaikan menurut status bayar (belum bayar → potong tagihan; DP → potong tagihan atau kembalikan uang; lunas →
  kembalikan uang). K-193: uangnya menjadi tugas *Pengembalian uang* (tunai atau transfer) yang dikonfirmasi saat
  benar-benar diserahkan; caranya bisa diganti selama menunggu `[KODE: web/features/koreksi/tab-pengembalian.tsx]`.
- Tabel: `surat_jalan`, `surat_jalan_detail`, `surat_jalan_hasil`, `surat_jalan_hasil_detail`.
- Bukti: `[KODE: api/modules/penjualan/surat-jalan/service.ts]` (`catatHasil`, `sisaKirim`,
  `sinkronStatusPengiriman`, `buatSuratJalanTx`), `[KODE: web/features/pengantaran/panel-surat-jalan.tsx]`; tes
  `api/modules/penjualan/surat-jalan.test.ts` (13 kasus), e2e `pengiriman.spec.ts`, `pengantaran.spec.ts`.
  Status: BERFUNGSI.

**F41. Kendaraan, sopir, dan perjalanan (FMS inti)** | Logistik › Kendaraan & Sopir; Logistik › Pengiriman | Kasir
(lihat), Admin/Owner (kelola) | desktop
- Fungsi: kendaraan (plat unik dirapikan, jenis, kapasitas) dan sopir (nama unik, No. HP) sebagai data master;
  dipilih saat berangkat, tidak diketik ulang. Satu perjalanan (nomor TRP) membawa beberapa surat jalan; kendaraan
  dan sopir yang sedang jalan terkunci sampai hasil semua surat jalannya dicatat (dijaga service + indeks unik
  parsial). Riwayat perjalanan per kendaraan dan per sopir.
- Tabel: `kendaraan`, `sopir`, `perjalanan`, kolom `surat_jalan.id_perjalanan` (migrasi 0023).
- Bukti: `[KODE: api/modules/master/armada/]`, `[KODE: api/modules/penjualan/perjalanan/service.ts]`
  (`berangkatkanRit`); `[DOK: K-150, K-174]`. Status: BERFUNGSI.

**F42. Papan Pengiriman dan rit rencana** | Logistik › Pengiriman | Kasir+ | desktop
- Fungsi: papan empat kolom (Backlog → Dijadwalkan → Di jalan → Selesai hari ini). Rit direncanakan lebih dulu
  (kendaraan, sopir, jadwal), lalu diisi dengan menyeret kartu order kirim ke grup rit atau lewat menu kartu; surat
  jalan dibuat saat itu, untuk semua sisa barang atau sebagian (dialog qty + rit), dan langsung berisi sopir dan
  kendaraan rit (K-174: tidak ada surat jalan tanpa rit; dialog yang sama dipakai di detail invoice dan tombol S
  kasir, dengan pilihan membuat rit baru). Keluar dari rit atau batal rit membatalkan surat jalannya sehingga order
  kembali ke Backlog. Grup rit menampilkan bar muatan, bisa ditandai *Dimuat*, dicetak, diberangkatkan
  (pemeriksaan muatan F43, penguncian kendaraan/sopir F41; semua surat jalan rit dicetak atau disimpan PDF sekaligus
  sesuai pilihan di dialog), atau dibatalkan dengan alasan. Setiap aksi seret punya
  padanan klik dan keyboard (R = rit baru). Data disegarkan tiap 30 detik; aksi pada rit yang sudah berubah ditolak.
- Input → Proses → Output: kendaraan, sopir, jadwal, kartu order kirim → kunci baris rit dan surat jalan, buat/pindah
  surat jalan, log aktivitas → rit DIRENCANAKAN → JALAN → SELESAI (atau BATAL).
- Tabel: `perjalanan` (status DIRENCANAKAN/BATAL, `jadwal_berangkat`, `alasan_batal`; migrasi 0027),
  `surat_jalan.id_perjalanan`.
- Bukti: `[KODE: api/modules/penjualan/perjalanan/service.ts]` (`rencanakanRit`, `isiRit`, `keluarkanDariRit`,
  `muatRit`, `berangkatkanRit`, `batalkanRit`), `[KODE: web/features/pengiriman/halaman-pengiriman.tsx]`;
  `[DOK: docs/05 S14, docs/13 §4, K-160]`; tes `surat-jalan.test.ts` (alur rit rencana), e2e `pengiriman.spec.ts`.
  Status: BERFUNGSI.

**F43. Data muatan dan pemeriksaan muatan (ODOL)** | Data Barang › Data muatan; Logistik › Kendaraan & Sopir;
dialog Berangkat | Admin/Owner (data), Kasir+ (berangkat) | desktop
- Fungsi: berat dan ukuran kemasan per satuan dasar barang (boleh diisi g/kg/ton, mm/cm/m, L/m³), daya angkut dan
  ukuran bak kendaraan, masa berlaku STNK/KIR. Saat berangkat, berat/volume/panjang rit dihitung: hijau aman, kuning
  hampir penuh, oranye wajib alasan tertulis, merah ditolak (berat tidak pernah boleh melebihi daya angkut).
- Tabel: kolom muatan di `barang`, `kendaraan`, `perjalanan` (migrasi 0026); konfigurasi faktor isi dan julur.
- Bukti: `[KODE: api/modules/penjualan/perjalanan/service.ts]` (`hitungMuatan`), `[KODE: shared/satuan-muatan.ts]`;
  `[DOK: docs/05 S13, docs/13 §3, K-161]`; e2e `muatan.spec.ts`.
- Isi massal lewat Excel: unduh barang (semua/yang belum lengkap), isi dengan satuan bebas, pratinjau lama → baru,
  simpan semua sekaligus `[KODE: api/modules/master/import/muatan.ts]`, e2e `muatan-excel.spec.ts`.
- Status: BERFUNGSI; pengingat masa berlaku STNK/KIR menyusul (K-162).

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

**F28. Shift toko dan clerical check** | Shift & Clerical Check | Kasir+ | komputer kasir
- Fungsi (diperbarui 18 Okt, K-121, K-132–K-142; 30 Okt K-197 *Sebelum menutup*: penghalang void menunggu dan
  daftar menggantung yang wajib diakui, termasuk pembayaran di luar shift yang masuk shift berikutnya):
  - **Satu shift untuk toko** (satu laci): dibuka/ditutup siapa pun yang berizin; semua uang tunai masuk shift itu
    dengan nama pencatatnya; status shift tampil di topbar untuk semua peran (termasuk Staf). Dua pembukaan
    bersamaan tetap menghasilkan satu shift (kunci transaksi).
  - **Buka shift tiga cara** dalam satu dialog dengan konfirmasi (Enter = ya, Esc = kembali/tutup): *sama dengan
    uang ditinggal kemarin*, *hitung sekarang* per pecahan (Rp100.000 … Rp100) atau total, dan *buka dulu, hitung
    nanti* untuk toko yang sudah ramai. Hitung susulan dua langkah (hitung → hasil dengan angka → hitung ulang
    sekali → simpan): modal saat buka = laci − uang masuk sejak buka; beda dengan uang kemarin = *selisih semalam*.
  - Hitung per pecahan dengan −/+, kosongkan baris/semua, dan hotkey (↑↓, + −, Del, Shift+Del).
  - **Koreksi modal** tanpa mengubah angka asli: dicatat sebagai kas *Koreksi modal ±* beralasan; bebas sebelum ada
    transaksi tunai, sesudahnya dengan kode sekali pakai dari Admin/Owner (anti-kecurangan).
  - Kas manual (kasbon, setor/tarik owner, masuk/keluar lain).
  - **Tutup dua langkah** dengan **hitung buta**: hitungan pertama dikirim dan terkunci (shift berstatus *sedang
    ditutup*, uang baru ditolak) → hasil rekonsiliasi, **tinjauan shift** (transaksi per jenis, pembayaran per
    metode, linimasa tunai dengan saldo laci) dan **bantuan mencari selisih** (mencocokkan selisih dengan
    pembayaran, kembalian, kas, atau kelipatan pecahan) → hitung ulang sekali → keterangan wajib di luar
    **toleransi receh** (bawaan Rp 1.000) → **uang ditinggal di laci** (menjadi usulan modal besok) → tutup.
  - Saat tutup: semua **order belum selesai** dengan pilihan per order, dan **retur/void menunggu** sebagai
    informasi (uang belum keluar dari laci).
  - **Kembalian tidak diambil** pembeli (tombol K di layar bayar) dicatat kas masuk khusus, bukan penjualan.
  - Admin/Owner menambah **penjelasan selisih** setelah shift ditutup (angka tetap).
  - Shift yang lewat hari mengunci pencatatan; jadwal buka/tutup dengan pengingat.
- Tabel: `shift_kasir`, `kas_shift`, `clerical_check`, `hitung_kas` (setiap hitungan uang shift).
- Bukti: `[KODE: api/modules/kas/shift/service.ts:182,511,624,765,838,931]`
  `[KODE: api/modules/kas/shift/bantuan.ts:53,135]` `[KODE: web/features/shift/dialog-buka-shift.tsx]`
  `[KODE: web/features/shift/alur-tutup-shift.tsx]` `[TES: api/modules/kas/shift.test.ts K15–K23]`
  `[TES: web/e2e/shift.spec.ts]`. Status: BERFUNGSI.

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

**F40. Rekomendasi pemesanan ulang (Saran pesan)** | Stok Persediaan › Saran pesan; Laporan | Admin, Owner | desktop
- Fungsi: barang yang perlu dibeli ulang dan jumlah sarannya per pemasok, dengan status Pesan sekarang / Segera /
  Aman / Tidak laku, stok cukup untuk berapa hari, dan perkiraan biaya. Rumus di bagian 5d.
- Input → Proses → Output: data penjualan (ledger) + stok tersedia + lama kirim/jarak belanja pemasok + pengaturan
  → hitung RO1–RO6 → daftar saran per pemasok, laporan, notifikasi.
- Tabel: `mutasi_persediaan`, `persediaan`, `barang`, `barang_satuan_jual`, `penerimaan_barang(_detail)`,
  `pemasok`, `konfigurasi` (hanya dibaca).
- Metode (K-127): A rata-rata, B statistik (stok pengaman Z × simpangan baku × √lama kirim, tingkat layanan
  90/95/98 %), C min–maks (stok minimum/maksimum per barang), D tren (pemulusan eksponensial ganda Holt). Hasil
  tiap metode disimpan sementara di memori server 10 menit dan dihitung ulang bila ada transaksi atau perubahan
  data barang/pemasok (docs/05 RO9–RO13).
- Bukti: `[KODE: api/modules/persediaan/saran-pesan/service.ts]` `[KODE: api/modules/persediaan/saran-pesan/routes.ts]`
  `[KODE: api/modules/persediaan/saran-pesan/hitung.ts]` `[KODE: shared/qty.ts]`; tes `saran-pesan.test.ts`,
  `qty-statistik.test.ts`.
- Status: BERFUNGSI (K-113, K-127).

**F37. Laporan (16 jenis)** — rincian di bagian 7. Menu jenis laporan berupa tiga tombol kelompok di atas; pratinjau
dibagi per lembar A4 bernomor seperti hasil cetak, tanpa memotong baris tabel (K-182)
`[KODE: web/features/laporan/halaman-laporan.tsx]` `[KODE: web/features/laporan/pratinjau-halaman.tsx]`; uji
`e2e/laporan.spec.ts`. Status: BERFUNGSI.

**F38. Dashboard per peran** | Dashboard | semua | semua
- Fungsi: penjualan hari ini vs kemarin dan grafik 7 hari (hanya yang berizin omzet), antrean order, pengiriman
  aktif, persetujuan menunggu (Admin/Owner), peringatan stok, aktivitas terkini.
- Bukti: `[KODE: api/modules/dashboard/service.ts:21-63]` `[KODE: api/modules/dashboard/routes.ts:11-18]`.
- Status: BERFUNGSI.

**F39. Cetak struk, invoice, surat jalan** | layar transaksi | Kasir+ | komputer kasir + printer
- Fungsi: struk thermal 58/80 mm (langsung ESC/POS atau jendela cetak), invoice dan surat jalan A4, cetak ulang
  tercatat di log.
- Bukti: `[KODE: web/lib/printer-thermal.ts]` `[KODE: web/lib/struk-escpos.ts]` `[KODE: api/modules/penjualan/penjualan/service.ts:580]`.
- Panduan penyiapan berlaku untuk semua printer ESC/POS (Bluetooth SPP dan USB), termasuk membuat port COM keluar
  saat Windows menulis *Driver is unavailable* `[DOK: docs/panduan/printer-struk.md]` (K-115).
- Status: SEBAGIAN — jalur cetak langsung ke printer thermal baru diuji dengan printer tiruan; uji pada printer
  toko belum dilakukan; pemilik menganggapnya berhasil untuk keperluan dokumen ini dan akan mengujinya `[JAWAB 3]`.

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
| Surat jalan | DIPROSES → DIMUAT → DIKIRIM (berangkat) → SELESAI (hasil dicatat), atau BATAL |
| Perjalanan | JALAN → SELESAI (otomatis saat hasil semua surat jalannya dicatat) |
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
- **Surat jalan:** qty kirim ≤ qty − retur (disetujui dan menunggu) − qty terpakai di surat jalan lain yang belum
  batal (qty diterima bila hasilnya sudah dicatat, selain itu qty kirim) `[KODE: api/modules/penjualan/surat-jalan/service.ts]`
  (`sisaKirim`); status pengiriman invoice disinkronkan setiap
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

**SUDAH ADA sejak 17 Oktober 2026** (Fase 14 bagian 1, K-113; rekomendasi dosen pembimbing). Rumus
"rata-rata jual + lead time" `[KODE: api/modules/persediaan/saran-pesan/hitung.ts]`
`[DOK: docs/05-aturan-bisnis-inti.md §17 RO1–RO8]`:

| Langkah | Rumus | Sumber data |
|---|---|---|
| Terjual bersih | Σ keluar PENJUALAN + TUKAR_RETUR − Σ masuk RETUR_JUAL + VOID, N hari penuh **sampai kemarin** (bawaan N = 30) | ledger `mutasi_persediaan` `[KODE: api/modules/persediaan/saran-pesan/repo.ts]` |
| Hari amatan | min(N, hari sejak mutasi pertama barang); barang baru diamati sejak stoknya pertama masuk | ledger |
| Rata-rata jual per hari | terjual bersih ÷ hari amatan | |
| Stok pengaman | rata × hari pengaman (bawaan 2) | pengaturan |
| Titik pesan | rata × lama kirim + stok pengaman | lama kirim per pemasok (bawaan 3 hari) |
| Saran pesan | bulat ke atas (rata × (lama kirim + jarak belanja) + stok pengaman − stok tersedia), ≥ 0; juga dalam kemasan terbesar | jarak belanja per pemasok (bawaan 7 hari) |
| Stok cukup untuk | stok tersedia ÷ rata (hari) | |
| Status | Tidak laku (tidak terjual) · Pesan sekarang (tersedia ≤ titik pesan) · Segera pesan (tersedia < target) · Aman | |
| Perkiraan biaya | saran × harga beli terakhir (hanya yang berizin melihat harga modal) | `persediaan.harga_beli_terakhir` |

- **Pemasok barang** = pemasok penerimaan pembelian terakhirnya. Lama kirim dan jarak belanja diisi di Data
  Pemasok `[KODE: apps/api/src/db/schema/master.ts]` (kolom `lama_kirim_hari`, `jarak_belanja_hari`).
- **Siapa melihat:** Admin/Owner, di **Stok Persediaan › Saran pesan** (dikelompokkan per pemasok, saring
  status/pemasok/kategori/cari, penjelasan rumus dengan contoh) `[KODE: web/features/persediaan/tab-saran-pesan.tsx]`,
  laporan **Rekomendasi Pemesanan Ulang** (layar, cetak, Excel) `[KODE: api/modules/laporan/rekomendasi-pesan.ts]`,
  dan notifikasi lonceng "Barang perlu dipesan" `[KODE: api/modules/sistem/notifikasi/service.ts]`.
- **Tidak disimpan:** dihitung ulang setiap kali dibuka dari ledger (selalu sesuai data terbaru).
- **Tidak termasuk:** barang titipan (diisi penitip); pesanan pembelian (PO) ke pemasok belum ada (backlog G13).
- **Tes:** 6 tes layanan (contoh angka K-113, status, pembulatan, data sungguhan dengan void, notifikasi, izin) dan
  1 tes layar `[KODE: apps/api/src/modules/persediaan/saran-pesan.test.ts]` `[KODE: apps/web/e2e/saran-pesan.spec.ts]`.

Fitur pendukung yang sudah ada sebelumnya tetap berlaku: stok minimum per barang, status stok 4 tingkat,
notifikasi stok habis/kritis, kartu peringatan stok di dashboard, laporan Stok Minimum, Produk Terlaris, dan
Riwayat Harga Beli.

### 5e. Promo dan diskon

- **Pembuatan:** Admin/Owner di Pengaturan › Promo (lihat F17). Aturan potongan dikunci setelah promo terpakai;
  anggaran dan batas per pembeli boleh diubah `[DOK: K-087, K-110]`.
- **Penerapan otomatis**, satu promo per baris: kandidat yang berlaku (tanggal) dan cocok (barang, pembeli,
  syarat) diurutkan potongan terbesar → tanggal mulai terbaru → id terbesar; promo yang membuat harga di bawah
  modal **dilewati** bila penjualnya Staf/Kasir, lalu promo aman berikutnya dipakai
  `[KODE: api/modules/promo/hitung.ts:116-150]`.
- **Rumus potongan:** persen = bulat(qty × harga × persen ÷ 100), dibatasi batas potongan baris; nominal =
  bulat(qty × potongan per satuan); selalu 0 ≤ potongan ≤ bruto `[KODE: api/modules/promo/hitung.ts:90-100]`.
- **Urutan harga baris:** harga tier transaksi → potongan promo dari harga tier itu (diskon manual dihapus, K-146)
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
- **Diskon manual dihapus** (K-146): API menolak potongan selain promo; diskon lama yang tersimpan tetap dihitung
  laporan `[KODE: api/modules/penjualan/harga-baris.ts]`.

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
merah bila shift lewat hari; kuning/merah bila hitung uang shift susulan belum dikirim; kuning bila shift sedang
ditutup) `[KODE: web/components/layout/peringatan-shift.tsx]`; pesan Telegram/email ke
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
| Admin/Owner | Kapan dan berapa banyak barang dibeli ulang | Saran pesan per pemasok (rata jual/hari, titik pesan, saran qty dan kemasan, stok cukup berapa hari, perkiraan biaya), status stok, produk terlaris, riwayat harga beli per pemasok | Stok Persediaan › Saran pesan, laporan Rekomendasi Pemesanan Ulang (lihat 5d) |
| Admin/Owner | Menaikkan/menurunkan harga jual | Usulan harga, margin, dasar modal baru | Tinjau Harga |
| Admin/Owner | Menagih pelanggan | Umur piutang, jatuh tempo terdekat, posisi kredit per pelanggan | Piutang, Data Pelanggan, laporan Piutang |
| Admin/Owner | Membayar pemasok | Umur hutang, jatuh tempo | Hutang Pemasok, laporan Hutang |
| Admin/Owner | Menilai kejujuran kas | Selisih clerical check per shift, hitungan pertama dan hitung ulang, koreksi modal beserta alasan dan penyetuju, selisih semalam, bantuan mencari selisih, linimasa tunai; uang non-tunai sudah/tidak masuk | Shift & Clerical Check |
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
| Rekomendasi Pemesanan Ulang | Persediaan | Per pemasok: terjual, rata/hari, tersedia, cukup (hari), titik pesan, saran pesan, kemasan, perkiraan biaya, status | persediaan (Admin+); biaya hanya yang berizin nilai | `[KODE: api/modules/laporan/rekomendasi-pesan.ts]` |
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
| Log aktivitas | `log_aktivitas`: `waktu`, `id_pengguna`, `username_percobaan`, `aksi` (103 jenis), `entitas`, `id_entitas`, `nomor_dokumen`, `ringkasan`, `data_lama`, `data_baru` (JSON), `ip` `[KODE: apps/api/src/db/schema/sistem.ts:114-130]` | Siapa melakukan apa, kapan, dari mana; nilai sebelum/sesudah | Tidak (hanya tampil di Pengaturan › Log aktivitas dengan cari/saring); **ekspor Excel akan ditambahkan** `[JAWAB 5]` |
| Riwayat login | `log_aktivitas` aksi `LOGIN_SUKSES`, `LOGIN_GAGAL`, `LOGOUT`; `sesi_login` (sesi aktif, waktu terakhir aktif, IP, peramban) `[KODE: apps/api/src/db/schema/sistem.ts:89]` | Frekuensi dan waktu pemakaian per pengguna | Tidak langsung |
| Waktu transaksi | `penjualan`, `order_penjualan`, `pembayaran_penjualan`, dsb.: `tanggal`/`waktu` (timestamptz UTC), `tanggal_operasional` (tanggal Jakarta), `dibuat_pada` | Kapan order dibuat, dikirim ke antrean, diproses, dibayar | Ya, lewat laporan Penjualan/Detail Invoice (Excel) |
| Riwayat stok | `mutasi_persediaan`: barang, waktu, jenis mutasi, kondisi, qty masuk/keluar, saldo setelah, HPP satuan/setelah, rujukan dokumen, pengguna `[KODE: apps/api/src/db/schema/persediaan.ts:274]` | Setiap perubahan stok dengan dokumennya | Ya: Kartu Stok, Stok Rekap (Excel) |
| Riwayat harga jual | `log_aktivitas` aksi `HARGA_UBAH`, `HARGA_TINJAU_TERAPKAN/ABAIKAN` dengan data lama/baru | Perubahan harga dan penyebabnya (manual/otomatis) | Tidak langsung |
| Riwayat harga beli | `penerimaan_barang_detail` | Harga beli per penerimaan | Ya: laporan Riwayat Harga Beli |
| Persetujuan | `permintaan_persetujuan` (jenis, pengaju, nilai, ringkasan, status, penyetuju, waktu); `retur_penjualan`/`void_transaksi` (`cara_persetujuan`: sendiri, akun atasan, di tempat, batas bebas) | Siapa menyetujui apa dan caranya | Sebagian (riwayat di layar Retur/Void) |
| Kas & kejujuran | `shift_kasir`, `kas_shift`, `clerical_check` (uang fisik, saldo sistem, selisih, keterangan, toleransi, uang ditinggal, penjelasan atasan), `hitung_kas` (setiap hitungan) | Selisih kas per shift | Di layar Shift; laporan kas per shift belum ada (backlog D-L3) |
| Pengecekan non-tunai | `pembayaran_penjualan`: `status_verifikasi`, `diverifikasi_oleh`, `diverifikasi_pada`, `catatan_verifikasi` | Kapan uang transfer dicek dan hasilnya | Di layar Cek uang non-tunai |
| Cetak & ekspor | `log_aktivitas` aksi `CETAK_ULANG`, `LAPORAN_EKSPOR` | Pemakaian laporan dan dokumen | Tidak langsung |
| Cadangan | `cadangan` | Riwayat cadangan dan uji pulih | Di layar Pengaturan › Cadangan |

---

## 9. Aspek kualitas sistem yang terlihat dari kode

| Aspek | Yang ada di kode | Bukti |
|---|---|---|
| Validasi input | Skema Zod yang sama dipakai API dan form web; pesan galat berbahasa Indonesia per kolom | `[KODE: shared/schemas/]` `[DOK: CLAUDE.md, aturan 10]` |
| Integritas data | CHECK constraint di database dari enum yang sama; transaksi DB untuk setiap dokumen; kunci baris saat mengubah stok, nomor dokumen, shift, promo berbatas; tabel transaksi hanya-tambah | `[KODE: api/modules/persediaan/ledger.ts:50,161]` `[KODE: api/modules/sistem/penomoran.ts:44]` |
| Kiriman ganda & ubah bersamaan | Kunci idempoten per kiriman (klik ganda/kirim ulang setelah jaringan putus tidak membuat dokumen kedua); cek versi saat mengubah data master (perubahan orang lain tidak tertimpa diam-diam) | `[KODE: api/middleware/idempoten.ts]` `[KODE: api/lib/versi.ts]` `[DOK: K-164]` |
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
| 10 | Shift & Clerical Check: dialog buka shift tiga cara; hasil tutup dengan tinjauan dan bantuan selisih | Kasir | komputer kasir | Kontrol kas |
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

**Diminta pemilik pada 14 Oktober 2026 (akan dikerjakan):**
- ~~Rekomendasi jumlah pemesanan ulang~~ — **selesai 17 Okt 2026** (F40, bagian 5d).
- Tampilan responsif yang nyaman di **tablet** untuk staf penjualan.
- Ekspor log aktivitas ke Excel untuk dokumentasi penelitian.

**Belum ada dan tidak dijadwalkan:** mode offline; tata letak ponsel;
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
| 14–17 Okt | Inventaris fitur; rekomendasi pemesanan ulang; tampilan muat dan panduan printer umum |
| 18 Okt | Satu shift toko, hitung susulan dua langkah, kembalian tidak diambil, kode atasan dilanjutkan (K-132–K-142); shift tiga cara buka, hitung susulan, koreksi modal dengan kode atasan, tutup dua langkah dengan tinjauan dan bantuan selisih (K-121); katalog anomali (K-120); order disimpan untuk diambil nanti, kembali ke draf, peringatan draf lain (K-122) |

Sumber: `git log --merges` (198 commit; commit pertama 29 Sep 2026). Rincian per keputusan:
`docs/10-ringkasan-keputusan.md`.

---

## 13. Daftar [TANYA] dan jawaban pemilik (14 Oktober 2026)

Label `[JAWAB n]` di dokumen merujuk ke tabel ini.

| No | Pertanyaan | Jawaban pemilik |
|---|---|---|
| 1 | Sudah dipasang di toko? Cadangan cloud aktif? | Belum. Masih diuji di laptop pengembang. Bentuk deploy dipilih pemilik toko: hosting remote/cloud atau server lokal di komputer toko. Cadangan ke cloud pasti dilaksanakan bersama pengembangan. |
| 2 | Perangkat staf penjualan? | Dua jenis perangkat: laptop/komputer dan **tablet** (dipakai staf penjualan di toko). Keduanya saling bertukar data dan sama-sama dipakai untuk input. Tampilan harus responsif dan bisa dipakai di tablet (**penting sekali**). |
| 3 | Cetak langsung ke printer RPP02 sudah berhasil? | Belum dicoba; dianggap berhasil untuk keperluan dokumen ini. |
| 4 | Fitur rekomendasi pemesanan ulang? | Belum ada; rekomendasi dosen pembimbing. Akan ditambahkan, bersama fitur pendukung keputusan lain untuk v2.0.0. |
| 5 | Ekspor log aktivitas? | Ke Excel. |
| 6 | Skala pemakaian? | 4 staf penjualan, 1 kasir, 2 owner; lebih dari 200 transaksi per hari. |
| 7 | Cara persetujuan atasan yang paling sering? | Paling sering kode lewat Telegram; sebagian dari akun atasan sendiri dan lewat email. |

Catatan tentang jawaban 2: karena semua perangkat membuka satu server yang sama, "saling bertukar data" sudah
terjadi tanpa sinkronisasi tambahan. Order dari tablet staf muncul di layar kasir dalam hitungan detik lewat
siaran antrean (bagian 1, butir 7).

## Lampiran A — Daftar endpoint API dan izinnya

Format: `berkas:baris METODE alamat izin`. `LOGIN` = cukup login (data milik sendiri). Login dan masuk cepat tidak
butuh izin tetapi dibatasi laju; masuk cepat hanya ada di mode pengembangan `[KODE: api/app.ts:132,146]`.
Path berkas relatif terhadap `apps/api/src/modules/`. Jumlah: 210 endpoint (+ `GET /api/health`,
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
kas/shift/routes.ts:43 GET /api/shift/aktif kas.shift.kelola_sendiri
kas/shift/routes.ts:44 GET /api/shift/saya kas.shift.kelola_sendiri (nama lama /aktif)
kas/shift/routes.ts:46 GET /api/shift/status LOGIN
kas/shift/routes.ts:48 GET /api/shift/menunggu kas.shift.kelola_sendiri
kas/shift/routes.ts:49 GET /api/shift/usulan-buka kas.shift.kelola_sendiri
kas/shift/routes.ts:50 POST /api/shift/buka kas.shift.kelola_sendiri
kas/shift/routes.ts:54 POST /api/shift/kas kas.shift.kelola_sendiri
kas/shift/routes.ts:58 GET /api/shift/ kas.shift.kelola_sendiri
kas/shift/routes.ts:61 GET /api/shift/:id kas.shift.kelola_sendiri
kas/shift/routes.ts:65 POST /api/shift/:id/hitung-buka/simpan kas.shift.kelola_sendiri
kas/shift/routes.ts:73 POST /api/shift/:id/hitung-buka kas.shift.kelola_sendiri
kas/shift/routes.ts:88 POST /api/shift/:id/koreksi-modal/minta-kode kas.shift.kelola_sendiri
kas/shift/routes.ts:103 POST /api/shift/:id/koreksi-modal kas.shift.kelola_sendiri (kode KOREKSI_KAS bila perlu)
kas/shift/routes.ts:118 POST /api/shift/:id/hitung kas.shift.kelola_sendiri
kas/shift/routes.ts:133 GET /api/shift/:id/hasil kas.shift.kelola_sendiri
kas/shift/routes.ts:136 POST /api/shift/:id/tutup kas.shift.kelola_sendiri
kas/shift/routes.ts:151 POST /api/shift/:id/penjelasan kas.shift.lihat_semua
sistem/kode-persetujuan/routes.ts:12 GET /api/persetujuan/:id LOGIN (hanya permintaan sendiri)
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
laporan/routes.ts GET /api/laporan/rekomendasi-pesan laporan.persediaan
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
master/import/routes.ts GET /api/import/muatan/berkas master.barang.kelola
master/import/routes.ts POST /api/import/muatan/baca master.barang.kelola
master/import/routes.ts POST /api/import/muatan/pratinjau master.barang.kelola
master/import/routes.ts POST /api/import/muatan master.barang.kelola
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
penjualan/order/routes.ts:48 GET /api/order/antrean penjualan.checkout
penjualan/order/routes.ts:55 GET /api/order/antrean/siaran penjualan.order.buat
penjualan/order/routes.ts:79 GET /api/order/draf-barang penjualan.order.buat
penjualan/order/routes.ts:82 GET /api/order/ penjualan.order.buat
penjualan/order/routes.ts:85 GET /api/order/:id penjualan.order.buat
penjualan/order/routes.ts:89 POST /api/order/pratinjau penjualan.order.buat
penjualan/order/routes.ts:92 POST /api/order/ penjualan.order.buat
penjualan/order/routes.ts:101 PUT /api/order/:id penjualan.order.buat
penjualan/order/routes.ts:110 POST /api/order/:id/kirim penjualan.order.buat
penjualan/order/routes.ts:117 POST /api/order/:id/simpan penjualan.order.buat
penjualan/order/routes.ts:133 POST /api/order/:id/draf penjualan.order.buat
penjualan/order/routes.ts:139 POST /api/order/:id/proses penjualan.checkout
penjualan/order/routes.ts:145 POST /api/order/:id/lepas penjualan.checkout
penjualan/order/routes.ts:151 POST /api/order/:id/batal penjualan.order.batal_sendiri
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
penjualan/surat-jalan/routes.ts GET /api/surat-jalan/perlu-kirim penjualan.surat_jalan.kelola
penjualan/surat-jalan/routes.ts POST /api/surat-jalan/:id/hasil penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts GET /api/perjalanan/ penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/rencana penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/keluar penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/:id/isi penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/:id/dimuat penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/:id/berangkat penjualan.surat_jalan.kelola
penjualan/perjalanan/routes.ts POST /api/perjalanan/:id/batal penjualan.surat_jalan.kelola
master/armada/routes.ts GET /api/kendaraan/ penjualan.surat_jalan.kelola
master/armada/routes.ts POST /api/kendaraan/ master.armada.kelola
master/armada/routes.ts PATCH /api/kendaraan/:id master.armada.kelola
master/armada/routes.ts PATCH /api/kendaraan/:id/status master.armada.kelola
master/armada/routes.ts GET /api/sopir/ penjualan.surat_jalan.kelola
master/armada/routes.ts POST /api/sopir/ master.armada.kelola
master/armada/routes.ts PATCH /api/sopir/:id master.armada.kelola
master/armada/routes.ts PATCH /api/sopir/:id/status master.armada.kelola
sistem/cari/routes.ts GET /api/cari dashboard.dasar (hasil disaring per izin)
sistem/pemeriksaan-data/routes.ts GET /api/pemeriksaan-data sistem.pengaturan.kelola
sistem/pemeriksaan-data/routes.ts POST /api/pemeriksaan-data/rapikan-no-hp sistem.pengaturan.kelola
sistem/arsip/routes.ts GET /api/arsip sistem.cadangan.kelola
sistem/arsip/routes.ts POST /api/arsip/:tahun/tutup sistem.cadangan.kelola
sistem/arsip/routes.ts POST /api/arsip/:tahun/buka sistem.cadangan.kelola
sistem/arsip/routes.ts POST /api/arsip/:tahun/periksa sistem.cadangan.kelola
sistem/arsip/routes.ts GET /api/arsip/:tahun/berkas sistem.cadangan.kelola
master/armada/routes.ts GET /api/armada/bbm penjualan.surat_jalan.kelola
master/armada/routes.ts POST /api/armada/bbm penjualan.surat_jalan.kelola
master/armada/routes.ts POST /api/armada/bbm/:id/batal master.armada.kelola
master/armada/routes.ts GET /api/armada/servis penjualan.surat_jalan.kelola
master/armada/routes.ts POST /api/armada/servis master.armada.kelola
master/armada/routes.ts POST /api/armada/servis/:id/batal master.armada.kelola
master/armada/routes.ts GET /api/armada/statistik master.armada.kelola
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
persediaan/saran-pesan/routes.ts GET /api/saran-pesan/ persediaan.stok.lihat
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

## Lampiran B — Daftar tabel database (59)

| Berkas skema | Tabel (baris deklarasi) |
|---|---|
| `apps/api/src/db/schema/sistem.ts` | konfigurasi:37, penghitung_nomor:51, pengguna:61, sesi_login:89, log_aktivitas:114, cadangan:146, kunci_idempoten (K-164), tutup_tahun (K-165) |
| `…/master.ts` | kategori:41, merk:56, satuan:69, jenis_atribut:95, pemasok:119, tingkat_harga:136, golongan_pelanggan:178, pelanggan:191, barang:224, barang_atribut:288, barang_satuan_jual:321, harga_barang:351, promo:402, promo_pelanggan:488 |
| `…/persediaan.ts` | persediaan:41, penerimaan_barang:79, penerimaan_barang_detail:139, penyesuaian_stok:184, penyesuaian_stok_detail:213, mutasi_persediaan:274 |
| `…/penjualan.ts` | order_penjualan:46, order_penjualan_detail:116, penjualan:180, penjualan_detail:269, surat_jalan:349, surat_jalan_detail:390, pembayaran_penjualan:416 |
| `…/kas.ts` | rekening_toko:46, shift_kasir:72, kas_shift:130, clerical_check:181, hitung_kas:247 |
| `…/koreksi.ts` | retur_penjualan:42, retur_penjualan_detail:111, void_transaksi:172, void_transaksi_detail:236, permintaan_persetujuan:275, kode_persetujuan:347 |
| `…/transaksi-pemasok.ts` | retur_pemasok:28, retur_pemasok_detail:73, penyelesaian_konsinyasi:106, penyelesaian_konsinyasi_detail:152, pembayaran_pemasok:193 |
| `…/armada.ts` (K-150, K-160–K-162) | kendaraan, sopir, perjalanan, catatan_bbm, catatan_servis |
| `…/hasil-pengantaran.ts` (K-149, K-151) | surat_jalan_hasil, surat_jalan_hasil_detail |

---

## Riwayat

- 2026-10-14 — v1: inventaris disusun dari kode di `main` commit `42fe18d` (K-001–K-112).
- 2026-10-14 — v1.1: jawaban pemilik atas pertanyaan 1–7 dicatat (bagian 13); rencana reorder, tablet, ekspor log (bagian 11).
- 2026-10-17 — Layar kasir separuh-separuh dengan panel rincian barang, deret tab membungkus, panduan printer umum (K-114, K-115).
- 2026-10-17 — Rekomendasi pemesanan ulang (F40, bagian 5d, laporan ke-16, notifikasi ke-15; K-113).
- 2026-10-18 — F28 shift diperbarui (tiga cara buka, hitung susulan, koreksi modal, tutup dua langkah, tinjauan, bantuan selisih, penjelasan atasan; K-121); notifikasi ke-16; tabel ke-49 `hitung_kas`; 7 endpoint shift baru.
- 2026-10-18 — F18 order disimpan, kembali ke draf, peringatan draf lain, buka draf otomatis, panel rincian di input cepat (K-122); notifikasi ke-17; 3 endpoint order baru; F28 pilihan order saat tutup shift.
- 2026-10-18 — F28 satu shift toko, hitung susulan dua langkah, order belum selesai + retur/void menunggu saat tutup, kembalian tidak diambil, hitung pecahan −/+; kode atasan bisa dilanjutkan; indikator shift di topbar (K-132–K-142); 6 endpoint baru.
- 2026-10-23 — Diskon manual dihapus, form order lengkap dihapus (Ubah lewat input cepat), istilah "uang shift" (K-146, K-147, K-129).
- 2026-10-23 — F23 diperbarui (Pengiriman aktif, hasil per barang); F41 kendaraan, sopir, perjalanan (K-149–K-151).
- 2026-10-24 — Rekening penerimaan wajib dipilih + No. referensi wajib (K-154), satu shift dijamin database (K-155), Harga dasar dengan kalkulator (K-158), tampilan pas layar dan pengingat diciutkan (K-152–K-157).
- 2026-10-24 — Pencarian universal Ctrl+K (K-167); kebal kiriman ganda (kunci idempoten) dan cek versi data master (K-164).
- 2026-10-24 — Data muatan barang/kendaraan dan pemeriksaan muatan saat berangkat (K-161, docs/13).
- 2026-10-24 — Lampiran B: 57 tabel (armada, hasil pengantaran; `kunci_idempoten` di sistem.ts).
- 2026-10-24 — F17 promo menjadi kampanye (K-163 bagian 1); promo_sasaran di master.ts.
- 2026-10-30 — F10: atribut dimensi ↔ data muatan selaras langsung di form (K-201).
- 2026-10-30 — Umum: pencarian dan saringan daftar diingat; klik menu mengulang (K-202) `[KODE: web/lib/ingat-saring.ts]`.
- 2026-10-30 — F17: batas kelipatan promo per baris (K-194).
- 2026-10-30 — F23/F45: centang muat per surat jalan, ubah rit, satu batas toleransi muatan (K-203).
- 2026-10-30 — F28: kotak Sebelum menutup shift dan matriks dependensi alur (K-197).
- 2026-10-30 — F23: penyelesaian hasil kirim menurut status bayar; Pengembalian uang tunai/transfer (K-192, K-193).
- 2026-10-28 — F15: dasar markup FIFO (K-184).
- 2026-10-28 — F17: promo kombinasi kategori + merk + barang dan beli N potong Rp X (K-185).
- 2026-10-28 — F21: layar kasir pas layar, pindah/gulir panel dengan tombol (K-171).
- 2026-10-28 — F37: menu laporan di atas dan pratinjau per halaman A4 (K-182).
- 2026-10-28 — F48: pemeriksaan data alamat sama dan kelengkapan data (K-183).
- 2026-10-28 — F43: atribut dimensi dan data muatan satu sumber; notifikasi & lencana barang tanpa data muatan (K-169, K-170).
- 2026-10-28 — Info cepat nomor dokumen (K-181) di linimasa kas, dashboard, riwayat, retur, papan.
- 2026-10-28 — F42: nomor antrean, info cepat, warna kartu dibagi, penanda hari ini, saringan Backlog (K-173).
- 2026-10-28 — F23: alasan hasil per barang, kembali mengurangi tagihan, tugas refund transfer, penanda kartu (K-176).
- 2026-10-28 — F54 panduan penyiapan pertama dan contoh data (K-168).
- 2026-10-26 — F53 akun pertama dan lupa password (K-191).
- 2026-10-26 — F52 log interaksi penelitian (K-190).
- 2026-10-26 — F42 surat jalan hanya di dalam rit, keluar/batal rit membatalkan surat jalan, cetak semua saat berangkat; F41 berangkat langsung tanpa rit dihapus (K-174).
- 2026-10-24 — F46 arsip tahunan, F47 pembaruan aman dan versi aplikasi (K-165, K-166).
- 2026-10-24 — F51 order pembelian ke pemasok (K-125); F40 saran pesan memakai sudah dipesan dan lama kirim aktual.
- 2026-10-24 — F50 Hasil Penjualan (K-126).
- 2026-10-24 — F5 log aktivitas: ekspor Excel.
- 2026-10-24 — F40 saran pesan: metode A–D dan simpanan memori (K-127); kolom `barang.stok_maksimum`.
- 2026-10-24 — F49 pengaturan cetak: logo, kepekatan, kertas, cetak otomatis (K-124).
- 2026-10-24 — F48 data bersih (K-137); notifikasi rinci + dashboard Perlu perhatian (K-131); order: F10, saringan Semua, penginput (K-129, K-138, K-139).
- 2026-10-24 — F45 FMS pendukung: BBM, servis, pengingat, statistik armada (K-162).
- 2026-10-24 — F43: isi massal data muatan lewat Excel (K-161 selesai). Lampiran A: endpoint perjalanan, kendaraan,
  sopir, hasil surat jalan, pencarian, dan data muatan ditambahkan.
- 2026-10-24 — F42 papan Pengiriman dan rit rencana (K-160); F43 muatan, F44 pencarian universal, baris kiriman ganda
  di bagian 9 ditulis lengkap; F23 dan F41 disesuaikan.
