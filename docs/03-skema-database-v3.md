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
| (konfigurasi) | `konfigurasi`, `penghitung_nomor`, `log_aktivitas`, `log_interaksi` |
| (M2, di luar DFD) | `promo`, `retur_pemasok`(+detail), `pembayaran_pemasok`, `penyelesaian_konsinyasi`(+detail) |

## 3. Tabel

Tanda: **[APPEND]** append-only · **[M2]** dipakai UI mulai M2 (tabel sudah ada sejak migrasi 0000).

### 3.1 Sistem

**`konfigurasi`** — key-value setelan toko dan sistem. Dibaca struk/invoice/laporan dan aturan bisnis. Daftar kunci di §6.

**`penghitung_nomor`** — `(prefix, tanggal_kode YYMMDD) → nilai_terakhir`. Service `penomoran.ts` melakukan
`INSERT ... ON CONFLICT DO UPDATE SET nilai_terakhir = nilai_terakhir + 1 RETURNING` di transaksi yang sama dengan
dokumennya. Tidak ada nomor ganda; nomor bisa berlubang bila transaksi dibatalkan (diterima).

**`pengguna`** — akun. `peran` menentukan izin lewat `roles.ts`. Kolom keamanan: `wajib_ganti_password`,
`gagal_login_berturut`, `terkunci_sampai`. `kode` = `USR-00001`. v3.12: `email` dan `telegram_chat_id` (keduanya
boleh kosong) = tujuan kode persetujuan sekali pakai; diisi pemilik akun sendiri (K-102). v3.32: `kode_pemulihan_hash`
(argon2id, boleh kosong) dan `kode_pemulihan_dibuat_pada` = kode pemulihan sekali pakai untuk lupa password (K-191).
v3.39: `tur_status` jsonb `{selesai: [], dilewati: []}` = tur fitur yang sudah selesai/dilewati pengguna (K-206).
v3.41: `pintasan` jsonb `{}` = tombol pintasan layar kerja yang diganti pengguna, mis. `{"KASIR_CARI":"F6"}` (K-145).

**`kode_reset_password`** (v3.39, K-209) — kode verifikasi lupa password lewat email: `id_pengguna`, `kode_hash`
(SHA-256), `kedaluwarsa` (10 menit), `salah` (gugur pada 5), `dipakai_pada`, `digugurkan_pada`, `dibuat_pada`.
Baris tidak dihapus; yang berubah hanya kolom status (`salah`, `dipakai_pada`, `digugurkan_pada`).

**`sesi_login`** [APPEND] — token disimpan sebagai `sha256` (kolom `token_hash`); cookie berisi token mentah.
`kadaluarsa_absolut` dan `terakhir_aktif` untuk batas absolut dan idle. Logout = isi `dicabut_pada`.

**`log_aktivitas`** [APPEND] — jejak audit. `data_lama`/`data_baru` jsonb untuk perubahan master; `nomor_dokumen`
untuk transaksi. `id_pengguna` null hanya untuk percobaan login dengan username tak dikenal dan aksi otomatis
sistem (job order basi/kunci kadaluarsa, K-070; cadangan terjadwal, K-084).

**`log_interaksi`** (v3.31) [APPEND] — data pemakaian untuk penelitian (K-190), terpisah dari jejak audit:
`id_pengguna` (wajib), `id_sesi_klien` (acak per tab peramban), `waktu` (saat kejadian di peramban; dikirim
berkelompok, waktu yang terpaut > 2 hari diganti waktu terima), `jenis` HALAMAN/KLIK/TOMBOL/CARI/DIALOG/GALAT (CHECK),
`halaman` (alamat tanpa query, id angka menjadi `:id`), `elemen` (label tombol/judul dialog/alamat API pencarian),
`keterangan` (jenis elemen, kunci pintasan, buka/tutup, kata cari barang, pesan galat), `angka` (lama ms atau jumlah
hasil). Tidak pernah berisi isi kotak isian; deret ≥ 7 angka disamarkan `#`. Diisi hanya bila konfigurasi
`log_interaksi_aktif` = `true` (bawaan `false`); `log_interaksi_tingkat` SEMUA/BERMAKNA. Lama penyimpanan belum
dibatasi (menunggu keputusan pemilik; tabel ini append-only seperti log lain).

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

**`barang`** — master utama. Kolom penting: `id_satuan_dasar` (satuan stok), `stok_minimum`, `stok_maksimum` (boleh kosong; batas atas saran pesan metode C, CHECK > 0 dan ≥ minimum, K-127), `harga_modal_awal`
(dasar HPP dan markup sebelum ada penerimaan; saat barang dibuat, service membuat baris `persediaan` dengan
`hpp_rata2 = harga_beli_terakhir = harga_modal_awal`), `kepemilikan` MILIK_SENDIRI/KONSINYASI dengan
`id_pemasok_konsinyasi` + `harga_titip` wajib untuk konsinyasi (CHECK), `harga_otomatis` (bawaan true sejak v3.8,
K-094) dan `perlu_tinjau_harga` (M2), `barcode` unik opsional, `perlu_persetujuan_beli` (K-225: pembelian wajib disetujui Owner; diatur hanya Owner). Aturan service: kepemilikan tidak boleh diubah selama `stok_fisik + stok_rusak > 0`.

**`barang_atribut`** — satu baris per (barang, jenis atribut); tepat satu dari `nilai_angka`/`nilai_teks` terisi
(CHECK `num_nonnulls = 1`). `id_satuan` wajib bila jenis atribut berdimensi (service).

