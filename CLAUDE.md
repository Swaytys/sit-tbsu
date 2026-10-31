# SIT TBSU — Sistem Informasi Terintegrasi UD. Sumber Urip

Aplikasi web internal (bukan e-commerce) untuk penjualan dan persediaan toko bahan bangunan
UD. Sumber Urip, Peterongan, Jombang. Dipakai oleh 4 peran: Staf Penjualan, Kasir, Admin, Owner.

Bahasa komunikasi dengan pemilik proyek: **Bahasa Indonesia**.
Istilah domain di kode: Bahasa Indonesia (`barang`, `penjualan`). Istilah teknis: Inggris (`service`, `handler`).

## Baca dulu (wajib, setiap sesi)

`docs/` adalah sumber kebenaran. Baca `docs/README.md`, lalu dokumen yang relevan dengan tugas:

| Butuh tahu | Baca |
|---|---|
| Alur bisnis, aktor, istilah, peta proses → modul | `docs/01-ikhtisar-sistem.md` |
| Stack, struktur repo, lapisan kode, konvensi teknis | `docs/02-arsitektur.md` |
| Tabel, kolom, constraint | `docs/03-skema-database-v3.md` + `docs/03-skema-database-v3.sql` |
| Izin, peran, data sensitif, sesi | `docs/04-hak-akses.md` |
| Stok, reservasi, HPP, penomoran, status dokumen | `docs/05-aturan-bisnis-inti.md` |
| Tier harga, markup, diskon, promo, piutang, hutang, konsinyasi | `docs/06-harga-piutang-hutang.md` |
| Urutan fase dan definisi selesai | `docs/07-roadmap.md` |
| Mengapa sesuatu diputuskan | `docs/keputusan/` |
| Laporan KP, diagram, skema lama, mockup Figma | `docs/referensi/` |

Jika kode dan dokumen bertentangan, atau spesifikasi terasa salah: **berhenti, tulis alasannya, tanyakan**.
Jangan menebak dan jangan "memperbaiki" spesifikasi diam-diam.

## Cara kerja dengan pemilik proyek

Pemilik proyek paham algoritma dan alur bisnis, tetapi bukan programmer dan sedang belajar. Karena itu:

1. Untuk tugas yang menyentuh lebih dari satu file: tulis **rencana singkat** (file yang disentuh, apa yang berubah,
   cara mengujinya), lalu **tunggu persetujuan** sebelum mengedit apa pun.
2. Jangan pernah menghapus, menimpa, atau mengganti nama file yang sudah ada tanpa menunjukkan apa yang berubah
   dan mendapat konfirmasi.
3. Jangan menyentuh file di luar folder repo ini.
4. Setelah setiap langkah besar: ringkas apa yang dikerjakan, hasil tes, dan langkah berikutnya, dalam 3–6 kalimat
   Bahasa Indonesia tanpa jargon berlebihan.
5. Di akhir tugas: daftar semua file yang dibuat/diubah beserta lokasinya.
6. Saat konsep teknis baru pertama kali muncul (misal migrasi, middleware, row lock), jelaskan dalam satu paragraf.
7. Satu fitur per branch: `feat/<nomor-fase>-<nama>`, contoh `feat/03-master-barang`. Commit kecil dan sering.
   Format pesan commit: `feat(barang): tambah form tambah barang` (tipe Conventional Commits, deskripsi Indonesia).
8. Kerjakan hanya fase yang sedang aktif di `docs/07-roadmap.md`. Fitur di luar fase, sekecil apa pun,
   dicatat sebagai usulan, bukan dikerjakan.

## Perintah

Skrip di bawah dibuat pada Fase 1 dan harus tetap bernama begini:

```
pnpm install          # pasang dependency
pnpm dev              # api (port 3000) + web (port 5173) bersamaan
pnpm build            # build produksi semua paket
pnpm typecheck        # tsc --noEmit semua paket
pnpm lint             # eslint semua paket
pnpm test             # vitest (unit + service dengan DB uji)
pnpm test:e2e         # playwright (butuh pnpm dev berjalan)
pnpm test:e2e:kritis  # 5 alur kritis (@kritis), wajib lulus sebelum memperbarui server toko (K-085)
pnpm db:migrate       # jalankan migrasi ke DATABASE_URL
pnpm db:seed          # data awal (konfigurasi, satuan, tier harga, akun owner)
pnpm db:reset         # HANYA dev: drop + migrate + seed. Minta konfirmasi eksplisit sebelum menjalankan.
```

