# 02 — Arsitektur

## 1. Bentuk aplikasi

Aplikasi **web** (browser), satu server, satu database PostgreSQL. Dipakai bersamaan oleh beberapa orang di
perangkat berbeda (kasir di meja, staf di gudang, owner memantau). Bukan aplikasi desktop `.exe` (K-001).

Skala: beberapa pengguna, ratusan transaksi per hari, puluhan ribu baris ledger per tahun. Beban ini kecil untuk
satu server. "Scalable" di proyek ini berarti: kode terstruktur, integritas data terjaga oleh database dan
transaksi, tes otomatis, dan bisa dipindah dari satu PC toko ke VPS tanpa menulis ulang.

## 2. Stack

| Lapisan | Pilihan | Alasan singkat |
|---|---|---|
| Bahasa | TypeScript `strict` (frontend + backend) | Satu bahasa; kesalahan tipe tertangkap sebelum jalan; pagar utama untuk kode buatan AI |
| Runtime | Node.js LTS | Stabil, dokumentasi luas |
| Paket & monorepo | pnpm workspaces | Cepat, hemat disk, dukungan workspace bawaan |
| Frontend | React + Vite + React Router + Tailwind CSS + shadcn/ui | Sama dengan hasil Figma Make, tampilan bisa dipindah hampir 1:1 |
| Form & validasi | React Hook Form + Zod | Standar industri; skema Zod dipakai bersama API |
| Data fetching | TanStack Query + klien Hono RPC (`hc`) | Cache, invalidasi, dan tipe route otomatis dari backend |
| Backend | Hono (Node adapter) | Ringan, mudah dibaca, middleware sederhana, RPC bertipe ke frontend |
| ORM & migrasi | Drizzle ORM + drizzle-kit | Sintaks dekat SQL; migrasi berupa SQL yang bisa dibaca |
| Database | PostgreSQL | Gratis, standar industri; CHECK/FK/UNIQUE dari skema laporan terpakai utuh |
| Auth | Sesi cookie httpOnly + `argon2` (argon2id) | Sesuai kebutuhan nonfungsional laporan (login, hak akses, auto logout) |
| Uang & qty | integer rupiah + `decimal.js` untuk qty | Tidak ada float |
| Tanggal | `date-fns` + `@date-fns/tz` | Zona Asia/Jakarta eksplisit |
| Logging | `pino` | Terstruktur, cepat |
| Tes | Vitest (unit + service dengan DB uji), Playwright (e2e) | Aturan bisnis diuji terhadap DB sungguhan |
| Kualitas | ESLint (typescript-eslint), Prettier, husky + lint-staged | Format dan lint otomatis sebelum commit |
| Excel | `exceljs` (ekspor & import) | Ekspor laporan, import master barang |
| Cetak | HTML + CSS `@media print` / `@page` | Struk thermal 58/80 mm, invoice A4, surat jalan A4 lewat browser |

### Versi terkunci (K-050)

Dikunci pada Fase 1 (29/09/2026). Daftar lengkap ada di K-050 dan di `catalog:` pada `pnpm-workspace.yaml`
(satu-satunya tempat versi ditulis; `package.json` tiap paket menulis `"catalog:"`):

Node.js 24 LTS · pnpm 12 · TypeScript 6.0 · React 19.3 · Vite 8.3 · React Router 8.4 · Tailwind CSS 4.3 ·
Hono 4.13 · Drizzle ORM 0.45 + drizzle-kit 0.31 · PostgreSQL 17 · Zod 4.6 · TanStack Query 5 ·
React Hook Form 7 · Vitest 5 · Playwright 1.63 · ESLint 10 · pino 10 · argon2 0.45.

TypeScript 7 belum dipakai karena typescript-eslint belum mendukungnya (K-050). Paket fase berikutnya
(decimal.js, date-fns, exceljs, sonner) dipin saat pertama dipasang: decimal.js 10.6.0 dan exceljs 4.4.0 di
Fase 3 (K-058, K-061).

