# 06 — Harga, Diskon, Promo, Piutang, Hutang, Konsinyasi, Stok Rusak

Format dan kewajiban tes sama dengan `05-aturan-bisnis-inti.md`. Aturan tanpa tanda berlaku sejak fase M1 yang
disebut; **[M2]** berarti dibangun pada fase M2 yang disebut, meskipun kolomnya sudah ada di skema.

## 1. Tier harga dan harga jual (Fase 3 dasar, Fase 9 penuh)

| # | Aturan |
|---|---|
| H1 | Master `tingkat_harga`: tepat satu `is_default` (seed: NORMAL). Tier NONAKTIF tidak muncul di dropdown, tetapi baris `harga_barang`-nya dipertahankan. Menonaktifkan tier default ditolak. Tier `is_default` disebut **tier dasar** ("Harga dasar" di layar): harga semua transaksi sebelum syarat belanja tier lain tercapai (H8); tidak bisa dipindah ke tier lain. |
| H2 | Setiap barang punya satu baris `harga_barang` untuk setiap tier aktif (satuan jual null). Dibuat saat barang dibuat (K-047; tier yang tidak diisi = IKUT_TIER, termasuk tier default, K-094) dan saat tier baru dibuat (untuk semua barang, metode IKUT_TIER). **K-098:** hanya tier dasar yang boleh diatur per barang (TETAP/MARKUP); baris tier lain selalu IKUT_TIER, untuk semua barang, dan isian harga/markup per barang untuk tier itu ditolak. Harga tetap tier default tidak boleh Rp 0. Harga modal boleh belum diketahui: harga markup Rp 0 berarti "belum ada harga" dan baris jual ditolak sampai penerimaan pertama mengisi dasar modal atau harga Rp diisi (K-095). |
| H3 | Dasar markup `D` = `persediaan.harga_beli_terakhir` bila `konfigurasi.dasar_markup = HARGA_BELI_TERAKHIR` (default), `persediaan.hpp_rata2` bila `HPP_RATA2`, atau `persediaan.harga_fifo` (harga beli lapisan stok tertua yang masih ada, docs/05 L12) bila `FIFO` (K-184). Dengan FIFO, `D` juga bisa berubah karena stok keluar; perubahan itu ditanggapi seperti H5/H7 di transaksi stok yang sama. HPP dan laporan laba tetap rata-rata tertimbang. Barang KONSINYASI: `D = harga_titip`. Sebelum ada penerimaan, `D = harga_modal_awal`. |
| H4 | Harga hasil markup: `bulatkanHarga(D × (1 + persen/100))`, dengan `bulatkanHarga(x)` = dibulatkan **ke atas** ke kelipatan `konfigurasi.pembulatan_harga` (default 100). Persen: IKUT_TIER → `tingkat_harga.markup_default_persen`; MARKUP → `harga_barang.markup_persen` (per barang, tidak boleh bersamaan dengan harga tetap). TETAP → `harga_tetap` apa adanya. Tier default boleh ketiga metode (K-094; sebelumnya wajib TETAP); tier lain hanya IKUT_TIER (K-098). `harga_jual` disimpan; `dasar_markup_saat_hitung = D` disimpan (dan diperbarui walau harga hasil pembulatan sama) untuk IKUT_TIER/MARKUP (K-086). |
| H5 | **Tanda perlu tinjau.** Pemicu = `D` barang berubah (dibandingkan sebelum/sesudah kejadian): penerimaan pembelian (L6; mode `HPP_RATA2` mengikuti HPP), `harga_modal_awal` diubah sebelum ada penerimaan, `harga_titip` atau kepemilikan berubah; juga `markup_default_persen` tier non-default berubah (barang yang punya baris IKUT_TIER pada tier itu) dan `dasar_markup`/`pembulatan_harga` di Pengaturan berubah (barang yang hasil hitung markupnya berubah). Barang tidak otomatis → `perlu_tinjau_harga = true`, harga tidak berubah; barang otomatis → H7. Tanda dilepas saat Tinjau Harga diterapkan atau diabaikan, atau saat harga barang itu disimpan manual (semua baris IKUT_TIER/MARKUP barang itu dihitung ulang dengan `D` terkini). Tier yang diaktifkan kembali: baris IKUT_TIER/MARKUP-nya dihitung ulang tanpa tanda, seperti tier baru (K-086). |
| H6 | **[M2 Fase 9] Tinjau Harga** (tab di Harga Jual; `master.harga.tinjau` dan `master.barang.lihat_hpp`): daftar barang aktif `perlu_tinjau_harga`, per tier: harga sekarang, dasar lama → baru, harga usulan (H4; harga tetap tier default diusulkan `bulatkanHarga(D × (1 + markup tier default))`, harga tetap tier lain tidak diusulkan), margin sekarang dan usulan. Aksi: terapkan per barang, terapkan semua terpilih (harga tetap tier default ikut diganti hanya bila dipilih), abaikan (lepas tanda). Menerapkan memakai `D` yang dihitung ulang (ditolak bila berbeda dari yang ditampilkan), mengubah `harga_jual`, dan mencatat `HARGA_TINJAU_TERAPKAN` dengan nilai lama/baru; abaikan mencatat `HARGA_TINJAU_ABAIKAN` (K-086). |
| H7 | **[M2 Fase 9]** `harga_otomatis = true` (bawaan **true** sejak K-094; dimatikan/dinyalakan pemegang `master.harga.kelola` dari form barang atau sakelar di tabel Harga Jual, log `BARANG_UBAH`): saat pemicu H5 terjadi, baris IKUT_TIER/MARKUP yang hasil hitungnya **naik** langsung diterapkan (H4) di transaksi yang sama dengan log `HARGA_UBAH`; yang **turun** (termasuk dasar Rp 0) tidak diterapkan dan barang ditandai perlu tinjau. Pada pemicu perubahan `D`, barang juga ditandai bila harga tetap tier default di bawah usulannya. Selain itu tanda dilepas. Baris TETAP tidak pernah otomatis (K-086). |
| H8 | **Tier transaksi menurut total nilai belanja (K-098; menggantikan tier menurut qty K-094/K-097).** Harga jual ditentukan total belanja satu transaksi, bukan pembelinya dan bukan qty per barang. `nilai_belanja` = Σ `bulatkanRupiah(qty × harga tier dasar)` semua baris (harga janji P2 bila ada; baris harga manual dinilai dengan harga tier dasarnya), sebelum promo dan diskon. **Tier transaksi** = tier aktif ber-`min_belanja` terbesar yang ≤ `nilai_belanja` (syarat sama → markup terkecil); tidak ada yang tercapai → tier dasar. Tier transaksi dipakai **semua baris** yang tidak dipilih kasir, kecuali baris yang harga tier itu belum ada atau lebih mahal dari harga tier dasarnya: baris itu memakai tier dasar. **Tier selalu otomatis (K-099):** tidak ada tier pilihan kasir (tombol T, pilihan tier di form order, izin `penjualan.tier.ubah`, dan kolom `tier_dipilih` dihapus); pengecualian harga hanya lewat promo atau harga manual (H9). Karena itu tier aktif selain tier dasar **wajib** punya `min_belanja` (CHECK `chk_tingkat_harga_aktif_bersyarat`; tier tanpa syarat hanya boleh NONAKTIF dan tidak bisa diaktifkan sebelum diisi); tier dasar tidak boleh punya `min_belanja`. Tidak butuh izin. Pratinjau mengembalikan `tierBelanja` (nilai belanja, tier transaksi, tier berikutnya dan kekurangan belanjanya) untuk kasir dan form order. Daftar tier memberi `peringatan` (pemegang `master.barang.lihat_hpp`) bila susunan janggal: markup tidak lebih kecil dari tier dasar, atau syarat belanja lebih besar tetapi markup lebih besar. |
| H9 | Harga manual (`penjualan.harga_manual`): kasir/Admin mengetik harga; `harga_manual = true`, `id_tingkat_harga = null`; log mencatat harga tier default sebagai pembanding. Harga manual di bawah `D` (di bawah modal) ditolak untuk Kasir; Admin/Owner diperbolehkan dengan konfirmasi dan log `PENJUALAN_HARGA_MANUAL` bertanda "di bawah modal". |
| H10 | Mengubah harga master tidak mengubah transaksi yang sudah ada (snapshot, P2). |
| H11 | **[M2 Fase 12]** Harga per satuan jual: bawaan = `bulatkanHarga(harga_jual satuan dasar tier itu × faktor_ke_dasar)`, **dihitung saat dibaca** (selalu mengikuti harga satuan dasar); bisa ditetapkan TETAP untuk tier dasar saja (baris `harga_barang` dengan `id_satuan_jual`; tier lain selalu dihitung, K-098). Perubahan harga satuan dasar tidak menimpa harga satuan jual yang TETAP. Promo: syarat min qty dan potongan nominal per satuan dihitung dalam satuan dasar; potongan persen dari harga baris. Satu barang boleh beberapa baris asal satuannya berbeda (K-095, menggantikan "satu barang satu baris" K-091); nilai belanja (H8) memakai harga tier dasar satuan baris. **K-094:** satuan dasar = satuan terkecil yang dijual; satuan jual aktif adalah kemasan berisi > 1 satuan dasar; qty kemasan wajib bulat (sebagian kemasan dijual dalam satuan dasar). |
| H12 | Margin tampil (`(harga_jual − D) ÷ harga_jual`, 2 desimal, dihitung API) di Harga Jual, form barang, Tinjau Harga, dan ekspor, hanya untuk pemegang `master.barang.lihat_hpp`; API menyaring `D`, `margin`, `markup_persen` barang, `hpp` untuk yang lain. |
| H13 | Halaman Harga Jual (Fase 3): tabel barang × tier, edit sel harga dasar langsung (tier lain hanya tampil, K-098), simpan massal; filter kategori; ekspor Excel. Import harga dasar dari Excel ikut templat import barang (kolom `harga_<kode tier dasar>`). Halaman, dialog Kelola tier, dan halaman Promo punya tombol "?" yang membuka penjelasan istilah dan aturan layar itu (K-099; sebelumnya kotak di halaman). |

