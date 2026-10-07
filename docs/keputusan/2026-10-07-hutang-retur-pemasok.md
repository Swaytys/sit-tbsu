# Keputusan Hutang Pemasok, Retur Pemasok, dan Stok Rusak (Fase 10) — 7 Oktober 2026

Melanjutkan penomoran dari `2026-10-04-harga-promo.md`. Seluruh butir di bawah adalah keputusan teknis Claude Code
sesuai kewenangan yang diberikan pemilik proyek (sesi kerja mandiri 5–7 Oktober 2026, tanpa tanya jawab). Butir
yang ditandai **(tinjau pemilik)** menyangkut alur bisnis dan sebaiknya dikonfirmasi pemilik sebelum dipakai di
toko; semuanya mudah diubah.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-088 — Hutang pemasok, retur ke pemasok, stok rusak, limit kredit, umur piutang/hutang

**Keputusan:**

1. **Kelompok umur (PT5, HT3) = hari lewat jatuh tempo:** `Belum jatuh tempo` (≤ 0 hari, termasuk jatuh tempo hari
   ini), `1–30`, `31–60`, `61–90`, `> 90` hari. Dokumen tanpa jatuh tempo (penyelesaian konsinyasi, Fase 11)
   masuk "belum jatuh tempo". Satu fungsi `kelompokUmur()` di `packages/shared` dipakai piutang dan hutang.
   *Alasan:* docs/06 menulis "0–30" sekaligus "belum jatuh tempo"; dokumen yang jatuh tempo hari ini belum
   terlambat (PT4 memakai `<`), jadi 0 hari masuk "belum". *Ditolak:* umur sejak tanggal transaksi (tidak
   menunjukkan keterlambatan).
2. **Halaman Hutang Pemasok** (`/hutang`, menu Persediaan, `hutang.lihat`): kartu total/terlambat/jumlah pemasok,
   bilah umur hutang, tabel per dokumen (nomor, pemasok, faktur, jatuh tempo, total, dibayar/potongan retur, sisa,
   status), saringan pemasok berisi ringkasan per pemasok (HT3), riwayat pembayaran per dokumen, dan dialog bayar
   (`hutang.kelola`). Daftar dihitung di memori dari semua dokumen terbuka (jumlahnya kecil di toko ini).
   *Alasan:* ringkasan umur dan per pemasok harus mencakup semua dokumen, bukan hanya halaman tabel.
3. **Bayar hutang (HT2):** satu PBP untuk satu dokumen; nominal ≤ sisa; TUNAI wajib shift BUKA pembayar dan tercatat
   `kas_shift BAYAR_PEMASOK`; TRANSFER wajib **rekening tujuan**, referensi opsional. *Alasan:* docs/06 menulis
   "rekening/referensi"; rekening paling berguna untuk penelusuran, nomor bukti tidak selalu ada saat dicatat.
   *Ditolak:* satu pembayaran dibagi ke beberapa dokumen (alokasi otomatis membingungkan; bisa jadi usulan v2).
4. **Notifikasi hutang (HT4):** "Hutang terlambat" dan "Hutang jatuh tempo ≤ 3 hari" untuk pemegang `hutang.lihat`,
   tautan ke halaman Hutang Pemasok.
5. **Retur ke pemasok — menu sendiri** "Persediaan › Retur ke Pemasok" (`/retur-pemasok`, izin
   `persediaan.retur_pemasok.kelola`): daftar RTP, form baru, detail, dan **cetak Nota Retur Pembelian A4** tanpa
   harga (HPP rata-rata adalah data internal; pemasok memakai harga fakturnya sendiri). Form bisa dibuka dari tab
   Stok rusak (`?barang=<id>`, terisi kondisi RUSAK dan seluruh qty rusak).
6. **(tinjau pemilik) GANTI_BARANG (RP5): barang pengganti dicatat masuk saat retur disimpan.** Satu RCV
   PEMBELIAN TUNAI LUNAS dibuat otomatis dengan harga = HPP yang diretur dan dibayar PBP metode KOMPENSASI. Mutasi
   masuknya bukan pembelian (`pembelian: false`) sehingga **harga beli terakhir tidak berubah** dan RCV ini tidak
   ikut Laporan Riwayat Harga Beli. *Alasan:* di toko, tukar barang biasanya terjadi saat sales pemasok datang
   (barang rusak diambil, pengganti diserahkan). *Ditolak:* dokumen "menunggu barang pengganti" (butuh status baru
   dan tindak lanjut; bisa ditambah bila pemilik menginginkan).
7. **REFUND (RP6):** TUNAI masuk laci shift pencatat (`kas_shift MASUK_LAIN`, wajib shift buka); TRANSFER hanya
   dicatat di catatan retur beserta referensi (tidak ada buku bank di sistem).
8. **Retur barang titipan** hanya lewat PENGEMBALIAN_TITIPAN dari pemasok penitipnya; barang milik sendiri tidak
   boleh memakai penyelesaian itu, dan sebaliknya. Barang yang belum pernah dibeli dari pemasok itu → **peringatan**
   setelah simpan (RP1), bukan penolakan.
9. **Stok rusak (SR4) sebagai tab "Stok rusak" di Stok Persediaan**, bukan menu terpisah: daftar barang dengan
   `stok_rusak > 0` (stok baik, stok rusak, nilai HPP bila berizin), tombol "Retur ke pemasok" dan "Musnahkan".
   Riwayat bucket RUSAK dilihat di Kartu stok (pilihan kondisi Rusak) dan tab Mutasi. API daftar barang mendapat
   kolom `stokRusak` dan saringan `adaRusak=true`.
10. **Pemusnahan (A5, SR3):** penyesuaian jenis MUSNAH dari bucket RUSAK, alasan wajib (form dan API), tombol
    "Musnahkan stok rusak" di tab Penyesuaian; dari tab Stok rusak, qty terisi seluruh stok rusak barang itu.
11. **Nilai persediaan (SR1):** laporan Nilai Persediaan menambah ikhtisar dan tabel "Barang rusak — informasi"
    (stok rusak × HPP), tidak dijumlahkan ke nilai persediaan.
12. **(tinjau pemilik) Limit kredit (PT6):** diperiksa saat checkout yang **tidak lunas** untuk pelanggan yang punya
    limit: piutang berjalan + sisa tagihan baru > limit → `LIMIT_TERLAMPAUI` (409) dengan rincian. Yang boleh
    melanjutkan = pemegang izin `master.pelanggan.atur_kredit` (Admin/Owner); layar kasir menampilkan dialog
    "Setujui & lanjutkan", lalu dicatat log `PENJUALAN_LIMIT_OVERRIDE`. Kasir tanpa izin itu mendapat pesan untuk
    meminta Admin/Owner atau menerima pembayaran lebih dulu. *Alasan:* izin yang mengatur limit adalah izin yang
    paling wajar untuk melampauinya. *Ditolak:* izin baru khusus (menambah daftar izin untuk satu kasus).
13. **Laporan Hutang Usaha (HT5)** di grup Keuangan (`laporan.hutang`): per pemasok, per dokumen, ringkasan umur,
    saringan pemasok dan "hanya yang lewat jatuh tempo". Laporan Piutang mendapat ringkasan umur yang sama (PT5).

**Usulan di luar fase (dicatat, belum dikerjakan):** pembayaran satu PBP untuk beberapa dokumen hutang; status
"menunggu barang pengganti" untuk GANTI_BARANG; kartu "Hutang jatuh tempo minggu ini" di dashboard Owner; tautan
langsung dari tab Stok rusak ke kartu stok kondisi rusak.
