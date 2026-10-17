# 11 — Riwayat Teknis Pengembangan

Catatan teknis yang runtut dari awal sampai sekarang: **apa yang benar-benar dibangun** di setiap tahap, kerangka
teknisnya (modul, tabel, alur, aturan), dan alasan logis di baliknya. Ditulis sebagai penjelasan, bukan daftar
commit. Dokumen ini ditambah setiap kali sesuatu dibangun (K-118).

Pembagian peran dokumen:

| Dokumen | Menjawab |
|---|---|
| `LAPORAN-FITUR-APLIKASI.md` | Fitur apa yang ada **sekarang** dan di mana kodenya |
| **`11-riwayat-teknis.md`** (ini) | **Bagaimana** aplikasi dibangun dari waktu ke waktu dan kerangka teknisnya |
| `10-ringkasan-keputusan.md` dan `keputusan/` | **Mengapa** sesuatu diputuskan, termasuk pilihan yang ditolak |
| `01`–`06` | Spesifikasi yang berlaku: istilah, arsitektur, skema, hak akses, aturan bisnis |

Angka K-nnn merujuk ke catatan keputusan. Kode aturan seperti `L4`, `P9`, `RO3` merujuk ke docs/05 dan docs/06.

---

## Bagian A — Kerangka yang dipakai di seluruh aplikasi

Sebelum riwayat per tahap, berikut bangunan dasar yang dipakai semua fitur, karena hampir setiap tahap berikutnya
bergantung padanya.

**A1. Satu repo, tiga paket.** `apps/api` (server Hono di Node.js + Drizzle ORM ke PostgreSQL), `apps/web` (React +
Vite, TanStack Query untuk data, React Hook Form + Zod untuk form), dan `packages/shared` (kontrak bersama: enum
status, daftar izin, peran, skema validasi Zod, helper uang dan kuantitas). Karena web dan API memakai skema Zod
yang sama, aturan validasi tidak pernah berbeda antara layar dan server (K-002, K-053).

**A2. Lapisan per modul API.** Setiap modul berisi `routes.ts` (alamat HTTP + izin + validasi), `service.ts`
(logika bisnis, transaksi database, log), dan `repo.ts` (kueri Drizzle). Logika bisnis tidak pernah di layar: layar
hanya menampilkan angka dari API. Contoh struktur: `apps/api/src/modules/persediaan/penerimaan/{routes,service,repo}.ts`.

**A3. Penjaga izin.** Setiap rute memasang `requirePermission('kode.izin')` atau `requireLogin()`. Saat server
menyala, `periksaDeklarasiIzin()` memeriksa seluruh rute dan server **menolak menyala** bila ada rute tanpa
deklarasi (K-054). Peran adalah kumpulan izin yang bertingkat Staf ⊂ Kasir ⊂ Admin ⊂ Owner (`shared/roles.ts`).

**A4. Uang dan kuantitas.** Uang = rupiah bulat (`bigint` di database, `number` aman di TypeScript); kuantitas =
`numeric(14,3)` yang di TypeScript selalu lewat helper `qty.ts` berbasis decimal.js. Pembulatan rupiah setengah ke
atas, pembulatan harga ke atas ke kelipatan Rp 100 (K-013, K-058).

**A5. Ledger stok satu pintu.** Semua perubahan stok lewat `catatMutasi()` di `persediaan/ledger.ts`: mengunci baris
`persediaan` (`SELECT … FOR UPDATE`), menulis satu baris `mutasi_persediaan` (jenis, qty masuk/keluar, saldo setelah,
HPP setelah, rujukan dokumen), lalu memperbarui cache stok di transaksi yang sama. Reservasi order lewat
`ubahReservasi()`. Fungsi audit `hitungUlangCache()` membuktikan cache sama dengan ledger (L9).

