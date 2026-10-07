# 06 — Harga, Diskon, Promo, Piutang, Hutang, Konsinyasi, Stok Rusak

Format dan kewajiban tes sama dengan `05-aturan-bisnis-inti.md`. Aturan tanpa tanda berlaku sejak fase M1 yang
disebut; **[M2]** berarti dibangun pada fase M2 yang disebut, meskipun kolomnya sudah ada di skema.

## 1. Tier harga dan harga jual (Fase 3 dasar, Fase 9 penuh)

| # | Aturan |
|---|---|
| H1 | Master `tingkat_harga`: tepat satu `is_default` (seed: NORMAL). Tier NONAKTIF tidak muncul di dropdown, tetapi baris `harga_barang`-nya dipertahankan. Menonaktifkan tier default ditolak. |
| H2 | Setiap barang punya satu baris `harga_barang` untuk setiap tier aktif (satuan jual null). Dibuat saat barang dibuat (K-047) dan saat tier baru dibuat (untuk semua barang, metode IKUT_TIER). Tidak ada barang tanpa harga tier default. |
| H3 | Dasar markup `D` = `persediaan.harga_beli_terakhir` bila `konfigurasi.dasar_markup = HARGA_BELI_TERAKHIR` (default), atau `persediaan.hpp_rata2` bila `HPP_RATA2`. Barang KONSINYASI: `D = harga_titip`. Sebelum ada penerimaan, `D = harga_modal_awal`. |
| H4 | Harga hasil markup: `bulatkanHarga(D × (1 + persen/100))`, dengan `bulatkanHarga(x)` = dibulatkan **ke atas** ke kelipatan `konfigurasi.pembulatan_harga` (default 100). Persen: IKUT_TIER → `tingkat_harga.markup_default_persen`; MARKUP → `harga_barang.markup_persen` (per barang, tidak boleh bersamaan dengan harga tetap). TETAP → `harga_tetap` apa adanya. Tier default wajib TETAP. `harga_jual` disimpan; `dasar_markup_saat_hitung = D` disimpan (dan diperbarui walau harga hasil pembulatan sama) untuk IKUT_TIER/MARKUP (K-086). |
| H5 | **Tanda perlu tinjau.** Pemicu = `D` barang berubah (dibandingkan sebelum/sesudah kejadian): penerimaan pembelian (L6; mode `HPP_RATA2` mengikuti HPP), `harga_modal_awal` diubah sebelum ada penerimaan, `harga_titip` atau kepemilikan berubah; juga `markup_default_persen` tier non-default berubah (barang yang punya baris IKUT_TIER pada tier itu) dan `dasar_markup`/`pembulatan_harga` di Pengaturan berubah (barang yang hasil hitung markupnya berubah). Barang tidak otomatis → `perlu_tinjau_harga = true`, harga tidak berubah; barang otomatis → H7. Tanda dilepas saat Tinjau Harga diterapkan atau diabaikan, atau saat harga barang itu disimpan manual (semua baris IKUT_TIER/MARKUP barang itu dihitung ulang dengan `D` terkini). Tier yang diaktifkan kembali: baris IKUT_TIER/MARKUP-nya dihitung ulang tanpa tanda, seperti tier baru (K-086). |
| H6 | **[M2 Fase 9] Tinjau Harga** (tab di Harga Jual; `master.harga.tinjau` dan `master.barang.lihat_hpp`): daftar barang aktif `perlu_tinjau_harga`, per tier: harga sekarang, dasar lama → baru, harga usulan (H4; harga tetap tier default diusulkan `bulatkanHarga(D × (1 + markup tier default))`, harga tetap tier lain tidak diusulkan), margin sekarang dan usulan. Aksi: terapkan per barang, terapkan semua terpilih (harga tetap tier default ikut diganti hanya bila dipilih), abaikan (lepas tanda). Menerapkan memakai `D` yang dihitung ulang (ditolak bila berbeda dari yang ditampilkan), mengubah `harga_jual`, dan mencatat `HARGA_TINJAU_TERAPKAN` dengan nilai lama/baru; abaikan mencatat `HARGA_TINJAU_ABAIKAN` (K-086). |
| H7 | **[M2 Fase 9]** `harga_otomatis = true` (bawaan false; diubah pemegang `master.harga.kelola`): saat pemicu H5 terjadi, baris IKUT_TIER/MARKUP yang hasil hitungnya **naik** langsung diterapkan (H4) di transaksi yang sama dengan log `HARGA_UBAH`; yang **turun** (termasuk dasar Rp 0) tidak diterapkan dan barang ditandai perlu tinjau. Pada pemicu perubahan `D`, barang juga ditandai bila harga tetap tier default di bawah usulannya. Selain itu tanda dilepas. Baris TETAP tidak pernah otomatis (K-086). |
| H8 | Pilihan tier di transaksi (Fase 5): default P3 docs/05; dropdown menampilkan nama tier dan harganya. **[M2 Fase 9]** bila `qty ≥ tingkat_harga.saran_min_qty` dan tier itu lebih murah dari harga baris, API memberi saran (bila lebih dari satu: yang termurah); UI menyorotnya untuk semua peran, tidak memaksa (K-087). |
| H9 | Harga manual (`penjualan.harga_manual`): kasir/Admin mengetik harga; `harga_manual = true`, `id_tingkat_harga = null`; log mencatat harga tier default sebagai pembanding. Harga manual di bawah `D` (di bawah modal) ditolak untuk Kasir; Admin/Owner diperbolehkan dengan konfirmasi dan log `PENJUALAN_HARGA_MANUAL` bertanda "di bawah modal". |
| H10 | Mengubah harga master tidak mengubah transaksi yang sudah ada (snapshot, P2). |
| H11 | **[M2 Fase 12]** Harga per satuan jual: baris `harga_barang` dengan `id_satuan_jual`; default dibuat otomatis = `bulatkanHarga(harga_jual satuan dasar × faktor_ke_dasar)` saat satuan jual dibuat; bisa diubah menjadi TETAP. Perubahan harga satuan dasar tidak menimpa harga satuan jual yang TETAP. |
| H12 | Margin tampil (`(harga_jual − D) ÷ harga_jual`, 2 desimal, dihitung API) di Harga Jual, form barang, Tinjau Harga, dan ekspor, hanya untuk pemegang `master.barang.lihat_hpp`; API menyaring `D`, `margin`, `markup_persen` barang, `hpp` untuk yang lain. |
| H13 | Halaman Harga Jual (Fase 3): tabel barang × tier, edit sel langsung, simpan massal; filter kategori; ekspor Excel. Import harga dari Excel ikut templat import barang. |