Aturan: semua versi dipin eksak (tanpa `^`); versi baru dipilih bila sudah berumur ≥ 7 hari. Upgrade dilakukan
sadar, satu paket per commit, dengan tes lulus.

### Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Aplikasi desktop (.exe, Electron/Tauri) | Tetap butuh server DB pusat; dua pekerjaan (aplikasi + server); update harus dipasang di tiap PC |
| Next.js | Batas server/klien membingungkan pemula; server action rawan lupa cek otorisasi |
| FastAPI / Django (Python) | Dua bahasa; tipe data tidak otomatis tersambung ke React |
| Laravel (PHP) | Pemilik belum pegang PHP; mockup sudah React |
| Prisma | Query builder-nya lebih jauh dari SQL yang sudah dipelajari pemilik; Drizzle lebih transparan |
| Express | Tidak bertipe di route; Hono memberi RPC bertipe ke frontend |
| Docker sebagai prasyarat dev | Di Windows butuh WSL2 + virtualisasi BIOS; sumber masalah setup pemula. Docker hanya opsional (K-035) |
| Microservices / Kubernetes | Over-engineering untuk skala toko |

## 3. Struktur repo

```
sit-tbsu/
├── CLAUDE.md                     aturan Claude Code
├── docs/                         sumber kebenaran (lihat docs/README.md)
├── apps/
│   ├── api/                      backend Hono + Drizzle
│   │   ├── src/
│   │   │   ├── index.ts          bootstrap server (port, graceful shutdown)
│   │   │   ├── app.ts            Hono app: middleware global, mount semua modul, serve web di produksi
│   │   │   ├── db/
│   │   │   │   ├── client.ts     koneksi pg + drizzle
│   │   │   │   ├── schema/       skema Drizzle per domain: sistem, master, persediaan, kas, penjualan,
│   │   │   │   │                 koreksi, transaksi-pemasok (+ kolom.ts, index.ts) — K-053
│   │   │   │   ├── migrations/   SQL migrasi (0000 = DDL v3), dikelola drizzle-kit
│   │   │   │   ├── migrator.ts   jalankanMigrasi(url) — dipakai db:migrate, db:reset, setup tes
│   │   │   │   ├── seed.ts, data-awal.ts   pnpm db:seed (K-053)
│   │   │   │   ├── reset.ts      pnpm db:reset --ya (hanya *_dev)
│   │   │   │   └── verifikasi-skema.ts     db:verifikasi: skema Drizzle = migrasi SQL (K-052)
│   │   │   ├── middleware/       auth.ts (sesi), require-permission.ts, csrf, error-handler.ts, request-log.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── sistem/       penomoran.ts, log-aktivitas.ts, konfigurasi/, pengaturan/, log/, health/
│   │   │   │   ├── master/       barang/ kategori/ satuan/ atribut/ harga/ pelanggan/ pemasok/ pengguna/ import/
│   │   │   │   ├── persediaan/   ledger.ts, stok/ penerimaan/ penyesuaian/ retur-pemasok/(M2)
│   │   │   │   ├── penjualan/    order/ checkout/ pembayaran/ surat-jalan/ piutang/
│   │   │   │   ├── retur/
│   │   │   │   ├── void/
│   │   │   │   ├── kas/          shift/ kas-shift/ clerical/
│   │   │   │   ├── laporan/      satu file per laporan + ekspor
│   │   │   │   ├── dashboard/
│   │   │   │   └── (M2) harga/ promo/ hutang/ konsinyasi/
│   │   │   └── lib/              errors.ts, waktu.ts, paginasi.ts, transaksi.ts
│   │   ├── test/                 setup DB uji, helper (buatPengguna, buatBarang, ...)
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── web/                      frontend React + Vite
│       ├── src/
│       │   ├── main.tsx, app.tsx, routes.tsx
│       │   ├── api/              client.ts (hc<AppType>), hooks per modul (useBarang, useOrder, ...)
│       │   ├── components/ui/    shadcn/ui (disalin, bukan dependency)
│       │   ├── components/       Layout, Sidebar, Topbar, DataTable, FormField, MoneyInput, QtyInput, StatusBadge, ...
│       │   ├── features/<modul>/ halaman + komponen khusus modul (lihat docs/01 §4)
│       │   ├── cetak/            layout cetak: struk, invoice, surat-jalan, laporan
│       │   ├── lib/              format.ts (uang, tanggal), auth.tsx (context), izin.ts, hotkeys.ts
│       │   └── styles/
│       ├── e2e/                  Playwright
│       └── package.json
├── packages/
│   └── shared/                   dipakai api dan web
│       └── src/
│           ├── enums.ts          semua enum status (satu sumber)
│           ├── permissions.ts    daftar izin
│           ├── roles.ts          peran → izin
│           ├── schemas/          Zod: barang.ts, order.ts, penjualan.ts, ...
│           ├── money.ts          helper uang integer (bulatkan, persen, format)
│           ├── qty.ts            helper qty (decimal.js): tambah, kali, konversi satuan
│           └── index.ts
├── scripts/                      backup.ps1 / backup.sh (Fase 8); seed ada di apps/api/src/db (K-053)
├── docker-compose.yml            PostgreSQL opsional (untuk yang tidak mau install native)
├── .env.example
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .prettierrc  .gitignore
```

