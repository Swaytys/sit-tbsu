# Dokumentasi SIT TBSU

Folder ini adalah **sumber kebenaran** proyek. Claude Code membacanya lewat `CLAUDE.md` di root repo.
Manusia membacanya untuk memahami apa yang dibangun dan mengapa.

Nama repo: `sit-tbsu`. Nama tampil di aplikasi: **BonsaiUrip** (K-044).

## Peta dokumen

| Berkas | Isi | Dibaca saat |
|---|---|---|
| `01-ikhtisar-sistem.md` | Konteks toko, ruang lingkup M1/M2, aktor, peta 10 proses DFD → modul kode, alur bisnis, glosarium | Mulai sesi apa pun, saat ragu istilah |
| `02-arsitektur.md` | Stack dan alasannya, struktur repo, lapisan kode, request lifecycle, error model, tipe uang/qty, testing, env, deploy | Fase 1 setup dan setiap kali membuat modul baru |
| `03-skema-database-v3.md` + `.sql` | 41 tabel: tujuan tiap tabel, kolom penting, constraint, perubahan vs skema FINAL2 laporan KP | Setiap kali menyentuh DB |
| `04-hak-akses.md` | Daftar izin, matriks peran, aturan data sensitif, sesi, login, persetujuan | Setiap route baru, setiap menu baru |
| `05-aturan-bisnis-inti.md` | Ledger stok, reservasi order, HPP rata-rata, penomoran, status dokumen, satuan & konversi | Fase 4–6 |
| `06-harga-piutang-hutang.md` | Tier harga, markup, tinjau harga, diskon, promo, piutang, hutang, retur pemasok, konsinyasi, stok rusak | Fase 3 (tier dasar), Fase 5 (piutang), M2 |
| `07-roadmap.md` | Milestone M1/M2, 12 fase, deliverable dan definisi selesai per fase, status; rencana Fase 13 | Awal setiap fase; diperbarui di akhir fase |
| `08-backlog.md` | Usulan di luar fase: v2.0.0 (produktivitas, peran kustom, keuangan ringan, perbaikan) dan v3.0.0 | Saat ada usulan baru; sebelum merencanakan versi berikut |
| `09-keamanan.md` | Checklist keamanan (OWASP dasar) beserta bukti tiap butir | Setiap rilis dan setiap modul baru |
| `10-ringkasan-keputusan.md` | Ringkasan seluruh keputusan K-001 s.d. K-145: garis waktu, yang berlaku sekarang per topik, keputusan yang diganti, daftar lengkap | Saat ingin gambaran utuh tanpa membaca 29 berkas keputusan |
| `11-riwayat-teknis.md` | Riwayat teknis runtut: kerangka bersama (ledger, izin, penomoran, log, tes) lalu apa yang dibangun di setiap tahap dan bagaimana; ditambah setiap fitur baru (K-118) | Saat perlu memahami cara kerja dan sejarah teknis aplikasi |
| `12-anomali-alur-kerja.md` | Katalog anomali alur kerja per fitur (salah ketik, urutan terbalik, lupa, curang) dengan jawaban atasi, cegah, ajari dan statusnya (K-120) | Sebelum merancang atau mengubah fitur; setiap fitur baru menambah barisnya |
| `UJI-PEMILIK.md` | Daftar hal yang perlu dicoba pemilik (U1, U2, …) dengan langkah, hasil yang diharapkan, dan status | Setiap selesai fitur (baris baru) dan setiap pemilik melapor hasil uji |
| `LAPORAN-FITUR-APLIKASI.md` | Inventaris fitur faktual dengan rujukan `berkas:baris` (peran & hak akses, fitur per modul, rumus bisnis, laporan, jejak data, daftar endpoint dan tabel); bahan Proposal TA | Saat perlu tahu fitur apa yang sudah ada dan di mana kodenya; diperbarui setiap fitur baru |
| `keputusan/` | Log keputusan bernomor K-001, K-002, … beserta alasan dan alternatif yang ditolak | Saat bertanya "kenapa begini?" |
| `panduan/` | Panduan langkah demi langkah untuk pemilik proyek (install, git, alur kerja) | Fase 1 |
| `referensi/` | Laporan KP, diagram, skema lama, mockup Figma Make, screenshot | Saat perlu sumber asli |