**`barang_satuan_jual`** [M2] — satuan alternatif per barang dengan `faktor_ke_dasar` (roll = 50 m → 50).
Boleh punya barcode sendiri (unik bersama `barang.barcode`). Sejak Fase 12 (K-091) diatur di form barang; baris
tidak dihapus (dinonaktifkan). Baris order/penjualan menyimpan `id_satuan_jual` dan `faktor` (snapshot);
`qty_dasar = qty × faktor`. Baris `harga_barang` dengan `id_satuan_jual` hanya bermakna bila `TETAP`; metode
lain = harga dihitung saat dibaca dari harga satuan dasar × faktor (kolom `harga_jual`-nya tidak dipakai).

**`tingkat_harga`** — master tier. Tepat satu `is_default` (index parsial). `markup_default_persen` dipakai barang
bermetode IKUT_TIER; `min_belanja` (v3.10, `bigint`) = total nilai belanja transaksi agar tier dipakai otomatis
untuk semua barang (kosong = hanya manual; tier default selalu kosong, CHECK `chk_tingkat_harga_min_belanja`).
Menggantikan `min_qty` v3.9 (K-098).

**`harga_barang`** — harga jual berlaku per (barang, tier, satuan jual|null). `metode`: `IKUT_TIER` (markup default
tier), `MARKUP` (markup sendiri), `TETAP` (harga tetap). `harga_jual` selalu terisi (K-010: harga disimpan).
`dasar_markup_saat_hitung` menyimpan nilai dasar saat `harga_jual` dihitung, sehingga Tinjau Harga bisa menunjukkan
"dasar berubah dari X ke Y". Service membuat satu baris untuk setiap tier aktif saat barang dibuat (Fase 3: tier
Normal wajib diisi TETAP; tier lain kosong → IKUT_TIER dihitung dari `harga_modal_awal`). v3.10 (K-098):
baris tier selain tier default selalu IKUT_TIER (ditegakkan service; butuh membaca `tingkat_harga`); kolom
`min_qty` v3.9 dihapus.

**`pelanggan`** — + `term_hari` (jatuh tempo piutang), `limit_kredit` (nullable; ditegakkan M2), `id_golongan`
(v3.9, sasaran promo; menggantikan `id_tingkat_harga` yang dihapus). `kode` = `PLG-00001`.

**`golongan_pelanggan`** [v3.9] — master golongan (nama unik, status aktif) untuk sasaran promo (K-097).

**`pemasok`** — sama dengan FINAL2 + `kode` = `PMS-00001`. v3.16 (K-113): `lama_kirim_hari` (0–365) dan `jarak_belanja_hari` (1–365), boleh NULL (= bawaan konfigurasi `saran_pesan_lama_kirim_default` / `saran_pesan_jarak_belanja_default`); dipakai rekomendasi pemesanan ulang (docs/05 §17).

**`promo`** [M2] — satu baris satu promo; `sasaran` SEMUA/KATEGORI/BARANG dengan CHECK konsistensi; tepat satu jenis
potongan. v3.9: `sasaran_pembeli` SEMUA/GOLONGAN/PELANGGAN (+ `id_golongan`, CHECK), `min_belanja_pelanggan` dan
`hari_belanja` (keduanya terisi atau keduanya kosong). **`promo_pelanggan`** (id_promo, id_pelanggan) = pelanggan
yang berhak untuk sasaran PELANGGAN.
v3.14 (K-110): `anggaran` (jumlah seluruh potongan yang boleh diberikan; NULL = tanpa batas) dan
`maks_per_pembeli` (potongan paling banyak per pembeli); CHECK keduanya > 0 dan `maks_per_pembeli < anggaran`.
Yang terpakai tidak disimpan: dihitung dari `penjualan_detail.diskon_promo` (bukan VOID).
v3.26 (K-163): `mulai_pada`/`selesai_pada` (timestamptz, CHECK selesai > mulai), `hari_berlaku` (bit 1–127),
`jam_mulai`/`jam_selesai` (`HH:mm`, keduanya atau tidak sama sekali), `harga_khusus`, `beli_qty`/`gratis_qty`,
`templat`; `jenis_potongan` + HARGA_KHUSUS, GRATIS (CHECK `chk_promo_nilai` per jenis); `sasaran` + MERK.
**`promo_sasaran`** (id_promo + tepat satu dari id_barang/id_kategori/id_merk, CHECK `num_nonnulls = 1`, unik per
promo) menggantikan `promo.id_kategori`/`id_barang` (dipindah di migrasi 0029, kolom dihapus di 0030).
v3.34 (K-185): `sasaran` + KELOMPOK; untuk KELOMPOK satu baris `promo_sasaran` = satu kelompok berisi 1–3 kolom
sekaligus (CHECK `chk_promo_sasaran_isi`: `num_nonnulls >= 1`, menggantikan `chk_promo_sasaran_satu`).
`jenis_potongan` + BELI_POTONG (`beli_qty` > 0 dan `potongan_nominal` > 0, kolom lain kosong; `chk_promo_nilai`).

### 3.3 Persediaan

**`persediaan`** — satu baris per barang, dibuat saat barang dibuat. `stok_fisik` (bucket BAIK), `stok_dipesan`,
`stok_tersedia` (generated = fisik − dipesan), `stok_rusak` (bucket RUSAK, M2), `hpp_rata2`, `harga_beli_terakhir`,
`tanggal_beli_terakhir`, `harga_fifo` (v3.35, K-184: harga beli lapisan stok tertua yang masih ada, docs/05 L12;
CHECK `chk_persediaan_fifo` ≥ 0). CHECK: fisik ≥ 0, 0 ≤ dipesan ≤ fisik, rusak ≥ 0. Konsekuensi CHECK dipesan ≤ fisik:
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