## 2. Diskon (Fase 5)

| # | Aturan |
|---|---|
| D1 | Diskon baris: dimasukkan sebagai rupiah atau persen; disimpan sebagai rupiah (`diskon_baris`, U4); persen dihitung dari subtotal baris setelah promo (`bruto − diskon_promo`). Diskon transaksi: rupiah atau persen dari Σ subtotal baris (setelah promo dan diskon baris), disimpan rupiah (`diskon_transaksi`). |
| D2 | Batas per peran: `konfigurasi.batas_diskon_persen_<PERAN>` (seed: STAF 0, KASIR 0, ADMIN 100, OWNER 100). Diskon baris ditolak bila `diskon_baris ÷ (bulatkanRupiah(qty × harga) − diskon_promo) × 100 > batas`; diskon transaksi ditolak bila `diskon_transaksi ÷ Σ subtotal × 100 > batas`. Batas 0 = tidak boleh memberi diskon manual. Pesan menyebut batas peran. Batas diuji untuk nilai yang diberikan/diubah pelaku; diskon yang sudah ada di order dan tidak diubah tetap sah (K-087). |
| D3 | Diskon manual dan diskon promo disimpan terpisah (`diskon_baris` vs `diskon_promo`); keduanya boleh ada pada baris yang sama hanya bila peran punya batas > 0 (D2 dihitung atas subtotal setelah promo). |
| D4 | Subtotal baris dan `total_neto` tidak boleh negatif. |
| D5 | Setiap diskon manual > 0 dicatat log `PENJUALAN_DISKON` (nomor, baris, nilai, peran). |
| D6 | Struk dan invoice mencetak diskon per baris ("Disc Rp 5.000") dan diskon transaksi sebagai baris terpisah sebelum total. |

