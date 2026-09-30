# 07 — Roadmap

Dua milestone. **M1** = ruang lingkup Laporan KP + perbaikan integritas + fitur basic yang murah. **M2** = fitur
operasional toko yang diminta pemilik proyek. Skema database sudah memuat keduanya sejak awal (K-031), sehingga M2
tidak membutuhkan rework M1. Versi rilis: **v1.0.0 (MVP) = akhir M1 (Fase 8)**; M2 = v1.1–v1.4; usulan v2.0.0 dan
v3.0.0 ada di `08-backlog.md` (K-062).

Satu fase = satu atau beberapa branch `feat/<nomor>-<nama>`. Fase berikutnya dimulai setelah definisi selesai fase
sebelumnya terpenuhi dan status di tabel ini diperbarui. Claude Code hanya mengerjakan fase yang berstatus
**Aktif**.

## Status

| Fase | Nama | Status | Selesai |
|---|---|---|---|
| 0 | Fondasi (dokumen) | Selesai | 2026-09-19 |
| 1 | Setup lingkungan | Selesai | 2026-09-29 |
| 2 | Akses dasar | Selesai | 2026-09-30 |
| 3 | Data master | Selesai | 2026-09-30 |
| 4 | Inti persediaan | Belum | — |
| 5 | Penjualan | Belum | — |
| 6 | Koreksi dan kontrol | Belum | — |
| 7 | Laporan dan dashboard | Belum | — |
| 8 | Pengerasan dan deploy (akhir M1) | Belum | — |
| 9 | Harga dan promo | Belum | — |
| 10 | Hutang pemasok, retur pemasok, stok rusak | Belum | — |
| 11 | Konsinyasi | Belum | — |
| 12 | Multi-satuan jual dan label (akhir M2) | Belum | — |

Nilai status: Belum · Aktif · Berjalan (sebagian branch merge) · Selesai · Ditunda.

---

## M1

### Fase 0 — Fondasi
Deliverable: `CLAUDE.md`, `docs/01`–`07`, DDL v3, log keputusan, panduan setup, `docs/referensi/` terisi.
Selesai bila: semua dokumen berstatus Final v1 di `docs/README.md` dan pemilik menyetujui.

### Fase 1 — Setup lingkungan
Tujuan: laptop siap, repo berdiri, satu halaman membaca database.

Deliverable:
- Terpasang di Windows 11: Git (sudah), Node.js LTS, pnpm, PostgreSQL + pgAdmin, VS Code + ekstensi
  (Claude Code, ESLint, Prettier, Tailwind CSS IntelliSense).
- Repo `sit-tbsu` dengan struktur di docs/02 §3, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint, Prettier,
  husky + lint-staged, `.gitignore`, `.env.example`.
- Database `tbsu_dev` dan `tbsu_test`; migrasi `0000_skema_v3.sql`; skema Drizzle sesuai DDL (diverifikasi
  `drizzle-kit check`); seed minimal.
- API: `GET /api/health` (cek DB), `GET /api/satuan` (daftar satuan dari DB).
- Web: Layout kosong dari mockup (sidebar + topbar) dan halaman `/satuan` menampilkan data dari API lewat
  klien Hono RPC + TanStack Query.
- Satu tes service (`satuan.test.ts`) dan satu tes route (`health.test.ts`) lulus terhadap `tbsu_test`.
- Semua skrip di `CLAUDE.md` § Perintah berfungsi.
- Versi paket dikunci dan dicatat sebagai keputusan baru di `docs/keputusan/`.

Selesai bila: `pnpm dev` menampilkan halaman satuan berisi data; `pnpm typecheck && pnpm lint && pnpm test` lulus;
commit pertama di `main`.

Catatan penyelesaian (2026-09-29, branch `feat/01-setup`):
- Versi paket dikunci di `catalog:` `pnpm-workspace.yaml` (K-050). TypeScript 6.0, bukan 7 (lint bertipe belum
  mendukung TS 7).
- Skema Drizzle terbukti identik dengan migrasi 0000 lewat `db:verifikasi` (pg_dump, 1468 baris), karena
  `drizzle-kit check` hanya memeriksa riwayat migrasi (K-052).