## 2. Diskon (Fase 5)

| # | Aturan |
|---|---|
| D0 | **[K-146] Diskon manual dihapus.** Potongan harga hanya lewat Promo (PR1–PR11). API menolak `diskonBaris`/`diskonTransaksi` baru dengan `VALIDASI` "Potongan harga hanya lewat Promo"; nilai yang sudah tersimpan sebelum K-146 tetap sah saat dokumen diubah atau dilaporkan. D1–D6 di bawah hanya berlaku untuk data lama. |
| D1 | Diskon baris: dimasukkan sebagai rupiah atau persen; disimpan sebagai rupiah (`diskon_baris`, U4); persen dihitung dari subtotal baris setelah promo (`bruto − diskon_promo`). Diskon transaksi: rupiah atau persen dari Σ subtotal baris (setelah promo dan diskon baris), disimpan rupiah (`diskon_transaksi`). |
| D2 | Batas per peran: `konfigurasi.batas_diskon_persen_<PERAN>` (seed: STAF 0, KASIR 0, ADMIN 100, OWNER 100). Diskon baris ditolak bila `diskon_baris ÷ (bulatkanRupiah(qty × harga) − diskon_promo) × 100 > batas`; diskon transaksi ditolak bila `diskon_transaksi ÷ Σ subtotal × 100 > batas`. Batas 0 = tidak boleh memberi diskon manual. Pesan menyebut batas peran. Batas diuji untuk nilai yang diberikan/diubah pelaku; diskon yang sudah ada di order dan tidak diubah tetap sah (K-087). |
| D3 | Diskon manual dan diskon promo disimpan terpisah (`diskon_baris` vs `diskon_promo`); keduanya boleh ada pada baris yang sama hanya bila peran punya batas > 0 (D2 dihitung atas subtotal setelah promo). |
| D4 | Subtotal baris dan `total_neto` tidak boleh negatif. |
| D5 | Setiap diskon manual > 0 dicatat log `PENJUALAN_DISKON` (nomor, baris, nilai, peran). |
| D6 | Struk dan invoice mencetak diskon per baris ("Disc Rp 5.000") dan diskon transaksi sebagai baris terpisah sebelum total. |