## 4. Lapisan backend dan request lifecycle

```
HTTP → Hono router
     → middleware global: request-log (pino), csrf, auth (muat sesi → c.var.pengguna)
     → requirePermission('kode.izin')            ← wajib per route
     → zValidator (Zod dari packages/shared)      ← validasi body/query/param
     → handler di routes.ts: hanya mengurai request & memanggil service
     → service.ts: logika bisnis; membuka transaksi bila menulis
         → repo.ts: query Drizzle (tanpa logika bisnis)
         → ledger.ts / penomoran.ts / log-aktivitas.ts bila perlu
     → respons { data } atau AppError → error-handler → { error }
```

Aturan lapisan:

- `routes.ts` tidak boleh memanggil Drizzle langsung. `repo.ts` tidak boleh memutuskan aturan bisnis.
- Service yang menulis ke lebih dari satu tabel **wajib** memakai `db.transaction()`. Helper `lib/transaksi.ts`
  menyediakan `dalamTransaksi(fn)`.
- Operasi stok memanggil `catatMutasi()` dari `persediaan/ledger.ts`, yang melakukan
  `SELECT ... FROM persediaan WHERE id_barang = $1 FOR UPDATE` sebelum menghitung saldo baru, lalu menulis satu
  baris `mutasi_persediaan` dan memperbarui cache di `persediaan`. Ini mencegah dua kasir menjual unit terakhir
  secara bersamaan.
- Penomoran memakai `SELECT ... FOR UPDATE` pada `penghitung_nomor` di transaksi yang sama dengan pembuatan
  dokumen, sehingga nomor tidak lompat atau ganda.
- Log aktivitas ditulis di transaksi yang sama dengan mutasinya.

### Format respons

```jsonc
// sukses
{ "data": { ... } }
// daftar berhalaman
{ "data": [ ... ], "meta": { "total": 145, "halaman": 1, "perHalaman": 25 } }
// gagal
{ "error": { "kode": "STOK_TIDAK_CUKUP", "pesan": "Stok tersedia Semen Gresik 40kg hanya 3 sak", "detail": { ... } } }
```

Query daftar memakai `?halaman=1&perHalaman=25&cari=semen&urut=nama_barang&arah=asc` ditambah filter khusus modul.

### Error model (`lib/errors.ts`)

```ts
export class AppError extends Error {
  constructor(
    public readonly kode: KodeError,
    message: string,
    public readonly status: number = 400,
    public readonly detail?: unknown,
  ) { super(message); }
}
```

