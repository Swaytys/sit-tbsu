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
| Cetak | HTML + CSS `@media print` / `@page`; struk thermal juga ESC/POS lewat Web Serial (K-103) | Invoice, surat jalan, laporan A4 lewat jendela cetak; struk bisa langsung ke printer thermal tanpa jendela cetak |
| Pesan ke atasan | Bot API Telegram (`fetch`) + `nodemailer` (SMTP) | Kode persetujuan sekali pakai (K-102) |

### Versi terkunci (K-050)

Dikunci pada Fase 1 (29/09/2026). Daftar lengkap ada di K-050 dan di `catalog:` pada `pnpm-workspace.yaml`
(satu-satunya tempat versi ditulis; `package.json` tiap paket menulis `"catalog:"`):

Node.js 24 LTS · pnpm 12 · TypeScript 6.0 · React 19.3 · Vite 8.3 · React Router 8.4 · Tailwind CSS 4.3 ·
Hono 4.13 · Drizzle ORM 0.45 + drizzle-kit 0.31 · PostgreSQL 17 · Zod 4.6 · TanStack Query 5 ·
React Hook Form 7 · Vitest 5 · Playwright 1.63 · ESLint 10 · pino 10 · argon2 0.45.

TypeScript 7 belum dipakai karena typescript-eslint belum mendukungnya (K-050). Paket fase berikutnya
(decimal.js, date-fns, exceljs, sonner) dipin saat pertama dipasang: decimal.js 10.6.0 dan exceljs 4.4.0 di
Fase 3 (K-058, K-061); nodemailer 10.0.14 untuk email kode persetujuan (K-102).

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
│   │   │   │   ├── kas/          shift/ kas-shift/ clerical/ rekening/ nontunai/ (K-111)
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

### Pengaman *race condition* (banyak pengguna bersamaan)

*Race condition* = dua permintaan yang berjalan bersamaan saling menimpa hasilnya (mis. dua kasir menjual unit
terakhir). Pengaman yang berlaku:

| Keadaan | Pengaman | Bukti tes |
|---|---|---|
| Stok barang yang sama dijual/diubah bersamaan | `FOR UPDATE` baris `persediaan` di `catatMutasi`; urutan kunci per id barang | L11: 20 penjualan paralel dari stok 10 → tepat 10 berhasil |
| Nomor dokumen | baris `penghitung_nomor` dikunci (upsert) di transaksi dokumen | penomoran.test |
| Shift toko | `pg_advisory_xact_lock` saat buka + indeks unik `uq_shift_toko_terbuka` (K-155) | shift.test (dua pembukaan bersamaan) |
| Order diproses dua kasir | status DIPROSES + `id_kasir_proses` dikunci `FOR UPDATE` (R8) | order.test |
| Pembayaran/retur/void atas penjualan yang sama | `FOR UPDATE` baris `penjualan`; nominal dicek terhadap sisa di dalam kunci | penjualan/retur/void.test |
| Kode persetujuan dipakai dua kali | status kode dikunci dan ditandai terpakai di transaksi persetujuannya | persetujuan.test |
| Kendaraan/sopir berangkat dua kali | `FOR UPDATE` kendaraan & sopir + indeks unik parsial perjalanan JALAN | surat-jalan.test (dua keberangkatan bersamaan) |
| Hasil surat jalan dicatat dua kali | `FOR UPDATE` surat jalan + UNIQUE `surat_jalan_hasil.id_surat_jalan` | surat-jalan.test |
| Rit rencana diubah dua orang (isi/pindah/berangkat/batal) | `FOR UPDATE` baris perjalanan; semua aksi rit rencana menolak rit yang bukan DIRENCANAKAN lagi; surat jalan dikunci saat dipindah (K-160) | surat-jalan.test (rit rencana) |

| Kiriman yang sama dikirim ulang karena jaringan putus | header `Idempotency-Key` dari klien + tabel `kunci_idempoten`: jawaban pertama dikembalikan, tidak dijalankan dua kali (K-164, `middleware/idempoten.ts`) | idempoten.test (checkout tunai diulang = 1 penjualan) |
| Dua admin mengubah barang/pelanggan/pemasok yang sama | cek versi (`lib/versi.ts`): versi saat form dibuka ≠ versi sekarang → `KONFLIK` (K-164) | versi.test |

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
| `TERLALU_BANYAK_PERCOBAAN` | 429 | Rate limit login per IP (K-054) dan persetujuan di tempat per pengaju (K-100) |
| `INTERNAL` | 500 | Tak terduga; pesan generik ke klien, detail ke log |

