# 03 — Skema Database v3

DDL lengkap: `03-skema-database-v3.sql` (v3.1, 41 tabel). Dokumen ini menjelaskan **mengapa** tiap tabel ada, kolom
yang penting, aturan yang ditegakkan database, dan aturan yang harus ditegakkan aplikasi. DDL sudah dijalankan dan
diuji di PostgreSQL 16 (2026-09-19): semua CHECK, UNIQUE, generated column, dan FK berperilaku sesuai rancangan.

## 1. Prinsip

1. **Ledger adalah sumber kebenaran stok.** `mutasi_persediaan` mencatat setiap pergerakan. `persediaan` hanya cache
   posisi terkini. Kalau keduanya beda, ledger yang benar dan cache dihitung ulang.
2. **Transaksi append-only.** Koreksi lewat dokumen baru (void, retur, penyesuaian), bukan mengubah dokumen lama.
   Yang boleh berubah: kolom status dan kolom cache (§4).
3. **Snapshot saat transaksi.** Harga jual, HPP, tier, faktor satuan disalin ke baris transaksi. Perubahan master
   sesudahnya tidak mengubah riwayat.
4. **Uang integer, qty desimal.** `bigint` rupiah; `numeric(14,3)` kuantitas; `numeric(6,2)` persen.
5. **Database menegakkan yang bisa ditegakkan** (CHECK, UNIQUE, FK, generated column). Aturan yang butuh membaca
   tabel lain (stok cukup, transisi status, batas diskon) ditegakkan service di dalam transaksi DB.
6. **Enum = CHECK.** Nilai status ditulis di `packages/shared/src/enums.ts` dan harus sama dengan CHECK di DDL.
   Menambah nilai = migrasi baru (ubah CHECK) + ubah enum.

## 2. Data store DFD Level 0 → tabel

| Data store DFD | Tabel |
|---|---|
| 1 Data Pengguna | `pengguna`, `sesi_login` |
| 2 Data Barang | `barang`, `kategori`, `satuan`, `jenis_atribut`, `barang_atribut`, `barang_satuan_jual`, `tingkat_harga`, `harga_barang` |
| 3 Data Pelanggan | `pelanggan` |
| 4 Data Pemasok | `pemasok` |
| 5 Data Order Penjualan | `order_penjualan`, `order_penjualan_detail` |
| 6 Data Penjualan Langsung | `penjualan` (jenis LANGSUNG), `penjualan_detail` |
| 7 Data Penjualan Pengantaran | `penjualan` (jenis PENGANTARAN), `penjualan_detail` |
| 8 Data Pembayaran Penjualan | `pembayaran_penjualan` |
| 9 Data Surat Jalan | `surat_jalan`, `surat_jalan_detail` |
| 10 Data Retur Penjualan | `retur_penjualan`, `retur_penjualan_detail` |
| 11 Data Void Transaksi | `void_transaksi`, `void_transaksi_detail` |
| 12 Data Penerimaan Barang | `penerimaan_barang`, `penerimaan_barang_detail` |
| 13 Data Persediaan | `persediaan`, `mutasi_persediaan`, `penyesuaian_stok`, `penyesuaian_stok_detail` |
| 14 Data Clerical Check | `clerical_check`, `shift_kasir`, `kas_shift` |
| (konfigurasi) | `konfigurasi`, `penghitung_nomor`, `log_aktivitas` |
| (M2, di luar DFD) | `promo`, `retur_pemasok`(+detail), `pembayaran_pemasok`, `penyelesaian_konsinyasi`(+detail) |

## 3. Tabel

Tanda: **[APPEND]** append-only · **[M2]** dipakai UI mulai M2 (tabel sudah ada sejak migrasi 0000).

### 3.1 Sistem

**`konfigurasi`** — key-value setelan toko dan sistem. Dibaca struk/invoice/laporan dan aturan bisnis. Daftar kunci di §6.

**`penghitung_nomor`** — `(prefix, tanggal_kode YYMMDD) → nilai_terakhir`. Service `penomoran.ts` melakukan
`INSERT ... ON CONFLICT DO UPDATE SET nilai_terakhir = nilai_terakhir + 1 RETURNING` di transaksi yang sama dengan
dokumennya. Tidak ada nomor ganda; nomor bisa berlubang bila transaksi dibatalkan (diterima).

**`pengguna`** — akun. `peran` menentukan izin lewat `roles.ts`. Kolom keamanan: `wajib_ganti_password`,
`gagal_login_berturut`, `terkunci_sampai`. `kode` = `USR-00001`.

**`sesi_login`** [APPEND] — token disimpan sebagai `sha256` (kolom `token_hash`); cookie berisi token mentah.
`kadaluarsa_absolut` dan `terakhir_aktif` untuk batas absolut dan idle. Logout = isi `dicabut_pada`.

**`log_aktivitas`** [APPEND] — jejak audit. `data_lama`/`data_baru` jsonb untuk perubahan master; `nomor_dokumen`
untuk transaksi. `id_pengguna` null hanya untuk percobaan login dengan username tak dikenal dan aksi otomatis
sistem (job order basi/kunci kadaluarsa, K-070; cadangan terjadwal, K-084).