**A6. Dokumen hanya-tambah.** Order, penjualan, pembayaran, retur, void, penerimaan, penyesuaian, shift, log tidak
pernah di-UPDATE isinya atau di-DELETE; yang berubah hanya kolom status dan cache. Koreksi selalu berupa dokumen
baru. Data master dinonaktifkan, tidak dihapus (K-021).

**A7. Penomoran.** Nomor dokumen `PREFIX-YYMMDD-NNN` diterbitkan `terbitkanNomor()` dari tabel `penghitung_nomor`
dengan kunci baris, di dalam transaksi dokumennya, sehingga tidak ada nomor ganda walau dua kasir menyimpan
bersamaan (K-022).

**A8. Log aktivitas.** Setiap aksi yang mengubah data memanggil `catatLog()` di transaksi yang sama: pelaku, waktu,
aksi (103 jenis), entitas, id, nomor dokumen, ringkasan, data lama/baru (JSON), IP (K-037, K-055).

**A9. Tes.** Tes layanan memakai PostgreSQL sungguhan (`tbsu_test`) yang dimigrasi dari berkas SQL; setiap aturan
bisnis punya tes bernama sesuai kodenya. Tes layar (Playwright) menjalankan alur lengkap di peramban. Skrip
`db:verifikasi` membuktikan skema di kode TypeScript identik dengan hasil migrasi SQL (K-052).

---

## Bagian B — Riwayat per tahap

### B1. Fase 0 — Fondasi dokumen (19 September 2026)

Belum ada kode. Disusun `CLAUDE.md` dan `docs/01`–`07`: ikhtisar sistem dari Laporan KP, arsitektur, skema database
v3 (41 tabel, dari skema Oracle 19 tabel di laporan KP, diubah ke PostgreSQL dan diperluas), hak akses, aturan
bisnis, harga/piutang/hutang, roadmap 12 fase. Keputusan K-001–K-049 menetapkan bentuk aplikasi (web, satu
server), stok tiga angka (fisik, dipesan, tersedia), HPP rata-rata tertimbang, harga jual yang disimpan (bukan
dihitung diam-diam), retur tiga penyelesaian, void dengan persetujuan, shift dan clerical check dengan hitung buta,
serta ruang lingkup M1 (Fase 1–8) dan M2 (Fase 9–12). DDL v3 diuji di PostgreSQL sebelum dipakai (K-046).

### B2. Fase 1 — Setup lingkungan (29 September)

Monorepo pnpm dengan versi paket dikunci di `pnpm-workspace.yaml` (K-050). Migrasi `0000` = DDL v3 apa adanya;
skema Drizzle ditulis ulang agar identik dan dibuktikan dengan `db:verifikasi` (perbandingan `pg_dump` dua database,
hasil awal 1.468 baris identik). Skrip `db:migrate`, `db:seed` (data awal: konfigurasi, satuan, tier, akun Owner),
`db:reset --ya` (hanya database `*_dev`). Halaman pertama membaca daftar satuan dari API.

### B3. Fase 2 — Akses dasar (30 September)

- **Login dan sesi:** password argon2id (`lib/password.ts`); token sesi acak 256 bit di cookie `sit_sesi`
  (httpOnly, SameSite=Lax), yang disimpan di tabel `sesi_login` hanya hash SHA-256-nya. Sesi berakhir bila diam
  60 menit atau setelah 12 jam. Batas 20 percobaan login per menit per IP; akun terkunci 15 menit setelah 5 kali
  salah. Pengguna baru wajib mengganti password.
- **Penjaga izin** (A3), **penomoran** (A7), **log** (A8), menu sidebar yang disaring izin.
- **Kelola pengguna** (Owner) dan **Pengaturan** per bagian yang disimpan di tabel `konfigurasi` (kunci → nilai).
- Masuk cepat per peran hanya ada saat `NODE_ENV=development` (rute tidak terdaftar di produksi).

### B4. Fase 3 — Data master (30 September)