Pembuat galat yang dipakai semua modul (K-100), supaya bentuk `detail.kolom` yang dibaca form selalu sama:
`galatKolom(kolom, pesan, kode = 'VALIDASI')` untuk satu kolom isian dan `galatBaris(i, kolom, pesan)` untuk
baris ke-`i` dokumen berbaris (pesan diawali "Baris n:", kolom `baris.<i>.<kolom>`). Modul tidak membuat
versi lokalnya.

Galat yang bukan `AppError` dipetakan `middleware/error-handler.ts` (K-100):

| Sumber | HTTP | Kode | Arti |
|---|---|---|---|
| PostgreSQL `23505` | 409 | `KONFLIK` | Dua simpan bersamaan dengan kode yang sama |
| PostgreSQL `40P01`, `40001`, `55P03` | 409 | `KONFLIK` | Kebuntuan atau menunggu kunci baris terlalu lama; aman diulang |
| PostgreSQL `57014` | 503 | `INTERNAL` | Pernyataan melewati batas waktu |
| PostgreSQL `53100`, `53200`, `53300` | 503 | `INTERNAL` | Komputer server kehabisan ruang penyimpanan, memori, atau koneksi database |
| PostgreSQL `57P01`–`57P03`, `08000`/`08003`/`08006`; Node `ECONNREFUSED`, `ECONNRESET` | 503 | `INTERNAL` | Database sedang dimatikan/dinyalakan atau koneksinya putus |
| PostgreSQL `23514`, `23503`, `22003`, `22001` | 400 | `VALIDASI` | Aturan database menolak data; dicatat `error` (celah validasi service) |
| `GalatAngka` (`packages/shared`) | 400 | `VALIDASI` | Hasil hitung melampaui batas rupiah/qty |
| lainnya | 500 | `INTERNAL` | Tak terduga |

Batas waktu koneksi (`db/client.ts`, K-100): pernyataan 60 detik, menunggu kunci baris 15 detik, transaksi
menganggur 60 detik, menunggu koneksi dari pool 10 detik. Migrasi dan cadangan memakai koneksi sendiri.

Pola rute yang dipakai bersama (K-100): `paramId` (`lib/validasi.ts`) untuk parameter `/:id`;
`batasUnggahGambar` / `batasUnggahXlsx` dan `berkasKiriman(c, jenis)` (`lib/unggah.ts`) untuk unggahan.

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
- Galat tampilan (K-100): `HalamanGalat` (`features/umum/halaman-galat.tsx`) dipasang sebagai `errorElement`
  dua lapis di `routes.tsx`: galat di satu halaman tampil di dalam kerangka, galat di kerangka/login tampil
  penuh. Berkas halaman yang gagal diunduh setelah server diperbarui memicu muat ulang otomatis.
- Pembantu bersama web (K-100): `paramId` (`api/client.ts`), `qtySah` / `qtyDariIsian` (`lib/qty.ts`).
- Struk thermal langsung (K-103): `packages/shared/src/escpos.ts` menyusun byte ESC/POS (murni, diuji);
  `lib/struk-escpos.ts` mengisi strukturnya dari `DetailPenjualan`; `lib/printer-thermal.ts` mengirimnya lewat
  Web Serial (Chrome/Edge) dengan pengaturan per komputer di `localStorage`. Bila tidak aktif atau gagal, struk
  dicetak lewat `AreaCetak` seperti dokumen lain. Notifikasi (toast) disembunyikan di semua cetakan (K-104).
  Struk langsung selalu potret, font bawaan printer, opsional double-strike; memilih printer lagi mencabut izin
  port lama; `AreaCetak` gulungan tidak pernah lebih pendek dari lebarnya (K-105).
- Penyiapan terpandu (K-105): `components/langkah.tsx` (`Langkah`, `KotakHasil`) untuk penyiapan berurutan
  dengan tanda selesai; dipakai tab Persetujuan dan kartu Printer struk. Aturan menulis petunjuk: K-105 butir 1.
- Ganti akun (K-106): `gantiPengguna(qc, pengguna)` di `api/auth.ts` mengosongkan seluruh cache TanStack Query
  sebelum memasang pengguna baru; dipanggil login dan masuk cepat. Tanpa itu data akun sebelumnya (profil,
  kontak penerima kode) masih tampil sampai dimuat ulang.