**`cadangan`** (v3.4) — riwayat cadangan data dan uji pulih (K-084): `jenis` CADANGAN/UJI_PULIH, `status`
BERJALAN/BERHASIL/GAGAL, `pemicu` JADWAL/MANUAL/SEBELUM_PEMBARUAN, `id_pengguna` (null bila terjadwal),
`waktu_mulai`/`waktu_selesai`, `ukuran_dump`, `snapshot_lokal`/`status_lokal`, `snapshot_cloud`/`status_cloud`
(BERHASIL/GAGAL/NONAKTIF), `pesan`. Baris dibuat saat proses mulai; kolom hasil diisi oleh proses yang sama saat
selesai (proses yang terhenti > 3 jam ditandai GAGAL). Isi cadangan sendiri ada di repositori restic, bukan di
database.

### 3.2 Master

**`kategori`** — pengganti teks bebas `KATEGORI_BARANG`.

**`merk`** — (v3.2, migrasi 0001) nama merk unik (sistem juga menolak nama sama beda huruf besar/kecil),
`keterangan`, `status_aktif`. Barang merujuk lewat `barang.id_merk` (nullable = tanpa merk); kolom teks
`barang.merk` lama dipindah ke tabel ini lalu dihapus (migrasi 0002). K-063.

**`satuan`** — `jenis_dimensi` + `faktor_ke_basis`. Konversi hanya antar-satuan berdimensi sama; untuk dimensi fisik
(PANJANG, LUAS, VOLUME, BERAT, DAYA) tepat satu satuan basis (index parsial). Satuan hitung (`JUMLAH`: sak, batang,
buah, roll, dus) tidak saling dikonversi lewat tabel ini; konversi antar-satuan hitung bersifat per barang
(`barang_satuan_jual`).

**`jenis_atribut`** — daftar atribut deskriptif (Panjang, Lebar, Tebal, Diameter, Berat, Volume, Daya, Warna, Bentuk,
Tekstur, Fungsi, …). `tipe_nilai` ANGKA/TEKS; ANGKA berdimensi mewajibkan `jenis_dimensi` sehingga satuan yang
dipakai barang diverifikasi dimensinya (aturan service).

**`barang`** — master utama. Kolom penting: `id_satuan_dasar` (satuan stok), `stok_minimum`, `harga_modal_awal`
(dasar HPP dan markup sebelum ada penerimaan; saat barang dibuat, service membuat baris `persediaan` dengan
`hpp_rata2 = harga_beli_terakhir = harga_modal_awal`), `kepemilikan` MILIK_SENDIRI/KONSINYASI dengan
`id_pemasok_konsinyasi` + `harga_titip` wajib untuk konsinyasi (CHECK), `harga_otomatis` dan `perlu_tinjau_harga`
(M2), `barcode` unik opsional. Aturan service: kepemilikan tidak boleh diubah selama `stok_fisik + stok_rusak > 0`.

**`barang_atribut`** — satu baris per (barang, jenis atribut); tepat satu dari `nilai_angka`/`nilai_teks` terisi
(CHECK `num_nonnulls = 1`). `id_satuan` wajib bila jenis atribut berdimensi (service).

**`barang_satuan_jual`** [M2] — satuan alternatif per barang dengan `faktor_ke_dasar` (roll = 50 m → 50).
Boleh punya barcode sendiri. M1 tidak membuat baris di sini; semua transaksi memakai satuan dasar (`faktor = 1`).

**`tingkat_harga`** — master tier. Tepat satu `is_default` (index parsial). `markup_default_persen` dipakai barang
bermetode IKUT_TIER; `saran_min_qty` untuk saran tier di UI (M2).

**`harga_barang`** — harga jual berlaku per (barang, tier, satuan jual|null). `metode`: `IKUT_TIER` (markup default
tier), `MARKUP` (markup sendiri), `TETAP` (harga tetap). `harga_jual` selalu terisi (K-010: harga disimpan).
`dasar_markup_saat_hitung` menyimpan nilai dasar saat `harga_jual` dihitung, sehingga Tinjau Harga bisa menunjukkan
"dasar berubah dari X ke Y". Service membuat satu baris untuk setiap tier aktif saat barang dibuat (Fase 3: tier
Normal wajib diisi TETAP; tier lain kosong → IKUT_TIER dihitung dari `harga_modal_awal`).

**`pelanggan`** — + `id_tingkat_harga` (tier default), `term_hari` (jatuh tempo piutang), `limit_kredit` (nullable;
ditegakkan M2). `kode` = `PLG-00001`.

**`pemasok`** — sama dengan FINAL2 + `kode` = `PMS-00001`.

**`promo`** [M2] — satu baris satu promo; `sasaran` SEMUA/KATEGORI/BARANG dengan CHECK konsistensi; tepat satu jenis
potongan.

### 3.3 Persediaan

