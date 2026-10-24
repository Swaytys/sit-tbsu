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
| 4 | Inti persediaan | Selesai | 2026-10-01 |
| 5 | Penjualan | Selesai | 2026-10-02 |
| 6 | Koreksi dan kontrol | Selesai | 2026-10-03 |
| 7 | Laporan dan dashboard | Selesai | 2026-10-04 |
| 8 | Pengerasan dan deploy (akhir M1) | Siap uji coba toko | — |
| 9 | Harga dan promo | Selesai (menunggu tinjauan pemilik) | 2026-10-05 |
| 10 | Hutang pemasok, retur pemasok, stok rusak | Selesai (menunggu tinjauan pemilik) | 2026-10-07 |
| 11 | Konsinyasi | Selesai (menunggu tinjauan pemilik) | 2026-10-07 |
| 12 | Multi-satuan jual dan label (akhir M2) | Selesai (menunggu tinjauan pemilik) | 2026-10-07 |
| 13 | Aplikasi desktop (versi build) | Belum (lingkup menunggu konfirmasi pemilik) | — |
| 14 | Pendukung keputusan, anomali alur kerja, order pembelian, tablet, ekspor log (dikerjakan sebelum Fase 13; lingkup v1.0.0 menurut K-120–K-127) | Berjalan (rekomendasi pesan 2026-10-17; shift K-121 dan order K-122 selesai 2026-10-18) | — |

Nilai status: Belum · Aktif · Berjalan (sebagian branch merge) · Selesai · Ditunda.

Tinjauan pemilik atas Fase 9–12 berjalan 8–12 Oktober 2026 dan menghasilkan K-092–K-112; ringkasan seluruh
keputusan ada di `10-ringkasan-keputusan.md`.

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

Catatan penyelesaian (2026-10-01, branch `feat/04-ledger`, `feat/04-penerimaan`, `feat/04-penyesuaian`,
`feat/04-stok`):
- Ledger `catatMutasi()` + audit cache `pnpm db:audit` (L1–L11); penerimaan RCV dengan bukti terima (K-066);
  penyesuaian ADJ empat jenis, lembar opname, import saldo awal sebagai draf (K-067); posisi stok, mutasi,
  kartu stok (cetak), ekspor Excel, status stok di Data Barang, notifikasi topbar, kartu peringatan stok di
  beranda (K-068).
- Kriteria selesai dibuktikan tes `stok.test.ts`: saldo awal 10 @10.000 + terima 5 @12.000 + terima 10 @11.000 +
  opname fisik 22 → HPP 10.000 → 10.667 → 10.800, saldo 22, nilai Rp 237.600, sama dengan hitungan manual.
- Tes: 171 tes Vitest (162 API + 9 shared) dan 28 tes Playwright lulus.
- Ditunda ke fase lain: pembayaran TUNAI penerimaan terkait shift (Fase 6), tab stok tertahan (Fase 5),
  MUSNAH dan retur pemasok (Fase 10).
- Revisi 2026-10-02 (`feat/04-revisi`, masukan pemilik): tombol Urungkan setelah hapus baris, konfirmasi sebelum
  meninggalkan form yang belum disimpan, barang di lembar opname dikecualikan dengan alasan alih-alih dihapus
  (K-069, skema v3.3). Modul opname terjadwal dan pemilih barang grafis masuk backlog v2 Sprint E.

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

Catatan penyelesaian (2026-10-02, branch `feat/05-order`, `feat/05-kasir`, `feat/05-pengantaran`,
`feat/05-piutang`):
- Order & antrean dua panel seperti mockup, reservasi lewat `ubahReservasi()` di ledger, kunci kasir, order basi,
  job 15 menit, tab Stok tertahan (K-070). Izin baru `penjualan.order.lepas_paksa`.
- Layar kasir (F2/Enter/F9), checkout dari antrean atau keranjang, pembayaran campuran, struk thermal, belum
  diambil, buka shift (K1 dimajukan dari Fase 6, K-071).
- Invoice pengantaran, surat jalan bertahap dengan linimasa, cetak invoice & surat jalan A4, halaman Piutang,
  notifikasi order basi & piutang, peringatan piutang terlambat (K-072).
