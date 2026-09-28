# Keputusan Tambahan — 19 September 2026 (Batch 2)

Melanjutkan penomoran dari `2026-09-19-keputusan-fondasi.md`.

### K-044 — Nama tampil aplikasi: BonsaiUrip
**Keputusan:** Nama tampil aplikasi (judul tab browser, halaman login, kop struk/invoice/laporan baris pertama,
`konfigurasi.nama_toko`) adalah **BonsaiUrip**. Baris kedua kop menampilkan `nama_badan_usaha` = "UD. Sumber Urip".
Repo tetap `sit-tbsu`, cookie tetap `sit_sesi`. Menggantikan sebagian K-041 (bagian nama tampil).
**Alasan:** Permintaan pemilik proyek.

### K-045 — Prefix nomor pembayaran ke pemasok: PBP
**Keputusan:** Daftar prefix di K-022 ditambah `PBP` untuk `pembayaran_pemasok`. Daftar lengkap: ORD, STR, INV, SJ,
BYR, RTR, VD, RCV, ADJ, RTP, KSG, PBP, SHF, CLC.
**Alasan:** Tabel `pembayaran_pemasok` butuh nomor dokumen sendiri; terlewat di K-022.

### K-046 — DDL v3 divalidasi di PostgreSQL 16 sebelum dipakai
**Keputusan:** `docs/03-skema-database-v3.sql` dinyatakan final setelah dijalankan pada PostgreSQL 16.15 dari
database kosong (41 tabel terbentuk) dan diuji dengan 19 kasus constraint serta satu alur transaksi lengkap.
Perubahan skema selanjutnya wajib diuji dengan cara yang sama sebelum menjadi migrasi.
**Alasan:** Berkas ini menjadi migrasi 0000; kesalahan di sini menular ke semua fase.

### K-047 — Harga per tier dibuat untuk setiap barang sejak Fase 3
**Keputusan:** Saat barang dibuat, service membuat satu baris `harga_barang` untuk setiap tier aktif. Tier default
(Normal) wajib diisi harga tetap oleh pengguna; tier lain yang dikosongkan diisi metode IKUT_TIER dengan
`harga_jual` = pembulatan(`harga_modal_awal` × (1 + markup default tier)). Mesin markup penuh (Tinjau Harga,
tanda perlu tinjau, saran tier) tetap Fase 9.
**Alasan:** K-010 mewajibkan harga tersimpan; tanpa baris untuk setiap tier, dropdown tier di checkout tidak
punya nilai.

### K-048 — Persediaan menolak pengurangan fisik di bawah stok dipesan
**Keputusan:** CHECK `stok_dipesan <= stok_fisik` dipertahankan. Opname/koreksi yang menurunkan fisik di bawah
jumlah yang ditahan order ditolak dengan pesan yang menyebut order penahan; pengguna membatalkan atau checkout
order itu dulu.
**Alasan:** Order yang menahan barang yang ternyata tidak ada tidak bisa dipenuhi; lebih baik ketahuan saat opname
daripada saat kasir checkout.
**Ditolak:** Membiarkan `stok_tersedia` negatif dengan peringatan.

### K-049 — Skema v3.1: kolom cache tagihan penjualan
**Keputusan:** `penjualan.total_potong_tagihan` diganti tiga kolom cache: `total_void` (nilai barang di-void),
`total_retur` (nilai barang dikembalikan lewat retur REFUND/POTONG_TAGIHAN), `total_refund` (uang dikembalikan ke
pembeli). `sisa_tagihan = total_neto − total_void − total_retur − total_dibayar + total_refund`. Ikut ditambah:
`penerimaan_barang.total_retur_potong`, `pembayaran_pemasok` metode KOMPENSASI + `id_retur_pemasok`,
`retur_pemasok` penyelesaian PENGEMBALIAN_TITIPAN. Diuji ulang di PostgreSQL 16 (K-046).
**Alasan:** Rumus lama membuat sisa tagihan salah pada void sebagian dan retur refund; ditemukan saat merinci
aturan V5 dan T6 di docs/05. Diperbaiki sebelum skema dipakai (Fase 1 belum dimulai).