**`persediaan`** — satu baris per barang, dibuat saat barang dibuat. `stok_fisik` (bucket BAIK), `stok_dipesan`,
`stok_tersedia` (generated = fisik − dipesan), `stok_rusak` (bucket RUSAK, M2), `hpp_rata2`, `harga_beli_terakhir`,
`tanggal_beli_terakhir`. CHECK: fisik ≥ 0, 0 ≤ dipesan ≤ fisik, rusak ≥ 0. Konsekuensi CHECK dipesan ≤ fisik:
penyesuaian yang menurunkan fisik di bawah dipesan ditolak; pengguna harus membatalkan/checkout order penahan dulu
(UI menunjukkan order mana).

**`mutasi_persediaan`** [APPEND] — ledger. Satu baris = satu pergerakan satu bucket. `jenis_mutasi` (sebab),
`kondisi` (bucket), `qty_masuk`/`qty_keluar` (arah dipaksa CHECK sesuai sebab), `saldo_setelah` (saldo bucket itu
sesudah mutasi), `hpp_satuan` (nilai per satuan dasar yang bergerak), `hpp_setelah` (hpp_rata2 barang setelah
mutasi; memungkinkan laporan nilai persediaan per tanggal apa pun). Tepat satu FK sumber terisi dan sesuai jenis
(CHECK). Ditulis hanya oleh `ledger.ts` dengan `FOR UPDATE` pada `persediaan`.

Jenis mutasi dan arah:

| Jenis | Arah | Bucket | Sumber |
|---|---|---|---|
| SALDO_AWAL | masuk | BAIK | penyesuaian_stok_detail (jenis SALDO_AWAL) |
| PENERIMAAN | masuk | BAIK | penerimaan_barang_detail |
| PENJUALAN | keluar | BAIK | penjualan_detail |
| RETUR_JUAL | masuk | BAIK (kondisi BAIK) / RUSAK (kondisi RUSAK/CACAT, M2) | retur_penjualan_detail |
| TUKAR_RETUR | keluar | BAIK | retur_penjualan_detail (barang pengganti) |
| VOID | masuk | BAIK | void_transaksi_detail |
| PENYESUAIAN | masuk/keluar | BAIK | penyesuaian_stok_detail (OPNAME, KOREKSI) |
| PINDAH_KONDISI | keluar BAIK + masuk RUSAK (2 baris) | keduanya | penyesuaian_stok_detail (jenis RUSAK) |
| RETUR_PEMASOK | keluar | BAIK atau RUSAK | retur_pemasok_detail |
| MUSNAH | keluar | RUSAK | penyesuaian_stok_detail (jenis MUSNAH) |

**`penerimaan_barang`** [APPEND] + **`penerimaan_barang_detail`** [APPEND] — `jenis` PEMBELIAN/KONSINYASI; `syarat_bayar`
TUNAI/TEMPO hanya untuk PEMBELIAN; TEMPO wajib `tanggal_jatuh_tempo` (CHECK). Hutang: `total_faktur`, `total_dibayar`
(cache), `total_retur_potong` (cache, retur pemasok POTONG_HUTANG, M2), `sisa_hutang` (generated = faktur − dibayar −
retur potong), `status_hutang`. KONSINYASI: `total_faktur = 0`, `status_hutang = TIDAK_ADA`
(kewajiban muncul saat laku, lewat `penyelesaian_konsinyasi`). Detail menyimpan qty dalam satuan input dan
`qty_dasar`/`harga_modal_dasar` untuk HPP.

**`penyesuaian_stok`** + **`penyesuaian_stok_detail`** — dokumen `ADJ`. `jenis`: SALDO_AWAL (import/awal go-live,
`hpp_satuan` diinput), OPNAME (lembar hitung: `qty_sistem` vs `qty_fisik`, selisih otomatis), KOREKSI (selisih
langsung), RUSAK (pindah BAIK → RUSAK), MUSNAH (hapus dari RUSAK). `status` DRAFT → SELESAI (mutasi ditulis saat
SELESAI) atau BATAL. Detail boleh diubah selama DRAFT. (v3.3) Baris OPNAME yang sengaja tidak dihitung ditandai
`dikecualikan` dengan `alasan_kecuali`, `id_pengguna_kecuali`, `waktu_kecuali` (CHECK: ketiganya wajib bila
dikecualikan); baris lembar opname tidak dihapus (K-069).

### 3.4 Penjualan

**`order_penjualan`** + **`order_penjualan_detail`** — `status` DRAFT (belum menahan stok) → MENUNGGU (menahan;
`waktu_masuk_antrean` diisi; dasar deteksi basi) → DIPROSES (dikunci `id_kasir_proses`) → SELESAI (`id_penjualan`
terisi) | BATAL (`alasan_batal`). PENGANTARAN wajib pelanggan dan alamat (CHECK). Detail menyimpan tier, harga,
diskon, dan `qty_dasar` yang ditahan. Detail boleh diubah selama DRAFT/MENUNGGU (service menyesuaikan
`stok_dipesan`). v3.5: detail juga menyimpan promo baris (`id_promo`, `diskon_promo`) dan `promo_nonaktif` (promo
dilepas kasir); promo dievaluasi ulang saat checkout (K-087).