- Tes: 190 tes Vitest (181 API + 9 shared; termasuk 8 checkout paralel atas stok 5 → tepat 5 berhasil) dan
  35 tes Playwright lulus, termasuk dua skenario "Selesai bila".
- Ditunda: tutup shift, kas shift, clerical (Fase 6); limit kredit & umur piutang (Fase 10); satuan jual (Fase 12).
- Revisi 2026-10-02 (`feat/05-pos`, masukan pemilik, K-073): alur POS cepat — input order cepat tanpa nama pembeli,
  nomor antrean, papan antrean FIFO berisi barang di layar Penjualan Langsung & Pengantaran (diperbarui langsung
  lewat siaran), seluruh alur kasir/pengantaran/staf dengan keyboard, kasir boleh mengubah isi order saat bayar,
  struk/invoice tercetak otomatis, rekening bawaan transfer/EDC.
- Revisi 2026-10-03 (`feat/05-pos-cetak`, K-074): struk langsung tercetak tanpa jendela print lewat
  `scripts/kasir/buka-kasir.cmd` (Chrome `--kiosk-printing`); invoice pengantaran dicetak bila diminta (P).
  Halaman pintasan, pintasan umum, panduan, dan pengaturan printer → v2.0.0 Sprint F.

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

Catatan penyelesaian (2026-10-03, branch `feat/06-shift`, `feat/06-void`, `feat/06-retur`):
- Shift: kas masuk/keluar (kasbon, setor/tarik owner, lain-lain), tutup shift blind count dengan keterangan selisih
  wajib, clerical check, riwayat; Admin/Owner bisa menutup shift kasir lain; bayar pemasok tunai keluar dari laci
  (K-075).
- Void per item/transaksi dengan persetujuan, stok kembali, refund dari laci penyetuju, surat jalan belum berangkat
  dibatalkan (K-076). Retur REFUND/TUKAR_BARANG/POTONG_TAGIHAN dengan kondisi barang, batas nilai, dan persetujuan
  (K-077). Notifikasi VOID_MENUNGGU dan RETUR_MENUNGGU.
- Skenario "Selesai bila" diuji otomatis di `apps/api/src/modules/koreksi/retur.test.ts` (modal 100.000, 5 penjualan,
  1 retur, 1 void, tutup shift → selisih 0). Playwright: shift, void, retur.

### Fase 7 — Laporan dan dashboard
Deliverable: 9 laporan KP + Piutang (layout sesuai `referensi/laporan-kp/`), filter periode, total seluruh
periode, cetak PDF, ekspor Excel, dashboard per peran (kartu, grafik 7 hari, aksi cepat, aktivitas terkini),
notifikasi topbar (order basi, stok minimum, persetujuan menunggu, piutang jatuh tempo).
Tes: angka laporan stok rekap = ledger; gross profit = Σ(harga jual − HPP snapshot) × qty − retur; Kasir tidak
menerima kolom HPP.
Selesai bila: 10 laporan cocok dengan data uji yang dihitung manual.

Catatan penyelesaian (2026-10-04, branch `feat/07-laporan`):
- 10 laporan (stok rekap, kartu stok, stok minimum, nilai persediaan, penjualan per periode, produk terlaris,
  detail invoice, retur penjualan, gross profit, piutang) disusun API sebagai dokumen formal bergaya laporan
  keuangan — kop, periode, ikhtisar, rincian, catatan, tanda tangan — yang sama untuk layar, cetak/PDF, dan
  Excel (K-078, arahan pemilik). Tafsiran angka K-079; izin K-081.
- Dashboard per peran: kartu ringkasan, grafik penjualan bersih 7 hari, pengingat persetujuan, aksi cepat,
  aktivitas terkini (K-080). Notifikasi topbar sudah lengkap sejak Fase 5–6.
- Tes: `apps/api/src/modules/laporan/laporan.test.ts` — data uji dua hari (saldo awal, penerimaan, 5 penjualan
  termasuk diskon/ongkir/DP, void sebagian & penuh, retur refund/potong tagihan/tukar) dihitung manual dan
  dicocokkan untuk ke-10 laporan; stok rekap = ledger; gross profit = Σ (harga jual − HPP snapshot) × qty − retur;
  Kasir ditolak untuk laporan persediaan/laba dan tidak menerima HPP. Playwright: laporan & dashboard.
