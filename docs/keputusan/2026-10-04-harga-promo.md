# Keputusan Harga dan Promo (Fase 9) — 4 Oktober 2026

Melanjutkan penomoran dari `2026-10-04-deploy-cadangan.md`. Butir yang ditandai **(pemilik)** diputuskan
pemilik proyek lewat pertanyaan 4 Oktober 2026; butir lain keputusan teknis Claude Code sesuai kewenangan yang
diberikan.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-086 — Mesin harga jual: markup per barang, pemicu, harga otomatis, Tinjau Harga
**Keputusan:**
1. **(pemilik)** Barang baru **tidak** berharga otomatis ("ditinjau dulu"): `harga_otomatis = false` bawaan.
   Sakelar *Harga otomatis* ada di form barang dan hanya bisa diubah pemegang `master.harga.kelola` (log
   `BARANG_UBAH`). Menyalakannya langsung mengevaluasi harga barang itu (butir 4).
2. **(pemilik)** Harga tier default (Normal) **tetap wajib harga tetap** (K-047). Tinjau Harga menampilkan
   **usulan** `bulatkanHarga(D × (1 + markup tier default))`; Admin/Owner yang menerapkannya (mengganti harga
   tetap), dan boleh memilih tidak menggantinya (sakelar "Ganti juga harga Normal dengan usulan"). Harga otomatis
   tidak pernah mengubah harga tetap mana pun.
3. **Metode MARKUP per barang (H4):** isian `markupPersen` per tier (0–999,99%); tidak boleh bersamaan dengan harga
   tetap; tier default tidak boleh MARKUP. Persen markup barang dan margin hanya dikirim API ke pemegang
   `master.barang.lihat_hpp` (seperti markup tier, K-060).
4. **(pemilik) Harga otomatis — naik langsung, turun ditinjau (H7):** saat pemicu terjadi, baris IKUT_TIER/MARKUP
   barang otomatis yang hasil hitungnya **naik** langsung diterapkan di transaksi yang sama (log `HARGA_UBAH`
   "Harga otomatis … (sebab)"); yang **turun** (termasuk dasar Rp 0) tidak diterapkan dan barang ditandai perlu
   tinjau. Pada pemicu perubahan dasar, barang otomatis juga ditandai bila harga Normal di bawah usulannya (margin
   Normal di bawah target). Bila tidak ada yang perlu diputuskan, tanda dilepas.
5. **Pemicu H5** dihitung dengan membandingkan `D` sebelum dan sesudah kejadian (bukan sekadar "kolom berubah"):
   penerimaan pembelian (harga beli terakhir, atau HPP rata-rata pada mode `HPP_RATA2`), harga modal awal sebelum
   ada penerimaan, harga titip, kepemilikan. Juga: markup default tier non-default berubah (barang ber-IKUT_TIER di
   tier itu), dan dasar markup/pembulatan di Pengaturan berubah (hanya barang yang hasil hitung markupnya benar-benar
   berubah). Barang biasa → ditandai, harga tidak berubah. Mengubah markup tier default tidak menandai barang
   (harga Normal selalu tetap); usulan Normal memakai markup terbaru saat barang ditinjau. Keputusan ini dibuat
   di modul harga (`tanggapiPemicuHarga`/`tanggapiPerubahanDasar`); ledger hanya menulis harga beli terakhir (L6).
