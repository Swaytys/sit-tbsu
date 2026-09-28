# 01 — Ikhtisar Sistem

## 1. Konteks

UD. Sumber Urip adalah toko bahan bangunan di Jl. Peterongan No. 104, Peterongan, Jombang. Menjual semen, besi
beton, pasir, cat (termasuk racikan Nippon Paint), pipa PVC, triplek, kayu, baja ringan, alat tukang, kelistrikan,
dan perlengkapan kamar mandi. Sampai sekarang seluruh pencatatan manual di buku (Buku Transaksi Penjualan, Buku
Persediaan Barang, buku katalog) ditambah nota dan surat jalan tulisan tangan.

Masalah yang harus dipecahkan (Laporan KP Tabel 5.2):

1. Penjualan langsung tidak selalu dicatat; rekap penjualan tidak akurat.
2. Saat ramai, kasir tidak tahu rincian barang yang diserahkan staf; selisih sulit terdeteksi.
3. Retur dicatat dengan mengubah/menghapus catatan lama; jejak hilang.
4. Penjualan pengantaran memakai tiga media pencatatan; status transaksi, kiriman, dan bayar tidak sinkron.
5. Data barang belum berupa master yang terstruktur.
6. Mutasi stok manual; riwayat tidak terlacak.
7. Tidak ada pengelolaan harga bertingkat (retail / grosir biasa / grosir distributor).
8. Tidak ada laporan operasional.

Sistem ini menjawab kedelapan masalah tersebut dan menambah fitur operasional toko yang diminta pemilik proyek
(lihat ruang lingkup M2).

## 2. Ruang lingkup

### M1 — Ruang lingkup Laporan KP + perbaikan integritas + fitur basic murah

- Login, sesi, hak akses 4 peran, log aktivitas, kelola pengguna, pengaturan profil toko.
- Data master: kategori, satuan (dengan dimensi dan konversi), jenis atribut, barang (atribut fleksibel, 3 tier
  harga tetap), pelanggan (tier harga, term bayar), pemasok. Import Excel barang dan saldo awal stok.
- Persediaan: ledger mutasi, stok fisik / dipesan / tersedia, penerimaan barang (pembelian tunai/tempo, konsinyasi),
  HPP rata-rata tertimbang, harga beli terakhir, penyesuaian (saldo awal, opname, koreksi, rusak), kartu stok,
  status stok, peringatan stok minimum.
- Penjualan: order (antrean, prioritas, reservasi stok, order basi), penjualan langsung (tier per baris, diskon
  baris, bayar campuran, kembalian, struk, status pengambilan), penjualan pengantaran (alamat, ongkir, invoice,
  surat jalan bisa parsial, sopir/kendaraan, timeline status), pembayaran (penuh, DP, pelunasan, bayar saat terima),
  daftar piutang dan jatuh tempo.
- Koreksi dan kontrol: retur (persetujuan, 3 penyelesaian), void (persetujuan, per item / per transaksi), shift kasir
  (modal awal, kas non-penjualan), clerical check dengan blind count.
- Laporan: 9 laporan KP + laporan piutang, filter periode, cetak PDF, ekspor Excel, dashboard per peran.
- Pengerasan: tes end-to-end, review keamanan, backup harian, deploy, uji coba dengan toko.

### M2 — Fitur operasional toko (di luar Laporan KP, diminta pemilik proyek)

- Harga: markup dari harga beli terakhir, tinjau harga, pembulatan, saran tier by qty, riwayat harga beli.
- Diskon dan promo: batas diskon per peran, promo periodik (potongan %/Rp, sasaran barang/kategori/semua, syarat).
- Hutang pemasok (tempo), pembayaran pemasok, retur ke pemasok, bucket stok rusak, limit kredit pelanggan,
  umur piutang/hutang, laporan hutang.
- Konsinyasi: penyelesaian berkala (qty terjual × harga titip), retur barang tidak laku, laporan konsinyasi.
- Multi-satuan jual (roll/meter, dus/pcs) dan cetak label barcode.

### Sengaja tidak dibuat

PPN/pajak; PO ke pemasok dan modul pembelian penuh; multi-gudang/cabang; batch dan kadaluarsa; komisi sales;
akuntansi dan laba rugi penuh; nomor seri; kupon dan loyalitas; integrasi WhatsApp; mode offline; aplikasi mobile
native; editor peran kustom (izin per peran ditetapkan di kode).