**`order_pembelian`** [APPEND; DRAF boleh diubah] + **`order_pembelian_detail`** — K-125: PO ke pemasok. `nomor`
kosong selama DRAF/DIAJUKAN/DISETUJUI (CHECK `chk_po_nomor`), `status`
DRAF/DIAJUKAN/DISETUJUI/DIPESAN/DIKONFIRMASI/SEBAGIAN/SELESAI/DITUTUP/BATAL, `tanggal_dipesan` (wajib setelah dikirim),
`tanggal_janji_kirim`, `alasan_tutup`; K-225 (migrasi 0046): `alasan_persetujuan`, `id_penyetuju` (FK pengguna),
`disetujui_pada`, `catatan_persetujuan` (catatan penyetuju atau "Ditolak: …"); kolom status persetujuan ini boleh
berubah selama order belum dikirim. K-236 (migrasi 0047): `syarat_bayar` (DI_MUKA/SAAT_TERIMA/TEMPO), `tempo_hari`,
`uang_muka_rencana`, `tanggal_kirim_diminta`, `cara_kirim`, `metode_bayar_rencana` (boleh diubah selama draf),
`tanggal_janji_awal`, `jumlah_ubah_janji` (cache konfirmasi). Detail: `qty_ditolak`, `qty_dipotong` (cache K-237,
migrasi 0048). **`penerimaan_barang_tolak`** [APPEND] (0048): barang datang tetapi ditolak (qty, alasan, tindakan
GANTI/POTONG). `penerimaan_barang`: `penyimpangan_bayar`, `alasan_penyimpangan`, `id_penyetuju_penyimpangan` (0048);
`tanggal_jatuh_tempo` hanya berubah lewat **`perpanjangan_jatuh_tempo`** [APPEND] (0049, Owner). `pemasok.tempo_hari`
(0047), `pemasok.rekening` (0054, hanya Owner). **`hutang_awal`** [APPEND kecuali `total_dibayar`, `status_hutang`] (K-241, 0052): hutang pemasok dari sebelum
aplikasi; `pembayaran_pemasok.id_hutang_awal` (CHECK `chk_pbp_sumber` kini empat sumber). Kode dokumen `HAW`. Detail: `qty_pesan`,
`harga_perkiraan`, `qty_konfirmasi`/`harga_konfirmasi` (jawaban pemasok), `qty_diterima` (cache Σ penerimaan,
disinkronkan di transaksi penerimaan), UNIQUE (PO, barang). **`alokasi_uang_muka`** [APPEND]: pemakaian uang muka PO
(DIPAKAI → `id_penerimaan`; DIKEMBALIKAN → `metode_kembali`). `penerimaan_barang.id_order_pembelian`,
`penerimaan_barang_detail.id_order_pembelian_detail`, `pembayaran_pemasok.id_order_pembelian` (CHECK `chk_pbp_sumber`
tepat satu dari penerimaan/konsinyasi/PO).

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
dilepas kasir); promo dievaluasi ulang saat checkout (K-087). v3.8 `tier_dipilih` dihapus di v3.11
(tier selalu otomatis, K-099). v3.18 (K-122, migrasi 0021): status DISIMPAN (pesan sekarang, diambil nanti; menahan stok,
di luar antrean) dengan `no_hp_pembeli` dan `tanggal_ambil` (CHECK `chk_order_disimpan`: keduanya wajib saat
DISIMPAN); detail boleh diubah juga selama DISIMPAN.

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
v3.20 (K-149, K-150, migrasi 0023): `surat_jalan.id_perjalanan` (diisi saat berangkat); kolom teks `sopir` dan
`kendaraan` tetap sebagai salinan untuk cetakan dan data lama. DIKIRIM hanya lewat perjalanan, SELESAI hanya lewat
catat hasil.
v3.24 (K-160): `id_perjalanan` juga diisi saat surat jalan dimasukkan ke rit rencana dan boleh berubah (pindah rit,
keluar dari rit, rit rencana batal) selama surat jalan belum DIKIRIM. Kolom ini kolom penugasan, bukan isi dokumen;
setelah DIKIRIM tidak berubah lagi.

**`kendaraan`**, **`sopir`** [MASTER] (v3.20, K-150) — kendaraan: `plat` (unik tanpa beda huruf, indeks
`upper(plat)`), `jenis`, `kapasitas_kg` (opsional, > 0), `catatan`, `status_aktif`. Sopir: `nama` (unik tanpa beda
huruf, indeks `lower(nama)`), `no_hp`, `catatan`, `status_aktif`. Sopir tidak punya akun.

**`perjalanan`** [APPEND kecuali status dan kolom waktu/muatan per status] (v3.20, K-150; v3.24, K-160) — satu
kendaraan + satu sopir membawa satu atau lebih surat jalan. Nomor `TRP`. `status` DIRENCANAKAN → JALAN → SELESAI,
atau DIRENCANAKAN → BATAL. Rit rencana punya `jadwal_berangkat`; `waktu_berangkat`, `muatan_berat_kg`,
`muatan_volume_m3`, dan `alasan_muatan` diisi sekali saat berangkat; `alasan_batal` saat batal. CHECK
`chk_perjalanan_kembali`: DIRENCANAKAN/BATAL tanpa `waktu_kembali`; JALAN wajib `waktu_berangkat`; SELESAI wajib
keduanya. Indeks unik parsial `uq_perjalanan_kendaraan_jalan` dan `uq_perjalanan_sopir_jalan` (`where status =
'JALAN'`): satu perjalanan berjalan per kendaraan dan per sopir.