| Kode | HTTP | Kapan |
|---|---|---|
| `VALIDASI` | 400 | Zod gagal (detail = daftar field) |
| `BELUM_LOGIN` | 401 | Tidak ada sesi valid |
| `TIDAK_BERIZIN` | 403 | Izin kurang |
| `TIDAK_DITEMUKAN` | 404 | Entitas tidak ada |
| `STATUS_TIDAK_VALID` | 409 | Transisi status tidak diizinkan (mis. void penjualan yang sudah diretur) |
| `STOK_TIDAK_CUKUP` | 409 | Stok tersedia kurang |
| `KONFLIK` | 409 | Unik terlanggar, data diubah orang lain |
| `LIMIT_TERLAMPAUI` | 409 | Limit kredit / batas diskon |
| `WAJIB_GANTI_PASSWORD` | 403 | Pengguna harus mengganti password sebelum memakai fitur lain (K-054) |
| `TERLALU_BANYAK_PERCOBAAN` | 429 | Rate limit login per IP (K-054) |
| `INTERNAL` | 500 | Tak terduga; pesan generik ke klien, detail ke log |

## 5. Frontend

- Routing di `routes.tsx` dengan pelindung: route butuh login, dan route dengan `izin` tertentu (menu dan halaman
  disembunyikan bila izin tidak ada; API tetap penjaga utama).
- Data lewat TanStack Query; kunci query per modul: `['barang', 'daftar', params]`, `['barang', 'detail', id]`.
  Mutasi meng-invalidate kunci terkait.
- Klien API: `hc<AppType>('/api')` dari Hono. Tipe request/response mengalir dari backend; jika route berubah,
  frontend gagal typecheck.
- Form: React Hook Form + `zodResolver` dengan skema dari `packages/shared`. Komponen `MoneyInput` (menampilkan
  `Rp 1.234.567`, menyimpan integer) dan `QtyInput` (3 desimal, satuan di sampingnya).
- Tampilan mengikuti mockup: `Layout` (sidebar grup yang bisa di-collapse, topbar cari/notifikasi/pengguna),
  `DataTable` (cari, filter, paginasi server), dialog/drawer untuk form master, `StatusBadge` warna per status.
- Cetak: komponen `AreaCetak` (`components/area-cetak.tsx`) merender struk/invoice/surat jalan ke `body`;
  CSS `.area-cetak` membuat hanya dokumen itu yang tercetak saat `window.print()`. `@page { size: 80mm auto }`
  untuk thermal (lebar 58/80 mm dari konfigurasi), `A4` untuk invoice/surat jalan. Layar POS mencetak otomatis
  tanpa pratinjau; di toko Chrome dijalankan dengan `--kiosk --kiosk-printing` (K-073).
- Layar POS (`features/pos/`, K-073): keyboard penuh — F2 cari barang, F3 antrean, F4 pelanggan, F8 bayar,
  F9 batal, Esc kembali, Ctrl+Z urungkan; huruf perintah di kotak bayar (T/B/E/C/D/L/S). F1, F6, F7, F10–F12
  tidak dipakai (dicadangkan peramban). Komponen POS memakai elemen HTML biasa agar ringan dirender.
- Siaran perubahan: `useSiaranAntrean()` membuka `EventSource` ke `GET /api/order/antrean/siaran`; backend
  (`lib/siaran.ts`) mengirim tanda "berubah" setelah transaksi order/checkout di-commit, lalu layar memuat ulang
  datanya sendiri (tanpa data bisnis di kanal siaran).
- Pengaturan tampilan (sidebar terbuka, lebar struk terakhir) boleh di `localStorage`; data bisnis tidak.

## 6. Paket `shared`

Satu sumber untuk: enum status (dipakai CHECK DB lewat migrasi, API, web), daftar izin dan peran, skema Zod
request/response, helper uang dan qty, formatter nomor dokumen (hanya format, bukan penerbitan). Tidak boleh
mengimpor dari `apps/*`.