- `GET /api/satuan` sementara tanpa izin; wajib diberi `requirePermission` di Fase 2 (K-051).
- Penyimpangan kecil struktur (letak seed, 7 berkas skema, enums.ts lengkap, kode satuan `m2`/`m3`) — K-053.
- Tes: 10 tes Vitest (service satuan + route health) dan 2 tes Playwright lulus; `pnpm build` berhasil.

### Fase 2 — Akses dasar
Tujuan: login aman, hak akses berjalan, kerangka UI final.

Deliverable:
- Modul `auth`: login, logout, sesi (tabel `sesi_login`), idle/absolut timeout, penguncian gagal login, rate limit,
  middleware `auth` dan `requirePermission`, guard default menolak route tanpa izin, CSRF.
- `packages/shared`: `permissions.ts`, `roles.ts` (matriks docs/04), `enums.ts` awal (sudah lengkap sejak Fase 1,
  K-053).
- Pasang `requirePermission` pada `GET /api/satuan` dan tentukan izin baca satuan (K-051).
- Modul `sistem`: `penomoran.ts` (tabel `penghitung_nomor`, FOR UPDATE, format dari konfigurasi), `log-aktivitas.ts`,
  `konfigurasi` (baca/tulis, cache di memori dengan invalidasi).
- Kelola pengguna (Owner): daftar, tambah, ubah, nonaktif, reset password, cabut sesi, aturan Owner terakhir.
- Pengaturan: profil toko, prefix nomor, ambang restock, batas umur order, lebar struk, pembulatan.
- Web: halaman login (tombol masuk cepat hanya dev), `Layout` lengkap dengan menu terfilter izin, halaman pengguna,
  halaman pengaturan, `DataTable` generik, toast, dialog konfirmasi.
- Tes: login sukses/gagal/terkunci; peran tanpa izin → 403; penomoran tidak ganda saat 20 request paralel;
  log tercatat saat ubah pengguna.

Selesai bila: keempat peran bisa login dan melihat menu sesuai docs/04 §4; Owner bisa mengelola pengguna;
tes lulus.

Catatan penyelesaian (2026-09-30, branch `feat/02-akses`, `feat/02-pengguna`, `feat/02-pengaturan`):
- Guard default: server menolak menyala bila ada rute tanpa deklarasi izin; rute milik sendiri memakai
  `requireLogin()`; izin baca satuan = `master.barang.lihat` (K-054).
- Menu docs/04 §4 tampil lengkap per izin; halaman yang belum dibangun menampilkan "sedang disiapkan — Fase N".
- Log aktivitas tampil sebagai tab di Pengaturan (Owner); pengaturan disimpan per bagian (K-055).
- Tes: 82 tes Vitest (login/kunci/rate limit/sesi, izin 403, 50 penomoran paralel, Owner terakhir, log ubah
  pengguna, pengaturan) dan 17 tes Playwright (menu per peran, kelola pengguna, pengaturan) lulus.

### Fase 3 — Data master
Tujuan: semua data induk siap dipakai transaksi.

Deliverable:
- Kategori (tabel), Satuan (jenis dimensi, faktor), Jenis Atribut, halaman gabungan bertab.
- Barang: daftar (cari, filter kategori/status, paginasi server, "atur kolom"), form tambah/ubah (kode otomatis
  `BRG-00001` bisa diubah, barcode opsional, satuan dasar, stok minimum, kepemilikan MILIK_SENDIRI/KONSINYASI +
  pemasok + harga titip), atribut dinamis (tambah baris: jenis atribut, nilai, satuan), gambar (unggah ke folder
  `storage/`), nonaktifkan.
- Harga jual: master tier (seed Normal/Grosir/Distributor), harga tetap per tier per barang di form barang dan di
  halaman Harga Jual (edit massal). Tier non-default awalnya IKUT_TIER dari markup default (K-047); tanda
  perlu tinjau (H5) dipasang sejak Fase 3 (K-056). Halaman Tinjau Harga dan penerapan otomatis Fase 9.
- Pelanggan: daftar, form (tier harga default, term hari, limit kredit disimpan tanpa enforcement), nonaktifkan.
- Pemasok: daftar, form, nonaktifkan.
- Import Excel barang: templat unduh, unggah, pratinjau validasi baris, simpan. Import saldo awal dipindah ke Fase 4.
- Tes: kode unik, nonaktif bukan hapus, Kasir tidak menerima HPP, konversi satuan hanya sesama dimensi,
  atribut dengan satuan dimensi salah ditolak.