## 3. Aktor

Peran bertingkat: Staf Penjualan ⊂ Kasir ⊂ Admin ⊂ Owner (peran atas mewarisi semua izin peran di bawahnya).
Rincian izin ada di `04-hak-akses.md`.

| Peran | Fokus | Fungsi eksklusif (dari Use Case Diagram) |
|---|---|---|
| Staf Penjualan | Melayani pembeli, cek stok tersedia, membuat order, mendata pelanggan pengantaran | Mengelola Data Pelanggan, Mengelola Order Penjualan |
| Kasir | Menyelesaikan transaksi dan mengendalikan kas harian | Penjualan Langsung, Penjualan Pengantaran, Pembayaran, Retur (ajukan), Void (ajukan), Clerical Check, Laporan penjualan |
| Admin | Data master sensitif dan persediaan | Data Barang, Data Pemasok, Penerimaan Barang, Persediaan, Laporan persediaan, menyetujui retur/void |
| Owner | Pengawasan, keputusan, otorisasi tertinggi | Data Pengguna, log aktivitas, harga modal dan laba |

Entitas eksternal (tidak login): Pelanggan (memberi data, bayar, menerima struk/invoice/surat jalan) dan Pemasok
(mengirim barang, faktur, surat jalan pemasok).

## 4. Peta proses DFD Level 0 → modul kode

| # | Proses DFD | Modul API (`apps/api/src/modules/`) | Halaman web (`apps/web/src/features/`) |
|---|---|---|---|
| 1 | Pengelolaan Data Master | `master/` (pengguna, barang, kategori, satuan, atribut, harga, pelanggan, pemasok), `sistem/` (konfigurasi) | `master/*`, `pengaturan/` |
| 2 | Order Penjualan | `penjualan/order/` | `penjualan/order/` |
| 3 | Penjualan Langsung | `penjualan/checkout/` (jenis `LANGSUNG`) | `penjualan/langsung/` |
| 4 | Penjualan Pengantaran | `penjualan/checkout/` (jenis `PENGANTARAN`), `penjualan/surat-jalan/`, `penjualan/pembayaran/` | `penjualan/pengantaran/` |
| 5 | Retur Penjualan | `retur/` | `retur/` |
| 6 | Void Transaksi | `void/` | `void/` |
| 7 | Penerimaan Barang | `persediaan/penerimaan/` | `persediaan/penerimaan/` |
| 8 | Pengelolaan Persediaan | `persediaan/` (`ledger.ts`, `stok/`, `penyesuaian/`) | `persediaan/stok/` |
| 9 | Clerical Check | `kas/` (shift, kas-shift, clerical) | `kas/` |
| 10 | Laporan Operasional | `laporan/` | `laporan/`, `dashboard/` |
| — | (lintas) Autentikasi, penomoran, log aktivitas | `auth/`, `sistem/` | `auth/` |
| — | (M2) Harga & promo, hutang, konsinyasi | `harga/`, `promo/`, `hutang/`, `konsinyasi/` | idem |

Data store DFD (14) dipetakan ke tabel di `03-skema-database-v3.md`. "Data Penjualan Langsung" dan "Data Penjualan
Pengantaran" adalah satu tabel `penjualan` dengan kolom `jenis_penjualan` (sesuai catatan di skema FINAL2).

## 5. Alur bisnis (ringkas, sudah memuat keputusan fondasi)

### 5.1 Order → Checkout
1. Staf/Kasir membuat order: pilih barang (lihat stok **tersedia**), qty, tier harga per baris, jenis LANGSUNG atau
   PENGANTARAN. Pengantaran wajib pelanggan, alamat kirim, boleh ongkir dan catatan kirim. Order DRAFT belum menahan
   stok.
2. Order dikirim ke antrean (status MENUNGGU): stok **dipesan** bertambah, stok tersedia berkurang. Stok fisik tetap.
3. Kasir memilih order dari antrean (boleh tidak berurutan; prioritas ditandai). Saat dibuka, status DIPROSES
   (dikunci untuk kasir itu). Kasir memverifikasi barang dan total.