- **Referensi:** kategori, merk (tabel sendiri, K-063), satuan berdimensi dengan faktor konversi, jenis atribut.
- **Barang:** kode `BRG-nnnnn`, atribut (baris `barang_atribut`), gambar (disimpan di `STORAGE_DIR` dengan nama acak,
  isi berkas diperiksa), stok minimum, kepemilikan milik sendiri/titipan. Setiap barang baru otomatis punya baris
  `persediaan` (lewat ledger) dan satu baris `harga_barang` untuk setiap tier (K-047).
- **Pelanggan dan pemasok:** No. HP wajib; tier, term, dan limit pelanggan hanya diatur Admin/Owner (izin
  `master.pelanggan.atur_kredit`, K-059).
- **Import Excel:** templat dibuat server dari data saat itu; berkas dibaca menjadi baris, pratinjau menjalankan
  `buatBarang()` yang sama dengan form di dalam transaksi yang dibatalkan (savepoint per baris); simpan semua atau
  tidak sama sekali; baris salah bisa diperbaiki di layar (K-061, K-064). Ekspor data barang.
- Uji skala 5.000 barang: pencarian 5–28 ms (K-062).

### B5. Fase 4 — Inti persediaan (1–2 Oktober)

- **Ledger** (A5) dengan rumus HPP rata-rata tertimbang: `HPP baru = (qty lama × HPP lama + qty masuk × harga
  masuk) ÷ (qty lama + qty masuk)`, hanya untuk barang masuk berkondisi baik; barang titipan HPP = harga titip.
- **Penerimaan barang:** pembelian tunai (langsung lunas, dokumen `PBP`) atau tempo (menjadi hutang), titipan
  (konsinyasi); tanggal selalu hari ini.
- **Penyesuaian:** saldo awal (bisa diimpor), koreksi, barang rusak, lembar opname per semua barang/kategori. Barang
  yang tidak dihitung **dikecualikan dengan alasan**, bukan dihapus dari lembar (K-069).
- **Status stok** didefinisikan sekali sebagai ekspresi SQL `sqlStatusStok()`: HABIS (fisik ≤ 0), KRITIS (< minimum),
  PERLU_RESTOCK (≤ minimum × (1 + ambang%)), AMAN (K-068). Kartu stok, notifikasi lonceng, kartu dashboard.
- Stok fisik tidak boleh turun di bawah stok yang dipesan; pesan menyebut order penahannya (K-048).

### B6. Fase 5 — Penjualan (2–3 Oktober)

- **Order dan reservasi:** order MENUNGGU/DIPROSES menaikkan `stok_dipesan`; checkout memotong fisik dan melepas
  reservasi dalam satu transaksi; draf tidak menahan stok (K-006, K-070). Job tiap 15 menit menandai order basi dan
  melepas kunci order yang ditinggal.
- **Checkout** (`penjualan/penjualan/service.ts` `checkout`): satu transaksi database membuat penjualan + detail
  (menyimpan harga dan HPP saat itu), melepas reservasi, mencatat mutasi keluar per baris, mencatat pembayaran,
  menghitung cache tagihan (`tagihan = neto − void − retur`, `sisa = tagihan − (dibayar − refund)`) dan status
  pembayaran, lalu menulis log.
- **Layar kasir cepat** (K-073): papan antrean tiket FIFO yang diperbarui lewat **Server-Sent Events**
  (`lib/siaran.ts`), input order cepat (`3*semen` = qty 3), keyboard penuh (F2 cari, F8 bayar, F9 batal), struk
  dicetak otomatis.
- **Pengantaran:** invoice, surat jalan bertahap (qty kirim ≤ sisa), status pengiriman invoice dihitung ulang.
- **Piutang:** jatuh tempo dari term pelanggan; halaman Piutang; notifikasi jatuh tempo.

### B7. Fase 6 — Koreksi dan kontrol (3 Oktober)

