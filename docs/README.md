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
| `07-roadmap.md` | Milestone M1/M2, 12 fase, deliverable dan definisi selesai per fase, status | Awal setiap fase; diperbarui di akhir fase |
| `08-backlog.md` | Usulan di luar fase: v2.0.0 (produktivitas, peran kustom, keuangan ringan, perbaikan) dan v3.0.0 | Saat ada usulan baru; sebelum merencanakan versi berikut |
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

- Dokumen bernomor (`01`–`07`) adalah **dokumen hidup**: diubah ketika keputusan berubah. Setiap perubahan
  dicatat di bagian `## Riwayat` di akhir dokumen tersebut (tanggal + ringkasan).
- `keputusan/` bersifat **append-only**: keputusan baru = entri baru (K-nnn berurutan lintas berkas), berkas
  bertanggal `YYYY-MM-DD-<topik>.md`. Keputusan lama tidak diedit; yang dibatalkan dirujuk oleh entri baru
  dengan status "Menggantikan K-nnn".
- Sebelum Claude Code mengubah dokumen mana pun, ia harus menyebutkan perubahannya dan mendapat persetujuan.

## Status dokumen

| Dokumen | Status | Terakhir |
|---|---|---|
| CLAUDE.md | Final v1 | 2026-09-19 |
| 01-ikhtisar-sistem.md | Final v1 (§5.1 alur cepat order → kasir, K-073) | 2026-10-02 |
| 02-arsitektur.md | Final v1 (versi paket dikunci, K-050; + decimal.js, exceljs; layar POS & siaran, K-073) | 2026-10-02 |
| 03-skema-database-v3 (.md + .sql) | Final v3.3 (.sql = v3.1 migrasi 0000; v3.2–v3.3 lewat migrasi 0001–0003) | 2026-10-02 |
| 04-hak-akses.md | Final v1 (+ izin `master.pelanggan.atur_kredit`, K-059) | 2026-09-30 |
| 05-aturan-bisnis-inti.md | Final v1 (§16 PENYESUAIAN_UBAH) | 2026-10-01 |
| 06-harga-piutang-hutang.md | Final v1 | 2026-09-19 |
| 07-roadmap.md | Final v1 (Fase 5 selesai; rencana cadangan Fase 8) | 2026-10-02 |
| 08-backlog.md | Hidup (v2.0.0, v3.0.0) | 2026-09-30 |
| keputusan/2026-09-19-keputusan-fondasi.md | Final | 2026-09-19 |
| keputusan/2026-09-19-keputusan-tambahan.md | Final (K-044–K-049) | 2026-09-19 |
| keputusan/2026-09-29-setup-fase-1.md | Final (K-050–K-053) | 2026-09-29 |
| keputusan/2026-09-30-akses-dasar.md | Final (K-054–K-055) | 2026-09-30 |
| keputusan/2026-09-30-data-master.md | Final (K-056–K-065) | 2026-09-30 |
| keputusan/2026-10-01-persediaan.md | Final (K-066–K-069) | 2026-10-02 |
| keputusan/2026-10-02-penjualan.md | Final (K-070–K-074) | 2026-10-03 |
| panduan/fase-1-setup-lingkungan.md | Final v1 (Windows 11, drive D) | 2026-09-19 |