Selesai bila: 20 barang contoh bisa diinput lewat form dan lewat import; tampilan mendekati mockup Master Barang,
Pelanggan, Pemasok.

Catatan penyelesaian (2026-09-30, branch `feat/03-referensi`, `feat/03-mitra`, `feat/03-barang`, `feat/03-import`):
- Keputusan pemilik: tanda perlu tinjau harga dipasang sejak Fase 3, No. HP wajib, import hanya menambah barang
  baru (K-056); tier/term/limit kredit pelanggan hanya Admin/Owner lewat izin baru `master.pelanggan.atur_kredit`
  (K-059).
- Barang: kode otomatis/sendiri, atribut sesama dimensi, konsinyasi, gambar, persediaan awal lewat
  `persediaan/ledger.ts`; harga modal awal & satuan dasar dikunci setelah ada mutasi (K-060).
- Harga Jual: edit sel dan simpan massal, kelola tier (tambah/ubah/nonaktif), ekspor Excel. Mengganti tier
  default belum disediakan.
- Import Excel: templat mengikuti tier & atribut aktif; pratinjau = proses simpan yang dibatalkan; simpan
  semua-atau-tidak (K-061).
- Tes: 135 tes Vitest (termasuk Kasir tidak menerima HPP, atribut dimensi salah ditolak, 20 barang lewat import)
  dan 20 tes Playwright lulus.
- Usulan (di luar fase): status stok 4 tingkat di daftar barang ikut Fase 4; pemecahan bundel web (peringatan
  ukuran chunk Vite) di Fase 8.

### Fase 4 — Inti persediaan
Tujuan: ledger stok yang benar, sebelum ada penjualan.

Deliverable:
- `persediaan/ledger.ts`: `catatMutasi()` dengan FOR UPDATE, saldo tidak negatif, HPP rata-rata tertimbang,
  `hpp_setelah` per mutasi, kondisi BAIK (RUSAK dipakai Fase 10).
- Stok: tabel `persediaan` (fisik, dipesan, tersedia, hpp_rata2, harga_beli_terakhir), status 4 tingkat,
  halaman Stok Persediaan (posisi, riwayat mutasi, kartu stok per barang, ekspor).
- Penerimaan barang: form seperti mockup (nomor otomatis `RCV`, pemasok, jenis PEMBELIAN/KONSINYASI, syarat
  TUNAI/TEMPO + jatuh tempo, nomor faktur & surat jalan pemasok, baris barang qty/harga modal/subtotal, catatan),
  riwayat penerimaan, cetak bukti. Tempo → baris hutang tercipta (UI bayar hutang di Fase 10).
- Penyesuaian stok: dokumen `ADJ` jenis SALDO_AWAL / OPNAME / KOREKSI / RUSAK dengan baris stok sistem vs fisik,
  selisih, alasan; lembar hitung opname (cetak), input hasil, simpan.
- Import saldo awal dari Excel (menghasilkan satu dokumen SALDO_AWAL).
- Notifikasi stok minimum di topbar dan dashboard.
- Tes (wajib, sesuai docs/05): saldo tidak negatif; HPP rata-rata benar pada 3 penerimaan berbeda harga;
  konsinyasi tidak mengubah HPP milik sendiri dan tidak masuk nilai persediaan milik toko; dua transaksi paralel
  pada barang yang sama tidak menghasilkan saldo salah; `hpp_setelah` konsisten dengan `persediaan.hpp_rata2`.

Selesai bila: kartu stok sebuah barang setelah saldo awal + 2 penerimaan + 1 opname sama dengan hitungan manual.

### Fase 5 — Penjualan
Tujuan: alur order → checkout → pembayaran → surat jalan berjalan penuh.

Deliverable:
- Order: form (cari barang dengan stok tersedia, qty + satuan dasar, dropdown tier per baris, diskon baris jika
  berizin, jenis, pelanggan, alamat/ongkir/catatan kirim, prioritas), antrean (kartu seperti mockup, filter,
  prioritas, umur), reservasi stok, order basi + daftar stok tertahan, batal, kunci saat DIPROSES.
