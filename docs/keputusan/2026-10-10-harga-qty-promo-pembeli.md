# Keputusan Harga Jual Menurut Qty dan Promo Menurut Pembeli — 10 Oktober 2026

Melanjutkan penomoran dari `2026-10-09-draf-cetak-kemasan.md`. Butir **(pemilik)** diputuskan pemilik proyek
(pilihan dari usulan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-097 — Harga jual hanya menurut qty; harga khusus pembeli lewat promo

**Keputusan:**

1. **(pemilik) Harga jual (tier) ditentukan variabel objektif: jumlah beli.** Tier pelanggan dihapus
   (`pelanggan.id_tingkat_harga`, migrasi 0010). Semua pembeli mulai dari tier default; tier lain dipakai otomatis
   bila total `qty_dasar` barang itu di transaksi mencapai syarat qty (H8). Distributor yang kali ini membeli eceran
   membayar harga eceran.
2. **(pemilik) Syarat qty per tier, bisa diganti per barang.** `tingkat_harga.min_qty` (isian *Mulai qty* di Kelola
   tier; menggantikan `saran_min_qty`) dan `harga_barang.min_qty` (isian *Mulai qty* per tier di form barang). Tier
   tanpa syarat qty hanya dipakai bila dipilih manual (tombol T, berizin). Tier default tidak boleh punya syarat
   qty. Bila beberapa tier memenuhi syarat: harga termurah; seri dengan tier default → tier qty.
3. **(pemilik) Harga tier qty dan promo tidak digabung; dipakai yang paling murah bagi pembeli** (PR9). Promo
   dihitung dari harga normal; dibandingkan dengan harga tier qty tanpa promo.
4. **(pemilik) Promo menurut pembeli:** `promo.sasaran_pembeli` SEMUA / GOLONGAN / PELANGGAN. **Golongan
   pelanggan** (tabel baru `golongan_pelanggan`, mis. Distributor, Kontraktor, Tukang; dikelola Admin/Owner lewat
   tombol *Golongan* di Data Pelanggan) menggantikan tier pelanggan; data lama: tier pelanggan selain default
   menjadi golongan bernama sama (migrasi 0009). Pelanggan tertentu disimpan di `promo_pelanggan`.
5. **(pemilik) Syarat belanja pelanggan:** "belanja ≥ Rp X dalam N hari terakhir" per promo
   (`min_belanja_pelanggan`, `hari_belanja`), dihitung dari penjualan non-VOID pelanggan itu, neto setelah void dan
   retur. Pembeli umum tidak pernah memenuhi syarat ini.
6. **Perbaikan bug yang ditemukan:** subquery SQL mentah di query satu tabel ditulis drizzle tanpa nama tabel
   (`"id"`), sehingga Postgres membacanya sebagai kolom tabel subquery. Akibatnya angka seperti jumlah barang per
   kategori/merk/jenis atribut, pemakaian satuan, sesi aktif pengguna, dan jumlah baris dokumen bisa salah di daftar
   yang tidak memakai join. Semua subquery mentah kini memakai `kolomPenuh()` (`apps/api/src/db/kolom-penuh.ts`).

*Alasan:* harga yang bergantung pada "siapa pembelinya" tidak adil saat pelanggan grosir membeli eceran, dan sulit
dijelaskan ke kasir; promo sudah punya masa berlaku, syarat, dan laporan, sehingga cocok untuk harga khusus
pembeli.

*Ditolak:* promo bertumpuk di atas harga grosir (margin terlalu tipis dan sulit dikendalikan); promo diatur per
promo boleh/tidak digabung (menambah satu keputusan di setiap promo); syarat qty hanya per tier (10 sak semen dan
10 buah sekrup dianggap sama).