- Usulan di luar fase dicatat di docs/08 (Sprint D).

### Fase 8 — Pengerasan dan deploy
Deliverable: Playwright untuk 5 alur kritis; review keamanan dengan checklist (OWASP dasar: auth, otorisasi per
objek, injeksi, CSRF, header, rate limit, dependensi); backup `pg_dump` terjadwal + uji restore; keputusan deploy
(mini-PC toko vs VPS) + skrip; manual pengguna singkat per peran; uji coba dengan toko (owner + 1 kasir + 1 staf)
dan daftar temuan. Komputer kasir dibuka lewat `scripts/kasir/buka-kasir.cmd` (cetak senyap `--kiosk-printing`,
printer bawaan = printer struk; K-073, K-074).
Selesai bila: sistem dipakai untuk transaksi sungguhan minimal satu hari penuh tanpa pemilik proyek turun tangan.

Catatan pengerjaan (2026-10-04, branch `feat/08-produksi`, `feat/08-keamanan`, `feat/08-cadangan`,
`feat/08-uji-kritis`):
- Deploy diputuskan pemilik: komputer Windows di toko + akses luar Tailscale (K-082). Mode produksi satu port
  (API + web), HTTPS dengan CA lokal toko, skrip pasang/jalankan/perbarui/pulihkan di `scripts/server/`.
- Review keamanan OWASP dasar: `docs/09-keamanan.md` (K-083) — header keamanan, batas body, CSRF, audit
  dependensi bersih.
- Cadangan restic terenkripsi lokal + Google Drive, retensi 7/4/12/5, uji pulih bulanan, Pengaturan › Cadangan,
  peringatan di lonceng, pemulihan darurat (K-084). Diuji dengan restic & pg_dump sungguhan.
- 5 alur kritis Playwright bertanda `@kritis` (`pnpm test:e2e:kritis`): akses & ganti password, order → kasir,
  pengantaran DP → surat jalan → pelunasan, penerimaan barang, shift & clerical (K-085).
- Manual pengguna per peran (`docs/panduan/manual-pengguna.md`), panduan pasang server, daftar periksa uji coba
  (`docs/panduan/fase-8-uji-coba.md`).
- Tersisa (oleh pemilik): pasang di komputer toko, uji coba satu hari penuh, catat temuan → "Selesai bila".

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

Catatan pengerjaan (2026-10-04/05, branch `feat/09-harga`, `feat/09-promo`):
- Keputusan pemilik: barang baru tidak berharga otomatis; harga Normal tetap harga tetap dan hanya diusulkan di
  Tinjau Harga; harga otomatis naik langsung, turun ditinjau; promo tidak untuk harga manual; promo di bawah
  modal untuk Kasir diganti promo aman berikutnya; belum perlu promo cuci gudang (K-086, K-087).
- Harga: metode markup per barang, simpan manual menghitung ulang semua baris markup, pemicu dibandingkan dari
  dasar `D`, harga otomatis, tab Tinjau Harga (terapkan/abaikan, usulan Normal opsional), margin untuk
  Admin/Owner, tier diaktifkan kembali dihitung ulang, pengaturan dasar/pembulatan memicu tinjau (K-086).
- Promo: menu Promo (kode PRM, aturan terkunci setelah terpakai), evaluasi di order dan ulang saat checkout,
  pratinjau harga di kasir/order (total dari API), lepas promo per baris (tombol P), struk/invoice mencetak
  promo, saran tier menurut qty, izin diskon diuji hanya untuk nilai yang diubah (K-087). Migrasi 0005.
- Laporan baru: Promo (Penjualan) dan Riwayat Harga Beli (Persediaan, butuh `laporan.laba`); Detail Invoice
  mendapat kolom Promo.
- Tes: harga.test.ts (17), promo.test.ts (11), laporan-fase9.test.ts (2), tes unit pembulatan; E2E Tinjau
  Harga (barang.spec) dan promo.spec; 5 alur kritis tetap lulus.
- Usulan (di luar fase): input diskon baris dalam persen di layar kasir; tombol "terapkan semua hasil saringan"
  di Tinjau Harga bila barang bertanda sangat banyak.