**`catatan_bbm`**, **`catatan_servis`** [APPEND kecuali kolom batal] (v3.25, K-162, docs/13 §5) — catatan BBM (kendaraan, tanggal, sopir dan rit opsional, odometer, liter `numeric(8,2)`, `total_rp`, *isi penuh*) dan servis (kendaraan, tanggal, odometer, jenis, `biaya_rp`, bengkel). Catatan salah tidak diubah/dihapus: `batal_pada`, `alasan_batal`, `dibatalkan_oleh` (CHECK batal_pada dan alasan terisi bersamaan). Odometer tidak boleh mundur menurut tanggal (dicek service dengan kunci baris kendaraan). `kendaraan.servis_tiap_km` (> 0) dan `servis_tiap_bulan` (1–60) untuk pengingat servis berkala. Tidak terhubung ke kas shift.

**`surat_jalan_hasil`** + **`surat_jalan_hasil_detail`** [APPEND] (v3.20, K-149, K-151) — hasil pengantaran, sekali per
surat jalan (UNIQUE `id_surat_jalan`). Header: pencatat, waktu, `nama_penerima`, `penanganan_rusak`
(KIRIM_PENGGANTI/KURANGI_TAGIHAN), `id_retur_tukar` dan `id_retur_uang` (retur yang dibuatnya), `catatan`. Detail per
baris surat jalan (UNIQUE `id_surat_jalan_detail`): `qty_diterima`, `qty_kembali`, `qty_rusak`, `qty_ditolak`
(semua ≥ 0; jumlahnya = `qty_kirim`, dijaga service), `kondisi_ditolak`.

**`pembayaran_penjualan`** [APPEND] — `jenis` PENUH/DP/PELUNASAN; `metode` TUNAI/TRANSFER/EDC/QRIS; TUNAI wajib
`id_shift` (CHECK); `uang_diterima` dan `kembalian` untuk tunai; `rekening`, `referensi` untuk non-tunai. Nomor `BYR`.
Service menolak `nominal > sisa_tagihan`. v3.15 (K-111): `id_rekening` → `rekening_toko` (`rekening` menyimpan
labelnya saat itu). **Kolom status yang boleh berubah:** `status_verifikasi` BELUM_DICEK/SUDAH_MASUK/TIDAK_MASUK
(NULL untuk tunai; CHECK `(metode = 'TUNAI') = (status_verifikasi is null)`), `diverifikasi_oleh`,
`diverifikasi_pada`, `catatan_verifikasi`. Isi pembayaran lainnya tidak pernah diubah.

### 3.5 Retur, void

**`retur_penjualan`** + **`retur_penjualan_detail`** [APPEND] — `status` MENUNGGU/DISETUJUI/DITOLAK/DIBATALKAN
(v3.11), `cara_persetujuan` SENDIRI/AKUN_ATASAN/DI_TEMPAT/BATAS_BEBAS (v3.11; terisi tepat saat DISETUJUI, CHECK;
sama untuk `void_transaksi`), `id_pengaju`,
`id_penyetuju`, `waktu_persetujuan`. `penyelesaian` REFUND (wajib `metode_refund`; tunai memakai `id_shift`),
TUKAR_BARANG (detail: `id_barang_pengganti` + `qty_pengganti_dasar`, keduanya terisi atau kosong), POTONG_TAGIHAN.
Detail: `harga_satuan_efektif` = subtotal baris ÷ qty saat retur; `nominal_retur`; `kondisi` BAIK/RUSAK/CACAT.
Efek stok dan kas hanya saat DISETUJUI (docs/05).

**`permintaan_persetujuan`** + **`kode_persetujuan`** (v3.12, K-102) — kode sekali pakai yang dikirim ke atasan
untuk menyetujui retur, void, atau melampaui limit kredit dari layar pengaju. Permintaan: `jenis`
RETUR/VOID/LIMIT_KREDIT, `id_pengaju`, rujukan (`id_retur` / `id_void` / `id_pelanggan`, CHECK sesuai jenis),
`nilai` (nilai dokumen; untuk limit kredit = tagihan baru tertinggi yang disetujui), `ringkasan` (isi pesan
untuk atasan), `status` MENUNGGU/DIPAKAI/GAGAL/DIGANTI, `gagal` (hitungan salah ketik), `kadaluarsa_pada`,
`id_penyetuju` + `diputus_pada` (terisi saat DIPAKAI). [APPEND] kecuali kolom status tersebut. Kode: satu baris
per atasan penerima (`id_atasan`, unik per permintaan), `kode_hash` (sha256; kode aslinya tidak disimpan),
`saluran` (yang berhasil mengirim, mis. `TELEGRAM,EMAIL`). Dipakai di transaksi yang sama dengan dokumen yang
disetujuinya.
v3.13 (K-107): jenis `UBAH_PELANGGAN` (rujukan `id_pelanggan`) dan kolom `sidik` (SHA-256 isian yang
dimintakan persetujuan; kode hanya berlaku untuk isian yang sama).

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
`id_penyelesaian_konsinyasi` agar tidak disetor dua kali. v3.6: satu baris detail per barang **per harga titip**
(unique `id_penyelesaian, id_barang, harga_titip`), dan `retur_penjualan_detail.id_penyelesaian_konsinyasi` menandai
retur pelanggan yang sudah diperhitungkan di setoran (kolom penanda, diisi sekali; K-089).

