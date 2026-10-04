# Panduan Fase 8 — Uji Coba di Toko

Untuk: pemilik toko (pelaksana uji coba) bersama 1 kasir dan 1 staf penjualan. Tujuan (docs/07 Fase 8,
"Selesai bila"): **sistem dipakai untuk transaksi sungguhan minimal satu hari penuh tanpa pemilik proyek turun
tangan.** Temuan dicatat di tabel di bawah lalu dibahas untuk diperbaiki.

## A. Persiapan (H-3 s.d. H-1)

- [ ] Server terpasang dan bisa dibuka dari semua komputer (panduan `fase-8-pasang-server.md` bagian 1–5).
- [ ] Cadangan diatur dan *Cadangkan sekarang* + *Uji pulih sekarang* berhasil (bagian 7).
- [ ] Akun dibuat: owner (sudah), 1 admin bila ada, 1 kasir, 1 staf. Masing-masing sudah login & ganti password.
- [ ] Profil toko, logo, lebar struk, rekening transfer/EDC diisi (*Pengaturan*).
- [ ] Data barang diimpor dari Excel (*Data Barang › Import*); harga per tier diperiksa (*Harga Jual*).
- [ ] Pelanggan langganan dan pemasok utama dimasukkan.
- [ ] **Saldo awal stok** diimpor/diisi (*Stok Persediaan › Penyesuaian › Saldo awal*), dicocokkan dengan hitungan
      fisik untuk barang-barang laku.
- [ ] Printer struk tercetak dari *buka-kasir.cmd*; printer A4 untuk invoice & surat jalan.

## B. Skenario hari uji (jalankan transaksi sungguhan)

| # | Langkah | Siapa | ✓ |
|---|---|---|---|
| 1 | Buka shift dengan modal awal | Kasir | |
| 2 | Order langsung dari staf → kasir bayar tunai → struk tercetak | Staf, Kasir | |
| 3 | Penjualan langsung tanpa order (pembeli umum), bayar transfer/EDC | Kasir | |
| 4 | Order pengantaran → invoice DP → surat jalan → status dikirim → diterima | Staf, Kasir | |
| 5 | Pelunasan piutang dari halaman Piutang | Kasir | |
| 6 | Void satu barang salah input → disetujui Admin/Owner | Kasir, Admin | |
| 7 | Retur barang (uang kembali atau tukar) → disetujui | Kasir, Admin | |
| 8 | Penerimaan barang dari pemasok; stok bertambah | Admin | |
| 9 | Kasbon / setor ke owner dari laci | Kasir | |
| 10 | Tutup shift: hitung uang, blind count, selisih dijelaskan | Kasir | |
| 11 | Laporan penjualan hari ini & gross profit dicetak; angka dicocokkan dengan catatan manual | Owner | |
| 12 | Besok pagi: cadangan malam berhasil (Pengaturan › Cadangan) | Owner | |

## C. Daftar temuan

Catat setiap kebingungan, salah hitung, lambat, atau hal yang membuat karyawan kembali ke cara lama.

| No | Waktu | Layar / menu | Yang terjadi | Yang diharapkan | Tingkat (berat/sedang/ringan) | Siapa |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

Tingkat: **berat** = transaksi tidak bisa diselesaikan / angka salah; **sedang** = bisa diselesaikan dengan cara
memutar; **ringan** = tampilan/kata membingungkan.

## D. Kriteria lulus

- [ ] Satu hari penuh semua transaksi tercatat di sistem (tidak ada nota manual yang tertinggal).
- [ ] Clerical check kasir selisih 0 atau selisihnya dapat dijelaskan.
- [ ] Laporan penjualan hari itu = hitungan manual pemilik.
- [ ] Tidak ada temuan **berat** yang belum diatasi.
- [ ] Cadangan malam itu berhasil.