Sebelum menyatakan tugas selesai, wajib lulus: `pnpm typecheck && pnpm lint && pnpm test`.

## Aturan arsitektur (tidak bisa ditawar)

1. **Logika bisnis hanya di `apps/api/src/modules/*/service.ts`.** Komponen React tidak menghitung stok, harga,
   total, atau status; ia menampilkan hasil dari API. Perhitungan tampilan (subtotal sementara di keranjang) boleh,
   tetapi nilai final selalu dari API.
2. **Semua perubahan stok lewat satu fungsi** `catatMutasi()` di `apps/api/src/modules/persediaan/ledger.ts`,
   di dalam transaksi DB, dengan `SELECT ... FOR UPDATE` pada baris `persediaan` barang terkait.
   Tidak ada `UPDATE persediaan` dari tempat lain.
3. **Tabel transaksi bersifat append-only**: order, penjualan, pembayaran, surat jalan, retur, void, penerimaan,
   penyesuaian, mutasi, shift, clerical, log. Tidak ada UPDATE isi maupun DELETE. Yang boleh berubah hanya kolom
   status dan kolom cache yang didefinisikan di docs/03. Koreksi dilakukan lewat dokumen baru (void, retur, penyesuaian).
4. **Data master tidak dihapus**; dinonaktifkan lewat `status_aktif`.
5. **Setiap route API mendeklarasikan izin** lewat `requirePermission('kode.izin')`. Route tanpa deklarasi
   ditolak oleh guard default. Pengecualian hanya daftar publik: `POST /api/auth/login`, `GET /api/health`.
6. **Field sensitif** (harga modal, HPP, laba, harga titip) **disaring di API** berdasarkan izin
   `master.barang.lihat_hpp` / `laporan.laba`. Menyembunyikan di UI saja tidak cukup.
7. **Uang = integer rupiah.** DB `bigint`, TS `number` (safe integer). Tidak pernah float, tidak pernah desimal.
   Persentase dibulatkan ke rupiah utuh dengan aturan di docs/06.
8. **Kuantitas = `numeric(14,3)`** di DB. Di TS hanya lewat helper `packages/shared/src/qty.ts` (decimal.js).
   Tidak ada aritmatika `number` biasa untuk qty.
9. **Waktu** disimpan `timestamptz` (UTC), ditampilkan zona `Asia/Jakarta`. Tanggal operasional (shift, laporan
   harian) memakai tanggal lokal Asia/Jakarta.
10. **Validasi input dengan skema Zod di `packages/shared`**, dipakai bersama oleh API dan web.
    Tidak ada validasi ganda dengan aturan berbeda.
11. **Nomor dokumen hanya dari** `apps/api/src/modules/sistem/penomoran.ts` (tabel penghitung, dalam transaksi).
    Tidak ada format nomor yang dirakit manual di tempat lain.
12. **Setiap aturan bisnis di docs/05 dan docs/06 punya tes otomatis** di level service dengan database uji
    sungguhan (bukan mock DB). Fitur belum selesai sebelum tesnya ada dan lulus.
13. Tidak ada `any`, `// @ts-ignore`, atau `eslint-disable` tanpa komentar alasan satu baris.
14. Tidak menambah dependency baru tanpa menyebutkannya di rencana beserta alasannya.
15. Kolom cache (`stok_fisik`, `stok_dipesan`, `status_pembayaran`, dsb.) disinkronkan **di transaksi DB yang sama**
    dengan penulisan sumber kebenarannya. Tidak ada sinkronisasi "nanti".

## Keamanan

- Password: `argon2id`. Tidak pernah dilog, tidak pernah dikembalikan API.
- Sesi: cookie `httpOnly`, `SameSite=Lax`, `Secure` di produksi. Token acak disimpan sebagai hash di `sesi_login`.
  Idle timeout dan batas absolut sesuai docs/04.
- Login: rate limit dan penguncian akun sesuai docs/04.
- CSRF: middleware `csrf()` Hono untuk semua metode selain GET/HEAD.
- Semua query lewat Drizzle (parameterized). `sql` template hanya dengan parameter terikat. Tidak ada SQL yang
  dirakit dari string input pengguna.