## 3. Promo [M2 Fase 9]

| # | Aturan |
|---|---|
| PR1 | Promo berlaku bila `status_aktif = AKTIF`, bukan templat, dan saat transaksi di dalam `[mulai_pada, selesai_pada]` (sampai menit, K-163; promo lama: 00:00 tanggal mulai s.d. 23:59:59 tanggal selesai WIB), ditambah PR12. `tanggal_mulai`/`tanggal_selesai` = tanggal lokal dari keduanya (saringan dan laporan). |
| PR2 | Kecocokan baris: `sasaran = SEMUA`; atau KATEGORI/MERK/BARANG dan kategori/merk/barang baris itu termasuk daftar `promo_sasaran` (boleh beberapa, K-163). Syarat: `qty ≥ min_qty` (bila diisi) dan `total_bruto transaksi ≥ min_belanja` (bila diisi). **K-097 pembeli:** `sasaran_pembeli` SEMUA (semua pembeli, termasuk umum), GOLONGAN (pelanggan transaksi bergolongan `id_golongan` aktif), atau PELANGGAN (pelanggan transaksi ada di `promo_pelanggan`); syarat belanja pelanggan: Σ(`total_neto − total_void − total_retur`) penjualan non-VOID pelanggan itu dengan `tanggal_operasional` dalam `hari_belanja` hari terakhir (termasuk hari transaksi) ≥ `min_belanja_pelanggan`; pembeli umum tidak pernah memenuhi syarat ini. |
| PR3 | Potongan baris: PERSEN → `bulatkanRupiah(qty × harga_satuan × persen/100)` (dibulatkan sekali), dibatasi `maks_potongan` bila diisi; NOMINAL → `bulatkanRupiah(potongan_nominal × qty)`. Potongan selalu ≤ bruto baris. |
| PR4 | Satu promo per baris: bila lebih dari satu cocok, dipilih potongan terbesar; seri → yang `tanggal_mulai` terbaru, lalu id terbesar. `id_promo` dan `diskon_promo` disimpan di baris order dan penjualan. Promo tidak berlaku untuk baris harga manual (K-087). |
| PR5 | Promo dievaluasi ulang setiap baris berubah (pratinjau API) dan sekali lagi saat checkout (tanggal dan pelaku checkout yang menentukan; baris & total order ikut diselaraskan). Kasir (`penjualan.checkout`) dapat melepas/memasang promo pada baris tertentu; dicatat `PENJUALAN_PROMO_LEPAS` (K-087). |
| PR6 | Promo tidak boleh membuat harga baris di bawah `D` untuk pelaku tanpa izin `penjualan.harga_manual` (Staf/Kasir): promo itu dilewati dan dipakai promo aman berikutnya; UI diberi tanda tanpa angka modal. Pemegang izin itu (Admin/Owner) tetap boleh (K-087, keputusan pemilik). |
| PR7 | Struk mencetak "Promo <nama>" di bawah baris; invoice, detail penjualan, dan Laporan Detail Invoice menampilkan potongan promo. Laporan Promo: ringkasan per promo (transaksi, baris, bruto, potongan, bersih, rasio) dan rincian per barang. |
| PR8 | Yang belum ada: voucher, kupon undian, poin, promo bertingkat, sasaran per atribut, dan gratis barang yang berbeda (beli X gratis Y hanya barang yang sama, PR14) — usulan K-163 bagian 2. |
| PR9 | **K-098: promo bertumpuk di atas harga tier.** Urutan hitung baris: harga tier (H8) → bruto → promo dihitung dari harga tier baris itu (PR3) → diskon manual (D1). Baris bertier pilihan kasir juga mendapat promo. Batas modal PR6 diuji atas harga setelah promo. Saat checkout order (PR5), promo dievaluasi ulang dari harga yang tersimpan di baris order. Nilai belanja penentu tier (H8) tidak dikurangi promo. Menggantikan K-097 ("tier qty dan promo tidak digabung"). |
| PR10 | **[K-110] Anggaran promo.** `promo.anggaran` (rupiah; NULL = tanpa batas) = jumlah seluruh potongan yang boleh diberikan promo. *Terpakai* = Σ `diskon_promo` baris penjualan yang memakai promo itu, tidak termasuk baris VOID dan penjualan VOID (void mengembalikan anggaran; retur tidak). Potongan sebuah baris dibatasi sisa anggaran: bila sisa < potongan penuh, baris dipotong sebesar sisanya; bila sisa 0, promo gugur dan kandidat berikutnya (PR4) dipakai. Sisa dibagi ke baris satu transaksi secara berurutan. Saat checkout promo berbatas dikunci (`FOR UPDATE`, urut id) sebelum sisanya dibaca. Anggaran boleh diubah setelah promo dipakai, tetapi tidak di bawah yang terpakai. |
| PR11 | **[K-110] Batas per pembeli.** `promo.maks_per_pembeli` (rupiah; NULL = tanpa batas) = potongan paling banyak untuk satu pembeli dari promo itu. Pelanggan terdata: dihitung dari semua transaksinya (bukan VOID). Pembeli umum: per transaksi. Bila `anggaran` juga diisi, `maks_per_pembeli < anggaran` (CHECK DB dan validasi). Sisa yang berlaku untuk sebuah transaksi = yang terkecil dari sisa anggaran (PR10) dan sisa batas pembeli. |
| PR12 | **[K-163] Hari dan jam berlaku.** `hari_berlaku` (bit hari ISO, Senin = 1 … Minggu = 64; NULL = setiap hari) dan jam harian `[jam_mulai, jam_selesai)` zona toko (keduanya NULL = sepanjang hari; tidak melewati tengah malam). Dinilai pada saat pratinjau dan saat checkout (PR5). |
| PR13 | **[K-163] Sasaran banyak.** `promo.sasaran` KATEGORI, MERK, atau BARANG dengan daftar di `promo_sasaran` (satu baris = tepat satu barang/kategori/merk; maks. 200). Barang/kategori/merk yang baru dipilih harus AKTIF. Promo lama (satu kategori/satu barang) dipindah ke daftar ini (migrasi 0029). |
| PR14 | **[K-163] Jenis manfaat.** Selain PERSEN/NOMINAL (PR3): HARGA_KHUSUS = `bruto − bulatkanRupiah(qty dasar × harga_khusus)` (0 bila harga tier sudah lebih murah); GRATIS (beli X gratis Y, barang yang sama, satuan dasar) = nilai `⌊qty ÷ (beli + gratis)⌋ × gratis` dari harga baris: `bulatkanRupiah(bruto × qty gratis ÷ qty)`. Kasir mengetik seluruh qty yang dibawa pembeli; yang gratis menjadi potongan. PR4, PR6, PR10, PR11 tetap berlaku. |
| PR16 | **[K-185] Sasaran kombinasi.** `promo.sasaran = KELOMPOK`: tiap baris `promo_sasaran` = satu kelompok berisi kategori, merk, dan/atau barang (minimal satu). Barang cocok dengan kelompok bila **semua** kolom yang diisi sama dengan barang itu (kategori DAN merk DAN barang); barang kena promo bila cocok dengan **salah satu** kelompok (maks. 50). Kelompok baru wajib berisi data AKTIF, dan barang di kelompok wajib termasuk kategori/merk kelompok itu (kalau tidak, kelompok itu tidak pernah cocok, jadi ditolak). |
| PR17 | **[K-185] Beli N potong Rp X.** `jenis_potongan = BELI_POTONG` dengan `beli_qty` = N (satuan dasar) dan `potongan_nominal` = X: potongan = `⌊qty dasar ÷ N⌋ × X`, per kelipatan seperti PR14 GRATIS. Contoh beli 2 potong Rp 2.000: qty 5 → Rp 4.000, qty 1 → 0. Tetap dibatasi bruto baris; PR4, PR6, PR10, PR11 berlaku. **[K-194]** `maks_kelipatan` (1–1000, kosong = tanpa batas; hanya GRATIS dan BELI_POTONG) membatasi jumlah kelipatan per baris: `min(⌊qty ÷ N⌋, maks)`; untuk GRATIS jumlah paket (beli + gratis) yang dibatasi. |
| PR15 | **[K-163] Templat kampanye.** `promo.templat = true`: tidak pernah menjadi kandidat (PR1), tampil di daftar Templat. *Simpan sebagai templat* dan *Pakai templat* menyalin isian di layar menjadi templat/promo baru (waktu diisi ulang). Kolom aturan yang dikunci setelah promo terpakai (K-087) kini juga mencakup hari/jam, harga khusus, beli/gratis, daftar sasaran, dan `templat`; waktu selesai tetap boleh diubah. |