## 3. Promo [M2 Fase 9]

| # | Aturan |
|---|---|
| PR1 | Promo berlaku bila `status_aktif = AKTIF` dan `tanggal_operasional` transaksi di dalam `[tanggal_mulai, tanggal_selesai]`. |
| PR2 | Kecocokan baris: `sasaran = SEMUA`; atau KATEGORI dan `barang.id_kategori` sama; atau BARANG dan `id_barang` sama. Syarat: `qty ≥ min_qty` (bila diisi) dan `total_bruto transaksi ≥ min_belanja` (bila diisi). |
| PR3 | Potongan baris: PERSEN → `bulatkanRupiah(qty × harga_satuan × persen/100)` (dibulatkan sekali), dibatasi `maks_potongan` bila diisi; NOMINAL → `bulatkanRupiah(potongan_nominal × qty)`. Potongan selalu ≤ bruto baris. |
| PR4 | Satu promo per baris: bila lebih dari satu cocok, dipilih potongan terbesar; seri → yang `tanggal_mulai` terbaru, lalu id terbesar. `id_promo` dan `diskon_promo` disimpan di baris order dan penjualan. Promo tidak berlaku untuk baris harga manual (K-087). |
| PR5 | Promo dievaluasi ulang setiap baris berubah (pratinjau API) dan sekali lagi saat checkout (tanggal dan pelaku checkout yang menentukan; baris & total order ikut diselaraskan). Kasir (`penjualan.checkout`) dapat melepas/memasang promo pada baris tertentu; dicatat `PENJUALAN_PROMO_LEPAS` (K-087). |
| PR6 | Promo tidak boleh membuat harga baris di bawah `D` untuk pelaku tanpa izin `penjualan.harga_manual` (Staf/Kasir): promo itu dilewati dan dipakai promo aman berikutnya; UI diberi tanda tanpa angka modal. Pemegang izin itu (Admin/Owner) tetap boleh (K-087, keputusan pemilik). |
| PR7 | Struk mencetak "Promo <nama>" di bawah baris; invoice, detail penjualan, dan Laporan Detail Invoice menampilkan potongan promo. Laporan Promo: ringkasan per promo (transaksi, baris, bruto, potongan, bersih, rasio) dan rincian per barang. |
| PR8 | Yang tidak ada: beli X gratis Y, kupon, poin, promo bertingkat, promo per pelanggan. |

## 4. Piutang pelanggan (Fase 5 dasar, Fase 10 limit dan umur)

