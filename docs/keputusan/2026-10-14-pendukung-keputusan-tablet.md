# Keputusan 14 Oktober 2026 — Pendukung keputusan, tablet, ekspor log

Melanjutkan penomoran dari `2026-10-12-tinjauan-pemilik.md`. Sumbernya jawaban pemilik proyek atas daftar
pertanyaan di `docs/LAPORAN-FITUR-APLIKASI.md` (bagian 13) dan rekomendasi dosen pembimbing Tugas Akhir.
Butir **(pemilik)** diputuskan pemilik (lewat pilihan yang diajukan Claude Code); butir lain keputusan teknis.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-113 — Fase 14: rekomendasi pemesanan ulang, tampilan tablet, ekspor log ke Excel

**Status:** menambah Fase 14 di docs/07 (dikerjakan **sebelum** Fase 13, yang lingkupnya belum dikonfirmasi);
menambah Sprint G di docs/08. Mengubah aturan UI di `CLAUDE.md` setelah disetujui pemilik (butir 5). Belum ada
perubahan kode.

**Latar:** inventaris fitur untuk Proposal TA menunjukkan aplikasi belum punya rekomendasi jumlah pemesanan ulang;
dosen pembimbing merekomendasikannya karena membantu pengambilan keputusan pembelian. Pemilik juga menyebut
perangkat sungguhan di toko: laptop/komputer untuk kasir, admin, owner, dan **tablet** untuk staf penjualan, dengan
syarat tampilan responsif ("penting sekali"). Skala: 4 staf penjualan, 1 kasir, 2 owner, lebih dari 200
transaksi per hari.

**Keputusan:**

1. **(pemilik) Rekomendasi pemesanan ulang memakai rumus "rata-rata jual + lead time"**, bukan statistik Z·σ dan
   bukan EOQ:
   - *Rata-rata jual per hari* = jumlah terjual bersih (penjualan non-VOID dikurangi retur, dalam satuan dasar)
     selama periode pengamatan ÷ jumlah hari periode. Periode bawaan 30 hari (pengaturan).
   - *Stok pengaman* = rata-rata jual per hari × hari pengaman (pengaturan, bawaan 2 hari).
   - *Titik pesan ulang* = rata-rata jual per hari × lama kirim pemasok + stok pengaman.
   - *Saran qty pesan* = rata-rata jual per hari × (lama kirim + jarak belanja) + stok pengaman − stok tersedia,
     paling kecil 0, dibulatkan ke atas ke satuan dasar utuh (dan ditampilkan juga dalam kemasan).
   - *Stok cukup untuk* = stok tersedia ÷ rata-rata jual per hari (hari).
   - *Lama kirim* dan *jarak belanja* (hari) diatur per pemasok; barang memakai pemasok penerimaan terakhirnya;
     bila belum ada, nilai bawaan dari pengaturan.
2. **Penyajian:** tab *Saran Pesan* di Stok Persediaan dan laporan *Rekomendasi Pemesanan Ulang* (grup
   Persediaan; layar, cetak, Excel), dikelompokkan per pemasok dengan perkiraan biaya (harga beli terakhir).
   Hanya Admin/Owner (memuat harga modal). Barang titipan (konsinyasi) tidak disarankan karena diisi penitip.
   Barang yang tidak terjual selama periode ditandai "tidak laku N hari" sebagai informasi modal tertahan.
3. **(pemilik) Tampilan tablet:** layar staf penjualan (Order Penjualan input cepat dan form lengkap, cari barang,
   Data Pelanggan, Dashboard, Akun saya) dibuat nyaman disentuh di tablet **mendatar (±1280×800)** dan tetap bisa
   dipakai **tegak (±800×1280)**. Layar lain tetap rapi saat lebar mengecil. Dites otomatis pada kedua ukuran.
4. **(pemilik) Ekspor log aktivitas ke Excel** (Owner), dengan saringan yang sama dengan layar, untuk data
   triangulasi penelitian.
5. **Aturan UI di `CLAUDE.md`** ("desktop-first, lebar minimum 1280 px, tablet 1024 px masih bisa") diubah
   menjadi: desktop untuk kasir/admin/owner; layar staf penjualan wajib nyaman di tablet mendatar dan tegak.
   Perubahan berkas itu ditunjukkan dulu kepada pemilik.
6. **(pemilik) Urutan:** rekomendasi pemesanan ulang → tablet → ekspor log. Tiap bagian dites dan di-merge ke main
   lokal. Layar rekomendasi langsung dibuat responsif.
7. **Bentuk deploy belum final.** Pemilik toko akan memilih antara server lokal di komputer toko (rancangan K-082)
   dan hosting remote/cloud. Cadangan ke cloud (K-084) tetap dilaksanakan. Pilihan ini dibahas sebelum Fase 13.

**Alasan:** rumus rata-rata + lead time memakai data yang sudah ada (penjualan dan penerimaan), setiap angkanya
bisa ditelusuri dan dijelaskan di proposal, dan cukup untuk toko dengan ratusan transaksi per hari. Tablet adalah
perangkat sungguhan staf; tanpa tampilan yang pas, data yang dimasukkan staf menjadi titik lemah kualitas sistem.

*Ditolak:*
- **Stok pengaman statistik (Z·σ, tingkat layanan):** lebih akurat untuk barang yang lakunya tidak menentu, tetapi
  butuh riwayat beberapa bulan dan sulit dijelaskan; bisa ditambahkan kemudian sebagai pilihan (Sprint G).
- **EOQ:** butuh biaya pesan dan biaya simpan per barang yang tidak dicatat toko.
- **Membuat semua halaman (laporan, pengaturan) nyaman di tablet tegak:** paling lama, dan halaman itu dipakai di
  komputer.