- **Shift:** modal awal; kas manual (kasbon, setor/tarik owner, masuk/keluar lain); tutup shift dengan **hitung
  buta**: `saldo sistem = modal awal + tunai penjualan + kas masuk lain − kas keluar`, selisih ≠ 0 wajib keterangan.
  Pencatatan kas mengunci shift `FOR SHARE`, tutup shift `FOR UPDATE`, sehingga uang tidak bisa masuk ke shift yang
  sedang ditutup (K-075).
- **Void:** hanya penjualan di shift yang masih buka, belum dikirim, tanpa retur; nominal = Σ subtotal baris yang
  di-void; stok kembali lewat mutasi VOID; kelebihan bayar dikembalikan (K-076).
- **Retur:** nilai baris = harga satuan efektif × qty retur; uang kembali / tukar barang sama / potong tagihan;
  kondisi baik ke stok jual, rusak/cacat ke stok rusak (K-077).

### B8. Fase 7 — Laporan dan dashboard (4 Oktober)

Setiap laporan disusun server sebagai `DokumenLaporan` (kop, judul, periode, ikhtisar, tabel, catatan, tanda
tangan) dan dirender sama untuk layar, cetak, dan Excel (exceljs), sehingga angkanya identik (K-078). Definisi angka
(omzet, retur, penjualan bersih, HPP, laba kotor) ditulis di docs/05 §14. Dashboard berbeda per izin; grafik 7 hari
dibuat dengan SVG sendiri.

### B9. Fase 8 — Pengerasan dan deploy (4 Oktober)

- **Mode produksi:** satu port HTTPS melayani API dan hasil build web; skrip PowerShell untuk memasang, memperbarui
  (cadangkan → git pull → build → migrasi), dan memulihkan server Windows di toko; akses luar lewat Tailscale (K-082).
- **Keamanan:** header CSP, anti-frame, batas body 1 MB, CSRF, audit dependensi (K-083; `docs/09-keamanan.md`).
- **Cadangan:** `pg_dump` + folder storage → snapshot restic terenkripsi ke disk lokal dan cloud, retensi 7/4/12/5,
  uji pulih otomatis bulanan ke database sementara (K-084).
- **Lima alur kritis** Playwright wajib lulus sebelum server diperbarui (K-085).

### B10. Fase 9–12 — M2 (4–7 Oktober)

- **Mesin harga (K-086):** dasar markup = harga beli terakhir; harga per tier tetap/markup; pemicu dibandingkan dari
  dasar sebelum dan sesudah kejadian; Tinjau Harga dengan usulan dan margin; urutan kunci baku barang → persediaan →
  harga.
- **Promo (K-087):** satu jalur perhitungan `hitungBarisJual()` untuk order, pratinjau, dan checkout; promo
  dievaluasi ulang saat checkout; promo yang membuat harga di bawah modal dilewati untuk Staf/Kasir.
- **Hutang dan retur pemasok, stok rusak, limit kredit (K-088):** bayar hutang per dokumen; retur ke pemasok
  (potong hutang, ganti barang, uang kembali, pengembalian titipan); bucket stok rusak; pemusnahan; limit kredit
  diperiksa saat checkout tidak lunas.
- **Konsinyasi (K-089):** setoran per pemasok sampai tanggal = terjual × harga titip, dikurangi retur.
- **Label dan satuan jual (K-090, K-091):** barcode Code 128 ditulis sendiri (`shared/code128.ts`); satuan jual per
  barang dengan faktor ke satuan dasar; stok dan HPP selalu dalam satuan dasar.

### B11. Tinjauan pemilik 8–10 Oktober

- Retur barang titipan apa pun kondisinya mengurangi setoran; titipan rusak bisa dikembalikan atau dimusnahkan
  dengan ganti rugi toko (K-092).
- Harga otomatis menjadi bawaan; kemasan disederhanakan; struk dicetak seukuran gulungan (K-094); draf order otomatis
  dan beberapa satuan untuk satu barang (K-095, K-096).