- Tata letak bersama (K-106): kepala halaman memakai `flex flex-wrap items-start justify-between gap-x-4 gap-y-2`
  dengan blok judul `min-w-0 flex-1 basis-80` (tombol turun ke baris berikut saat jendela sempit); `FormItem`
  (`components/ui/form.tsx`) memakai `content-start` sehingga label dan isian sejajar di kisi mana pun.
- Komponen bersama baru: `InfoTierBelanja` (keterangan tier belanja, K-106), `PeringatanShift` di `Layout`
  (pengingat jam tutup dan shift terlewat, K-109), `BadgeVerifikasi` (hasil cek uang non-tunai, K-111).
- Cari barang transaksi (K-108): `features/pos/cari-barang-pos.tsx` (pilihan kategori, tombol Daftar, foto
  kecil); pencarian per kata dan urutan relevansinya dihitung API (`master/barang/repo.ts`), bukan di layar.

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
   `terakhir_aktif` diperbarui paling sering sekali per menit. Tidak ada rahasia penanda tangan sesi: token
   acak hanya disimpan sebagai hash (K-054), sehingga `SESSION_SECRET` dihapus dari `.env` (K-100).

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
  kategori awal, satu akun Owner (`owner` / password dari `.env` `SEED_OWNER_PASSWORD`), dan akun demo per peran
  hanya saat `NODE_ENV=development`. Tidak ada data contoh barang (`SEED_CONTOH` dihapus, K-100). Baris yang
  kodenya sudah ada tidak ditimpa.
- `pnpm db:reset --ya` (hanya dev): kosongkan database `*_dev`, migrasi ulang, seed. Tanpa `--ya` perintah menolak.

## 10. Testing

- **Service test (utama)**: Vitest menjalankan service terhadap database uji `tbsu_test` (PostgreSQL sungguhan,
  bukan mock). Setiap file tes membersihkan tabel yang dipakainya di `beforeEach` lewat helper `test/reset.ts`.
  Tes DB berjalan serial (`fileParallelism: false`) untuk menghindari benturan.
- **Route test**: `app.request()` Hono untuk memastikan izin ditegakkan (403 untuk peran tanpa izin) dan format respons.
- **E2E**: Playwright untuk alur kritis: login → order → checkout langsung → struk; pengantaran → surat jalan →
  pelunasan; retur disetujui; void disetujui; tutup shift. Dijalankan di Fase 8 dan sebelum rilis.
- **Penyiapan E2E** (K-106, K-107): tes layar berjalan di database pengembangan. `e2e/penyiapan-global.ts`
  (`globalSetup` Playwright) menonaktifkan tier harga selain tier dasar selama tes dan mengaktifkannya kembali
  di akhir, menutup shift demo yang terlewat, dan menandai pembayaran non-tunai buatan tes sebagai sudah
  dicek. Server untuk tes dijalankan dengan `SALURAN_TIRUAN=1` (kode persetujuan tidak pernah dikirim ke
  Telegram/email sungguhan) dan `LOGIN_MAKS_PER_MENIT=600` (tes login puluhan kali semenit dari satu alamat).
- Cakupan minimal: setiap aturan di docs/05 dan docs/06 punya tes bernama sesuai aturannya, contoh
  `ledger.test.ts › "stok fisik tidak boleh negatif"`.

## 11. Konfigurasi lingkungan

`.env` (tidak di-commit) — `.env.example` di-commit dengan nilai contoh:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://sit:sit@localhost:5432/tbsu_dev
DATABASE_URL_TEST=postgres://sit:sit@localhost:5432/tbsu_test
SESSION_IDLE_MENIT=60
SESSION_ABSOLUT_JAM=12
SEED_OWNER_PASSWORD=<ganti>
LOG_LEVEL=info
TZ=UTC
```

Variabel produksi (`PORT_HTTP_ALIH`, `LOG_FILE`, `HTTPS_PFX`, `ORIGIN_TAMBAHAN`, `WEB_DIST`) dan cadangan
(`CADANGAN_*`) tercantum berkomentar di `.env.example`; daftar lengkap beserta validasinya ada di
`apps/api/src/env.ts`. Variabel yang tidak dikenal diabaikan.

Dua variabel hanya berpengaruh **di luar produksi** dan dipakai server tes e2e (K-107): `SALURAN_TIRUAN=1`
(pesan ke atasan masuk kotak keluar uji, tidak dikirim) dan `LOGIN_MAKS_PER_MENIT` (batas laju login per IP;
di produksi selalu 20).

Pekerjaan berkala di proses API (`index.ts`): job order tiap 15 menit (order basi, lepas kunci; K-070),
penjadwal cadangan tiap 10 menit (K-084), dan pengingat shift tiap 5 menit (`ingatkanShiftPerluDitutup`, K-109).

Konfigurasi bisnis (nama toko, prefix nomor, ambang restock, batas umur order, pembulatan, batas diskon per peran)
tidak di `.env` melainkan di tabel `konfigurasi` (bisa diubah Owner/Admin dari halaman Pengaturan).

## 12. Dev dan produksi

- Dev: `pnpm dev` → API `http://localhost:3000`, web `http://localhost:5173` (Vite proxy `/api`). Hot reload keduanya.
- Build: `pnpm build` → `apps/web/dist` + `apps/api/dist`. Produksi: `node apps/api/dist/index.js` menyajikan
  API dan file statis web di satu port.