## 4. Piutang pelanggan (Fase 5 dasar, Fase 10 limit dan umur)

| # | Aturan |
|---|---|
| PT1 | Piutang = penjualan `status_transaksi ≠ VOID` dengan `status_pembayaran ≠ LUNAS`. Nilai = `sisa_tagihan`. Hanya penjualan dengan pelanggan terdata yang boleh menjadi piutang (P6, P7). |
| PT2 | `tanggal_jatuh_tempo` wajib bila penjualan tidak lunas saat checkout (default P7). Bisa diubah oleh Kasir/Admin/Owner dengan log. |
| PT3 | Halaman Piutang: daftar per penjualan (pelanggan, nomor, tanggal, jatuh tempo, sisa, status), filter pelanggan/terlambat, total; tombol "Terima pembayaran" membuka form pembayaran PELUNASAN (P8). Ringkasan per pelanggan: total sisa, jumlah invoice, terlama. |
| PT4 | Terlambat = `tanggal_jatuh_tempo < hari ini`. Notifikasi H-3 dan terlambat (ST2). |
| PT5 | **[M2 Fase 10] Umur piutang**: kelompok menurut hari lewat jatuh tempo: belum jatuh tempo (≤ 0 hari, termasuk jatuh tempo hari ini), 1–30, 31–60, 61–90, > 90 hari (K-088). Laporan piutang menampilkan ringkasan umur dan per pelanggan. |
| PT6 | **[M2 Fase 10] Limit kredit**: bila `pelanggan.limit_kredit` terisi, saat checkout tidak lunas: `piutang_berjalan + sisa_tagihan_baru > limit_kredit` → `LIMIT_TERLAMPAUI` menyebut limit dan piutang berjalan. Pemegang `master.pelanggan.atur_kredit` (Admin/Owner) dapat melanjutkan dengan konfirmasi (`setujuLimit`, log `PENJUALAN_LIMIT_OVERRIDE`; K-088). Pengguna tanpa izin itu (Kasir) dapat melanjutkan dengan **kode sekali pakai** yang dikirim ke Admin/Owner (`kodeLimit`, docs/04 §6): kode berlaku untuk pelanggan itu dan tagihan baru paling banyak sebesar yang dibaca atasan; log atas nama atasan pemilik kode dan menyebut sesi kasir (K-102, menggantikan K-101). Limit bawaan pelanggan baru: `konfigurasi.limit_kredit_default`, diatur dari form tambah pelanggan (K-104). |
| PT7 | Pelanggan dengan piutang terlambat tidak diblokir otomatis; UI menampilkan peringatan di layar order/checkout. |
| PT8 | Retur POTONG_TAGIHAN mengurangi piutang (T7); refund tidak. |