- Penjualan langsung: layar kasir seperti mockup (F2/Enter/F9, tombol nominal cepat, pelanggan umum atau terdata),
  checkout dari order atau langsung, pembayaran campuran, kembalian, struk thermal, status pengambilan.
- Penjualan pengantaran: checkout dari order pengantaran, invoice A4, pembayaran penuh/DP/saat terima/pelunasan,
  jatuh tempo, halaman detail seperti mockup (info pelanggan, timeline status, barang kiriman, status bayar,
  riwayat bayar), surat jalan (bisa parsial, sopir, kendaraan, waktu status, cetak A4), status agregat.
- Piutang: daftar penjualan belum lunas, jatuh tempo, terlambat, pelunasan dari halaman piutang.
- Tes: reservasi mengurangi tersedia bukan fisik; checkout memotong fisik dan melepas reservasi dalam satu
  transaksi; stok tidak cukup ditolak; snapshot harga jual dan HPP tersimpan; total = Σ subtotal − diskon + ongkir;
  pembayaran > sisa ditolak; status pembayaran cache benar; surat jalan parsial tidak melebihi qty invoice;
  order basi terdeteksi; Staf tidak bisa checkout.

Selesai bila: skenario e2e "Staf membuat order → Kasir checkout → struk" dan "pengantaran DP → dua surat jalan →
pelunasan → lunas" berjalan di browser.

### Fase 6 — Koreksi dan kontrol
Deliverable:
- Retur: cari transaksi, pilih baris/qty, alasan, kondisi, penyelesaian (REFUND/TUKAR_BARANG/POTONG_TAGIHAN),
  pengajuan → persetujuan, dampak stok dan kas sesuai docs/05, riwayat retur.
- Void: daftar transaksi shift terbuka, per item / per transaksi, alasan, pengajuan → persetujuan dari akun
  Admin/Owner, penolakan, riwayat void.
- Shift: buka (modal awal), kas masuk/keluar shift (kasbon, setor, refund otomatis dari retur/void), tutup.
- Clerical check: blind count (uang fisik diinput sebelum angka sistem tampil), selisih, keterangan wajib,
  riwayat, tampilan seperti mockup.
- Tes: retur kondisi RUSAK tidak menambah stok jual; tukar barang menghasilkan mutasi keluar; void di shift
  tertutup ditolak; void penjualan yang sudah dikirim ditolak; Kasir tidak bisa menyetujui; selisih clerical
  dihitung dari sistem, bukan dari input.

Selesai bila: satu hari operasional simulasi (buka shift, 5 penjualan, 1 retur, 1 void, tutup shift) menghasilkan
clerical yang cocok dengan hitungan manual.

### Fase 7 — Laporan dan dashboard
Deliverable: 9 laporan KP + Piutang (layout sesuai `referensi/laporan-kp/`), filter periode, total seluruh
periode, cetak PDF, ekspor Excel, dashboard per peran (kartu, grafik 7 hari, aksi cepat, aktivitas terkini),
notifikasi topbar (order basi, stok minimum, persetujuan menunggu, piutang jatuh tempo).
Tes: angka laporan stok rekap = ledger; gross profit = Σ(harga jual − HPP snapshot) × qty − retur; Kasir tidak
menerima kolom HPP.
Selesai bila: 10 laporan cocok dengan data uji yang dihitung manual.

### Fase 8 — Pengerasan dan deploy
Deliverable: Playwright untuk 5 alur kritis; review keamanan dengan checklist (OWASP dasar: auth, otorisasi per
objek, injeksi, CSRF, header, rate limit, dependensi); backup `pg_dump` terjadwal + uji restore; keputusan deploy
(mini-PC toko vs VPS) + skrip; manual pengguna singkat per peran; uji coba dengan toko (owner + 1 kasir + 1 staf)
dan daftar temuan.
Selesai bila: sistem dipakai untuk transaksi sungguhan minimal satu hari penuh tanpa pemilik proyek turun tangan.

**Cadangan data (wajib, masukan pemilik 2026-09-30, K-062):**
- Isi cadangan: seluruh database (data + semua pengaturan, `pg_dump -Fc` terkompresi), folder `storage/`
  (gambar barang, logo), dan berkas konfigurasi server (terenkripsi).