4. Checkout: sistem membuat `penjualan` (+ detail dengan snapshot harga jual dan HPP), memotong stok **fisik** lewat
   ledger, melepas stok dipesan, mencatat pembayaran, memberi nomor STR (langsung) atau INV (pengantaran).
   Order menjadi SELESAI.
5. Kasir juga boleh membuat order dan checkout sekaligus dari layar kasir (saat ramai).
6. Order MENUNGGU lebih lama dari batas (default 24 jam) ditandai **basi**; muncul di notifikasi dan daftar
   "stok tertahan" per barang. Auto-batal opsional (default mati). Order bisa dibatalkan → stok dipesan dilepas.

### 5.2 Penjualan Langsung
Bayar tunai atau transfer/EDC, boleh campuran. Kembalian dihitung sistem. Struk dicetak. Kalau pembeli membayar
tetapi mengambil barang nanti, status pengambilan `BELUM_DIAMBIL`; stok tetap terpotong saat bayar; opname
memperhitungkan barang terjual yang belum diambil.

### 5.3 Penjualan Pengantaran
Invoice dibuat saat checkout. Pembayaran bisa penuh di awal, DP, bayar saat terima (COD), atau pelunasan kemudian
(piutang dengan jatuh tempo, default = term pelanggan). Surat jalan dibuat dari invoice: boleh lebih dari satu
(pengiriman sebagian), tiap surat jalan mencatat qty kirim per baris, sopir, kendaraan, dan waktu tiap status
(DIPROSES → DIMUAT → DIKIRIM → SELESAI). Status pengiriman invoice = agregat surat jalannya.

### 5.4 Retur Penjualan
Cari transaksi asal → pilih baris dan qty retur → alasan → kondisi barang (BAIK/RUSAK/CACAT) → penyelesaian
(REFUND / TUKAR_BARANG / POTONG_TAGIHAN). Kasir mengajukan; Admin/Owner menyetujui (jika pengaju Admin/Owner,
otomatis disetujui dan tercatat). Saat disetujui: hanya kondisi BAIK masuk stok jual; barang pengganti pada
TUKAR_BARANG dicatat sebagai mutasi keluar; refund tunai dicatat sebagai kas keluar shift; potong tagihan
mengurangi sisa piutang. Transaksi asal tidak pernah diubah.

### 5.5 Void
Hanya untuk penjualan pada shift yang belum ditutup dan belum ada surat jalan terkirim atau retur. Kasir mengajukan
(per transaksi atau per item, alasan wajib), Admin/Owner menyetujui dari akunnya sendiri. Semua permintaan tercatat
(MENUNGGU / DISETUJUI / DITOLAK). Disetujui → stok kembali lewat ledger, pembayaran dikembalikan (tunai = kas keluar
shift), status penjualan/item menjadi VOID. Di luar syarat tersebut, koreksi lewat retur.

### 5.6 Penerimaan Barang
Admin memilih pemasok, jenis (PEMBELIAN atau KONSINYASI), syarat bayar (TUNAI/TEMPO + jatuh tempo), nomor
faktur/surat jalan pemasok, lalu baris barang dengan qty dan harga modal. Simpan → stok masuk lewat ledger, HPP
rata-rata dan harga beli terakhir diperbarui (pembelian), atau HPP = harga titip (konsinyasi). Tempo → hutang
pemasok (UI pembayaran hutang di M2).

### 5.7 Persediaan
Halaman stok menampilkan fisik / dipesan / tersedia, status (HABIS, KRITIS, PERLU_RESTOCK, AMAN), riwayat mutasi,
kartu stok per barang. Penyesuaian dibuat sebagai dokumen bernomor (SALDO_AWAL, OPNAME, KOREKSI, RUSAK) dengan
stok sistem vs stok fisik per baris dan alasan.

### 5.8 Shift dan Clerical Check
Kasir membuka shift dengan modal awal. Semua pembayaran tunai yang ia terima, kas keluar (refund, kasbon, setor
ke owner), dan kas masuk lain terikat ke shift itu. Tutup shift: kasir menginput uang fisik **sebelum** melihat
angka sistem (blind count); sistem menghitung selisih; selisih ≠ 0 wajib keterangan; hasil tersimpan sebagai
clerical check (1 shift = 1 clerical).