## 5. Hutang pemasok [M2 Fase 10]

| # | Aturan |
|---|---|
| HT1 | Hutang = `penerimaan_barang` PEMBELIAN TEMPO dengan `status_hutang ∈ {BELUM_LUNAS, SEBAGIAN}` (sisa = `sisa_hutang`), dan `penyelesaian_konsinyasi` dengan `status_hutang ≠ LUNAS`. |
| HT2 | Pembayaran ke pemasok (`PBP`): `nominal ≤ sisa_hutang` dokumen sumber; TUNAI wajib shift BUKA pengguna dan otomatis `kas_shift(BAYAR_PEMASOK, KELUAR)`; TRANSFER wajib `rekening` tujuan dan `referensi` 4–40 huruf/angka (K-088; **K-196**: sama dengan P8, di semua peran). `status_hutang`: sisa 0 → LUNAS; sebagian dibayar → SEBAGIAN. |
| HT3 | Halaman Hutang: daftar per dokumen (pemasok, nomor, tanggal, jatuh tempo, total, dibayar, potongan retur, sisa), ringkasan per pemasok (saringan pemasok), umur hutang (kelompok seperti PT5), riwayat pembayaran, tombol bayar (K-088). |
| HT4 | Notifikasi hutang jatuh tempo H-3 dan terlambat (`hutang.lihat`). |
| HT5 | Laporan Hutang: per pemasok, per dokumen, per kelompok umur; total. |
| HT6 | Retur pemasok POTONG_HUTANG (RP4) menambah `total_retur_potong` dokumen penerimaan sumber dan menghitung ulang `status_hutang`. |
| HT7 | **[M2 Fase 9]** Laporan Riwayat Harga Beli: dari `penerimaan_barang_detail` PEMBELIAN, urut tanggal, per barang dan pemasok; perubahan dibanding pembelian sebelumnya dari pemasok yang sama; perbandingan antarpemasok (terendah, tertinggi, rata-rata tertimbang, terakhir). Izin `laporan.persediaan` + `laporan.laba` (K-087). |
| HT8 | **Hutang awal pemasok** (K-241, `hutang_awal`, nomor HAW): faktur lama yang belum lunas saat mulai memakai aplikasi; pemasok aktif, sisa > 0, jatuh tempo wajib (boleh sudah lewat), tanggal faktur tidak setelah hari ini, no. faktur lama sama untuk pemasok sama ditolak. Tidak menambah stok. Tampil di Hutang Pemasok (jenis HUTANG_AWAL) dan dibayar lewat HT2 (`pembayaran_pemasok.id_hutang_awal`). Izin `hutang.kelola`; log HUTANG_AWAL_CATAT. |