- Cara simpan seperti git: **snapshot terdeduplikasi dan terenkripsi** (restic). Tiap snapshot tampak utuh, tetapi
  yang benar-benar ditulis hanya bagian yang berubah sejak snapshot sebelumnya, sehingga cadangan harian tidak
  menggembungkan disk.
- Jadwal & retensi berjenjang: harian (malam hari, dan saat server menyala bila jadwal terlewat); disimpan
  7 harian, 4 mingguan, 12 bulanan, 5 tahunan; sisanya dibuang otomatis.
- Tujuan: disk lokal kedua/eksternal **dan** cloud (Google Drive lewat rclone) secara otomatis.
- Pengaturan › Cadangan (Owner): status cadangan terakhir, ukuran, riwayat, tombol "Cadangkan sekarang",
  peringatan di topbar bila cadangan gagal atau terlewat > 1 hari.
- Pemulihan: skrip + panduan; uji pulih otomatis bulanan ke database uji.
- Ekspor portabel (Excel) untuk migrasi ke aplikasi lain: barang sudah ada; pelanggan, pemasok, transaksi menyusul.

---

## M2

### Fase 9 — Harga dan promo
Markup per tier (default tier, override per barang), dasar markup (harga beli terakhir / HPP), pembulatan,
tanda "perlu tinjau harga" saat dasar berubah, halaman Tinjau Harga (massal), opsi otomatis per barang,
saran tier by qty, batas diskon per peran, promo (CRUD, penerapan otomatis di checkout, tercetak di struk),
riwayat harga beli per pemasok. Tes sesuai docs/06.

### Fase 10 — Hutang pemasok, retur pemasok, stok rusak
Halaman hutang (daftar, jatuh tempo, umur), pembayaran ke pemasok, retur ke pemasok (dari stok baik atau rusak,
mengurangi hutang bila belum dibayar), bucket stok rusak (mutasi kondisi, tampilan terpisah, tidak masuk nilai
persediaan), limit kredit pelanggan ditegakkan, umur piutang, laporan hutang.

### Fase 11 — Konsinyasi
Penyelesaian konsinyasi per pemasok per periode (qty terjual × harga titip), pembayaran, retur barang tidak laku,
laporan konsinyasi. Kepemilikan barang dan penerimaan konsinyasi sudah ada sejak Fase 3–4.

### Fase 12 — Multi-satuan jual dan label
Satuan jual per barang dengan faktor, dropdown satuan di order/kasir, harga per satuan jual (default × faktor,
bisa override), cetak label barcode, ekspor katalog harga.

---

## Cara memperbarui dokumen ini

Di akhir fase: ubah status, isi tanggal, tambahkan catatan singkat di bawah fase (apa yang menyimpang dari rencana
dan mengapa). Perubahan lingkup fase = keputusan baru di `docs/keputusan/`.

## Riwayat

- 2026-09-19 — Fase 0 selesai (Batch 1–3 diserahkan); Fase 1 diaktifkan.
- 2026-09-29 — Fase 1 selesai (catatan di bawah Fase 1; K-050–K-053). Fase 2 ditambah tugas K-051.
- 2026-09-30 — Fase 3 diaktifkan; `feat/03-referensi` (kategori, satuan, jenis atribut) di-merge (K-056–K-058).
- 2026-09-30 — `feat/03-mitra` (pelanggan, pemasok) di-merge (K-059).
- 2026-09-30 — `feat/03-barang` (barang, harga jual, tier, gambar) di-merge (K-060).
- 2026-09-30 — `feat/03-import` (import Excel barang, ekspor harga jual) di-merge (K-061). Fase 3 selesai.
- 2026-09-30 — Fase 2 selesai: `feat/02-pengguna` dan `feat/02-pengaturan` di-merge (K-055).
- 2026-09-30 — Fase 2 diaktifkan; branch `feat/02-akses` (login, sesi, izin, penomoran, log, menu) di-merge (K-054).
- 2026-09-19 — v1. Kepemilikan barang dan penerimaan konsinyasi dimasukkan ke M1 (Fase 3–4) karena toko sering
  memakai konsinyasi (K-029).