### 5.9 Laporan
Filter periode (hari ini, kemarin, minggu ini, bulan ini, rentang). Total dihitung untuk seluruh periode, bukan per
halaman. Cetak PDF lewat browser, ekspor Excel. Kasir melihat laporan penjualan tanpa HPP/laba.

## 6. Dokumen dan laporan

Dokumen transaksi: Struk Penjualan Langsung (thermal 58/80 mm), Invoice Penjualan (A4), Surat Jalan (A4).

Laporan M1 (9 dari Laporan KP + 1): Stok Rekap, Kartu Stok, Stok Minimum, Nilai Persediaan, Penjualan per Periode,
Produk Terlaris, Detail Invoice, Retur Penjualan, Gross Profit Penjualan, **Piutang**.
Laporan M2: Hutang Pemasok, Konsinyasi, Riwayat Harga Beli, Promo.

Rancangan visual tiap laporan ada di `referensi/laporan-kp/` (berkas 1–9).

## 7. Glosarium

| Istilah (UI, DB, kode) | Arti | Jangan pakai |
|---|---|---|
| barang | item yang dijual/disimpan | produk, item, product |
| kategori | pengelompokan barang | jenis barang |
| satuan | unit hitung (sak, m, kg) | unit |
| satuan dasar | satuan tempat stok dicatat | — |
| satuan jual | satuan alternatif saat menjual, punya faktor ke satuan dasar | — |
| atribut | karakteristik deskriptif barang (panjang, warna, watt) | spesifikasi |
| pelanggan | pembeli yang terdata | customer, pembeli (pembeli = orang di depan kasir, belum tentu terdata) |
| pemasok | sumber barang masuk | supplier, vendor, distributor |
| pengguna | akun login | user |
| peran | tingkat akses (Staf/Kasir/Admin/Owner) | role |
| izin | kemampuan spesifik (`master.barang.kelola`) | permission |
| order | pesanan sebelum checkout (menahan stok) | pesanan, keranjang |
| checkout | menjadikan order transaksi final | finalisasi |
| penjualan | transaksi final (jenis LANGSUNG / PENGANTARAN) | invoice (invoice = nomor dokumennya) |
| struk | dokumen penjualan langsung | nota |
| invoice | dokumen penjualan pengantaran | faktur |
| surat jalan | dokumen pengiriman | delivery order, DO |
| pembayaran | uang masuk untuk penjualan | payment |
| piutang | sisa tagihan pelanggan | receivable |
| hutang | sisa kewajiban ke pemasok | payable |
| retur | pengembalian barang oleh pelanggan | return |
| retur pemasok | pengembalian barang ke pemasok | — |
| void | pembatalan penjualan yang sudah tercatat | cancel (cancel = membatalkan order) |
| penerimaan | barang masuk dari pemasok | good receipt, GR |
| persediaan | posisi stok | inventory |
| mutasi | satu baris perubahan stok di ledger | movement |
| ledger | tabel `mutasi_persediaan`, sumber kebenaran stok | — |
| stok fisik | jumlah di gudang menurut sistem | — |
| stok dipesan | jumlah yang ditahan order MENUNGGU/DIPROSES | reserved |
| stok tersedia | fisik − dipesan | available |
| HPP | harga pokok per satuan dasar (rata-rata tertimbang) | COGS, harga modal (harga modal = harga beli di satu penerimaan) |
| harga beli terakhir | harga modal pada penerimaan pembelian terakhir | — |
| tier harga | tingkat harga jual (Normal, Grosir, Distributor, …) | price list |
| markup | persentase di atas dasar markup untuk membentuk harga jual | margin (margin = laba/harga jual) |
| penyesuaian | dokumen koreksi stok (saldo awal, opname, koreksi, rusak) | adjustment |
| opname | penghitungan fisik | stock take |
| shift | periode kerja satu kasir dengan satu laci | — |
| clerical check | rekonsiliasi kas saat tutup shift | — |
| konsinyasi | barang milik pemasok yang dititipkan, dibayar setelah laku | titipan |
| harga titip | nilai yang dibayar ke pemasok per satuan barang konsinyasi yang laku | — |

## Riwayat

- 2026-09-19 — v1, dibuat dari Laporan KP (BAB 5), dokumen observasi, mockup, dan keputusan K-001 s.d. K-043.
