# Rancangan Order Pembelian ke Pemasok (K-125)

Tanggal: 24 Oktober 2026. Status: **disetujui pemilik 24 Oktober 2026** (termasuk uang muka; dikelola Admin dan
Owner). Dikerjakan setelah K-126, sebelum deploy uji. Melanjutkan K-125 (PO masuk
v1.0.0) dan K-127 butir 3 (lama kirim aktual).

## 1. Alur umum yang dipakai (praktik standar toko/distributor)

```
Draf ──Kirim ke pemasok──► Dipesan ──Konfirmasi pemasok──► Dikonfirmasi
  │                           │                                  │
  └─ Batal                    └─ Batal (belum ada barang datang) ├─ (opsional) Uang muka
                                                                 ▼
                                   Penerimaan Barang dari PO (boleh berkali-kali, sebagian)
                                                                 │
                                       Sebagian diterima ────────┤
                                                                 ▼
                                      Selesai (semua datang)  atau  Ditutup (sisa tidak jadi dikirim, alasan)
```

1. **Draf**: Admin/Owner membuat PO untuk satu pemasok: barang, qty, perkiraan harga beli. Bisa dibuat langsung
   dari tab **Saran pesan** ("Buat order pembelian" per pemasok, qty = saran). Masih boleh diubah.
2. **Kirim ke pemasok**: nomor PO terbit (`PO-yymmdd-nnn`), isi dikunci, tanggal pesan dicatat. PO bisa dicetak A4
   atau disalin sebagai teks WhatsApp.
3. **Konfirmasi**: jawaban pemasok dicatat: **tanggal janji kirim** dan, bila pemasok mengubah, qty/harga per
   baris (perubahan tercatat di log, angka lama tetap terlihat).
4. **Uang muka** (opsional, bila pemasok minta bayar dulu): dicatat tunai/transfer beserta tanggal. Saat barang
   diterima dan hutang terbit, uang muka otomatis dipakai sebagai pembayaran hutang penerimaan itu.
5. **Penerimaan Barang dari PO**: di halaman Penerimaan Barang pilih PO; baris terisi sisa yang belum datang,
   qty dan harga boleh disesuaikan dengan faktur. Satu PO boleh diterima beberapa kali. Penerimaan tanpa PO
   tetap bisa seperti sekarang.
6. **Selesai / Ditutup / Batal**: semua qty sudah datang = Selesai otomatis. Sisa yang tidak jadi dikirim =
   **Tutup sisa** dengan alasan. **Batal** hanya bila belum ada barang diterima; uang muka yang sudah dibayar
   harus dicatat dikembalikan atau dijadikan potongan hutang.

## 2. Dampak ke bagian lain

- **Saran pesan**: qty yang sudah dipesan tetapi belum datang (PO Dipesan/Dikonfirmasi/Sebagian) mengurangi
  saran dan ditampilkan sebagai kolom "Sudah dipesan", supaya tidak dipesan dua kali.
- **Lama kirim aktual**: per pemasok = rata-rata (tanggal penerimaan pertama − tanggal kirim PO) dari PO yang
  sudah menerima barang. Bila sudah ada minimal 3 PO, angka ini dipakai saran pesan menggantikan isian manual
  (ditandai "aktual"); di bawah 3 tetap memakai isian manual.
- **Notifikasi**: PO yang lewat tanggal janji kirim tetapi barangnya belum (lengkap) datang.
- **Hutang**: tidak berubah; hutang tetap lahir dari Penerimaan Barang (PO bukan hutang). Uang muka tercatat
  sebagai pembayaran di muka dan menjadi pembayaran hutang saat barang diterima.
- **Stok**: tidak berubah oleh PO; stok baru bertambah saat Penerimaan Barang (aturan ledger tetap).

## 3. Data (perkiraan)

- `order_pembelian`: nomor, tanggal, id_pemasok, status (DRAF, DIPESAN, DIKONFIRMASI, SEBAGIAN, SELESAI,
  DITUTUP, BATAL), tanggal_dipesan, tanggal_janji_kirim, catatan, alasan tutup/batal, pembuat.
- `order_pembelian_detail`: id_barang, qty_pesan, harga_perkiraan, qty_diterima (cache, disinkronkan di transaksi
  penerimaan).
- `uang_muka_pemasok`: id_order_pembelian, tanggal, metode, nominal, terpakai (hanya-tambah).
- `penerimaan_barang.id_order_pembelian` dan `penerimaan_barang_detail.id_order_pembelian_detail` (boleh kosong).

## 4. Hak akses

Membuat, mengirim, mengonfirmasi, menutup, membatalkan PO dan mencatat uang muka: **Admin, Owner** (sama dengan
penerimaan barang). Harga perkiraan termasuk data harga beli: hanya terlihat oleh yang boleh melihat harga modal.

## 5. Di luar cakupan v1.0.0

Persetujuan berjenjang PO, portal pemasok, mata uang asing, PO ke banyak pemasok sekaligus.
