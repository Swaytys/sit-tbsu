# Keputusan Label Barang dan Daftar Harga (Fase 12, bagian 1) — 7 Oktober 2026

Melanjutkan penomoran dari `2026-10-07-konsinyasi.md`. Keputusan teknis Claude Code sesuai kewenangan yang
diberikan pemilik proyek (sesi kerja mandiri). Butir **(tinjau pemilik)** sebaiknya dikonfirmasi.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-090 — Cetak label barcode dan Daftar Harga (katalog)

**Keputusan:**

1. **Barcode Code 128 ditulis sendiri** (`packages/shared/src/code128.ts`, ±60 baris): tabel lebar standar
   107 simbol, set B untuk teks, set C untuk angka berpanjang genap, checksum modulo 103. Tabel diverifikasi
   silang dengan pustaka python-barcode (106 simbol + stop identik) dan diuji paritas/jumlah modul.
   *Alasan:* menghindari dependency baru (CLAUDE.md aturan 14) untuk fungsi kecil. *Ditolak:* JsBarcode/bwip-js;
   EAN-13 (hanya untuk barcode pabrik 13 digit, sedangkan kode barang toko berupa teks `BRG-xxxxx`).
2. **Isi barcode = barcode pabrik bila ada, selain itu kode barang.** Keduanya sudah bisa dicari di layar kasir
   (pencarian kode/barcode), jadi label langsung bisa dipindai tanpa data tambahan.
3. **Halaman Data Barang › Cetak label** (`/barang/label`, `master.barang.kelola`): pilih barang dan jumlah
   label, harga tier yang dicetak, tampil/sembunyikan harga, "mulai dari label ke-" (memakai sisa lembar yang
   sudah terpakai sebagian), pratinjau lembar pertama, cetak beberapa lembar A4.
   **(tinjau pemilik)** Dua ukuran kertas label disediakan: label harga rak 3 × 8 (63,5 × 33,9 mm) dan stiker
   barcode 4 × 10 (48,5 × 25,4 mm) per A4. Ukuran lain (atau printer label thermal) bisa ditambahkan setelah
   pemilik menyebut merek/ukuran kertas yang dipakai toko. **Uji pindai dengan scanner toko sebelum dipakai
   massal.**
4. **Daftar Harga (katalog)** sebagai laporan baru di grup Penjualan (`laporan.penjualan`, boleh Kasir): barang
   aktif per kategori, kolom harga per tier aktif (urutan tier), saringan kategori, cetak/PDF dan ekspor Excel
   dari mesin laporan yang sama. Hanya harga jual (tidak sensitif). *Ditolak:* fitur ekspor terpisah di halaman
   Harga Jual (sudah ada ekspor Excel untuk impor ulang, K-061; katalog untuk pelanggan butuh format laporan).
5. Perbaikan kecil: subjudul Laporan Konsinyasi tertulis "Periode Periode …".

**Belum dikerjakan (Fase 12 bagian 2):** multi-satuan jual (satuan jual per barang dengan faktor, harga per
satuan jual H11, dropdown satuan di order/kasir, retur dan surat jalan per satuan jual).