6. **Simpan manual** (form barang atau Harga Jual) menghitung ulang **semua** baris IKUT_TIER/MARKUP barang itu
   dengan `D` terkini, bukan hanya sel yang dikirim, lalu melepas tanda (K-060 #4 diperjelas). Kolom
   `dasar_markup_saat_hitung` ikut diperbarui walau harga hasil pembulatan sama.
7. **Tier diaktifkan kembali:** baris IKUT_TIER/MARKUP lama di tier itu dihitung ulang dengan `D` terkini tanpa
   tanda (sama seperti tier baru, H2), karena harganya tidak terpakai selama tier nonaktif.
8. **Tinjau Harga (H6)** = tab di halaman Harga Jual. Butuh `master.harga.tinjau` **dan** `master.barang.lihat_hpp`
   (memuat dasar, usulan, margin). Daftar: barang AKTIF bertanda (termasuk barang otomatis yang punya penurunan
   atau Normal di bawah usulan). Per tier: harga sekarang, dasar lama → baru, usulan (harga tetap tier selain
   default tidak diusulkan), margin sekarang dan usulan terhadap dasar baru. *Terapkan* per barang (semua tier
   sekaligus); `D` dihitung ulang di transaksi dan bila berbeda dari yang terlihat di layar ditolak 409 (muat
   ulang). *Abaikan* = tanda dilepas, harga tidak berubah. Log per barang: `HARGA_TINJAU_TERAPKAN`,
   `HARGA_TINJAU_ABAIKAN` (baru).
9. **Margin (H12)** = `(harga jual − D) ÷ harga jual`, dua desimal, dihitung API; tampil di Harga Jual, form
   barang, Tinjau Harga, dan ekspor Excel, hanya untuk `master.barang.lihat_hpp`.
10. **Urutan kunci baku** untuk semua penulis harga: `barang` → `persediaan` → `harga_barang`, masing-masing
    berurutan id (simpan harga, ubah barang, penerimaan, Tinjau, pemicu tier/Pengaturan), agar transaksi
    bersamaan tidak saling mengunci (deadlock).

**Alasan:** Harga Normal adalah harga eceran utama dan selalu keputusan manusia; kenaikan dasar yang otomatis
diteruskan melindungi margin tanpa menunggu Admin, sedangkan penurunan harga adalah keputusan bisnis. Membandingkan
`D` sebelum/sesudah mencegah tanda palsu (mis. penerimaan pertama dengan harga sama dengan modal awal). Menolak
penerapan bila `D` berubah mencegah harga yang tidak pernah dilihat Admin ikut diterapkan.
**Ditolak:** Normal boleh IKUT_TIER/MARKUP (harga eceran bisa berubah tanpa disadari); harga otomatis yang juga
menurunkan harga (harga bisa jatuh ke Rp 0 karena barang bonus); terapkan per tier (baris "ikut tier" yang tidak
mengikuti tier membingungkan); menghitung usulan atau margin di React (aturan 1, data sensitif).

### K-087 — Promo, diskon lintas peran, saran tier, dan laporan Fase 9
**Keputusan:**
1. **(pemilik)** Promo **tidak berlaku untuk baris harga manual** (harga hasil tawar). Promo berlaku untuk semua
   tier.
2. **(pemilik) PR6:** bila promo dengan potongan terbesar membuat harga baris di bawah modal `D` untuk pelaku tanpa
   izin `penjualan.harga_manual` (Staf/Kasir), promo itu dilewati dan dipakai **promo aman berikutnya**; baris diberi
   tanda "promo lebih besar tidak berlaku" tanpa angka modal. Pemegang `penjualan.harga_manual` (Admin/Owner) tidak
   dibatasi. Tidak ada penanda promo "cuci gudang" (belum perlu).
3. **Hitungan per baris** (satu jalur `hitungBarisJual` untuk order, pratinjau, dan checkout): harga → bruto →
   promo (PR1–PR4, `min_belanja` dibanding total bruto seluruh baris) → diskon manual atas subtotal setelah promo
   (D3: persen dan batas D2 memakai dasar `bruto − diskon_promo`) → subtotal. Diskon transaksi tetap atas Σ
   subtotal. PR3 persen dibulatkan sekali `bulatkanRupiah(qty × harga × persen ÷ 100)`; nominal ×
   qty dibulatkan; potongan selalu ≤ bruto. Seri potongan → `tanggal_mulai` terbaru → **id terbesar**.
4. **PR5:** promo dievaluasi saat order (tanggal hari itu) dan **dievaluasi ulang saat checkout** dengan tanggal dan
   pelaku checkout; hasilnya ikut menyelaraskan baris & total order dalam transaksi yang sama. Melepas/memasang
   promo per baris (`tanpaPromo`) butuh `penjualan.checkout` (Kasir ke atas) dan dicatat `PENJUALAN_PROMO_LEPAS`
   hanya saat berubah. Saat checkout, potongan promo dibatasi agar tidak melebihi `bruto − diskon manual`.
5. **Izin diuji untuk nilai yang diubah pelaku.** Harga manual, tier, diskon baris, dan diskon transaksi yang sudah
   ada di order dan tidak diubah tidak diuji ulang terhadap izin/batas pelaku berikutnya (diskon dari Admin tetap
   sah saat Kasir menyelesaikan order); nilai baru selalu diuji (D2).
6. **Pratinjau** `POST /api/order/pratinjau` (`penjualan.order.buat`): harga, promo, diskon, saran tier, dan total
   dihitung server tanpa menyimpan; layar kasir, input order cepat, dan form order memakainya (ditunda 200 ms).
   Angka lokal hanya cadangan sementara dengan label "menghitung…".
7. **Migrasi 0005:** `order_penjualan_detail` + `id_promo` (FK), `diskon_promo`, `promo_nonaktif`, CHECK harga
   memuat `diskon_promo`; indeks parsial `penjualan_detail(id_promo)`.
8. **Master promo:** kode `PRM-nnnnn` dari penghitung kode master (N5); tidak dihapus, dinonaktifkan. **Aturan
   dikunci setelah promo terpakai di penjualan** (tanggal mulai, jenis & nilai potongan, batas, sasaran, syarat);
   nama, keterangan, tanggal selesai, dan status tetap bisa diubah. Log `PROMO_BUAT/UBAH/NONAKTIF/AKTIFKAN`.
9. **H8 saran tier:** tier aktif lain yang `saran_min_qty`-nya terpenuhi dan harganya lebih murah dari harga baris;
   bila lebih dari satu, yang **termurah**. Ditampilkan untuk semua peran (Staf sebagai info), tidak memaksa.
10. **Laporan:** *Promo* (grup Penjualan, `laporan.penjualan`) — ikhtisar, ringkasan per promo (promo yang masanya
    beririsan ditampilkan walau belum terpakai), rincian per barang; *Riwayat Harga Beli* (grup Persediaan,
    `laporan.persediaan` + `laporan.laba` karena isinya harga modal) — riwayat per penerimaan pembelian dengan
    perubahan dibanding pembelian sebelumnya dari pemasok yang sama (termasuk sebelum periode), dan perbandingan
    antarpemasok. Detail Invoice mendapat kolom Promo; struk mencetak "Promo <nama>" di bawah baris (PR7).

**Alasan:** Satu jalur hitung mencegah layar, struk, dan laporan berbeda angka; evaluasi ulang saat checkout
memenuhi PR5 tanpa menyimpan promo yang sudah berakhir; mengunci aturan promo terpakai menjaga cetak ulang struk
dan Laporan Promo tetap sesuai kejadian.
**Ditolak:** menghitung promo di React (aturan 1, butuh `D` yang sensitif); promo untuk harga manual (harga tawar
sudah final); membatalkan promo sepenuhnya saat promo terbesar di bawah modal (pembeli kehilangan promo aman);
menguji ulang semua diskon terhadap kasir (order dari Admin tidak bisa diselesaikan Kasir).
