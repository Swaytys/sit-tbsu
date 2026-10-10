# Keputusan Tier Harga Menurut Nilai Belanja — 10 Oktober 2026

Melanjutkan penomoran dari `2026-10-10-harga-qty-promo-pembeli.md`. Butir **(pemilik)** diputuskan pemilik proyek
(pilihan dari usulan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-098 — Tier harga menurut total nilai belanja; promo dipotong dari harga tier

**Status:** menggantikan K-097 butir 1–3 (tier menurut qty, syarat qty per barang, "tier qty dan promo tidak
digabung") dan K-094 bagian tier otomatis per qty. K-097 butir 4–6 (promo menurut pembeli, golongan pelanggan,
syarat belanja pelanggan, `kolomPenuh()`) tetap berlaku.

**Keputusan:**

1. **(pemilik) Tier harga ditentukan total nilai belanja satu transaksi**, otomatis, untuk **semua barang tanpa
   kecuali**. `tingkat_harga.min_belanja` (isian *Mulai belanja* di Kelola tier) menggantikan `min_qty`; kolom
   `min_qty` di `tingkat_harga` dan `harga_barang` dihapus (migrasi 0011–0012).
2. **Nilai belanja** = Σ qty × harga tier dasar semua baris, sebelum promo dan diskon. Memakai harga tier dasar
   (bukan harga tier yang sedang dicari) agar tier tidak bergantung pada hasilnya sendiri, dan pembeli tidak
   "turun tier" hanya karena harga tier-nya lebih murah. Baris harga manual dinilai dengan harga tier dasarnya.
3. **Tangga tier:** dipakai tier ber-`min_belanja` terbesar yang tercapai; syarat sama → markup terkecil; tidak ada
   yang tercapai → tier dasar. Tier tanpa `min_belanja` hanya dipakai bila dipilih kasir (izin
   `penjualan.tier.ubah`). Tier dasar tidak boleh punya `min_belanja` (CHECK database dan service).
4. **(pemilik) Tier selain tier dasar selalu harga modal + markup tier untuk semua barang.** Harga dan markup per
   barang untuk tier itu ditolak API; migrasi 0011 mengubah baris lama menjadi IKUT_TIER dan menghitung ulang
   harganya. Tier dasar (Normal) tetap boleh Rp tetap, markup tier, atau markup sendiri per barang. Harga kemasan
   (satuan jual) tier lain juga selalu dihitung; hanya harga dasar kemasan yang boleh diisi.
5. **Pengaman pembeli:** bila harga tier transaksi sebuah baris lebih mahal dari harga tier dasarnya (mis. harga
   Normal diisi Rp tetap yang rendah) atau belum ada, baris itu memakai tier dasar. Belanja lebih banyak tidak
   pernah membuat sebuah barang lebih mahal dari harga dasarnya.
6. **(pemilik) Promo bertumpuk di atas harga tier.** Urutan: harga tier → promo dihitung dari harga tier itu →
   diskon manual. Tier dihitung lebih dulu karena berlaku tetap untuk semua barang, sedangkan promo adalah
   potongan khusus yang dibuat pemilik; batas modal PR6 tetap menjaga agar Staf/Kasir tidak menjual di bawah
   modal. Tier pilihan kasir juga mendapat promo.
7. **Pembagian peran yang jelas:** *Harga Jual* = aturan tetap untuk semua barang (markup dan syarat belanja per
   tier). *Promo* = potongan yang dibuat dulu, sementara atau jangka panjang, untuk barang/kategori tertentu dengan
   syarat apa pun (masa, pembeli, qty, total belanja, belanja pelanggan).
8. **Semua istilah dijelaskan di layar.** Lencana "Default" diganti **Harga dasar** dengan keterangan; tier dasar
   tidak menampilkan pilihan *Nonaktifkan*. Komponen `Penjelasan` (kotak "Cara kerja" yang bisa dilipat; pilihan
   lipat = preferensi tampilan) dipasang di Harga Jual, Kelola tier, dan Promo. Kasir dan form order menampilkan
   tier yang berlaku dan kekurangan belanja menuju tier berikutnya (`tierBelanja` dari pratinjau API).
9. **Peringatan susunan tier** (bukan penolakan) dari API bagi pemegang `master.barang.lihat_hpp`: markup tier
   tidak lebih kecil dari tier dasar, atau syarat belanja lebih besar tetapi markup lebih besar.
10. **Import Excel:** hanya kolom harga tier dasar (`harga_<kode>`). Kolom harga tier lain dari templat lama
    diabaikan dengan peringatan yang menjelaskan sebabnya.

*Alasan:* syarat qty masih subjektif (10 sak semen dan 10 buah sekrup tidak sebanding, dan harus diatur per
barang), sedangkan nilai rupiah sebanding untuk semua barang dan cukup diatur sekali per tier. Tier yang selalu
mengikuti markup membuat pemilik cukup mengubah satu angka untuk seluruh toko; kebutuhan khusus tetap terlayani
lewat promo yang punya masa berlaku, sasaran, dan laporan sendiri.

*Ditolak:* nilai belanja dihitung dari harga tier yang berlaku (melingkar: harga turun → nilai turun → tier
turun); tier termurah di antara yang tercapai (menyembunyikan salah susun tier; diganti peringatan butir 9);
menolak simpan susunan tier yang janggal (mengubah dua tier satu per satu pasti melewati susunan antara); promo
dan tier dipilih yang termurah (K-097; pemilik ingin keduanya berlaku berurutan); harga tier lain tetap bisa
diisi per barang (bertentangan dengan "semua barang tanpa kecuali"; kebutuhan itu pindah ke promo).

*Usulan lanjutan (backlog v2.0.0 A11):* promo untuk banyak barang pilihan, edit massal promo, syarat nilai belanja
per barang, hari/jam, dan potongan bertingkat menurut qty.