- **Konsep tier diubah tiga kali** dan berakhir pada: tier ditentukan **total nilai belanja** satu transaksi, untuk
  semua barang, selalu otomatis; promo dipotong dari harga tier (`pilihTierBelanja()`; K-097, K-098, K-099).
- **Tinjauan kode (K-100):** galat database dipetakan ke jawaban yang aman (409/503), batas waktu koneksi, halaman
  galat, satu sumber untuk pola berulang.

### B12. Tinjauan pemilik 11 Oktober

- **Kode persetujuan sekali pakai (K-102):** tabel `permintaan_persetujuan` dan `kode_persetujuan`; kode 6 angka
  berbeda per atasan, disimpan hanya hash-nya, 10 menit, sekali pakai, batal setelah 5 kali salah, terikat satu
  dokumen; dikirim lewat bot Telegram (`fetch` ke Bot API) dan email (nodemailer). Menggantikan password atasan di
  layar kasir.
- **Struk ESC/POS (K-103):** `shared/escpos.ts` menyusun byte perintah printer; `web/lib/printer-thermal.ts`
  mengirimnya lewat Web Serial; pengaturan per komputer.
- **Penyiapan terpandu (K-105):** komponen `Langkah` bercentang; uji kirim per saluran yang selalu sungguhan.

### B13. Tinjauan pemilik 12–13 Oktober (tiga gelombang)

- **Gelombang 1 (K-106):** cache data akun dibuang setiap login (`gantiPengguna`); `FormItem` `content-start` agar form
  sejajar; pohon laporan; bayar campuran yang bisa dihapus per bagian; "Mulai dari awal" dengan konfirmasi;
  penyiapan global tes layar.
- **Gelombang 2 (K-107, K-108):** ubah/nonaktif pelanggan oleh Kasir/Staf butuh kode yang terikat **sidik**
  SHA-256 dari isian perubahan; posisi kredit di daftar pelanggan; pencarian barang per kata lewat nama, kode,
  barcode, merk, kategori, dan atribut dengan urutan relevansi (`cocokCari`, `urutanRelevan`).
- **Gelombang 3 (K-109–K-111):** shift lewat hari mengunci pencatatan (`shiftUntukCatat`), jadwal shift dibekukan per
  shift, job pengingat 5 menit; anggaran promo dan batas per pembeli dengan kunci `FOR UPDATE` saat checkout; tabel
  `rekening_toko`, metode QRIS, status pengecekan per pembayaran non-tunai (migrasi 0015–0018).

### B14. Inventaris fitur dan Fase 14 (14–17 Oktober)

- `LAPORAN-FITUR-APLIKASI.md` disusun dari kode dengan rujukan `berkas:baris` untuk Proposal TA, dan jawaban pemilik
  dicatat (K-113).
- **Tampilan muat (K-114):** `TabsList` membungkus; layar kasir 1/2–1/2; panel rincian barang (`panel-detail-barang.tsx`)
  menutupi area antrean saat barang disorot, dipicu callback `onSorot` dari kotak cari yang hanya dipanggil saat
  barang/satuan/qty yang disorot berganti.
- **Panduan printer umum (K-115):** semua printer ESC/POS; langkah membuat port COM keluar.
- **Rekomendasi pemesanan ulang (K-113, migrasi 0019)** — dijelaskan rinci di Bagian C.

---

## Bagian C — Rincian fitur yang dibangun setelah dokumen ini dibuat

Mulai 17 Oktober 2026 setiap fitur baru dicatat di sini dengan lebih rinci.

### C1. Rekomendasi pemesanan ulang (17 Oktober 2026, K-113)

**Tujuan:** membantu Admin/Owner memutuskan *kapan* dan *berapa banyak* barang dibeli ulang, menggantikan perkiraan
manual dari stok minimum.

