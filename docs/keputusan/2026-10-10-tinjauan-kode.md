# Keputusan Tinjauan Kode — 10 Oktober 2026

Melanjutkan penomoran dari `2026-10-10-persetujuan-ditempat-tier-otomatis.md`. Seluruh butir adalah keputusan
teknis Claude Code atas permintaan pemilik proyek untuk meninjau seluruh basis kode (standar, konsistensi,
kesiapan dikembangkan, keamanan). Tidak ada aturan bisnis yang berubah.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-100 — Tinjauan menyeluruh kualitas kode: pengerasan dan satu sumber untuk pola berulang

**Status:** menambah docs/02 §4 (model galat), §8, §11; docs/04 §6–§7 (batas laju persetujuan di tempat);
docs/09 (review kedua). Menghapus dua variabel `.env` yang tidak pernah dipakai (butir 12).

**Cakupan yang ditinjau:** seluruh `apps/api/src` (34 berkas rute di 12 kelompok modul, middleware, `lib/`, skema dan migrasi),
`apps/web/src`, `packages/shared`, tes API, dan tes e2e. Pemeriksaan: pembacaan modul uang, stok, sesi, dan
izin baris demi baris; pencarian mekanis atas aturan CLAUDE.md; `pnpm audit`; pencarian kode mati dan impor
melingkar; pencarian pola yang ditulis berulang.

**Yang ditemukan sudah benar (tidak diubah):** stok hanya ditulis `catatMutasi()` dan `ubahReservasi()`
dengan kunci baris berurutan; tabel transaksi tidak pernah di-UPDATE isinya; setiap rute punya penjaga izin
dan server menolak menyala bila ada yang terlewat; data sensitif disaring di API; tidak ada SQL yang dirakit
dari masukan pengguna; unggahan diperiksa tanda tangan byte-nya dan diberi nama oleh server; tidak ada `any`,
`@ts-ignore`, atau `console.*`; tidak ada rahasia di riwayat git; `pnpm audit --prod` bersih; tidak ada impor
melingkar di luar berkas skema Drizzle; laporan dibatasi 366 hari dan tidak punya query berulang per baris.

**Keputusan — pengerasan:**

1. **Galat database punya jawaban sendiri**, bukan "kesalahan server" (`middleware/error-handler.ts`):
   kebuntuan, gagal serialisasi, dan menunggu kunci terlalu lama (SQLSTATE `40P01`, `40001`, `55P03`) → 409
   "sedang diproses pengguna lain, coba lagi"; pernyataan melewati batas waktu (`57014`) → 503; komputer
   server kehabisan memori, ruang penyimpanan, atau koneksi (`53100`, `53200`, `53300`) dan database tidak
   bisa dihubungi (`57P01`–`57P03`, `08xxx`, `ECONNREFUSED`) → 503 dengan pesan yang menyebut sebabnya; aturan
   database menolak data (`23514`, `23503`, `22003`, `22001`) → 400 dan dicatat `error` karena berarti
   validasi service punya celah. Semuanya membatalkan transaksi secara utuh, jadi aman diulang.
2. **Batas waktu koneksi database** (`db/client.ts`): pernyataan 60 detik, menunggu kunci 15 detik, transaksi
   menganggur 60 detik, menunggu koneksi 10 detik. Tanpa batas, satu transaksi macet menahan kunci barisnya
   selamanya dan menghentikan semua kasir yang menyentuh barang yang sama. Migrasi dan cadangan memakai
   koneksi sendiri sehingga tidak terkena.
3. **Proses tidak mati diam-diam:** koneksi menganggur yang diputus database dicatat (tanpa pendengar, Node
   menghentikan proses); galat yang tidak tertangkap dicatat `fatal` ke log lalu proses keluar dengan kode 1
   supaya penjaga `jalankan-server.ps1` menyalakannya lagi (K-082). Sebelumnya jejak galat hanya ke stderr,
   yang hilang karena server toko berjalan tanpa konsol. Penghentian rapi (SIGINT/SIGTERM) dipaksa selesai
   setelah 10 detik, karena koneksi siaran antrean (SSE) bisa menahan `server.close` beberapa menit. Job order
   basi (R7, R8) memproses tiap order di transaksinya sendiri dan melewati order yang gagal (dicatat `error`),
   supaya satu order bermasalah tidak menahan order sesudahnya di setiap putaran.
4. **Batas laju persetujuan di tempat:** 20 percobaan per menit per pengaju, berhasil maupun gagal (sama
   dengan login per IP). Penguncian akun (K-099) membatasi tebakan per akun atasan; batas ini membatasi jumlah
   pemeriksaan argon2id yang bisa dipicu satu sesi kasir. Pembatas dipindah ke `lib/batas-percobaan.ts`
   (berkunci bebas), middleware login menjadi pemakainya.
5. **`GalatAngka`** (`packages/shared/src/angka.ts`): hasil hitung di luar batas (rupiah di atas
   `Number.MAX_SAFE_INTEGER`, qty di luar `numeric(14,3)`) kini galat bertipe sendiri dan dijawab 400 "angka
   terlalu besar", bukan 500. Turunan `RangeError`; `RangeError` lain tetap dianggap kesalahan program.
