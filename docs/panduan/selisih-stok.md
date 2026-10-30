# Selisih stok karena salah input atau salah serah (K-200)

Panduan ini untuk pemilik, admin, dan kasir. Isinya tiga lapis: **mencegah**, **mengajari**, dan **menangani**
selisih antara stok di aplikasi dan stok di gudang yang terjadi karena kesalahan manusia (bukan pencurian).

## Dua jenis kesalahan

| Jenis | Contoh | Akibat |
|---|---|---|
| **Salah input** (di aplikasi) | Pembeli membeli 1, kasir mengetik 2 (dan menyerahkan 1). Pembeli membeli 2, tercatat 1. Barang lain ikut terinput. Satuan keliru (dus vs pcs). | Stok aplikasi lebih sedikit/lebih banyak dari gudang; uang laci bisa ikut berbeda. |
| **Salah serah** (di gudang) | Catatan benar, tetapi yang diserahkan/dikirim kurang, lebih, atau barangnya keliru. | Stok gudang berbeda dari aplikasi; pembeli bisa dirugikan atau diuntungkan. |

## 1. Mencegah

Yang sudah dilakukan aplikasi:
- **Qty tidak biasa ditandai.** Bila qty satu barang lebih dari 2× jumlah terbanyak yang pernah dijual dalam satu
  transaksi selama 90 hari terakhir, baris di keranjang diberi tanda kuning, dan sebelum bayar muncul pertanyaan
  *Qty tidak biasa, benar?* (**Periksa lagi** atau **Benar, lanjut bayar**). Ini menangkap salah ketik 2 menjadi 20.
- **Stok tidak cukup ditolak.** Kasir tidak bisa menjual lebih dari stok yang tersedia.
- **Struk dan surat jalan menulis qty dan satuan.** Cocokkan struk dengan barang sebelum diserahkan.
- **Barang yang belum diambil** ditandai di *Penjualan Langsung › Belum diambil*, jadi tidak lupa diserahkan.
- **Surat jalan dicentang Dimuat per surat jalan** sebelum rit berangkat (K-203), dan hasil kirim dicatat per
  barang (diterima/kembali/rusak).

Kebiasaan yang dianjurkan untuk toko:
1. **Baca ulang** isi keranjang ke pembeli sebelum bayar ("dua sak semen, satu kaleng cat — benar?").
2. **Serahkan barang sambil melihat struk**, centang dalam hati satu per satu.
3. Untuk barang mahal atau laris, lakukan **hitung cepat** (opname kecil) tiap minggu: *Penyesuaian Stok* jenis
   *Opname* untuk satu kategori saja.

## 2. Mengajari

- Panduan ini dan bagian *Penyesuaian stok* di manual pengguna.
- Saran alasan siap pakai di *Penyesuaian Stok* jenis *Koreksi*: "Salah serah: barang diberikan lebih/kurang dari yang
  tercatat (transaksi …)", "Salah serah: barang yang diberikan keliru (transaksi …)", "Hasil hitung fisik berbeda,
  penyebab belum diketahui". Isi nomor transaksinya bila diketahui supaya jejaknya jelas.
- Uji pemilik U159 melatih alur ini.

## 3. Menangani (langkah demi langkah)

### a. Ketahuan saat transaksi masih berjalan (pembeli masih di toko)
- Belum dibayar: perbaiki qty di keranjang.
- Sudah dibayar, **shift yang sama**: *Void Transaksi* baris yang salah (uang kembali dari laci), lalu jual ulang
  yang benar.
- Sudah lewat shift: *Retur Penjualan* (kelebihan input: retur barang yang tidak pernah diserahkan, uang kembali
  atau potong tagihan).

### b. Ketahuan belakangan dari hitung fisik (selisih di gudang)
1. Buka **Laporan › Kartu Stok** untuk barang itu, periode sejak hitung terakhir. Lihat transaksi satu per satu:
   siapa, kapan, berapa. Cari yang janggal (qty lebih besar dari biasanya, barang yang biasanya dibeli bersama).
2. Tanyakan kasir/gudang yang menangani transaksi itu; bila ada, hubungi pembelinya (No. HP di invoice).
3. Putuskan:
   - **Salah input, barang tidak pernah diserahkan** (tercatat 2, diserahkan 1): *Retur Penjualan* 1 dengan alasan
     "Salah input qty", uang dikembalikan/tagihan dipotong. Stok aplikasi kembali sesuai gudang.
   - **Salah serah, pembeli menerima lebih** (tercatat 1, diserahkan 2): tagih pembeli bila memungkinkan (jual 1 lagi
     ke pelanggan itu). Bila tidak bisa ditagih: *Penyesuaian Stok* jenis *Koreksi* −1 dengan alasan "Salah serah:
     barang diberikan lebih dari yang tercatat (transaksi …)".
   - **Salah serah, pembeli menerima kurang**: serahkan kekurangannya ke pembeli; stok aplikasi sudah benar.
   - **Barang keliru**: tukar dengan pembeli bila bisa; bila tidak, dua *Koreksi* (barang yang keluar −, barang yang
     tercatat +) dengan alasan "barang yang diberikan keliru (transaksi …)".
   - **Tidak ketemu penyebabnya**: *Opname* atau *Koreksi* dengan alasan "penyebab belum diketahui". Semua koreksi
     tercatat di log dan di laporan penyesuaian; pemilik bisa melihat pola (barang/kasir yang sering selisih).
4. Selisih uang laci dari salah input tunai terlihat di clerical check shift itu (bantuan selisih menampilkan
   linimasa tunai).

## Yang direncanakan berikutnya (usulan, belum dikerjakan)
- Laporan "barang paling sering dikoreksi" dan "koreksi per pengguna" untuk melihat pola.
- Hitung cepat per barang langsung dari Kartu Stok (satu klik membuat opname satu barang).
- Kolom nomor transaksi terstruktur di baris koreksi (sekarang lewat alasan).