- Tidak ada rahasia di kode. `.env` tidak di-commit; `.env.example` di-commit.
- Tombol "masuk cepat per peran" dari mockup hanya ada saat `NODE_ENV=development` dan wajib absen di build produksi.
- Log aktivitas dicatat untuk semua aksi mutasi: siapa, kapan, aksi, entitas, id, ringkasan perubahan.

## Konvensi kode

- TypeScript `strict` di semua paket. ESM.
- Nama: DB `snake_case` (`penjualan_detail`, `id_barang`); TS `camelCase` (`penjualanDetail`, `idBarang`);
  komponen `PascalCase`; nama file `kebab-case`.
- Istilah domain mengikuti glosarium di docs/01. Jangan mencampur sinonim (pakai `pemasok`, bukan `supplier`;
  `pelanggan`, bukan `customer`; `barang`, bukan `produk`/`item`).
- Enum status: nilai `UPPER_SNAKE` (`MENUNGGU`, `DISETUJUI`), didefinisikan sekali di
  `packages/shared/src/enums.ts`, dipakai oleh CHECK constraint DB, API, dan web.
- Struktur satu modul API: `routes.ts` (Hono), `service.ts` (logika), `repo.ts` (Drizzle), `schema.ts`
  (Zod request/response bila khusus modul), `*.test.ts`.
- Komentar dan pesan error untuk pengguna: Bahasa Indonesia. Pesan error internal/teknis boleh Inggris.
- Format: Prettier (`printWidth: 100`, `singleQuote: true`). Lint: ESLint `typescript-eslint` recommended-type-checked.
- Tidak ada `console.log` di kode produksi; pakai logger `pino`.

## UI

- Ikuti tampilan mockup Figma Make di `docs/referensi/mockup/`: sidebar gelap `slate-900`, topbar putih,
  aksen `blue-600`, kartu putih berbatas tipis, tabel padat. Tampilan boleh disempurnakan, tetapi
  **struktur dan logika mengikuti laporan KP**, bukan mockup, bila keduanya berbeda.
- Komponen dasar dari shadcn/ui di `apps/web/src/components/ui`. Jangan menulis ulang komponen yang sudah ada.
- Desktop-first (lebar minimum 1280 px), tetap bisa dipakai di tablet 1024 px. Sejak K-217 (31 Okt 2026) tampilan
  juga responsif untuk HP/tablet (PWA lewat Tailscale): panel menumpuk di bawah 1024 px, tanpa merusak tata letak laptop.
- Semua label, tombol, status, pesan: Bahasa Indonesia. Uang `Rp 1.234.567`; tanggal `19/09/2026`; waktu `14:30`.
- Setiap form: validasi Zod sisi klien dengan pesan yang sama dengan API; tombol simpan nonaktif saat mengirim;
  toast sukses/gagal.
- Layar kasir (penjualan langsung) harus bisa dioperasikan penuh dengan keyboard: `F2` cari barang,
  `Enter` bayar, `F9` batal, sesuai mockup.

## Definisi selesai (per fitur)

- [ ] Sesuai spesifikasi di docs (atau docs diperbarui lebih dulu dengan persetujuan pemilik)
- [ ] Bila skema berubah: migrasi baru dibuat; migrasi lama tidak diedit
- [ ] Skema Zod di `packages/shared`, dipakai API dan web
- [ ] Izin dideklarasikan; ada tes bahwa peran tanpa izin ditolak (HTTP 403)
- [ ] Tes service untuk aturan bisnis: kasus normal dan kasus gagal
- [ ] `pnpm typecheck && pnpm lint && pnpm test` lulus
- [ ] Log aktivitas tercatat untuk aksi mutasi
- [ ] Dicoba manual di browser; ringkasan hasil ditulis untuk pemilik
- [ ] Status di `docs/07-roadmap.md` diperbarui

## Jangan

- Jangan menyimpan data bisnis di `localStorage`; hanya preferensi tampilan (sidebar terbuka/tertutup).
- Jangan menyimpan hasil hitung tanpa sumber kebenaran di tabel transaksi/ledger.
- Jangan menjalankan `db:reset`, `DROP`, `TRUNCATE`, atau `git reset --hard` tanpa konfirmasi eksplisit.
- Jangan membuat "mode demo" atau data dummy di kode produksi; data contoh hanya lewat `pnpm db:seed` (dev).
- Jangan memakai `Date` untuk aritmatika tanggal bisnis; pakai helper `apps/api/src/lib/waktu.ts` (`date-fns` + zona).