**`penjualan`** [APPEND] + **`penjualan_detail`** [APPEND] — satu tabel untuk LANGSUNG (nomor `STR`,
`status_pengambilan` wajib) dan PENGANTARAN (nomor `INV`, `status_pengiriman` wajib, pelanggan dan alamat wajib) —
CHECK `chk_penjualan_langsung`. Uang: `total_bruto`, `total_diskon` (semua diskon), `diskon_transaksi`, `ongkir`,
`total_neto`, dan empat cache: `total_void` (nilai barang yang di-void), `total_retur` (nilai barang dikembalikan
lewat retur REFUND/POTONG_TAGIHAN), `total_dibayar`, `total_refund` (uang yang dikembalikan ke pembeli lewat retur REFUND
maupun void). `sisa_tagihan` (generated) = neto − void − retur − dibayar + refund; tagihan efektif = neto − void − retur,
dibayar bersih = dibayar − refund. CHECK: void + retur ≤ neto; refund ≤ dibayar. `id_shift` = shift kasir saat checkout (dipakai aturan void).
`bayar_saat_terima` menggantikan "COD" sebagai metode. `tanggal_jatuh_tempo` untuk piutang. Detail: snapshot
`harga_satuan`, `id_tingkat_harga` (null bila `harga_manual`), `hpp_saat_transaksi` (per satuan dasar; konsinyasi
= harga titip), `qty_retur_dasar` (cache), `status_item`, `id_penyelesaian_konsinyasi` (terisi saat disetor, M2).

**`surat_jalan`** + **`surat_jalan_detail`** — banyak surat jalan per invoice (K-024). `status` DIPROSES → DIMUAT →
DIKIRIM → SELESAI, atau BATAL (hanya sebelum DIKIRIM), dengan waktu tiap status. Detail: `qty_kirim` per baris
invoice; service menjaga Σ qty_kirim (SJ tidak batal) ≤ qty baris − qty void − qty retur.

**`pembayaran_penjualan`** [APPEND] — `jenis` PENUH/DP/PELUNASAN; `metode` TUNAI/TRANSFER/EDC; TUNAI wajib `id_shift`
(CHECK); `uang_diterima` dan `kembalian` untuk tunai; `rekening`, `referensi` untuk transfer/EDC. Nomor `BYR`.
Service menolak `nominal > sisa_tagihan`.

### 3.5 Retur, void

**`retur_penjualan`** + **`retur_penjualan_detail`** [APPEND] — `status` MENUNGGU/DISETUJUI/DITOLAK, `id_pengaju`,
`id_penyetuju`, `waktu_persetujuan`. `penyelesaian` REFUND (wajib `metode_refund`; tunai memakai `id_shift`),
TUKAR_BARANG (detail: `id_barang_pengganti` + `qty_pengganti_dasar`, keduanya terisi atau kosong), POTONG_TAGIHAN.
Detail: `harga_satuan_efektif` = subtotal baris ÷ qty saat retur; `nominal_retur`; `kondisi` BAIK/RUSAK/CACAT.
Efek stok dan kas hanya saat DISETUJUI (docs/05).

**`void_transaksi`** + **`void_transaksi_detail`** [APPEND] — `lingkup` TRANSAKSI/ITEM; untuk TRANSAKSI, service tetap
membuat satu baris detail per item sehingga ledger selalu merujuk detail. `nominal_void` (nilai barang),
`nominal_refund` (uang yang dikembalikan = min(nominal_void, total_dibayar) — service).

### 3.6 Pemasok (M2)

**`retur_pemasok`** + detail — dokumen `RTP`; `penyelesaian` POTONG_HUTANG / GANTI_BARANG / REFUND /
PENGEMBALIAN_TITIPAN (barang konsinyasi tidak laku, tanpa kompensasi); detail menyebut `kondisi_asal` (bucket yang
dikurangi).

**`penyelesaian_konsinyasi`** + detail — dokumen `KSG` per pemasok per periode: `qty_terjual`, `qty_retur` (retur
pelanggan kondisi BAIK atas baris yang sama), `qty_neto`, `harga_titip`, `subtotal`. Header punya `total`,
`total_dibayar`, `sisa_hutang` (generated), `status_hutang`. Baris `penjualan_detail` yang disertakan diberi
`id_penyelesaian_konsinyasi` agar tidak disetor dua kali.

**`pembayaran_pemasok`** [APPEND] — nomor `PBP`; tepat satu sumber: `id_penerimaan` atau
`id_penyelesaian_konsinyasi` (CHECK). `metode` TUNAI/TRANSFER, atau KOMPENSASI (tanpa uang: barang pengganti dari
retur pemasok GANTI_BARANG; wajib `id_retur_pemasok`). Untuk penerimaan PEMBELIAN TUNAI, service membuat satu baris pembayaran
otomatis saat penerimaan disimpan (sehingga `sisa_hutang = 0`).

### 3.7 Kas

**`shift_kasir`** — `nomor SHF`, `id_kasir`, `tanggal_operasional`, `modal_awal`, `waktu_buka/tutup`, `status`
BUKA/TUTUP. Satu shift BUKA per kasir (index parsial). Membuka kembali shift yang sudah tutup (koreksi) hanya
Admin/Owner dengan `dibuka_kembali_oleh` + alasan.