### Fase 10 — Hutang pemasok, retur pemasok, stok rusak
Halaman hutang (daftar, jatuh tempo, umur), pembayaran ke pemasok, retur ke pemasok (dari stok baik atau rusak,
mengurangi hutang bila belum dibayar), bucket stok rusak (mutasi kondisi, tampilan terpisah, tidak masuk nilai
persediaan), limit kredit pelanggan ditegakkan, umur piutang, laporan hutang.

Catatan penyelesaian (2026-10-07, branch `feat/10-hutang`, K-088):
- Hutang Pemasok (`/hutang`): ringkasan, umur hutang, saringan pemasok, riwayat dan dialog bayar (TUNAI dari laci
  shift / TRANSFER dengan rekening), notifikasi hutang terlambat dan H-3.
- Retur ke Pemasok (`/retur-pemasok`): RTP empat penyelesaian (potong hutang, ganti barang dengan RCV pengganti
  dibayar kompensasi, uang kembali tunai/transfer, pengembalian titipan), peringatan RP1, nota retur A4.
- Stok rusak: tab di Stok Persediaan, pemusnahan (penyesuaian MUSNAH), nilai barang rusak sebagai informasi di
  laporan Nilai Persediaan.
- Limit kredit di checkout (dialog persetujuan Admin/Owner di layar kasir), umur piutang di laporan Piutang,
  Laporan Hutang Usaha.
- Tes: hutang.test.ts (hutang, laporan, retur RP1–RP7, MUSNAH, limit kredit) dan e2e `hutang.spec.ts`.

### Fase 11 — Konsinyasi
Penyelesaian konsinyasi per pemasok per periode (qty terjual × harga titip), pembayaran, retur barang tidak laku,
laporan konsinyasi. Kepemilikan barang dan penerimaan konsinyasi sudah ada sejak Fase 3–4.

Catatan penyelesaian (2026-10-07, branch `feat/11-konsinyasi`, K-089):
- Halaman Konsinyasi: posisi per pemasok, buat setoran dengan pratinjau, riwayat, detail + bayar + nota setoran A4.
- Setoran KSG per barang per harga titip, retur baik dikurangkan, koreksi retur atas baris yang sudah disetor
  pada setoran berikutnya (ditunda bila belum cukup), void baris yang sudah disetor ditolak.
- Migrasi 0006 (penanda retur, unique detail per harga titip); Laporan Konsinyasi.
- Retur barang titipan tidak laku memakai Retur ke Pemasok › Pengembalian titipan (Fase 10).
- Tes: `konsinyasi.test.ts` dan e2e `konsinyasi.spec.ts`.

### Fase 12 — Multi-satuan jual dan label
Satuan jual per barang dengan faktor, dropdown satuan di order/kasir, harga per satuan jual (default × faktor,
bisa override), cetak label barcode, ekspor katalog harga.

Catatan bagian 1 (2026-10-07, branch `feat/12-label`, K-090): cetak label barcode Code 128 (Data Barang › Cetak
label, dua ukuran kertas label A4) dan laporan Daftar Harga (katalog per tier, cetak/Excel).

Catatan bagian 2 (2026-10-07, branch `feat/12-satuan-jual`, K-091): satuan jual per barang di form barang (faktor,
barcode, bawaan, harga tetap per tier atau otomatis), satuan per baris di layar kasir (tombol S, pindai barcode
dus), form order dan input order cepat; checkout, struk, invoice, surat jalan, retur, dan laporan memakai satuan
baris; stok/HPP/laba memakai qty dasar. Tes `satuan-jual.test.ts` dan e2e `satuan-jual.spec.ts`.

---

## Sesudah M2

### Fase 14 — Pendukung keputusan, anomali alur kerja, order pembelian, tablet, ekspor log (K-113, K-120–K-127)

**Status: aktif, dikerjakan sebelum Fase 13.** Pemilik menetapkan butir 3–9 masuk v1.0.0 (tinjauan 18 Oktober).
Setiap butir menjawab anomalinya (atasi, cegah, ajari; K-120) dan menambah barisnya di docs/12. Urutan dan
definisi selesai:

1. **Rekomendasi pemesanan ulang** (rumus di K-113 butir 1): kolom lama kirim dan jarak belanja per pemasok
   (migrasi baru), pengaturan periode/hari pengaman/bawaan, tab *Saran Pesan* di Stok Persediaan, laporan
   *Rekomendasi Pemesanan Ulang* (layar, cetak, Excel), notifikasi untuk Admin/Owner. Aturan bisnis baru di
   docs/05 dengan tes service per aturan. **Selesai 2026-10-17.**