**Data yang dipakai (semuanya sudah ada, tidak ada pencatatan baru oleh kasir):**
- Ledger `mutasi_persediaan`: terjual bersih per barang = keluar PENJUALAN + TUKAR_RETUR − masuk RETUR_JUAL + VOID.
  Memakai ledger (bukan tabel penjualan) membuat void, retur, dan tukar barang otomatis ikut terhitung dengan benar.
- Cache `persediaan`: stok tersedia (fisik − dipesan), harga beli terakhir.
- `penerimaan_barang(_detail)`: pemasok pembelian terakhir tiap barang.
- `pemasok.lama_kirim_hari`, `pemasok.jarak_belanja_hari` (kolom baru, migrasi 0019, boleh kosong).
- `konfigurasi`: periode (30 hari), hari pengaman (2), bawaan lama kirim (3) dan jarak belanja (7).

**Kerangka kode:**
- `persediaan/saran-pesan/repo.ts` — satu kueri: barang aktif milik sendiri + persediaan + kategori + satuan, dengan
  subkueri berkorelasi untuk terjual dalam periode, tanggal mutasi pertama, pemasok pembelian terakhir, dan kemasan
  aktif terbesar.
- `persediaan/saran-pesan/hitung.ts` — fungsi murni `hitungSaran()` (diuji dengan angka contoh). Setiap angka dibagi
  hari amatan **sekali** dari total (`terjual × hari ÷ hari amatan`) supaya pembulatan tidak menumpuk; saran
  dibulatkan ke atas ke satuan utuh lewat helper baru `bulatAtasQty()`.
- `persediaan/saran-pesan/service.ts` — membaca parameter, menghitung hari amatan (barang yang lebih baru dari
  periode diamati sejak mutasi pertamanya), memilih parameter pemasok atau bawaan, menghitung, menyaring per izin
  (perkiraan biaya hanya untuk `master.barang.lihat_hpp`), mengurutkan (status, lalu stok cukup paling sedikit), dan
  merangkum per pemasok.
- `persediaan/saran-pesan/routes.ts` — `GET /api/saran-pesan` (izin `persediaan.stok.lihat`).
- `laporan/rekomendasi-pesan.ts` — laporan formal yang memakai service yang sama (satu sumber angka), dikelompokkan
  per pemasok.
- Notifikasi `PERLU_DIPESAN` di `sistem/notifikasi/service.ts`.
- Web: `features/persediaan/tab-saran-pesan.tsx` (kartu status sebagai saringan, saring pemasok/kategori/cari, grup
  per pemasok, penjelasan rumus dengan contoh), isian di form pemasok dan Pengaturan › Operasional.

**Alur logika:** periode berakhir **kemarin** karena penjualan hari ini belum selesai dan akan menurunkan rata-rata
bila ikut dihitung. Status ditentukan berurutan: tidak terjual → Tidak laku; tersedia ≤ titik pesan → Pesan sekarang;
tersedia < stok target → Segera pesan; selain itu Aman. Barang titipan dikecualikan karena stoknya diisi penitip.
Hasil tidak disimpan: dihitung saat diminta, sesuai aturan "tidak ada angka hasil hitung tanpa sumber kebenaran".

**Tes:** `saran-pesan.test.ts` — empat tes rumus murni (contoh K-113: 240 terjual/30 hari, kirim 3, belanja tiap 7,
pengaman 2, tersedia 40 → titik 40, saran 56, 6 dus; status Segera/Aman; pembulatan pecahan; tidak laku) dan dua tes
data sungguhan (penerimaan, penjualan, void yang dikurangkan, riwayat 10 hari, parameter pemasok, barang titipan
dan nonaktif tidak ikut, notifikasi, laporan, Kasir ditolak 403). Tes layar `saran-pesan.spec.ts`.

---

## Riwayat dokumen

- 2026-10-17 — v1: dibuat atas permintaan pemilik (K-118); Bagian A–B dari catatan keputusan dan riwayat git
  (146 commit non-merge, 29 September–17 Oktober 2026); Bagian C1 rekomendasi pemesanan ulang.