**`pembayaran_pemasok`** [APPEND] — nomor `PBP`; tepat satu sumber: `id_penerimaan` atau
`id_penyelesaian_konsinyasi` (CHECK). `metode` TUNAI/TRANSFER, atau KOMPENSASI (tanpa uang: barang pengganti dari
retur pemasok GANTI_BARANG; wajib `id_retur_pemasok`). Untuk penerimaan PEMBELIAN TUNAI, service membuat satu baris pembayaran
otomatis saat penerimaan disimpan (sehingga `sisa_hutang = 0`).

### 3.7 Kas

**`shift_kasir`** — `nomor SHF`, `id_kasir` (sejak v3.19 = pengguna yang membuka shift toko; K-132), `tanggal_operasional`, `modal_awal`, `waktu_buka/tutup`, `status`
BUKA/TUTUP. Satu shift BUKA per kasir (index parsial). Membuka kembali shift yang sudah tutup (koreksi) hanya
Admin/Owner dengan `dibuka_kembali_oleh` + alasan. v3.13 (K-109): `jadwal_buka`, `jadwal_tutup` (`HH:mm`, jadwal
toko yang dibekukan saat shift dibuka; NULL = tanpa jadwal) dan kolom status `diingatkan_pada` (pengingat
terakhir ke atasan). v3.17 (K-121, migrasi 0020): status DIHITUNG (hitungan tutup sudah dikirim); index unik
satu shift per kasir kini `where status <> 'TUTUP'`; `cara_buka` SAMA_KEMARIN/HITUNG/HITUNG_NANTI (CHECK, bawaan
HITUNG), `modal_usulan` (uang ditinggal shift sebelumnya saat dibuka), `rincian_buka` (jsonb pecahan → jumlah
lembar/keping), `batas_hitung_buka` dan `hitung_buka_pada` (hitung susulan).

**`hitung_kas`** [APPEND] (v3.17, K-121) — setiap hitungan uang laci: `id_shift`, `jenis` BUKA/BUKA_SUSULAN/TUTUP/
TUTUP_ULANG, `waktu`, `id_pengguna`, `uang_fisik`, `rincian` (jsonb, boleh NULL bila hanya total), `saldo_sistem`
saat hitungan dikirim (NULL untuk BUKA tanpa catatan sebelumnya).

**`rekening_toko`** (v3.15, K-111) — data master tujuan pembayaran non-tunai: `jenis` TRANSFER/EDC/QRIS, `bank`,
`nomor`, `atas_nama`, `nama` (label lengkap ≤ 60 karakter, disalin ke pembayaran), `is_default` (index unik
parsial: satu bawaan AKTIF per jenis), `status_aktif`. Tidak dihapus.

**`kas_shift`** [APPEND] — kas masuk/keluar **non-penjualan** per shift: KASBON, SETOR_OWNER, TARIK_OWNER,
REFUND_RETUR, REFUND_VOID, BAYAR_PEMASOK, MASUK_LAIN, KELUAR_LAIN, KOREKSI_MODAL_TAMBAH, KOREKSI_MODAL_KURANG
(v3.17; koreksi modal tidak masuk kas masuk/keluar lain di clerical); maksimal satu referensi (retur/void/pembayaran
pemasok). Refund via transfer tetap dicatat di sini (arah KELUAR, keterangan) tetapi tidak dihitung dalam saldo
tunai clerical — service membedakan lewat metode di dokumen sumbernya.

**`clerical_check`** [APPEND] — satu per shift (`id_shift` unik). `saldo_sistem` = modal + tunai penjualan + kas masuk
lain − kas keluar tunai; `uang_fisik` diinput sebelum saldo sistem ditampilkan; `selisih` generated; selisih ≠ 0
wajib `keterangan` (CHECK). v3.17 (K-121): `uang_ditinggal` (0 ≤ nilai ≤ uang fisik, CHECK; usulan modal shift
berikutnya), `koreksi_modal`, `toleransi` (dibekukan dari konfigurasi), `jumlah_hitung`, dan kolom status
`penjelasan_atasan`, `dijelaskan_oleh`, `dijelaskan_pada` (diisi sekali oleh Admin/Owner setelah tutup).

## 4. Kolom cache dan siapa yang menyinkronkan

Semua sinkronisasi terjadi **di transaksi DB yang sama** dengan penulisan sumbernya (CLAUDE.md aturan 15).

