# Keputusan Penyelesaian Konsinyasi (Fase 11) — 7 Oktober 2026

Melanjutkan penomoran dari `2026-10-07-hutang-retur-pemasok.md`. Seluruh butir adalah keputusan teknis Claude Code
sesuai kewenangan yang diberikan pemilik proyek (sesi kerja mandiri, tanpa tanya jawab). Butir bertanda
**(tinjau pemilik)** menyangkut alur bisnis dan sebaiknya dikonfirmasi pemilik.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-089 — Setoran konsinyasi (KSG), koreksi retur, dan halaman Konsinyasi

**Keputusan:**

1. **Setoran per pemasok "sampai tanggal"**: pengguna memilih pemasok dan tanggal akhir periode (≤ hari ini);
   semua baris penjualan barang titipan pemasok itu yang belum disetor sampai tanggal itu ikut (KS5), termasuk
   yang tercecer dari periode sebelumnya. `periode_mulai` dihitung otomatis: sehari setelah setoran terakhir,
   atau tanggal penjualan tertua yang ikut bila lebih awal. Tidak ada penjualan yang belum disetor → ditolak.
   *Alasan:* toko menyetor "sampai hari ini" saat sales pemasok datang; memilih awal periode hanya membuka
   peluang penjualan terlewat.
2. **Satu baris setoran per barang per harga titip saat jual (KS9).** Bila harga titip berubah di tengah periode,
   barang itu tampil dua baris. Migrasi 0006 mengganti unique `uq_ksg_detail` menjadi
   (`id_penyelesaian`, `id_barang`, `harga_titip`). *Ditolak:* rata-rata tertimbang harga titip (tidak bisa
   dicocokkan pemasok dengan nota penjualannya).
3. **Retur pelanggan yang dihitung (KS5–KS6):** hanya retur **DISETUJUI** kondisi **BAIK** tanpa barang pengganti.
   **(tinjau pemilik)** Retur **tukar barang** dianggap netral bagi pemasok (barang kembali, barang yang sama
   keluar lagi) sehingga tidak mengurangi setoran. Retur RUSAK tidak mengurangi setoran (KS6).
4. **Penanda retur (migrasi 0006):** kolom `retur_penjualan_detail.id_penyelesaian_konsinyasi` diisi saat retur
   itu diperhitungkan di sebuah setoran, sehingga tidak dihitung dua kali. Kolom ini kolom penanda yang boleh
   diisi sekali (seperti `penjualan_detail.id_penyelesaian_konsinyasi`), bukan perubahan isi transaksi.
5. **Koreksi atas baris yang sudah disetor (KS6):** dikurangkan dari penjualan baru **dengan barang dan harga titip
   yang sama** pada setoran berikutnya. Bila penjualan baru belum cukup (qty neto tidak boleh negatif, CHECK DB),
   koreksi itu **ditunda** ke setoran berikutnya dan pratinjau menampilkan jumlah koreksi yang ditunda.
   *Ditolak:* qty neto negatif / nota kredit dari pemasok (butuh dokumen baru; bisa diusulkan untuk v2).
6. **Void ditolak untuk baris yang sudah disetor** (melengkapi V1): pesan "sudah disetor ke pemasok; gunakan retur".
   *Alasan:* setoran yang sudah dibayar tidak boleh berubah diam-diam.
7. **Status awal setoran:** total > 0 → BELUM_LUNAS (masuk Hutang Pemasok tanpa jatuh tempo, umur "belum jatuh
   tempo"); total 0 → LUNAS. Pembayaran memakai dialog bayar hutang yang sama (HT2), dari halaman detail setoran
   atau Hutang Pemasok.
8. **Halaman Konsinyasi** (`/konsinyasi`, menu Persediaan, `konsinyasi.kelola`): tab *Posisi per pemasok* (barang
   titipan yang masih ada stok, nilai stok titipan baik+rusak × harga titip saat ini, terjual belum disetor
   sebelum retur, sisa hutang setoran, tanggal setoran terakhir, tombol *Buat setoran*) dan *Riwayat setoran*.
   Form setoran menampilkan pratinjau dari API sebelum disimpan. Detail setoran: rincian, pembayaran, tombol
   bayar, dan **cetak Nota Setoran Konsinyasi A4** (dengan harga titip; dokumen untuk pemasok).
9. **Laporan Konsinyasi (KS8)** di grup Keuangan (`laporan.hutang`): ikhtisar (nilai stok titipan, belum disetor,
   disetor dan dibayar dalam periode, sisa hutang), tabel posisi per pemasok, tabel setoran dalam periode.
10. Log `KONSINYASI_SELESAIKAN` (sudah direncanakan di docs/05 §16 sebagai aksi M2).

**Usulan di luar fase (dicatat, belum dikerjakan):** jadwal setoran rutin per pemasok (mis. tiap tanggal 1) dengan
pengingat; nota kredit pemasok untuk koreksi yang lama tertunda; cetak rekap penjualan titipan harian untuk pemasok.