2. **Shift & clerical check anti-anomali** (K-121): tiga cara buka, hitung susulan, koreksi modal dengan kode
   atasan, tutup dua langkah, toleransi, uang ditinggal, tinjauan, bantuan selisih, penjelasan atasan (docs/05
   K15–K24). **Selesai 2026-10-18.**
3. **Order penjualan** (K-122): order disimpan (tahan stok), kembali ke draf, buka draf otomatis, peringatan barang
   di draf lain, panel rincian di Order Penjualan; pilihan per order saat tutup shift (K-121 butir 9).
   **Selesai 2026-10-18** (docs/05 R11–R14, migrasi 0021).
3a. **Perbaikan uji pemilik 18 Okt** (K-128–K-145, `keputusan/2026-10-18-uji-pemilik-lanjutan.md`):
   (i) perbaikan cepat dan **satu shift toko** (K-132–K-136, K-140–K-142) — **selesai 2026-10-18**;
   (ii) pemberitahuan tidak mengagetkan dan hot page pas layar (K-129, K-130, K-131, K-138, K-139, K-143);
   (iii) data bersih (K-137; K-144 diganti K-146); (iv) pengaturan hotkey (K-145) setelah butir lain.
3b. **Tinjauan pemilik 23 Okt** (K-146–K-151, `keputusan/2026-10-23-pengantaran-fms.md`): diskon manual dihapus,
   istilah uang shift, koreksi modal saat hitung susulan — **selesai 2026-10-23**; hasil pengantaran per barang,
   kendaraan & sopir, perjalanan (migrasi 0023) — **selesai 2026-10-23**.
3c. **Hasil uji 23 Okt** (K-152–K-167, `keputusan/2026-10-24-masukan-uji-dan-fms-lanjutan.md`): perbaikan tampilan,
   rekening wajib, satu shift dijamin database, pengingat diciutkan, harga dasar, cadangan (K-152–K-159) — **selesai
   2026-10-24**; K-164 dan K-167 **selesai 2026-10-24**; K-161 bagian 1 (data dan pemeriksaan muatan) dan K-160
   (papan Pengiriman, rit rencana, migrasi 0027) **selesai 2026-10-24**; sisa K-161 (isi massal Excel) **selesai
   2026-10-24**; K-162 (BBM, servis, pengingat STNK/KIR, statistik armada, migrasi 0028) **selesai 2026-10-24**;
   K-163 bagian 1 (kampanye promo, migrasi 0029–0030) **selesai 2026-10-24**; K-165 arsip tahunan dan K-166 pembaruan aman
   (migrasi 0031) **selesai 2026-10-24**; sisa gelombang 3–4 (K-129, K-130, K-131, K-137,
   K-138, K-139, K-143) **selesai 2026-10-24**; berikutnya K-123 dst. dan K-163 bagian 2 (voucher, kupon).
4. **Pencarian dan tampilan** (K-123): atribut dicocokkan sebagian, label keterjualan, angka stok merah tebal,
   teks kecil penting lebih jelas, panel rincian dengan tombol tutup dan info penjualan.
5. **Cetak** (K-124): logo dan kepekatan struk, setelan dokumen A4 tersimpan (invoice/surat jalan lanskap),
   cetak otomatis per jenis dokumen, panduan cetak A4 tanpa jendela.
6. **Metode rekomendasi pesan** (K-127): metode statistik Z, min–maks, tren; cache memori; "?" kelebihan dan
   kekurangan.
7. **Hasil Penjualan** (K-126).
8. **Order pembelian ke pemasok** (K-125): riset alur umum dan rancangan diajukan ke pemilik dulu; lead time aktual
   mengisi rekomendasi pesan.
9. **Tampilan tablet** untuk layar staf penjualan (K-113 butir 3), dengan tes Playwright pada 1280×800 dan
   800×1280.
10. **Ekspor log aktivitas ke Excel** (Owner).

Selesai bila: `pnpm typecheck && pnpm lint && pnpm test` lulus, tes e2e baru dan lama lulus, docs/03–06,
manual pengguna, dan `LAPORAN-FITUR-APLIKASI.md` diperbarui.

