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
| 19 | **Cadangan** terenkripsi, retensi berjenjang, uji pulih | ⏳ | Fase 8, modul cadangan (K-084) |
| 20 | **Pembaruan Windows/PostgreSQL/Node** di server toko | ⚠️ | Tanggung jawab operasional: Windows Update otomatis; Node & PostgreSQL diperbarui saat `perbarui-server.ps1` |

## Cara mengulang review

1. `pnpm audit --prod` — harus "No known vulnerabilities found".
2. `pnpm test` — mencakup tes izin (403), kepemilikan objek, CSRF, header, batas ukuran.
3. Cari rute baru tanpa izin: server menolak menyala (guard default).
4. Periksa rute baru yang menerima `:id`: apakah data milik pengguna lain bisa dibaca/diubah?
5. Periksa field baru yang sensitif (harga modal, laba): disaring di API?

## Riwayat

- 2026-10-04 — v1, review Fase 8 (K-083).