## 6. Retur ke pemasok [M2 Fase 10]

| # | Aturan |
|---|---|
| RP1 | Dokumen `RTP`: pemasok, opsional `id_penerimaan` asal, alasan, penyelesaian, baris (barang, `kondisi_asal` BAIK/RUSAK, qty). Barang harus milik pemasok itu (untuk KONSINYASI) atau pernah dibeli dari pemasok itu (untuk MILIK_SENDIRI; bila tidak ada riwayat, peringatan bukan penolakan). |
| RP2 | Efek stok: per baris `catatMutasi(RETUR_PEMASOK, keluar qty_dasar, bucket kondisi_asal, hpp = hpp_rata2 saat itu)`; `subtotal = bulatkanRupiah(qty × hpp)`; `total_retur = Σ subtotal`. |
| RP3 | `kondisi_asal = BAIK` mengurangi stok tersedia; ditolak bila melanggar A6 (stok dipesan). |
| RP4 | POTONG_HUTANG: wajib `id_penerimaan` dengan `sisa_hutang ≥ total_retur`; `total_retur_potong += total_retur` (HT6). |
| RP5 | GANTI_BARANG: barang pengganti dicatat sebagai penerimaan PEMBELIAN baru dengan `harga_modal_masuk` = hpp yang diretur, syarat TUNAI, dan `pembayaran_pemasok` otomatis metode KOMPENSASI (`id_retur_pemasok` diisi) sehingga tidak ada uang bergerak dan HPP tidak terdistorsi. Barang pengganti dicatat masuk saat retur disimpan; mutasinya bukan pembelian (harga beli terakhir tetap, tidak ikut HT7) (K-088). |
| RP6 | REFUND: pemasok mengembalikan uang; TUNAI → `kas_shift(MASUK_LAIN, MASUK, keterangan "Refund RTP-…")` pada shift pengguna; TRANSFER → dicatat di `catatan` retur pemasok dengan referensi (wajib, pola P8, K-196). |
| RP7 | PENGEMBALIAN_TITIPAN: hanya barang KONSINYASI; tanpa kompensasi; mengurangi stok titipan (RP2). |