## 7. Tipe data uang, qty, waktu

**Uang**: DB `bigint` (rupiah utuh). Drizzle `bigint({ mode: 'number' })`. Batas aman JS 9.007.199.254.740.991
(≈ 9 kuadriliun rupiah), cukup. Setiap nilai dicek `Number.isSafeInteger`. Persentase: `bulatkanRupiah(nilai * persen / 100)`
dengan aturan pembulatan di docs/06. Tidak ada `parseFloat` pada uang.

**Kuantitas**: DB `numeric(14,3)`. Drizzle mengembalikan `string`; helper `qty.ts` membungkus ke `Decimal`
(decimal.js) untuk tambah/kurang/kali/konversi, dan mengembalikan string 3 desimal untuk disimpan. Subtotal =
`bulatkanRupiah(qty × hargaSatuan)`.

**Waktu**: DB `timestamptz`. Server berjalan dengan `TZ=UTC`; konversi tampilan ke `Asia/Jakarta` di helper
`waktu.ts`. Kolom `tanggal_operasional` (shift, laporan harian) bertipe `date` berisi tanggal lokal Jakarta.

## 8. Autentikasi dan sesi

1. `POST /api/auth/login` (username, password) → verifikasi argon2id → buat token acak 32 byte → simpan
   `sha256(token)` di `sesi_login` (id pengguna, kadaluarsa, ip, user agent) → set cookie `sit_sesi`.
2. Middleware `auth` membaca cookie, mencari hash, memeriksa kadaluarsa dan idle, memuat pengguna + izin ke
   `c.var`. Idle diperpanjang tiap request (sliding), maksimum absolut sesuai docs/04.
3. `POST /api/auth/logout` mencabut sesi. Owner bisa mencabut semua sesi seorang pengguna (saat menonaktifkan akun).
4. Gagal login berulang → penguncian sementara (docs/04). Semua login sukses/gagal masuk log aktivitas.
5. Rute dijaga `requirePermission('kode.izin')` atau, untuk data milik sendiri (logout, profil, ganti password),
   `requireLogin()`. Server menolak menyala bila ada rute tanpa salah satunya yang tidak terdaftar publik (K-054).
   `terakhir_aktif` diperbarui paling sering sekali per menit. `SESSION_SECRET` belum dipakai.

Cookie `SameSite=Lax` + middleware `csrf()` Hono (memeriksa header `Origin`) melindungi dari CSRF. Frontend dan
API berada di origin yang sama (dev: proxy Vite `/api` → `:3000`; produksi: Hono menyajikan `apps/web/dist`).

## 9. Migrasi database

- Migrasi `0000_skema_v3.sql` = DDL di `docs/03-skema-database-v3.sql` apa adanya (K-003).
- Skema Drizzle (`db/schema/*.ts`) ditulis agar **sama persis** dengan DDL, termasuk nama constraint. Diverifikasi
  dengan `pnpm --filter @sit/api db:verifikasi` (perbandingan `pg_dump` di database uji; Fase 1: identik) dan
  `drizzle-kit check` (konsistensi riwayat migrasi) — K-052. Setelah itu, perubahan skema selalu: ubah
  `schema/*.ts` → `pnpm --filter @sit/api db:generate` → tinjau SQL yang dihasilkan → `db:verifikasi` → commit →
  `pnpm db:migrate`.
- Migrasi yang sudah di-commit tidak pernah diedit. Kesalahan diperbaiki dengan migrasi baru.
- Seed (`pnpm db:seed`) idempoten: konfigurasi default, satuan, jenis atribut, tier harga (Normal/Grosir/Distributor),
  kategori awal, satu akun Owner (`owner` / password dari `.env` `SEED_OWNER_PASSWORD`). Data contoh barang
  hanya bila `SEED_CONTOH=true` (mulai Fase 3). Baris yang kodenya sudah ada tidak ditimpa.