### Fase 13 — Aplikasi desktop (versi build)

**Status: belum aktif.** Rencana awal sudah dipaparkan kepada pemilik (aplikasi desktop yang membungkus aplikasi
web beserta databasenya, cadangan berkala, tutorial awal, manual pengguna). Lingkup dan urutan sub-fasenya
diputuskan bersama pemilik sebelum fase ini diaktifkan dan dicatat sebagai keputusan baru, karena mengubah
sebagian K-001 (bentuk aplikasi: web).

Syarat yang **sudah tercatat** dari keputusan sebelumnya dan wajib masuk rencana fase ini:

- **13.1 Cetak.** Pengaturan *printer per jenis dokumen* (struk, label, invoice/surat jalan, laporan) dan cetak
  tanpa jendela cetak untuk semuanya (K-112). Printer dipilih menurut namanya, bukan nomor port (K-105).
  Penyusun perintah ESC/POS dari K-103 dipakai ulang.
- Cookie sesi pada `http://localhost` diuji di pembungkus desktop yang dipakai (docs/08 D-K4).
- Kebutuhan memori komputer ditulis di panduan pasang: minimal 8 GB, disarankan 16 GB (docs/08 D-K9).
- **13.4 Tutorial awal** disusun bersama tombol "?" tiap halaman (docs/08 F7) dan mengikuti aturan menulis
  petunjuk K-105 butir 1.

---

## Cara memperbarui dokumen ini

Di akhir fase: ubah status, isi tanggal, tambahkan catatan singkat di bawah fase (apa yang menyimpang dari rencana
dan mengapa). Perubahan lingkup fase = keputusan baru di `docs/keputusan/`.

## Riwayat

- 2026-10-24 — Fase 14 butir 3c(perbaikan) selesai: K-152–K-159 (migrasi 0024).
- 2026-10-23 — Fase 14 butir 3b selesai: diskon manual dihapus, istilah uang shift (K-146–K-148); hasil pengantaran per barang, kendaraan & sopir, perjalanan (K-149–K-151, migrasi 0023).
- 2026-10-18 — Fase 14 butir 3a(i) selesai: satu shift toko, hitung susulan dua langkah, kembalian tidak diambil, kode atasan dilanjutkan (K-132–K-142, migrasi 0022).
- 2026-10-18 — Fase 14 butir 3 selesai: order disimpan, kembali ke draf, peringatan draf lain (K-122, docs/05 R11–R14, migrasi 0021).
- 2026-10-18 — Fase 14 diperluas dengan lingkup v1.0.0 dari tinjauan pemilik 18 Okt (K-120–K-127); butir 2 shift anti-anomali selesai (K-121, docs/05 K15–K24, migrasi 0020).
- 2026-10-17 — Fase 14 bagian 1 selesai: rekomendasi pemesanan ulang (K-113, docs/05 §17). Tinjauan pemilik 17 Okt: K-114–K-119.
- 2026-10-14 — Fase 14 ditambahkan dan diaktifkan: rekomendasi pemesanan ulang, tablet, ekspor log (K-113).
- 2026-10-12 — Tinjauan pemilik gelombang 1: data akun lama dibuang saat login, judul halaman dan form
  dirapikan, keterangan tier menonjol, pohon laporan, retur, bayar campuran, "Mulai dari awal" (K-106).
- 2026-10-12 — Gelombang 2: posisi kredit di Data Pelanggan, ubah/nonaktif pelanggan oleh Kasir/Staf dengan
  kode atasan (K-107); cari barang lewat atribut dan kategori, tombol Daftar, foto kecil (K-108).
- 2026-10-12 — Gelombang 3: shift terlewat mengunci, jadwal shift, pengingat (K-109); promo di Pengaturan
  dengan anggaran dan batas per pembeli (K-110); rekening toko, QRIS, cek uang non-tunai (K-111); printer per
  jenis dokumen dicatat sebagai syarat Fase 13.1 (K-112). Bagian "Sesudah M2" ditambahkan.