## 7. Konsinyasi (Fase 3–4 penandaan, Fase 11 penyelesaian)

| # | Aturan |
|---|---|
| KS1 | Barang `kepemilikan = KONSINYASI` wajib `id_pemasok_konsinyasi` dan `harga_titip` (CHECK DB). Kepemilikan tidak bisa diubah selama `stok_fisik + stok_rusak > 0` (service). |
| KS2 | Penerimaan: hanya lewat jenis KONSINYASI dari pemasok yang sama (E3). HPP = harga titip (L7). Tidak membentuk hutang saat diterima. |
| KS3 | Penjualan: baris barang konsinyasi memakai `hpp_saat_transaksi = harga_titip` saat itu (P5). Gross profit baris = subtotal − harga_titip × qty. Harga jual tier mengikuti H3 dengan `D = harga_titip`. |
| KS4 | Nilai persediaan memisahkan MILIK_SENDIRI (aset toko) dan KONSINYASI (informasi, bukan aset), keduanya dihitung `stok × hpp_rata2`. Laporan stok rekap, kartu stok, stok minimum memuat barang konsinyasi dengan tanda "Titipan". |
| KS5 | **[M2 Fase 11] Penyelesaian** (`KSG`) per pemasok per periode: kandidat = baris `penjualan_detail` barang konsinyasi pemasok itu dengan `status_item ≠ VOID`, `id_penyelesaian_konsinyasi` null, `tanggal_operasional ≤ periode_selesai`. Per barang: `qty_terjual = Σ qty_dasar`, `qty_retur = Σ qty_retur_dasar` kondisi BAIK dari retur DISETUJUI atas baris itu, `qty_neto = qty_terjual − qty_retur`, `subtotal = bulatkanRupiah(qty_neto × harga_titip baris saat jual)`. Baris yang disertakan diberi `id_penyelesaian_konsinyasi`. `total` menjadi hutang (HT1). Rinci (K-089): satu baris setoran per barang per harga titip saat jual; `periode_mulai` otomatis; retur tukar barang netral (tidak mengurangi). **Revisi K-092:** qty disetor = terjual − retur pelanggan (baik maupun rusak) + ganti rugi (barang titipan dimusnahkan toko, `qty_ganti_rugi`). |
| KS6 | **[M2 Fase 11]** Retur pelanggan kondisi BAIK atas baris yang **sudah** disetor: dicatat sebagai koreksi pada penyelesaian berikutnya (qty_retur negatif pada periode berikutnya). Kondisi RUSAK tidak mengurangi setoran (barang rusak tanggung jawab toko, kecuali diklaim ke pemasok lewat RP7). Koreksi hanya diserap penjualan baru barang & harga titip yang sama; bila belum cukup, ditunda ke setoran berikutnya (qty neto ≥ 0). Retur yang sudah dihitung ditandai `retur_penjualan_detail.id_penyelesaian_konsinyasi` (K-089). **Revisi K-092:** retur rusak juga mengurangi setoran; barang titipan rusak diselesaikan dengan Kembalikan ke penitip (penitip menanggung) atau Musnahkan (toko mengganti lewat setoran berikutnya). |
| KS7 | **[M2 Fase 11]** Pembayaran penyelesaian lewat HT2 dengan sumber `id_penyelesaian_konsinyasi`. Barang titipan tidak laku dikembalikan lewat RP7. |
| KS8 | **[M2 Fase 11] Laporan Konsinyasi** per pemasok: stok titipan saat ini (qty, nilai titip), terjual belum disetor, sudah disetor (periode), sisa hutang konsinyasi. |
| KS9 | Perubahan `harga_titip`: berlaku untuk penjualan berikutnya; `hpp_rata2` barang diperbarui (L7); penyelesaian memakai harga titip saat baris dijual (`hpp_saat_transaksi`), bukan saat disetor. |

## 8. Stok rusak [M2 Fase 10] (bucket disiapkan sejak Fase 4)

| # | Aturan |
|---|---|
| SR1 | Bucket RUSAK (`persediaan.stok_rusak`) terpisah dari stok jual. Tidak masuk `stok_tersedia`, tidak masuk nilai persediaan aset; nilainya (`stok_rusak × hpp_rata2`) ditampilkan sebagai informasi "nilai barang rusak". |
| SR2 | Masuk ke bucket RUSAK: retur pelanggan kondisi RUSAK/CACAT (T4), penyesuaian RUSAK dari bucket BAIK (A5). |
| SR3 | Keluar dari bucket RUSAK: retur pemasok `kondisi_asal = RUSAK` (RP2), penyesuaian MUSNAH (A5) dengan alasan wajib. |
| SR4 | Tab "Stok rusak" di Stok Persediaan: daftar barang dengan `stok_rusak > 0` (nilai HPP bila berizin), tombol "Retur ke pemasok" dan "Musnahkan"; riwayat bucket RUSAK lewat Kartu stok kondisi Rusak dan tab Mutasi (K-088). |
| SR5 | Kartu stok menampilkan kedua bucket dengan kolom kondisi; stok rekap memakai bucket BAIK, dengan lampiran rekap rusak. |
| SR6 | Barang KONSINYASI yang rusak masuk bucket RUSAK juga; penyelesaiannya lewat RP7 (klaim) atau MUSNAH. |