## Isi `referensi/` (disalin dari Project Claude.ai, tidak diedit)

```
referensi/
├── laporan-kp/     23430100014-2026-PPKP.txt (teks laporan KP), 9 rancangan laporan (jpeg/txt)
├── diagram/        use case, context diagram, DFD level 0, 10 system flow (jpg), CDM & PDM (jpeg)
├── skema-lama/     skema_database_tbsu_FINAL2.sql (Oracle, 19 tabel)
└── mockup/         hasil ekstrak Mockup_Design_TBSU.zip (Figma Make: React + Tailwind) + 18 screenshot
```

Mockup adalah **referensi tampilan**. Bila mockup dan laporan KP berbeda pada struktur atau logika,
laporan KP yang benar (K-032). Hasil Figma Make dibuat cepat oleh AI dari sebagian snapshot laporan,
jadi ada fitur yang hilang atau ditambah-tambahkan.

## Alur kerja per fitur bersama Claude Code

1. Buka VS Code di folder repo. Buka panel Claude Code (ikon di sidebar).
2. Buat branch: `git checkout -b feat/03-master-barang` (nomor fase + nama fitur).
3. Prompt awal, pakai pola ini:

   > Baca `CLAUDE.md` dan `docs/07-roadmap.md`. Kita mengerjakan **Fase 3, fitur Master Barang**.
   > Baca juga `docs/03-skema-database-v3.md` (tabel `barang`, `kategori`, `satuan`, `jenis_atribut`,
   > `barang_atribut`, `harga_barang`) dan `docs/04-hak-akses.md` (izin `master.barang.*`).
   > Buat **rencana** dulu: file yang akan dibuat/diubah, urutan pengerjaan, cara mengujinya.
   > Jangan mengedit apa pun sebelum saya setujui.

4. Baca rencananya. Setujui, atau koreksi dengan menyebut poin yang salah.
5. Claude mengerjakan. Perhatikan diff di panel. Setiap langkah besar, ia meringkas; kalau tidak, minta.
6. Setelah `pnpm typecheck && pnpm lint && pnpm test` lulus dan fitur dicoba di browser: `git add -A && git commit`.
7. Ragu terhadap sesuatu? Tempel ringkasan atau diff ke chat arsitek (Project Claude.ai) untuk review.
8. Fase selesai: `git checkout main && git merge feat/03-master-barang`, lalu perbarui status di `07-roadmap.md`.

Aturan pengaman yang selalu berlaku: Claude Code tidak mengedit sebelum rencana disetujui, tidak menghapus
file tanpa konfirmasi, dan tidak menjalankan perintah destruktif tanpa konfirmasi. Ini tertulis di `CLAUDE.md`.
Jangan pakai mode auto-accept.

## Aturan perubahan dokumen

- Dokumen bernomor (`01`–`10`) adalah **dokumen hidup**: diubah ketika keputusan berubah. Setiap perubahan
  dicatat di bagian `## Riwayat` di akhir dokumen tersebut (tanggal + ringkasan).
- `keputusan/` bersifat **append-only**: keputusan baru = entri baru (K-nnn berurutan lintas berkas), berkas
  bertanggal `YYYY-MM-DD-<topik>.md`. Keputusan lama tidak diedit; yang dibatalkan dirujuk oleh entri baru
  dengan status "Menggantikan K-nnn". Setiap keputusan baru ikut ditambahkan ke `10-ringkasan-keputusan.md`
  (daftar lengkap, dan bagian "yang berlaku sekarang" bila aturannya berubah).