**`kas_shift`** [APPEND] — kas masuk/keluar **non-penjualan** per shift: KASBON, SETOR_OWNER, TARIK_OWNER,
REFUND_RETUR, REFUND_VOID, BAYAR_PEMASOK, MASUK_LAIN, KELUAR_LAIN; maksimal satu referensi (retur/void/pembayaran
pemasok). Refund via transfer tetap dicatat di sini (arah KELUAR, keterangan) tetapi tidak dihitung dalam saldo
tunai clerical — service membedakan lewat metode di dokumen sumbernya.

**`clerical_check`** [APPEND] — satu per shift (`id_shift` unik). `saldo_sistem` = modal + tunai penjualan + kas masuk
lain − kas keluar tunai; `uang_fisik` diinput sebelum saldo sistem ditampilkan; `selisih` generated; selisih ≠ 0
wajib `keterangan` (CHECK).

## 4. Kolom cache dan siapa yang menyinkronkan

Semua sinkronisasi terjadi **di transaksi DB yang sama** dengan penulisan sumbernya (CLAUDE.md aturan 15).

| Kolom cache | Sumber kebenaran | Disinkronkan oleh |
|---|---|---|
| `persediaan.stok_fisik`, `stok_rusak`, `hpp_rata2`, `harga_beli_terakhir`, `terakhir_mutasi` | `mutasi_persediaan` | `ledger.catatMutasi()` |
| `persediaan.stok_dipesan` | `order_penjualan_detail.qty_dasar` untuk order MENUNGGU/DIPROSES | service order (kirim ke antrean, ubah detail, batal, checkout) |
| `order_penjualan.subtotal`, `total` | detail | service order |
| `penjualan.total_dibayar`, `status_pembayaran` | `pembayaran_penjualan` | service pembayaran |
| `penjualan.total_retur`, `total_refund` | `retur_penjualan` DISETUJUI (REFUND, POTONG_TAGIHAN) | service retur |
| `penjualan.total_void`, `total_refund` | `void_transaksi` DISETUJUI | service void |
| `penjualan.status_transaksi`, `penjualan_detail.status_item` | `void_transaksi` DISETUJUI, retur | service void / retur |
| `penjualan.status_pengiriman` | `surat_jalan` + detail | service surat jalan |
| `penjualan_detail.qty_retur_dasar` | `retur_penjualan_detail` DISETUJUI | service retur |
| `penerimaan_barang.total_faktur` | detail | service penerimaan (sekali, saat simpan) |
| `penerimaan_barang.total_dibayar`, `total_retur_potong`, `status_hutang` | `pembayaran_pemasok`, `retur_pemasok` POTONG_HUTANG | service hutang |
| `penyelesaian_konsinyasi.total_dibayar`, `status_hutang` | `pembayaran_pemasok` | service hutang |
| `retur_penjualan.total_retur`, `void_transaksi.nominal_void` | detail | service (sekali, saat simpan) |

Tes wajib di Fase 4–6: fungsi `hitungUlangCache(idBarang)` / `hitungUlangCachePenjualan(id)` yang menghitung dari
sumber dan dibandingkan dengan cache setelah setiap skenario.

## 5. Enum (harus identik dengan `packages/shared/src/enums.ts`)