6. **Halaman galat di web** (`features/umum/halaman-galat.tsx`, `errorElement` dua lapis): menggantikan layar
   galat bawaan React Router. Bila berkas halaman gagal diunduh karena server baru diperbarui, halaman dimuat
   ulang sendiri (paling sering sekali per menit); bila server tidak menjawab, pesannya menyebut server dan
   jaringan. Galat di satu halaman tampil di dalam kerangka sehingga menu samping tetap bisa dipakai. Tes e2e
   `galat.spec.ts`.

**Keputusan — satu sumber untuk pola yang ditulis berulang:**

7. **API:** `galatKolom(kolom, pesan, kode?)` dan `galatBaris(i, kolom, pesan)` di `lib/errors.ts`
   (sebelumnya tiga modul punya `galatKolom` dengan urutan argumen berbeda, empat modul punya `galatBaris`
   sendiri, dan 20 tempat lain merakit bentuk yang sama dengan tangan); `paramId` di `lib/validasi.ts` (23 berkas rute); `batasUnggahGambar`, `batasUnggahXlsx`,
   `berkasKiriman` di `lib/unggah.ts` (4 rute unggah).
8. **Web:** `paramId` di `api/client.ts` (6 salinan); `qtySah` dan `qtyDariIsian` di `lib/qty.ts` (dua fungsi
   lokal bernama `teksQty` berbenturan nama dengan pemformat `teksQty` di `packages/shared`); label metode
   pembayaran dari `packages/shared` (`LABEL_METODE_PEMBAYARAN`, baru `LABEL_METODE_PEMBAYARAN_PEMASOK`);
   satu `KELIPATAN_PERKIRAAN`. Perkiraan diskon persen di form order memakai `persenKeRupiah` (pembulatan yang
   sama dengan API) dan tidak lagi menghasilkan "NaN" saat persen diketik dengan koma.
9. **Tes:** `siapkanTierNormal()` di `test/fixtur-persediaan.ts`; lima berkas tes sebelumnya lulus hanya bila
   berkas tes lain sudah lebih dulu meninggalkan tier "NORMAL" di database uji. Diverifikasi dengan
   mengosongkan skema uji lalu menjalankan tiap berkas sendirian.
10. **E2E:** satu fungsi `api()` di `e2e/pembantu.ts` (19 salinan, dua varian perilaku).
11. **Kode mati dibuang:** `satuanJualPerBarang`, `namaPromo`, `ubahNilai`, `ambilBool` (tidak dipanggil dari
    mana pun, termasuk tes).
12. **`.env.example` disamakan dengan `env.ts`:** `SESSION_SECRET` dan `SEED_CONTOH` dihapus karena tidak
    pernah dibaca kode (sesi memakai token acak yang disimpan sebagai hash, K-054, sehingga tidak ada yang
    perlu ditandatangani; data contoh tidak pernah dibuat). Variabel `CADANGAN_*` (K-084) ditambahkan sebagai
    contoh berkomentar. `.env` yang sudah ada tidak perlu diubah: variabel berlebih diabaikan.

*Alasan:* aturan bisnis dan pengamannya sudah kuat; yang tersisa adalah perilaku saat keadaan tidak normal
(database lambat, dua kasir berebut, server diperbarui saat tab terbuka) dan pola kecil yang disalin dari
modul ke modul. Pola yang disalin adalah tempat modul berikutnya mulai berbeda diam-diam, seperti urutan
argumen `galatKolom` yang sudah berbeda di tiga modul.

*Ditolak:* mengulang transaksi otomatis di server saat kebuntuan (menyembunyikan perebutan kunci yang
seharusnya terlihat di log; pengguna cukup menekan simpan lagi); pembatas laju di database atau Redis (satu
server, catatan boleh hilang saat server dinyalakan ulang; penguncian akun tetap tersimpan di database);
memecah komponen besar sekarang (form barang 1.100 baris, form order 870 baris; risiko regresi tanpa manfaat
fungsi, dikerjakan saat komponen itu berikutnya diubah, docs/08 D-K1); menghapus ekspor komponen shadcn/ui
yang belum dipakai (komponen dasar, bukan kode aplikasi).

*Temuan saat pengujian:* ketika tes e2e berjalan di komputer pengembangan (RAM 7,7 GB, memori hampir penuh),
PostgreSQL sekali menjawab `out of memory` untuk query ringan, dan pengguna hanya melihat "kesalahan pada
server". Dari situ pemetaan `53xxx` di butir 1 ditambahkan. Untuk server toko: sediakan RAM lega (docs/08 D-K9).

*Catatan untuk pemilik (butuh keputusan konsep):* izin melampaui limit kredit pelanggan saat ini hanya bisa
diberikan oleh pengguna yang sedang login dan memegang `master.pelanggan.atur_kredit`. Di toko dengan satu
perangkat ini masalah yang sama dengan retur sebelum K-099: kasir harus keluar agar atasan bisa masuk.
Usulan: pakai dialog *Persetujuan atasan* yang sama (docs/08 D-K2).