## 9. Izin dan konfigurasi yang dipakai dokumen ini

Izin: `master.harga.kelola`, `master.harga.tinjau`, `penjualan.harga_manual`,
`penjualan.diskon`, `penjualan.piutang.lihat`, `hutang.lihat`, `hutang.kelola`, `persediaan.retur_pemasok.kelola`,
`konsinyasi.kelola`, `promo.kelola`, `laporan.piutang`, `laporan.hutang`, `master.barang.lihat_hpp`.

Konfigurasi: `dasar_markup`, `pembulatan_harga`, `batas_diskon_persen_<PERAN>`, `term_hari_default`,
`jatuh_tempo_default_hari`.

## Riwayat

- 2026-09-19 — v1.
- 2026-10-04 — §1 H4–H7, H12: markup per barang, pemicu dibandingkan dari `D`, harga otomatis naik langsung/turun
  ditinjau, usulan harga Normal di Tinjau Harga, margin (K-086, keputusan pemilik).
- 2026-10-04 — §2 D1–D2 dasar setelah promo, §3 PR3–PR7 dirinci, H8 saran termurah, HT7 dipindah ke Fase 9 (K-087).
- 2026-10-07 — PT5 kelompok umur dirinci, PT6 izin melanjutkan, HT2 rekening, HT3, RP5 barang pengganti, SR4 tab Stok rusak (K-088).
- 2026-10-07 — KS5–KS6 dirinci: baris per harga titip, retur tukar netral, koreksi ditunda (K-089).
- 2026-10-07 — H11 dirinci: harga satuan jual dihitung saat dibaca, promo per satuan dasar (K-091).
- 2026-10-08 — KS5–KS6 direvisi: retur rusak mengurangi setoran, ganti rugi pemusnahan titipan (K-092).
- 2026-10-09 — H2, H4, H7, H8, H11 direvisi: harga otomatis bawaan, tier default boleh markup, tier otomatis
  berdasarkan qty, kemasan berisi > 1 dengan qty bulat (K-094, keputusan pemilik).
- 2026-10-10 — H8 direvisi (harga hanya menurut qty; syarat qty per tier dan per barang), PR2 sasaran pembeli dan
  syarat belanja pelanggan, PR9 tier qty dan promo tidak digabung (K-097, keputusan pemilik).
- 2026-10-10 — H1, H2, H4, H8, H11, H13, PR9 direvisi: tier transaksi menurut total nilai belanja, tier selain
  tier dasar selalu markup tier untuk semua barang, promo dipotong dari harga tier (K-098, keputusan pemilik).
- 2026-10-10 — H8: tier selalu otomatis, tier aktif wajib bersyarat belanja, izin ganti tier dihapus (K-099).
- 2026-10-09 — H2/H11: harga modal boleh belum diketahui (harga markup Rp 0 = belum bisa dijual sampai
  penerimaan pertama); satu barang beberapa baris beda satuan (K-095).
- 2026-10-10 — PT6: melampaui limit kredit dengan persetujuan atasan di tempat (K-101, keputusan pemilik).
- 2026-10-11 — PT6: persetujuan dengan kode sekali pakai (K-102); limit kredit bawaan pelanggan baru (K-104).
- 2026-10-12 — PR10 anggaran promo, PR11 batas per pembeli (K-110).
- 2026-10-24 — PR1, PR2, PR8 disesuaikan; PR12–PR15 kampanye promo: waktu sampai menit, hari/jam, sasaran banyak, harga khusus, beli X gratis Y, templat (K-163 bagian 1).
- 2026-10-30 — PR17: batas kelipatan per baris untuk beli-gratis dan beli-potong (K-194).
- 2026-10-30 — HT2, RP6: No. referensi transfer wajib dengan pola yang sama di semua jalur uang (K-196).
- 2026-10-28 — H3: pilihan dasar markup FIFO (K-184).
- 2026-10-28 — PR16 sasaran kombinasi (kelompok kategori DAN merk DAN barang), PR17 beli N potong Rp X (K-185).
- 2026-10-23 — D0: diskon manual dihapus; D1–D6 hanya untuk data lama; konfigurasi `batas_diskon_persen_*` tidak dipakai lagi (K-146).