| # | Aturan |
|---|---|
| PT1 | Piutang = penjualan `status_transaksi ≠ VOID` dengan `status_pembayaran ≠ LUNAS`. Nilai = `sisa_tagihan`. Hanya penjualan dengan pelanggan terdata yang boleh menjadi piutang (P6, P7). |
| PT2 | `tanggal_jatuh_tempo` wajib bila penjualan tidak lunas saat checkout (default P7). Bisa diubah oleh Kasir/Admin/Owner dengan log. |
| PT3 | Halaman Piutang: daftar per penjualan (pelanggan, nomor, tanggal, jatuh tempo, sisa, status), filter pelanggan/terlambat, total; tombol "Terima pembayaran" membuka form pembayaran PELUNASAN (P8). Ringkasan per pelanggan: total sisa, jumlah invoice, terlama. |
| PT4 | Terlambat = `tanggal_jatuh_tempo < hari ini`. Notifikasi H-3 dan terlambat (ST2). |
| PT5 | **[M2 Fase 10] Umur piutang**: kelompok menurut hari lewat jatuh tempo: belum jatuh tempo (≤ 0 hari, termasuk jatuh tempo hari ini), 1–30, 31–60, 61–90, > 90 hari (K-088). Laporan piutang menampilkan ringkasan umur dan per pelanggan. |
| PT6 | **[M2 Fase 10] Limit kredit**: bila `pelanggan.limit_kredit` terisi, saat checkout tidak lunas: `piutang_berjalan + sisa_tagihan_baru > limit_kredit` → `LIMIT_TERLAMPAUI` menyebut limit dan piutang berjalan. Pemegang `master.pelanggan.atur_kredit` (Admin/Owner) dapat melanjutkan dengan konfirmasi (`setujuLimit`, log `PENJUALAN_LIMIT_OVERRIDE`; K-088). |
| PT7 | Pelanggan dengan piutang terlambat tidak diblokir otomatis; UI menampilkan peringatan di layar order/checkout. |
| PT8 | Retur POTONG_TAGIHAN mengurangi piutang (T7); refund tidak. |

## 5. Hutang pemasok [M2 Fase 10]

| # | Aturan |
|---|---|
| HT1 | Hutang = `penerimaan_barang` PEMBELIAN TEMPO dengan `status_hutang ∈ {BELUM_LUNAS, SEBAGIAN}` (sisa = `sisa_hutang`), dan `penyelesaian_konsinyasi` dengan `status_hutang ≠ LUNAS`. |
| HT2 | Pembayaran ke pemasok (`PBP`): `nominal ≤ sisa_hutang` dokumen sumber; TUNAI wajib shift BUKA pengguna dan otomatis `kas_shift(BAYAR_PEMASOK, KELUAR)`; TRANSFER wajib `rekening` tujuan, `referensi` opsional (K-088). `status_hutang`: sisa 0 → LUNAS; sebagian dibayar → SEBAGIAN. |
| HT3 | Halaman Hutang: daftar per dokumen (pemasok, nomor, tanggal, jatuh tempo, total, dibayar, potongan retur, sisa), ringkasan per pemasok (saringan pemasok), umur hutang (kelompok seperti PT5), riwayat pembayaran, tombol bayar (K-088). |
| HT4 | Notifikasi hutang jatuh tempo H-3 dan terlambat (`hutang.lihat`). |
| HT5 | Laporan Hutang: per pemasok, per dokumen, per kelompok umur; total. |
| HT6 | Retur pemasok POTONG_HUTANG (RP4) menambah `total_retur_potong` dokumen penerimaan sumber dan menghitung ulang `status_hutang`. |
| HT7 | **[M2 Fase 9]** Laporan Riwayat Harga Beli: dari `penerimaan_barang_detail` PEMBELIAN, urut tanggal, per barang dan pemasok; perubahan dibanding pembelian sebelumnya dari pemasok yang sama; perbandingan antarpemasok (terendah, tertinggi, rata-rata tertimbang, terakhir). Izin `laporan.persediaan` + `laporan.laba` (K-087). |

## 6. Retur ke pemasok [M2 Fase 10]