- Deploy (diputuskan Fase 8, K-082): **komputer Windows di toko** (tetap hidup saat internet putus) + akses luar
  lewat **Tailscale** (`tailscale serve`). HTTPS di LAN dengan CA lokal toko (`scripts/server/buat-sertifikat.ps1`;
  `ca-toko.cer` dipasang di komputer kasir). Server dijalankan Task Scheduler "BonsaiUrip Server" (akun SYSTEM,
  menyala saat komputer menyala) lewat penjaga `jalankan-server.ps1`. Pasang: `pasang-server.ps1`; perbarui:
  `perbarui-server.ps1`; panduan `docs/panduan/fase-8-pasang-server.md`.
- Backup (K-084): dijadwalkan server sendiri (cek tiap 10 menit): `pg_dump` format custom tanpa kompresi +
  folder `storage/` → snapshot restic terenkripsi di disk lokal dan cloud (rclone → Google Drive); retensi 7/4/12/5;
  uji pulih otomatis tiap tanggal 1; status di Pengaturan › Cadangan; pemulihan `scripts/server/pulihkan.ps1`.
- Log: pino ke stdout di dev; produksi ke `LOG_FILE` (diputar saat menyala bila > 10 MB, 5 berkas lama).

## Riwayat

- 2026-10-12 — §3 modul `kas/rekening` dan `kas/nontunai` (K-111); §5 ganti akun, tata letak bersama, komponen
  bersama baru, cari barang (K-106, K-108, K-109, K-111); §10 penyiapan e2e; §11 variabel khusus server tes
  dan daftar pekerjaan berkala (K-107, K-109).
- 2026-10-11 — §2 saluran pesan ke atasan dan nodemailer (K-102); §2, §5 struk ESC/POS lewat Web Serial (K-103).
- 2026-10-11 — §5 penyiapan terpandu, struk potret/tebal, izin port tunggal (K-105).
- 2026-10-10 — §4: pembuat galat bersama, pemetaan galat database, batas waktu koneksi, pola rute bersama;
  §5: halaman galat dan pembantu bersama web; §8, §9, §11: `SESSION_SECRET` dan `SEED_CONTOH` dihapus (K-100).
- 2026-10-04 — §12: deploy diputuskan (komputer toko + Tailscale, HTTPS CA lokal), cadangan restic, log
  berkas (K-082, K-084); header keamanan & batas body (K-083).
- 2026-09-19 — v1.
- 2026-10-04 — Fase 7: laporan = `DokumenLaporan` disusun API (satu berkas per laporan di `modules/laporan/`),
  dirender sama untuk layar, cetak, dan Excel (K-078); label enum bersama di `packages/shared/src/label.ts`,
  helper tanggal kalender tanpa `Date` di `packages/shared/src/tanggal.ts`; grafik dashboard SVG tanpa
  dependency baru (K-080).
- 2026-10-02 — §5: cetak lewat `AreaCetak`, layar POS keyboard penuh, siaran perubahan antrean (K-073).
- 2026-09-30 — Fase 2: kode error `WAJIB_GANTI_PASSWORD`, `TERLALU_BANYAK_PERCOBAAN` (§4); guard default dan
  `requireLogin` (§8) — K-054.
- 2026-09-29 — Fase 1: versi paket dikunci (§2, K-050); struktur `db/` dan letak seed disesuaikan (§3, K-053);
  cara verifikasi skema dan `db:reset --ya` (§9, K-052).
- 2026-10-24 — §4 tabel pengaman race condition (K-155, K-164).
- 2026-10-24 — §4 kunci idempoten dan cek versi (K-164).
- 2026-10-24 — §4 baris rit rencana (K-160).