- 2026-10-12 — `10-ringkasan-keputusan.md` dibuat (ringkasan K-001 s.d. K-112).
- 2026-09-19 — Fase 0 selesai (Batch 1–3 diserahkan); Fase 1 diaktifkan.
- 2026-09-29 — Fase 1 selesai (catatan di bawah Fase 1; K-050–K-053). Fase 2 ditambah tugas K-051.
- 2026-09-30 — Fase 3 diaktifkan; `feat/03-referensi` (kategori, satuan, jenis atribut) di-merge (K-056–K-058).
- 2026-09-30 — `feat/03-mitra` (pelanggan, pemasok) di-merge (K-059).
- 2026-09-30 — `feat/03-barang` (barang, harga jual, tier, gambar) di-merge (K-060).
- 2026-09-30 — `feat/03-import` (import Excel barang, ekspor harga jual) di-merge (K-061). Fase 3 selesai.
- 2026-09-30 — Fase 2 selesai: `feat/02-pengguna` dan `feat/02-pengaturan` di-merge (K-055).
- 2026-09-30 — Fase 2 diaktifkan; branch `feat/02-akses` (login, sesi, izin, penomoran, log, menu) di-merge (K-054).
- 2026-10-07 — Fase 10 selesai di branch `feat/10-hutang` (K-088), menunggu tinjauan pemilik.
- 2026-10-07 — Fase 11 selesai di branch `feat/11-konsinyasi` (K-089), menunggu tinjauan pemilik.
- 2026-10-07 — Fase 12 bagian 1 (label barcode, Daftar Harga) di branch `feat/12-label` (K-090).
- 2026-10-07 — Fase 12 selesai (satuan jual, K-091) di branch `feat/12-satuan-jual`, menunggu tinjauan pemilik.
- 2026-10-08 — Revisi dari tinjauan pemilik atas Fase 9–12 (K-092, K-093).
- 2026-10-09 — Revisi lanjutan: harga otomatis bawaan, tier otomatis per qty, kemasan, struk thermal, versi
  titipan (K-094).
- 2026-10-09 — Revisi lanjutan 2: draf order otomatis, pilihan cetak struk, beberapa satuan per barang, modal
  belum diketahui, pesan qty, hasil cari beratribut, pilihan saringan Data Barang (K-095).
- 2026-10-09 — Tombol "Simpan draf & order baru" dan tombol qty ±1 di baris barang (K-096).
- 2026-10-10 — Harga jual hanya menurut qty; harga khusus pembeli lewat promo (golongan, pelanggan tertentu,
  syarat belanja); tier qty dan promo tidak digabung (K-097).
- 2026-10-10 — Tier harga menurut total nilai belanja transaksi untuk semua barang; promo dipotong dari harga
  tier; kotak "Cara kerja" di Harga Jual, Kelola tier, dan Promo (K-098).
- 2026-10-10 — Persetujuan retur/void di tempat dan batas tanpa persetujuan, batalkan pengajuan, sisa retur
  per baris; tier selalu otomatis; menu baris kasir, catatan order di kasir, pindah layar Alt+1/2/3 (K-099).
- 2026-10-10 — Tinjauan menyeluruh kualitas kode di branch `chore/tinjauan-kode`: pengerasan (galat database,
  batas waktu koneksi, batas laju persetujuan, halaman galat) dan satu sumber untuk pola berulang; tanpa
  perubahan aturan bisnis (K-100).
- 2026-10-10 — Melampaui limit kredit pelanggan dengan persetujuan atasan di layar kasir (K-101).
- 2026-10-11 — Tinjauan pemilik: persetujuan dengan kode sekali pakai lewat Telegram/email (K-102); struk
  langsung ke printer thermal ESC/POS dan tab Struk & printer (K-103); pengantaran tanpa order, pelanggan
  bisa diklik, cara bayar tegas, limit kredit bawaan, cetakan tanpa notifikasi (K-104).
- 2026-10-11 — Perbaikan dari uji pemilik atas K-102/K-103: penyiapan saluran kode dan printer struk menjadi
  langkah terpandu, uji kirim per saluran yang selalu sungguhan, struk potret dan lebih tebal, panduan rinci
  dan skrip uji mandiri (K-105).
- 2026-09-19 — v1. Kepemilikan barang dan penerimaan konsinyasi dimasukkan ke M1 (Fase 3–4) karena toko sering
  memakai konsinyasi (K-029).