- Sebelum Claude Code mengubah dokumen mana pun, ia harus menyebutkan perubahannya dan mendapat persetujuan.

## Status dokumen

| Dokumen | Status | Terakhir |
|---|---|---|
| CLAUDE.md | Final v1 | 2026-09-19 |
| 01-ikhtisar-sistem.md | Final v1 (§5.1 alur cepat order → kasir, K-073; laporan Fase 9) | 2026-10-04 |
| 02-arsitektur.md | Final v1 (versi paket dikunci, K-050; + decimal.js, exceljs; layar POS & siaran, K-073; dokumen laporan, K-078; deploy & cadangan, K-082–K-084; model galat & pola bersama, K-100; saluran pesan & struk ESC/POS, K-102–K-105; modul rekening & non-tunai, penyiapan e2e, pekerjaan berkala, K-106–K-111) | 2026-10-12 |
| 03-skema-database-v3 (.md + .sql) | Final v3.19 (.sql = v3.1 migrasi 0000; v3.2–v3.19 lewat migrasi 0001–0022) | 2026-10-18 |
| 04-hak-akses.md | Final v1 (+ izin `master.pelanggan.atur_kredit`, K-059; nilai persediaan, K-081; Tinjau Harga, K-086; menu Fase 10, K-088; persetujuan di tempat, K-099; batas laju, K-100; limit kredit di tempat, K-101; kode sekali pakai, K-102; ubah pelanggan dengan kode, K-107; izin rekening & cek non-tunai, K-111; koreksi modal dengan kode, K-121) | 2026-10-18 |
| 05-aturan-bisnis-inti.md | Final v1 (§16 PENYESUAIAN_UBAH; §14 tukar retur netral, K-079; L6 → H5/H7, K-086; A5 MUSNAH, K-088; V1 setoran, K-089; K9–K11 shift, K-109; K12–K14 rekening & cek non-tunai, P8, K-111; §17 rekomendasi pesan, K-113; K15–K24 shift, K-121; R11–R14 order disimpan, K-122) | 2026-10-18 |
| 06-harga-piutang-hutang.md | Final v1 (H4–H8, H12, D1–D2, PR3–PR7, HT7 dirinci, K-086–K-087; PT5–PT6, HT2–HT3, RP5, SR4, K-088; KS5–KS6, K-089; tier nilai belanja & promo pembeli, K-097–K-099; PR10–PR11 anggaran promo, K-110) | 2026-10-12 |
| 07-roadmap.md | Final v1 (Fase 8 siap uji coba toko; Fase 9–12 selesai, tinjauan pemilik K-092–K-112; Fase 14 aktif dengan lingkup K-120–K-127; Fase 13 belum aktif) | 2026-10-18 |
| 09-keamanan.md | Hidup (checklist OWASP dasar, K-083; review kedua, K-100; review ketiga, K-106–K-111) | 2026-10-12 |
| 08-backlog.md | Hidup (v2.0.0, v3.0.0; temuan tinjauan kode D-K1–D-K12; A12 payment gateway; F8 katalog bergambar) | 2026-10-12 |
| 11-riwayat-teknis.md | Hidup (v1, sampai satu shift toko) | 2026-10-18 |
| 12-anomali-alur-kerja.md | Hidup (v1: shift S1–S21, order O1–O5, penjualan P1–P3) | 2026-10-18 |
| 10-ringkasan-keputusan.md | Hidup (ringkasan K-001 s.d. K-145) | 2026-10-18 |
| UJI-PEMILIK.md | Hidup (U1–U34) | 2026-10-18 |
| LAPORAN-FITUR-APLIKASI.md | Hidup (inventaris fitur dari kode; diperbarui tiap fitur, terakhir shift K-121) | 2026-10-18 |
| keputusan/2026-09-19-keputusan-fondasi.md | Final | 2026-09-19 |
| keputusan/2026-09-19-keputusan-tambahan.md | Final (K-044–K-049) | 2026-09-19 |
| keputusan/2026-09-29-setup-fase-1.md | Final (K-050–K-053) | 2026-09-29 |
| keputusan/2026-09-30-akses-dasar.md | Final (K-054–K-055) | 2026-09-30 |
| keputusan/2026-09-30-data-master.md | Final (K-056–K-065) | 2026-09-30 |
| keputusan/2026-10-01-persediaan.md | Final (K-066–K-069) | 2026-10-02 |
| keputusan/2026-10-02-penjualan.md | Final (K-070–K-074) | 2026-10-03 |
| keputusan/2026-10-03-koreksi.md | Final (K-075–K-077) | 2026-10-03 |
| keputusan/2026-10-04-laporan.md | Final (K-078–K-081) | 2026-10-04 |
| keputusan/2026-10-04-deploy-cadangan.md | Final (K-082–K-085) | 2026-10-04 |
| keputusan/2026-10-04-harga-promo.md | Final (K-086–K-087) | 2026-10-05 |
| keputusan/2026-10-07-hutang-retur-pemasok.md | Final (K-088) | 2026-10-07 |
| keputusan/2026-10-07-konsinyasi.md | Final (K-089) | 2026-10-07 |
| keputusan/2026-10-07-label-katalog.md | Final (K-090) | 2026-10-07 |
| keputusan/2026-10-07-satuan-jual.md | Final (K-091) | 2026-10-07 |
| keputusan/2026-10-08-tinjauan-pemilik.md | Final (K-092–K-093) | 2026-10-08 |
| keputusan/2026-10-09-harga-satuan-cetak.md | Final (K-094) | 2026-10-09 |
| keputusan/2026-10-09-draf-cetak-kemasan.md | Final (K-095–K-096) | 2026-10-09 |
| keputusan/2026-10-10-harga-qty-promo-pembeli.md | Final (K-097) | 2026-10-10 |
| keputusan/2026-10-10-tier-nilai-belanja.md | Final (K-098) | 2026-10-10 |
| keputusan/2026-10-10-persetujuan-ditempat-tier-otomatis.md | Final (K-099) | 2026-10-10 |
| keputusan/2026-10-10-tinjauan-kode.md | Final (K-100) | 2026-10-10 |
| keputusan/2026-10-10-limit-kredit-ditempat.md | Final (K-101; diganti K-102) | 2026-10-10 |
| keputusan/2026-10-11-tinjauan-pemilik.md | Final (K-102–K-105) | 2026-10-11 |
| keputusan/2026-10-12-tinjauan-pemilik.md | Final (K-106–K-112) | 2026-10-12 |
| keputusan/2026-10-14-pendukung-keputusan-tablet.md | Final (K-113) | 2026-10-14 |
| keputusan/2026-10-17-tinjauan-pemilik.md | Final (K-114–K-119) | 2026-10-17 |
| keputusan/2026-10-18-tinjauan-pemilik.md | Final (K-120–K-127) | 2026-10-18 |
| keputusan/2026-10-18-uji-pemilik-lanjutan.md | Final (K-128–K-145) | 2026-10-18 |
| panduan/fase-1-setup-lingkungan.md | Final v1 (Windows 11, drive D) | 2026-09-19 |
| panduan/fase-8-pasang-server.md | Final v1 (server toko Windows, Tailscale, cadangan, pemulihan) | 2026-10-04 |
| panduan/fase-8-uji-coba.md | Final v1 (persiapan, skenario, daftar temuan) | 2026-10-04 |
| panduan/manual-pengguna.md | Final v1 (per peran; + K-106–K-111) | 2026-10-12 |
| panduan/kode-persetujuan-telegram-email.md | Final v1 (bot Telegram, sandi aplikasi Gmail, penjelasan teknis, uji mandiri; K-105) | 2026-10-11 |
| panduan/printer-struk.md | Final v1 (printer thermal Bluetooth/USB, cetak langsung, pemecahan masalah; K-105) | 2026-10-11 |
