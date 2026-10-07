# Keputusan dari Tinjauan Pemilik atas Fase 9–12 — 8 Oktober 2026

Melanjutkan penomoran dari `2026-10-07-satuan-jual.md`. Pemilik proyek mencoba Fase 9–12 dan memberi masukan;
butir **(pemilik)** berasal langsung dari masukan itu, butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-092 — Barang titipan yang diretur/rusak: siapa menanggung (menggantikan sebagian K-089 butir 3)

**Keputusan:**

1. **(pemilik) Retur pelanggan atas barang titipan, apa pun kondisinya, mengurangi setoran.** Barang kembali
   menjadi milik penitip: kondisi baik kembali ke stok jual titipan, rusak/cacat masuk stok rusak titipan.
   (Sebelumnya hanya retur kondisi baik yang mengurangi; retur rusak membuat toko membayar barang yang tidak laku.)
2. **(pemilik) Barang titipan di stok rusak diselesaikan dengan salah satu dari dua tombol di tab Stok rusak:**
   - **Kembalikan ke penitip** (Retur ke Pemasok › Pengembalian titipan): penitip menanggung, toko tidak membayar.
   - **Musnahkan (toko ganti rugi)**: toko menanggung, nilai harga titip saat dimusnahkan **ditagihkan ke toko**
     pada setoran berikutnya (kolom "Ganti rugi toko" di nota setoran).
   Dengan begitu "kalau toko yang salah, toko yang ganti" tanpa langkah tambahan: pilihan tindakannya sekaligus
   menentukan siapa yang menanggung.
3. **Tukar barang tetap netral** bagi setoran (barang kembali dan barang pengganti keluar saling meniadakan); bila
   barang yang ditukar rusak, barang rusaknya tercatat di stok rusak titipan dan diselesaikan seperti butir 2.
4. **(pemilik) Tukar dengan stok pengganti kurang** ditolak sejak pengajuan dengan pesan berapa yang bisa ditukar;
   sisanya diajukan sebagai retur uang kembali atau potong tagihan (dua dokumen retur untuk penjualan yang sama).
5. Skema (migrasi 0007): `penyesuaian_stok_detail.id_penyelesaian_konsinyasi` (penanda pemusnahan yang sudah
   ditagihkan) dan `penyelesaian_konsinyasi_detail.qty_ganti_rugi`. Qty disetor = terjual − retur + ganti rugi.

*Ditolak:* pilihan "ditanggung toko/penitip" di setiap pemusnahan (menambah satu keputusan di setiap transaksi;
penitip yang menanggung cukup menerima barangnya kembali).

### K-093 — Perbaikan dan penyederhanaan dari tinjauan pemilik

1. **Pratinjau laporan = kertas asli.** Pratinjau digambar seukuran A4 (potret/lanskap) dengan margin cetak lalu
   diperkecil agar muat layar; tabel memakai lebar kolom tetap dan teks membungkus. Isi pratinjau sama dengan hasil
   cetak dan tidak lagi melewati batas kertas.
2. **(pemilik) Label thermal 58/57/80 mm** menjadi pilihan utama (satu label per baris, kertas gulungan, ukuran
   kertas `58mm auto`); kertas label A4 tetap tersedia. Pilihan terakhir diingat per perangkat.
3. **(pemilik) Saringan kepemilikan** (milik toko/titipan) dan **kondisi** (baik/rusak) di tab Mutasi; saldo baris
   stok rusak diberi tanda "rusak". Saringan kepemilikan juga di Data Barang. Nomor penjualan dan retur pemasok di
   tab Mutasi menjadi tautan.
4. **(pemilik) Qty di kotak cari kasir/order:** `3*semen`, `3x semen`, atau `semen*3`; **F1** menyisipkan `*`.
   Qty paling banyak 6 digit sehingga angka lebih panjang dibaca sebagai barcode (`8991234567890*2` = barcode × 2).
   Nama barang tidak boleh memuat `*` (validasi form dan import).
5. **(pemilik) Alur konsinyasi lebih jelas:** halaman Konsinyasi menampilkan 4 langkah singkat (daftarkan barang
   titipan → terima → jual → setor & bayar) dengan tombol langsung; form barang bisa dibuka dengan penitip terisi
   (`?titipan=`), penerimaan dengan jenis Konsinyasi terisi; form penerimaan konsinyasi memberi tautan "daftarkan
   barang titipan baru". Semua pemasok bisa menjadi penitip; yang membuat barang menjadi titipan adalah isian
   Kepemilikan di Data Barang.
6. **Satuan jual lebih ringkas:** isian ditulis "1 dus = … pcs"; hanya harga tier bawaan yang tampil, tier lain
   dilipat; harga kosong berarti otomatis (harga satuan dasar × isi). Penjelasan sakelar "Harga otomatis" di form
   barang ditulis ulang dengan bahasa sehari-hari.
7. **Kinerja:** daftar mutasi/kartu stok tidak lagi menggabungkan 17 tabel dalam satu kueri (perencanaan kueri
   PostgreSQL ±130 ms → total ±23 ms); kandidat retur/void dimuat dengan satu kueri, bukan satu per penjualan.
   Endpoint harian lain terukur 7–25 ms di data dev.
