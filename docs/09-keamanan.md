# 09 — Checklist Keamanan (OWASP dasar)

Dokumen hidup. Ditinjau ulang setiap rilis dan setiap ada modul baru. Rujukan: OWASP Top 10 (2021) dan
OWASP ASVS level 1, disesuaikan untuk aplikasi internal toko di jaringan lokal + akses Tailscale.

Status: ✅ terpenuhi (ada bukti/tes) · ⚠️ diterima dengan catatan · ⏳ menyusul.

## Review Fase 8 — 4 Oktober 2026

| # | Area | Status | Bukti / catatan |
|---|---|---|---|
| 1 | **Password** disimpan argon2id, tidak pernah dilog/dikembalikan API | ✅ | `modules/auth`, tes auth; respons pengguna tanpa `password_hash` |
| 2 | **Sesi**: token acak, disimpan sebagai hash; cookie `httpOnly`, `SameSite=Lax`, `Secure` di produksi; idle 60 menit, absolut 12 jam; logout/cabut sesi menghapus di server | ✅ | docs/04 §7, tes auth |
| 3 | **Login**: rate limit per IP + penguncian akun setelah gagal berturut-turut, tercatat di log | ✅ | `batasPercobaanLogin`, tes auth. ⚠️ Pesan "akun terkunci" mengungkap username ada — diterima (aplikasi internal) |
| 4 | **Otorisasi per rute**: setiap rute wajib `requirePermission`/`requireLogin`; server menolak menyala bila ada yang lupa | ✅ | guard default K-054, tes 403 per modul |
| 5 | **Otorisasi per objek (IDOR)**: order milik staf, shift milik kasir, notifikasi per izin, laporan per izin | ✅ | tes order (staf → 404 order orang lain), tes shift (kasir → 404 shift kasir lain), tes laporan (Kasir 403) |
| 6 | **Data sensitif** (HPP, nilai persediaan, laba) disaring di API | ✅ | docs/04 §5, tes barang & laporan ("Kasir tidak menerima HPP") |
| 7 | **Injeksi SQL**: semua query lewat Drizzle/parameter terikat | ✅ | Satu-satunya `sql.raw` membangun CHECK constraint dari konstanta enum di skema (bukan input) |
| 8 | **Validasi input**: skema Zod bersama API & web; field tak dikenal dibuang | ✅ | `packages/shared/src/schemas` |
| 9 | **CSRF**: middleware `csrf()` untuk semua POST/PATCH/DELETE; JSON lintas origin tertahan CORS (tidak ada header CORS) | ✅ | tes "POST dari origin lain ditolak"; origin Tailscale diizinkan eksplisit lewat `ORIGIN_TAMBAHAN` |
| 10 | **Header keamanan**: CSP sumber sendiri, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS bila HTTPS | ✅ | `app.ts` (K-083), tes header |
| 11 | **HTTPS** di jaringan toko (CA lokal toko) + pengalih HTTP→HTTPS; akses luar lewat Tailscale (terenkripsi end-to-end) | ✅ | `scripts/server/buat-sertifikat.ps1`, K-082 |
| 12 | **Ukuran permintaan**: JSON ≤ 1 MB; unggah gambar ≤ 2 MB (dicek tanda tangan berkas JPG/PNG/WebP); Excel ≤ 5 MB | ✅ | tes 413; `lib/penyimpanan.ts` |
| 13 | **Berkas unggahan**: nama acak dari server, divalidasi pola sebelum dibaca (tanpa path traversal) | ✅ | `lib/penyimpanan.ts` |
| 14 | **Pesan galat**: klien hanya menerima pesan umum; detail teknis ke log | ✅ | `middleware/error-handler.ts` |
| 15 | **Log aktivitas**: semua aksi mutasi, login gagal, ekspor/cetak laporan | ✅ | docs/05 §16 |
| 16 | **Rahasia**: `.env` & kunci sertifikat tidak di-commit; di server hanya bisa dibaca Administrator/SYSTEM | ✅ | `.gitignore`, `pasang-server.ps1` (icacls) |
| 17 | **Masuk cepat demo** hanya `NODE_ENV=development`, tidak terdaftar di produksi | ✅ | `app.ts`, `RUTE_PUBLIK` |
| 18 | **Dependensi**: `pnpm audit --prod` bersih | ✅ | uuid (lewat exceljs) dipaksa ≥ 11.1.1. ⚠️ `esbuild` lama di rantai `drizzle-kit` hanya alat pengembangan (tidak berjalan di server produksi) |
| 19 | **Cadangan** terenkripsi, retensi berjenjang, uji pulih | ✅ | Modul cadangan (K-084): restic terenkripsi, retensi 7/4/12/5, uji pulih otomatis tiap tanggal 1; status di Pengaturan › Cadangan |
| 20 | **Pembaruan Windows/PostgreSQL/Node** di server toko | ⚠️ | Tanggung jawab operasional: Windows Update otomatis; Node & PostgreSQL diperbarui saat `perbarui-server.ps1` |