| Enum | Nilai |
|---|---|
| peran | STAF_PENJUALAN, KASIR, ADMIN, OWNER |
| status_aktif | AKTIF, NONAKTIF |
| jenis_cadangan | CADANGAN, UJI_PULIH |
| status_cadangan | BERJALAN, BERHASIL, GAGAL |
| pemicu_cadangan | JADWAL, MANUAL, SEBELUM_PEMBARUAN |
| status_tujuan_cadangan | BERHASIL, GAGAL, NONAKTIF |
| jenis_dimensi | PANJANG, LUAS, VOLUME, BERAT, DAYA, JUMLAH, LAINNYA |
| tipe_nilai (atribut) | ANGKA, TEKS |
| kepemilikan | MILIK_SENDIRI, KONSINYASI |
| metode_harga | IKUT_TIER, MARKUP, TETAP |
| jenis_potongan | PERSEN, NOMINAL |
| sasaran_promo | SEMUA, KATEGORI, BARANG |
| jenis_penerimaan | PEMBELIAN, KONSINYASI |
| syarat_bayar | TUNAI, TEMPO |
| status_hutang | TIDAK_ADA, BELUM_LUNAS, SEBAGIAN, LUNAS |
| jenis_penyesuaian | SALDO_AWAL, OPNAME, KOREKSI, RUSAK, MUSNAH |
| status_penyesuaian | DRAFT, SELESAI, BATAL |
| kondisi_stok (bucket) | BAIK, RUSAK |
| kondisi_retur | BAIK, RUSAK, CACAT |
| jenis_penjualan | LANGSUNG, PENGANTARAN |
| prioritas_order | NORMAL, TINGGI |
| status_order | DRAFT, MENUNGGU, DIPROSES, SELESAI, BATAL |
| status_pembayaran | BELUM_BAYAR, DP, LUNAS |
| status_transaksi | SELESAI, VOID_SEBAGIAN, VOID |
| status_pengambilan | DIAMBIL, BELUM_DIAMBIL |
| status_pengiriman (invoice) | BELUM, SEBAGIAN, SELESAI |
| status_surat_jalan | DIPROSES, DIMUAT, DIKIRIM, SELESAI, BATAL |
| jenis_pembayaran | PENUH, DP, PELUNASAN |
| metode_pembayaran | TUNAI, TRANSFER, EDC |
| status_persetujuan (retur, void) | MENUNGGU, DISETUJUI, DITOLAK |
| penyelesaian_retur | REFUND, TUKAR_BARANG, POTONG_TAGIHAN |
| metode_refund | TUNAI, TRANSFER |
| lingkup_void | TRANSAKSI, ITEM |
| status_item | NORMAL, RETUR_SEBAGIAN, RETUR, VOID |
| penyelesaian_retur_pemasok | POTONG_HUTANG, GANTI_BARANG, REFUND, PENGEMBALIAN_TITIPAN |
| metode_pembayaran_pemasok | TUNAI, TRANSFER, KOMPENSASI |
| status_shift | BUKA, TUTUP |
| jenis_kas_shift | KASBON, SETOR_OWNER, TARIK_OWNER, REFUND_RETUR, REFUND_VOID, BAYAR_PEMASOK, MASUK_LAIN, KELUAR_LAIN |
| arah_kas | MASUK, KELUAR |
| jenis_mutasi | SALDO_AWAL, PENERIMAAN, PENJUALAN, RETUR_JUAL, TUKAR_RETUR, VOID, PENYESUAIAN, PINDAH_KONDISI, RETUR_PEMASOK, MUSNAH |
| status_stok (dihitung, tidak disimpan) | HABIS, KRITIS, PERLU_RESTOCK, AMAN |
| tipe_konfigurasi | TEKS, ANGKA, BOOL, JSON |

## 6. Seed (`pnpm db:seed`, idempoten)

**`konfigurasi`** (kode → nilai default):

| Kode | Default | Keterangan |
|---|---|---|
| nama_toko | BonsaiUrip | Nama tampil aplikasi dan kop dokumen (K-044) |
| nama_badan_usaha | UD. Sumber Urip | Baris kedua kop |
| alamat_toko | Jl. Peterongan No. 104, Peterongan, Jombang 61483 | |
| telp_toko | (0321) 862620 | |
| email_toko | (kosong) | |
| footer_struk | Terima kasih atas kepercayaan Anda. | |
| lebar_struk_mm | 80 | 58 atau 80 |
| struk_tampilkan_nama | true | kop struk memakai nama toko (K-065) |
| struk_tampilkan_logo | false | kop struk memakai logo toko (K-065) |
| baris_per_halaman | 25 | 10, 25, 50, 100 (K-065) |
| logo_toko | (tidak di-seed) | nama berkas logo di `storage/toko`; kosong = tanpa logo (K-065) |
| prefix_ORD / STR / INV / SJ / BYR / RTR / VD / RCV / ADJ / RTP / KSG / PBP / SHF / CLC | sesuai nama | K-022, K-045 |
| digit_nomor | 3 | melebar otomatis bila > 999/hari |
| ambang_restock_persen | 20 | K-023 |
| stok_minimum_default | 5 | untuk barang baru |
| batas_umur_order_jam | 24 | K-007 |
| auto_batal_order_basi | false | K-007 |
| dasar_markup | HARGA_BELI_TERAKHIR | atau HPP_RATA2 (K-009) |
| pembulatan_harga | 100 | kelipatan Rp, ke atas (K-010) |
| batas_diskon_persen_STAF_PENJUALAN / KASIR / ADMIN / OWNER | 0 / 0 / 100 / 100 | K-012 |
| term_hari_default | 0 | pelanggan baru |
| login_maks_gagal | 5 | docs/04 §7 |
| login_kunci_menit | 15 | |
| password_min | 8 | |
| checkout_wajib_shift | true | pembayaran TUNAI wajib shift terbuka |
| rekening_transfer_default | (kosong) | rekening bawaan saat kasir memilih transfer (K-073) |
| rekening_edc_default | (kosong) | mesin EDC bawaan saat kasir memilih EDC (K-073) |

**`satuan`** awal: m (basis PANJANG), cm 0.01, mm 0.001, dm 0.1; m² (basis LUAS); m³ (basis VOLUME), L 0.001;
kg (basis BERAT), g 0.001; W (basis DAYA); JUMLAH: buah, sak, batang, roll, dus, lembar, kaleng, pail, pasang,
set, kotak (masing-masing basis, faktor 1).

**`jenis_atribut`** awal: PANJANG, LEBAR, TINGGI, TEBAL, DIAMETER (PANJANG); LUAS (LUAS); VOLUME (VOLUME);
BERAT (BERAT); DAYA (DAYA); WARNA, BENTUK, TEKSTUR, FUNGSI, UKURAN_TEKS (TEKS).

**`tingkat_harga`**: NORMAL (default, markup 25), GROSIR (markup 20, saran_min_qty null), DISTRIBUTOR (markup 15).
Angka markup contoh; Admin mengubahnya.