| Kolom cache | Sumber kebenaran | Disinkronkan oleh |
|---|---|---|
| `persediaan.stok_fisik`, `stok_rusak`, `hpp_rata2`, `harga_beli_terakhir`, `terakhir_mutasi`, `harga_fifo` | `mutasi_persediaan` | `ledger.catatMutasi()` |
| `persediaan.stok_dipesan` | `order_penjualan_detail.qty_dasar` untuk order MENUNGGU/DIPROSES | service order (kirim ke antrean, ubah detail, batal, checkout) |
| `order_penjualan.subtotal`, `total` | detail | service order |
| `penjualan.total_dibayar`, `status_pembayaran` | `pembayaran_penjualan` | service pembayaran |
| `penjualan.total_retur`, `total_refund` | `retur_penjualan` DISETUJUI (REFUND, POTONG_TAGIHAN) | service retur |
| `penjualan.total_void`, `total_refund` | `void_transaksi` DISETUJUI | service void |
| `penjualan.status_transaksi`, `penjualan_detail.status_item` | `void_transaksi` DISETUJUI, retur | service void / retur |
| `penjualan.status_pengiriman` | `surat_jalan` + detail + `surat_jalan_hasil_detail.qty_diterima` | service surat jalan (buat, batal, catat hasil) |
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
| peran | STAF_PENJUALAN, KASIR, ADMIN (Kepala Toko), ADMIN_SISTEM, ADMIN_PERSEDIAAN, PETUGAS_GUDANG, OWNER (K-225, migrasi 0045) |
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
| status_order | DRAFT, MENUNGGU, DIPROSES, DISIMPAN, SELESAI, BATAL |
| status_pembayaran | BELUM_BAYAR, DP, LUNAS |
| status_transaksi | SELESAI, VOID_SEBAGIAN, VOID |
| status_pengambilan | DIAMBIL, BELUM_DIAMBIL |
| status_pengiriman (invoice) | BELUM, SEBAGIAN, SELESAI |
| status_surat_jalan | DIPROSES, DIMUAT, DIKIRIM, SELESAI, BATAL |
| status_perjalanan | DIRENCANAKAN, JALAN, SELESAI, BATAL |
| penanganan_rusak | KIRIM_PENGGANTI, KURANGI_TAGIHAN |
| jenis_pembayaran | PENUH, DP, PELUNASAN |
| metode_pembayaran | TUNAI, TRANSFER, EDC, QRIS |
| jenis_rekening | TRANSFER, EDC, QRIS |
| status_verifikasi | BELUM_DICEK, SUDAH_MASUK, TIDAK_MASUK |
| status_persetujuan (retur, void) | MENUNGGU, DISETUJUI, DITOLAK |
| penyelesaian_retur | REFUND, TUKAR_BARANG, POTONG_TAGIHAN |
| metode_refund | TUNAI, TRANSFER |
| lingkup_void | TRANSAKSI, ITEM |
| status_item | NORMAL, RETUR_SEBAGIAN, RETUR, VOID |
| penyelesaian_retur_pemasok | POTONG_HUTANG, GANTI_BARANG, REFUND, PENGEMBALIAN_TITIPAN |
| metode_pembayaran_pemasok | TUNAI, TRANSFER, KOMPENSASI |
| status_shift | BUKA, DIHITUNG, TUTUP |
| jenis_kas_shift | KASBON, SETOR_OWNER, TARIK_OWNER, REFUND_RETUR, REFUND_VOID, BAYAR_PEMASOK, MASUK_LAIN, KELUAR_LAIN, KOREKSI_MODAL_TAMBAH, KOREKSI_MODAL_KURANG, KEMBALIAN_DITINGGAL, BIAYA_ENTERTAIN |
| cara_buka_shift | SAMA_KEMARIN, HITUNG, HITUNG_NANTI |
| jenis_hitung_kas | BUKA, BUKA_SUSULAN, TUTUP, TUTUP_ULANG |
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
| lebar_struk_mm | 80 | 57, 58, atau 80 (K-094) |
| struk_cetak | OTOMATIS | struk setelah bayar: OTOMATIS, TANYA, TIDAK (K-095) |
| invoice_cetak | TIDAK | invoice pengantaran setelah dibuat: OTOMATIS, TANYA, TIDAK (K-124) |
| surat_jalan_cetak | OTOMATIS | surat jalan setelah dibuat: OTOMATIS, TANYA, TIDAK (K-124) |
| kertas_invoice | A4_LANSKAP | kertas invoice: A4/A5/F4/LETTER × POTRET/LANSKAP (K-124) |
| kertas_surat_jalan | A4_LANSKAP | kertas surat jalan (K-124) |
| kertas_dokumen_lain | A4_POTRET | nota setoran titipan, nota retur pemasok (K-124) |
| surat_jalan_rangkap | true | surat jalan dicetak 2 rangkap: asli + salinan (K-187) |
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
| batas_retur_tanpa_persetujuan / batas_void_tanpa_persetujuan | 0 / 0 | nilai retur/void per penjualan yang boleh diproses Kasir tanpa atasan, Rp; 0 = selalu butuh persetujuan (K-099) |

**`satuan`** awal: m (basis PANJANG), cm 0.01, mm 0.001, dm 0.1; m² (basis LUAS); m³ (basis VOLUME), L 0.001;
kg (basis BERAT), g 0.001; W (basis DAYA); JUMLAH: buah, sak, batang, roll, dus, lembar, kaleng, pail, pasang,
set, kotak (masing-masing basis, faktor 1).

**`jenis_atribut`** awal: PANJANG, LEBAR, TINGGI, TEBAL, DIAMETER (PANJANG); LUAS (LUAS); VOLUME (VOLUME);
BERAT (BERAT); DAYA (DAYA); WARNA, BENTUK, TEKSTUR, FUNGSI, UKURAN_TEKS (TEKS).