- `pnpm db:reset --ya` (hanya dev): kosongkan database `*_dev`, migrasi ulang, seed. Tanpa `--ya` perintah menolak.

## 10. Testing

- **Service test (utama)**: Vitest menjalankan service terhadap database uji `tbsu_test` (PostgreSQL sungguhan,
  bukan mock). Setiap file tes membersihkan tabel yang dipakainya di `beforeEach` lewat helper `test/reset.ts`.
  Tes DB berjalan serial (`fileParallelism: false`) untuk menghindari benturan.
- **Route test**: `app.request()` Hono untuk memastikan izin ditegakkan (403 untuk peran tanpa izin) dan format respons.
- **E2E**: Playwright untuk alur kritis: login → order → checkout langsung → struk; pengantaran → surat jalan →
  pelunasan; retur disetujui; void disetujui; tutup shift. Dijalankan di Fase 8 dan sebelum rilis.
- Cakupan minimal: setiap aturan di docs/05 dan docs/06 punya tes bernama sesuai aturannya, contoh
  `ledger.test.ts › "stok fisik tidak boleh negatif"`.

## 11. Konfigurasi lingkungan

`.env` (tidak di-commit) — `.env.example` di-commit dengan nilai contoh:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://sit:sit@localhost:5432/tbsu_dev
DATABASE_URL_TEST=postgres://sit:sit@localhost:5432/tbsu_test
SESSION_SECRET=<acak 32+ karakter>
SESSION_IDLE_MENIT=60
SESSION_ABSOLUT_JAM=12
SEED_OWNER_PASSWORD=<ganti>
SEED_CONTOH=false
LOG_LEVEL=info
TZ=UTC
```

Konfigurasi bisnis (nama toko, prefix nomor, ambang restock, batas umur order, pembulatan, batas diskon per peran)
tidak di `.env` melainkan di tabel `konfigurasi` (bisa diubah Owner/Admin dari halaman Pengaturan).

## 12. Dev dan produksi

- Dev: `pnpm dev` → API `http://localhost:3000`, web `http://localhost:5173` (Vite proxy `/api`). Hot reload keduanya.
- Build: `pnpm build` → `apps/web/dist` + `apps/api/dist`. Produksi: `node apps/api/dist/index.js` menyajikan
  API dan file statis web di satu port.
- Deploy (diputuskan Fase 8, K-039): opsi A mini-PC di toko (Windows/Linux, jalan via LAN, tetap hidup saat internet
  putus, backup ke drive eksternal + cloud); opsi B VPS (akses dari mana saja, butuh internet, HTTPS lewat Caddy).
  Kriteria: apakah owner perlu memantau dari luar toko, dan seberapa stabil internet toko.
- Backup: `pg_dump` harian terjadwal (Task Scheduler / cron) + folder `storage/` ke repositori snapshot
  terdeduplikasi dan terenkripsi (restic) di disk lokal dan cloud (rclone → Google Drive); retensi 7 harian,
  4 mingguan, 12 bulanan, 5 tahunan; uji pulih bulanan. Rincian di docs/07 Fase 8 (K-062).
- Log: pino ke stdout; di produksi diarahkan ke file berputar (pm2 atau systemd).

## Riwayat

- 2026-09-19 — v1.
- 2026-10-02 — §5: cetak lewat `AreaCetak`, layar POS keyboard penuh, siaran perubahan antrean (K-073).
- 2026-09-30 — Fase 2: kode error `WAJIB_GANTI_PASSWORD`, `TERLALU_BANYAK_PERCOBAAN` (§4); guard default dan
  `requireLogin` (§8) — K-054.
- 2026-09-29 — Fase 1: versi paket dikunci (§2, K-050); struktur `db/` dan letak seed disesuaikan (§3, K-053);
  cara verifikasi skema dan `db:reset --ya` (§9, K-052).