**`kategori`** awal: Semen, Agregat, Bata & Blok, Besi & Baja, Cat & Pelapis, Keramik, Pipa & Sanitasi, Atap, Kayu,
Alat Tukang, Kelistrikan, Kamar Mandi, Aksesoris (dari rancangan laporan dan observasi).

**`pengguna`**: satu Owner (`owner`, password dari `.env`, `wajib_ganti_password = true`). Akun demo per peran hanya
bila `NODE_ENV=development`.

## 7. Perubahan vs skema FINAL2 (Laporan KP)

| Perubahan | Alasan |
|---|---|
| Oracle → PostgreSQL; nama huruf kecil; `NUMBER GENERATED … IDENTITY` → `bigint generated … identity`; `VARCHAR2` → `varchar`; `SYSTIMESTAMP` → `now()` | K-003, K-034 |
| Uang `NUMBER(19,2)` → `bigint`; qty `NUMBER(10)` → `numeric(14,3)` | K-013 |
| `BARANG.KATEGORI_BARANG` teks → `kategori` tabel; `SATUAN` teks → `satuan` tabel (+ dimensi, konversi) | K-036, K-014 |
| Kolom atribut tetap (UKURAN … WATT) → `jenis_atribut` + `barang_atribut` | K-014 |
| `HARGA_RETAIL/GROSIR_BIASA/GROSIR_DISTRIBUTOR` → `tingkat_harga` + `harga_barang` | K-011 |
| `HARGA_MODAL_DEFAULT` → `harga_modal_awal` (hanya untuk inisialisasi) + `persediaan.hpp_rata2`, `harga_beli_terakhir` | K-008, K-009 |
| + `barang.kepemilikan`, `id_pemasok_konsinyasi`, `harga_titip`, `barcode`, `harga_otomatis`, `perlu_tinjau_harga` | K-029, K-036, K-010 |
| + `barang_satuan_jual`, `promo` | K-014, K-012 |
| + `pelanggan.kode`, `id_tingkat_harga`, `term_hari`, `limit_kredit`; + `pemasok.kode`, `pengguna.kode` | K-011, K-027, K-034 |
| + `pengguna.wajib_ganti_password`, `gagal_login_berturut`, `terkunci_sampai`, `login_terakhir`; + `sesi_login`, `log_aktivitas`, `penghitung_nomor` | docs/04 §7, K-037, K-022 |
| `PERSEDIAAN.STOK_SAAT_INI` → `stok_fisik` + `stok_dipesan` + `stok_tersedia` (generated) + `stok_rusak` + `hpp_rata2` + `harga_beli_terakhir` | K-006, K-030 |
| `MUTASI_PERSEDIAAN`: + `kondisi`, `hpp_satuan`, `hpp_setelah`, `tanggal_operasional`, `id_pengguna`; jenis diperluas; + FK ke penyesuaian, void detail, retur pemasok detail | K-008, K-030 |
| + `penyesuaian_stok` (+detail) menggantikan "PENYESUAIAN dengan semua FK null" | audit: setiap penyesuaian bernomor, beralasan, dua tahap |
| `PENERIMAAN_BARANG`: + `jenis`, `syarat_bayar`, `tanggal_jatuh_tempo`, `no_faktur_pemasok`, `no_surat_jalan_pemasok`, hutang cache; detail + satuan jual/faktor/harga dasar | K-028, K-029; mockup |
| `ORDER_PENJUALAN`: status DRAFT/MENUNGGU/DIPROSES/SELESAI/BATAL (dulu DRAFT/MENUNGGU_VERIFIKASI/CHECKOUT/BATAL); + prioritas, alamat/catatan kirim, ongkir, diskon, total, `id_kasir_proses`, `waktu_masuk_antrean`, `id_penjualan`, `alasan_batal` | K-006, K-007; mockup antrean |
| `PENJUALAN`: `METODE_BAYAR_UTAMA` dihapus (metode ada di pembayaran); `COD` → `bayar_saat_terima`; + `ongkir`, `diskon_transaksi`, `total_void`, `total_retur`, `total_refund`, `sisa_tagihan`, `tanggal_jatuh_tempo`, `status_pengambilan`, `status_pengiriman`, `id_shift`, `nama_pembeli`, alamat/catatan kirim; `status_transaksi` + VOID_SEBAGIAN | K-025, K-026, K-024, K-027 |
| `PENJUALAN_DETAIL`: + tier, satuan jual, faktor, `qty_dasar`, `harga_manual`, promo, `qty_retur_dasar`, `id_penyelesaian_konsinyasi`; `HARGA_MODAL_SAAT_TRANSAKSI` → `hpp_saat_transaksi` | K-011, K-014, K-029 |
| `SURAT_JALAN`: UNIQUE per penjualan dihapus; + detail qty per baris, sopir, kendaraan, waktu status, penerima; status + DIMUAT, BATAL | K-024 |
| `PEMBAYARAN_PENJUALAN`: metode COD dihapus, + EDC; + `nomor`, `id_shift`, `uang_diterima`, `kembalian`, `rekening`, `referensi`, `tanggal_operasional` | K-025, K-018 |
| `RETUR_PENJUALAN`: + POTONG_TAGIHAN, status persetujuan, penyetuju, metode/rekening refund, `id_shift`; detail + `qty_retur_dasar`, `harga_satuan_efektif`, barang pengganti | K-015, K-017 |
| `VOID_TRANSAKSI_LOG` → `void_transaksi` (+ status MENUNGGU/DITOLAK, `nominal_refund`, refund) + `void_transaksi_detail` (menggantikan `ID_PENJUALAN_DETAIL` tunggal) | K-016 |
| `CLERICAL_CHECK`: + `shift_kasir`, `kas_shift`; kolom modal awal, komponen kas, `saldo_sistem`, `selisih` generated, keterangan wajib bila selisih | K-018 |
| + `retur_pemasok` (+detail), `pembayaran_pemasok`, `penyelesaian_konsinyasi` (+detail) | K-028, K-029 |
| `KONFIGURASI`: + `tipe` | validasi nilai |