**`tingkat_harga`**: NORMAL (default, markup 25), GROSIR (markup 20), DISTRIBUTOR (markup 15); tier selain NORMAL dibuat NONAKTIF dengan
contoh `min_belanja` (Rp 1.000.000 dan Rp 5.000.000) sampai pemilik memeriksa lalu mengaktifkannya (K-099).
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
- 2026-10-07 — v3.6: `retur_penjualan_detail.id_penyelesaian_konsinyasi` (FK, indeks `idx_retur_detail_ksg`); unique `uq_ksg_detail` menjadi (`id_penyelesaian`, `id_barang`, `harga_titip`) (migrasi 0006; K-089). Urutan kolom promo `order_penjualan_detail` di skema Drizzle disamakan dengan migrasi 0005 (verifikasi skema identik).
- 2026-10-07 — Fase 12: pemakaian `barang_satuan_jual` dan baris harga satuan jual dirinci (tanpa perubahan struktur; K-091).
- 2026-10-08 — v3.7: `penyesuaian_stok_detail.id_penyelesaian_konsinyasi`, `penyelesaian_konsinyasi_detail.qty_ganti_rugi` (migrasi 0007; K-092).
- 2026-10-10 — v3.9: `golongan_pelanggan`, `pelanggan.id_golongan`, `tingkat_harga.min_qty`, `harga_barang.min_qty`, kolom sasaran pembeli di `promo`, `promo_pelanggan` (migrasi 0009); `pelanggan.id_tingkat_harga` dan `tingkat_harga.saran_min_qty` dihapus (migrasi 0010; K-097).
- 2026-10-09 — v3.8: `barang.harga_otomatis` bawaan true (barang lama dinyalakan), `order_penjualan_detail.tier_dipilih` (migrasi 0008; K-094).
- 2026-10-10 — v3.10: `tingkat_harga.min_belanja` + CHECK (migrasi 0011, sekaligus menjadikan baris harga tier selain tier default IKUT_TIER dan menghitung ulang harganya); `tingkat_harga.min_qty` dan `harga_barang.min_qty` dihapus (migrasi 0012; K-098).
- 2026-10-10 — v3.11: `retur_penjualan.cara_persetujuan`, `void_transaksi.cara_persetujuan` + CHECK; status DIBATALKAN; `order_penjualan_detail.tier_dipilih` dihapus; CHECK `chk_tingkat_harga_aktif_bersyarat` (tier aktif tanpa syarat belanja dinonaktifkan migrasi) (migrasi 0013; K-099).
- 2026-10-11 — v3.12: tabel `permintaan_persetujuan`, `kode_persetujuan`; `pengguna.email`, `pengguna.telegram_chat_id` (migrasi 0014; K-102). Kunci konfigurasi baru: `telegram_bot_token`, `smtp_host`, `smtp_port`, `smtp_pengguna`, `smtp_sandi`, `email_pengirim` (rahasia, tidak dikembalikan API; K-102), `limit_kredit_default` (K-104).
- 2026-10-12 — v3.13: `permintaan_persetujuan.sidik`, jenis `UBAH_PELANGGAN` (migrasi 0015; K-107); `shift_kasir.jadwal_buka`, `jadwal_tutup`, `diingatkan_pada` (migrasi 0016; K-109). v3.14: `promo.anggaran`, `promo.maks_per_pembeli` (migrasi 0017; K-110). v3.15: tabel `rekening_toko`; `pembayaran_penjualan.id_rekening`, `status_verifikasi`, `diverifikasi_oleh`, `diverifikasi_pada`, `catatan_verifikasi`; metode `QRIS` (migrasi 0018; K-111). Kunci konfigurasi baru: `shift_jam_buka`, `shift_jam_tutup`; `rekening_transfer_default` dan `rekening_edc_default` tidak dipakai lagi (isinya dipindah ke `rekening_toko`).
- 2026-10-17 — v3.16: `pemasok.lama_kirim_hari`, `pemasok.jarak_belanja_hari` (migrasi 0019; K-113). Kunci konfigurasi baru: `saran_pesan_periode_hari`, `saran_pesan_hari_pengaman`, `saran_pesan_lama_kirim_default`, `saran_pesan_jarak_belanja_default`.
- 2026-10-18 — v3.17: tabel `hitung_kas`; `shift_kasir.cara_buka`, `modal_usulan`, `rincian_buka`, `batas_hitung_buka`, `hitung_buka_pada`, status DIHITUNG, index satu shift belum tutup per kasir; `clerical_check.uang_ditinggal`, `koreksi_modal`, `toleransi`, `jumlah_hitung`, `penjelasan_atasan`, `dijelaskan_oleh`, `dijelaskan_pada`; jenis kas KOREKSI_MODAL_TAMBAH/KURANG; jenis kode `KOREKSI_KAS` (migrasi 0020; K-121). Kunci konfigurasi baru: `toleransi_selisih_kas`, `batas_hitung_buka_menit`.
- 2026-10-18 — v3.18: `order_penjualan.no_hp_pembeli`, `order_penjualan.tanggal_ambil`, status DISIMPAN, CHECK `chk_order_disimpan` (status DISIMPAN wajib tanggal ambil dan No. HP) (migrasi 0021; K-122).
- 2026-10-18 — v3.19: jenis kas `KEMBALIAN_DITINGGAL` (kembalian tidak diambil pembeli; migrasi 0022; K-141). Satu shift toko (K-132) dijaga service dengan kunci transaksi, tanpa constraint baru, agar shift ganda lama tidak menggagalkan migrasi; `shift_kasir.id_kasir` kini berarti pembuka.
- 2026-11-07 — v3.20: jenis kas `BIAYA_ENTERTAIN` (uang keluar untuk pihak lain atas kesepakatan; keterangan wajib; migrasi 0042; K-223).
- 2026-10-23 — v3.20: `kendaraan`, `sopir`, `perjalanan`, `surat_jalan_hasil`, `surat_jalan_hasil_detail`, `surat_jalan.id_perjalanan` (migrasi 0023; K-149–K-151). Prefix nomor `TRP`.
- 2026-10-24 — v3.21: indeks unik `uq_shift_toko_terbuka` pada `shift_kasir` (`where status <> 'TUTUP'`), migrasi 0024 dengan pemeriksaan shift ganda (K-155).
- 2026-10-24 — v3.22: tabel teknis `kunci_idempoten` (PK kunci + id_pengguna, status PROSES/SELESAI, jawaban tersimpan; dibersihkan setelah 24 jam; migrasi 0025, K-164).
- 2026-10-24 — v3.23: `barang.berat_kg`, `panjang_cm`, `lebar_cm`, `tinggi_cm`, `curah`, `volume_m3` (CHECK `chk_barang_muatan`); `kendaraan.bak_panjang_cm`, `bak_lebar_cm`, `bak_tinggi_cm`, `berlaku_stnk`, `berlaku_kir` (`kapasitas_kg` = daya angkut); `perjalanan.muatan_berat_kg`, `muatan_volume_m3`, `alasan_muatan` (migrasi 0026, K-161). Konfigurasi `muatan_faktor_isi_persen` (85), `muatan_julur_maks_cm` (100).
- 2026-10-24 — v3.24: `perjalanan.status` DIRENCANAKAN dan BATAL, `jadwal_berangkat`, `alasan_batal`,
  `waktu_berangkat` boleh kosong (rit rencana), CHECK `chk_perjalanan_status` dan `chk_perjalanan_kembali` diganti;
  `surat_jalan.id_perjalanan` menjadi kolom penugasan sebelum DIKIRIM (migrasi 0027, K-160).
