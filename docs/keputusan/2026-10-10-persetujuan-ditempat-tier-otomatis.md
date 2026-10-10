# Keputusan Persetujuan di Tempat dan Tier Otomatis — 10 Oktober 2026

Melanjutkan penomoran dari `2026-10-10-tier-nilai-belanja.md`. Butir **(pemilik)** diputuskan pemilik proyek
(pilihan dari usulan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-099 — Persetujuan retur/void di tempat, batas tanpa persetujuan, tier selalu otomatis

**Status:** mengubah docs/04 §6 (K-017 tetap berlaku untuk pengaju Admin/Owner; "penyetuju harus login dengan
akunnya sendiri, tidak ada PIN" diganti butir 1) dan K-098 butir 3 (tier tanpa syarat belanja tidak lagi bisa
dipilih kasir).

**Keputusan — persetujuan retur dan void:**

1. **(pemilik) Persetujuan di tempat.** Toko memakai satu perangkat, sehingga atasan tidak bisa menyetujui dari
   akunnya tanpa menghentikan kasir. Kasir yang mengajukan retur/void mendapat dialog *Persetujuan atasan*:
   Admin/Owner mengetik nama pengguna dan password-nya sendiri di layar kasir. Dokumen langsung DISETUJUI atas
   nama atasan (`cara_persetujuan = DI_TEMPAT`); tidak ada sesi baru dan sesi kasir tidak berubah. Bisa juga
   dipakai belakangan untuk dokumen yang sudah MENUNGGU.
2. **(pemilik) Batas tanpa persetujuan.** `konfigurasi.batas_retur_tanpa_persetujuan` dan
   `batas_void_tanpa_persetujuan` (bawaan Rp 0 = selalu butuh atasan). Dokumen yang nilainya masih di dalam batas
   langsung DISETUJUI atas nama pengaju (`BATAS_BEBAS`). Batas dihitung **per penjualan**: nilai retur (atau void)
   lain yang MENUNGGU/DISETUJUI atas penjualan yang sama ikut dijumlah, sehingga batas tidak bisa diakali dengan
   memecah satu retur menjadi beberapa dokumen kecil.
3. **Cara persetujuan disimpan di dokumen** (`cara_persetujuan`: SENDIRI, AKUN_ATASAN, DI_TEMPAT, BATAS_BEBAS;
   migrasi 0013) dan tampil di riwayat, supaya pemilik bisa melihat retur/void mana yang jadi tanpa atasan.
4. **Pengaman persetujuan di tempat:** akun atasan diperiksa persis seperti login (argon2id, akun aktif, tidak
   terkunci, punya izin `*.setujui`); password tidak disimpan atau dilog; kegagalan menaikkan hitungan gagal
   login dan mengunci akun seperti di halaman masuk, serta dicatat `PERSETUJUAN_GAGAL` beserta sesi pengaju;
   pemeriksaan dilakukan sebelum transaksi dokumen agar hitungan gagal tidak ikut dibatalkan; galat memakai HTTP
   400/403 (bukan 401) agar kasir tidak dianggap keluar. Isian password di peramban memakai
   `autocomplete="new-password"` agar tidak ditawarkan untuk disimpan di komputer kasir.
5. **Refund tunai keluar dari laci shift pengguna yang login di perangkat itu** (kasir pada DI_TEMPAT dan
   BATAS_BEBAS). Atasan yang menyetujui di tempat tidak perlu membuka shift.
6. **(pemilik) Salah input: batalkan sebelum disetujui.** Pengajuan MENUNGGU boleh ditarik pengajunya (atau
   pemegang izin setujui) dengan alasan → status baru `DIBATALKAN`, tanpa efek, tercatat `RETUR_BATAL` /
   `VOID_BATAL`. Dokumen DISETUJUI tidak bisa diubah atau dibalik: kekurangan = retur tambahan, kelebihan =
   penjualan baru. Tidak ada jalur "retur lalu dibalik".
7. **Form retur menunjukkan sisa yang bisa diretur.** Per baris: Dibeli, Sudah diretur (+ yang sedang menunggu),
   Sisa; isian qty dibatasi Sisa dan ditandai bila melebihi; retur yang sudah pernah dibuat atas penjualan itu
   tampil di atas tabel; setelah mengajukan, transaksi tetap terpilih dengan angka terbaru.

**Keputusan — harga:**

8. **(pemilik) Tier selalu otomatis.** Pilihan tier manual dihapus seluruhnya: tombol T di kasir, pilihan tier
   di form order, izin `penjualan.tier.ubah`, kolom `order_penjualan_detail.tier_dipilih`, saran tier, dan kolom
   `idTingkatHarga` pada isian baris order (API mengabaikannya). Pengecualian harga hanya lewat Promo atau Harga
   manual (Admin/Owner, tercatat di log).
9. **Tier aktif selain tier dasar wajib punya `min_belanja`** (CHECK database + service). Migrasi 0013
   menonaktifkan tier aktif yang belum punya syarat belanja (angkanya tidak bisa ditebak); pemilik mengisi *Mulai
   belanja* lalu mengaktifkannya. Seed baru membuat Grosir/Distributor NONAKTIF dengan angka contoh.

**Keputusan — tampilan:**

10. **Daftar barang transaksi** (kasir, pengantaran, order cepat): nama barang tidak dipotong "…" (maksimal dua
    baris; utuh saat baris dipilih/disorot) dan atribut tampil; setiap baris punya menu **⋮** (juga tombol **M**)
    berisi ubah qty, ganti satuan, diskon, lepas promo, hapus; tombol baris bisa dicapai dengan Tab.
11. **Catatan order** bisa diisi di input order cepat dan tampil di tiket antrean serta di layar kasir saat order
    dibuka (sebelumnya hanya bisa diisi di form lengkap dan tidak tampil di kasir).
12. **Pindah layar cepat:** tombol Order / Langsung / Pengantaran di bilah atas dan **Alt+1/2/3** dari halaman
    mana pun (sesuai izin). Keranjang kasir yang belum dibayar meminta konfirmasi sebelum ditinggalkan.
13. **Dialog** yang lebih tinggi dari layar digulir di dalam (sebelumnya terpotong, mis. form promo).
14. **Penjelasan halaman menjadi tombol "?"** di samping judul (membuka dialog), bukan kotak di halaman.
    Tombol "?" untuk semua halaman masuk backlog v2.0.0 (F7).
15. **Kata-kata** di form barang dirapikan (tidak lagi memakai "dikunci", "mutasi stok", "HPP" tanpa penjelasan;
    keterangan "belum tahu harga modal" tidak lagi menyiratkan barang bisa dijual tanpa stok).

*Alasan:* pemisahan tugas (kasir mengajukan, atasan menyetujui) tetap dijaga tanpa memaksa pembeli datang dua
kali: wewenang berpindah lewat password atasan, bukan lewat akun kasir. Batas bebas memberi kecepatan untuk
kesalahan kecil dengan risiko yang terukur dan terlihat di riwayat. Tier manual membuka salah pencet dan
penyalahgunaan tanpa jejak yang jelas; semua harga kini punya sebab yang bisa dijelaskan (total belanja, promo,
atau harga manual berlog).

*Ditolak:* PIN persetujuan terpisah (satu rahasia lagi yang harus dikelola dan mudah diintip di kasir); persetujuan
lewat email/WhatsApp (butuh server online, belum ada di mode desktop); atasan boleh membatalkan retur yang sudah
disetujui (membuka jalur retur-lalu-balik dan menambah dokumen koreksi baru; ditolak pemilik); batas bebas per
dokumen (bisa diakali dengan memecah retur); tier manual hanya untuk Admin/Owner (pemilik memilih semua otomatis).

*Catatan untuk pemilik:* isi **Batas retur/void tanpa persetujuan** di Pengaturan › Operasional bila ingin kasir
memproses sendiri retur kecil; biarkan Rp 0 bila semua harus lewat atasan.