Yang tidak berubah maksudnya: 19 tabel FINAL2 semuanya tetap ada dengan nama yang sama (huruf kecil) kecuali
`VOID_TRANSAKSI_LOG` → `void_transaksi`.

## 8. Catatan implementasi Drizzle (Fase 1)

- Migrasi `0000_skema_v3.sql` = berkas SQL ini apa adanya (identik byte-per-byte).
- Skema Drizzle ditulis di `apps/api/src/db/schema/{sistem,master,persediaan,kas,penjualan,koreksi,transaksi-pemasok}.ts`
  agar sesuai DDL (kolom generated dideklarasikan dengan `.generatedAlwaysAs()`; nama constraint ditulis eksplisit
  sama dengan nama bawaan PostgreSQL). Catatan: `drizzle-kit check` hanya memeriksa konsistensi riwayat migrasi;
  kesamaan skema dibuktikan dengan `pnpm --filter @sit/api db:verifikasi` (perbandingan `pg_dump`) — K-052.
  Hasil Fase 1: identik (1468 baris struktur).
- Tipe kolom: uang `bigint({ mode: 'number' })`; qty `numeric({ precision: 14, scale: 3 })` (string di TS → helper
  `qty.ts`); waktu `timestamp({ withTimezone: true })`; tanggal operasional `date({ mode: 'string' })`.
- CHECK constraint dideklarasikan di skema Drizzle dengan `check()`; CHECK berbentuk `kolom in (...)` disusun dari
  `packages/shared/src/enums.ts` (helper `dalamDaftar`), CHECK berlogika majemuk ditulis sama dengan DDL.
- Seed ada di `apps/api/src/db/seed.ts` + `data-awal.ts` (bukan `scripts/seed.ts` seperti komentar penutup DDL; K-053).
  Kode satuan luas/volume: `m2`, `m3`.
- Fungsi `num_nonnulls` dan `unique nulls not distinct` adalah fitur PostgreSQL (≥ 9.6 dan ≥ 15); tidak ada
  ekstensi tambahan yang dibutuhkan.

## Riwayat

- 2026-09-19 — v1. DDL 41 tabel diuji di PostgreSQL 16 dengan 19 kasus constraint dan satu alur transaksi lengkap.
- 2026-09-19 — v3.1. `penjualan`: `total_potong_tagihan` → `total_void`, `total_retur`, `total_refund` agar `sisa_tagihan`
  benar untuk void sebagian dan retur refund. `penerimaan_barang` + `total_retur_potong`. `pembayaran_pemasok` + metode
  KOMPENSASI + `id_retur_pemasok`. `retur_pemasok` + PENGEMBALIAN_TITIPAN. Diuji ulang (3 CHECK baru).
- 2026-09-30 — v3.2: tabel `merk` + `barang.id_merk` menggantikan kolom teks `barang.merk` (migrasi 0001–0002,
  data lama dipindah otomatis; K-063). `docs/03-skema-database-v3.sql` tetap berisi v3.1 (= migrasi 0000);
  perubahan sesudahnya hanya lewat migrasi baru.
- 2026-10-02 — v3.3: `penyesuaian_stok_detail` + `dikecualikan`, `alasan_kecuali`, `id_pengguna_kecuali` (FK pengguna),
  `waktu_kecuali`, CHECK `chk_penyesuaian_detail_kecuali` (migrasi 0003; K-069).
- 2026-09-29 — Fase 1: DDL v3.1 dipasang sebagai migrasi `0000_skema_v3.sql` di PostgreSQL 17.11 (41 tabel); skema
  Drizzle terverifikasi identik (K-052). §8 diperbarui (7 berkas skema, cara verifikasi, letak seed).
- 2026-10-04 — v3.4: tabel `cadangan` (riwayat cadangan & uji pulih, migrasi 0004; K-084).
- 2026-10-04 — v3.5: `order_penjualan_detail` + `id_promo` (FK promo), `diskon_promo`, `promo_nonaktif`; CHECK
  `chk_order_detail_harga` memuat `diskon_promo`; indeks parsial `idx_penjualan_detail_promo` (migrasi 0005; K-087).