| # | Aturan |
|---|---|
| RP1 | Dokumen `RTP`: pemasok, opsional `id_penerimaan` asal, alasan, penyelesaian, baris (barang, `kondisi_asal` BAIK/RUSAK, qty). Barang harus milik pemasok itu (untuk KONSINYASI) atau pernah dibeli dari pemasok itu (untuk MILIK_SENDIRI; bila tidak ada riwayat, peringatan bukan penolakan). |
| RP2 | Efek stok: per baris `catatMutasi(RETUR_PEMASOK, keluar qty_dasar, bucket kondisi_asal, hpp = hpp_rata2 saat itu)`; `subtotal = bulatkanRupiah(qty × hpp)`; `total_retur = Σ subtotal`. |
| RP3 | `kondisi_asal = BAIK` mengurangi stok tersedia; ditolak bila melanggar A6 (stok dipesan). |
| RP4 | POTONG_HUTANG: wajib `id_penerimaan` dengan `sisa_hutang ≥ total_retur`; `total_retur_potong += total_retur` (HT6). |
| RP5 | GANTI_BARANG: barang pengganti dicatat sebagai penerimaan PEMBELIAN baru dengan `harga_modal_masuk` = hpp yang diretur, syarat TUNAI, dan `pembayaran_pemasok` otomatis metode KOMPENSASI (`id_retur_pemasok` diisi) sehingga tidak ada uang bergerak dan HPP tidak terdistorsi. Barang pengganti dicatat masuk saat retur disimpan; mutasinya bukan pembelian (harga beli terakhir tetap, tidak ikut HT7) (K-088). |
| RP6 | REFUND: pemasok mengembalikan uang; TUNAI → `kas_shift(MASUK_LAIN, MASUK, keterangan "Refund RTP-…")` pada shift pengguna; TRANSFER → dicatat di `catatan` retur pemasok dengan referensi. |
| RP7 | PENGEMBALIAN_TITIPAN: hanya barang KONSINYASI; tanpa kompensasi; mengurangi stok titipan (RP2). |

## 7. Konsinyasi (Fase 3–4 penandaan, Fase 11 penyelesaian)

| # | Aturan |
|---|---|
| KS1 | Barang `kepemilikan = KONSINYASI` wajib `id_pemasok_konsinyasi` dan `harga_titip` (CHECK DB). Kepemilikan tidak bisa diubah selama `stok_fisik + stok_rusak > 0` (service). |
| KS2 | Penerimaan: hanya lewat jenis KONSINYASI dari pemasok yang sama (E3). HPP = harga titip (L7). Tidak membentuk hutang saat diterima. |
| KS3 | Penjualan: baris barang konsinyasi memakai `hpp_saat_transaksi = harga_titip` saat itu (P5). Gross profit baris = subtotal − harga_titip × qty. Harga jual tier mengikuti H3 dengan `D = harga_titip`. |
| KS4 | Nilai persediaan memisahkan MILIK_SENDIRI (aset toko) dan KONSINYASI (informasi, bukan aset), keduanya dihitung `stok × hpp_rata2`. Laporan stok rekap, kartu stok, stok minimum memuat barang konsinyasi dengan tanda "Titipan". |
| KS5 | **[M2 Fase 11] Penyelesaian** (`KSG`) per pemasok per periode: kandidat = baris `penjualan_detail` barang konsinyasi pemasok itu dengan `status_item ≠ VOID`, `id_penyelesaian_konsinyasi` null, `tanggal_operasional ≤ periode_selesai`. Per barang: `qty_terjual = Σ qty_dasar`, `qty_retur = Σ qty_retur_dasar` kondisi BAIK dari retur DISETUJUI atas baris itu, `qty_neto = qty_terjual − qty_retur`, `subtotal = bulatkanRupiah(qty_neto × harga_titip baris saat jual)`. Baris yang disertakan diberi `id_penyelesaian_konsinyasi`. `total` menjadi hutang (HT1). |
| KS6 | **[M2 Fase 11]** Retur pelanggan kondisi BAIK atas baris yang **sudah** disetor: dicatat sebagai koreksi pada penyelesaian berikutnya (qty_retur negatif pada periode berikutnya). Kondisi RUSAK tidak mengurangi setoran (barang rusak tanggung jawab toko, kecuali diklaim ke pemasok lewat RP7). |
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

Izin: `master.harga.kelola`, `master.harga.tinjau`, `penjualan.tier.ubah`, `penjualan.harga_manual`,
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