- 2026-10-31 — v3.39: `pengguna.tur_status` jsonb; tabel `kode_reset_password` (migrasi 0041, K-206, K-209).
- 2026-11-07 — v3.41: `pengguna.pintasan` jsonb (migrasi 0043, K-145).
  Konfigurasi baru tanpa migrasi: `jenis_usaha`, `jenis_usaha_lain`, `slogan_toko`, `kota_toko`, `layanan_toko`,
  `setup_awal` (K-205); data awal tidak lagi memuat nama/alamat/telepon toko tertentu (K-207).
- 2026-10-30 — v3.38: `promo.maks_kelipatan` integer + CHECK `chk_promo_kelipatan` (1–1000, hanya GRATIS/BELI_POTONG) (migrasi 0040, K-194).
- 2026-10-30 — v3.37: konfigurasi `muatan_toleransi_persen` (110; tanpa migrasi) (K-203).
- 2026-10-30 — v3.36: `retur_penjualan.pengembalian_ditunda`, `potong_dulu` (boolean); CHECK `chk_retur_transfer`
  kini menerima `metode_refund` TUNAI (status pengembalian uang tunai maupun transfer) (migrasi 0039, K-192, K-193).
- 2026-10-28 — v3.35: `persediaan.harga_fifo` [CACHE] + CHECK `chk_persediaan_fifo`, diisi dari ledger saat migrasi;
  konfigurasi `dasar_markup` boleh `FIFO` (migrasi 0038, K-184).
- 2026-10-28 — v3.34: `promo.sasaran` KELOMPOK dan `jenis_potongan` BELI_POTONG; `promo_sasaran` boleh berisi
  beberapa kolom per baris (CHECK `chk_promo_sasaran_isi`) (migrasi 0037, K-185).
- 2026-10-28 — v3.33: `surat_jalan_hasil.id_retur_rusak`; `surat_jalan_hasil_detail.alasan_kembali`, `alasan_rusak`
  (CHECK `chk_surat_jalan_hasil_alasan`); `retur_penjualan.nominal_refund`, `status_transfer` MENUNGGU/SELESAI,
  `waktu_transfer`, `id_pengguna_transfer` (CHECK `chk_retur_transfer`) (migrasi 0036, K-176).
- 2026-10-26 — v3.32: `pengguna.kode_pemulihan_hash`, `kode_pemulihan_dibuat_pada` (migrasi 0035, K-191). Seed tidak
  membuat akun `owner` bila `SEED_OWNER_PASSWORD` kosong (akun pertama dibuat di halaman *Buat akun pertama*).
- 2026-10-26 — v3.31: `log_interaksi` (migrasi 0034, K-190); konfigurasi `log_interaksi_aktif`,
  `log_interaksi_tingkat`.
- 2026-10-24 — v3.30: `order_pembelian`, `order_pembelian_detail`, `alokasi_uang_muka`; kolom PO di penerimaan,
  detail penerimaan, dan pembayaran pemasok (migrasi 0033, K-125). Penomoran `PO`.
- 2026-10-24 — v3.29: `barang.stok_maksimum` numeric(14,3) boleh kosong + CHECK `chk_barang_stok_maks` (migrasi 0032,
  K-127).
- 2026-10-24 — v3.28: konfigurasi `invoice_cetak`, `surat_jalan_cetak`, `kertas_invoice`, `kertas_surat_jalan`,
  `kertas_dokumen_lain` (tanpa migrasi; nilai bawaan dipakai bila baris belum ada, K-124).
- 2026-10-24 — v3.27: tabel `tutup_tahun` (tahun PK, status DITUTUP/DIBUKA, berkas, sha256, ukuran, ringkasan jsonb,
  penutup, pembuka + alasan; CHECK status–kolom buka) (migrasi 0031, K-165).
- 2026-10-24 — v3.26: promo kampanye: kolom waktu, hari/jam, manfaat HARGA_KHUSUS/GRATIS, templat; tabel
  `promo_sasaran`; `promo.id_kategori`/`id_barang` dihapus setelah datanya dipindah (migrasi 0029–0030, K-163).
- 2026-10-24 — v3.25: tabel `catatan_bbm`, `catatan_servis`; `kendaraan.servis_tiap_km`, `servis_tiap_bulan` (CHECK `chk_kendaraan_servis`) (migrasi 0028, K-162).