## Review kedua — 10 Oktober 2026 (tinjauan kode, K-100)

Seluruh butir review Fase 8 diperiksa ulang terhadap kode saat ini (Fase 9–12 dan K-092–K-099) dan tetap
terpenuhi; butir 19 (cadangan) kini ✅ (modul cadangan K-084: restic terenkripsi, retensi berjenjang, uji pulih
bulanan). Butir baru:

| # | Area | Status | Bukti / catatan |
|---|---|---|---|
| 21 | **Persetujuan di tempat** (password atasan diketik di layar kasir, K-099): diperiksa seperti login, tanpa sesi baru, password tidak disimpan/dilog, kegagalan mengunci akun dan dicatat | ✅ | `auth/service.ts` `verifikasiAtasan`, tes `koreksi/persetujuan.test.ts` |
| 22 | **Batas laju pemeriksaan password** di luar login: persetujuan di tempat 20/menit per pengaju | ✅ | `lib/batas-percobaan.ts`, tes "batas laju per pengaju" (K-100) |
| 23 | **Ketersediaan**: batas waktu pernyataan (60 dtk), kunci (15 dtk), transaksi menganggur (60 dtk); kebuntuan dijawab 409 "coba lagi"; sumber daya habis atau database putus dijawab 503 | ✅ | `db/client.ts`, `middleware/error-handler.ts`, tes `error-handler.test.ts` (K-100) |
| 24 | **Galat fatal** dicatat ke log berkas sebelum proses keluar; koneksi database terputus tidak mematikan server | ✅ | `index.ts`, `db/client.ts` (K-100) |
| 25 | **Pesan galat database** tidak pernah sampai ke klien (nama tabel/constraint hanya di log) | ✅ | tes "aturan database menolak data → 400 tanpa membocorkan detail" |
| 26 | **Tampilan saat galat**: tidak ada jejak kode (stack trace) di layar pengguna | ✅ | `features/umum/halaman-galat.tsx` menggantikan layar galat bawaan React Router |
| 27 | **Penguncian akun bisa dipicu sengaja** oleh orang yang tahu username | ⚠️ | Diterima: tercatat di log dengan IP/sesi pengaju, kunci 15 menit, Owner bisa membuka. docs/08 D-K6 |
| 28 | **Berkas Excel**: batas 5 MB berlaku sebelum dibuka (zip bomb) | ⚠️ | Diterima: unggah hanya Admin/Owner. docs/08 D-K5 |

Alat yang dipakai sekali jalan (tidak ditambahkan sebagai dependensi): `pnpm audit`, `knip` (kode mati),
`madge --circular` (impor melingkar).

## Cara mengulang review

1. `pnpm audit --prod` — harus "No known vulnerabilities found".
2. `pnpm test` — mencakup tes izin (403), kepemilikan objek, CSRF, header, batas ukuran.
3. Cari rute baru tanpa izin: server menolak menyala (guard default).
4. Periksa rute baru yang menerima `:id`: apakah data milik pengguna lain bisa dibaca/diubah?
5. Periksa field baru yang sensitif (harga modal, laba): disaring di API?

## Riwayat

- 2026-10-04 — v1, review Fase 8 (K-083).
- 2026-10-10 — Review kedua setelah Fase 9–12: butir 21–28 (K-100).
