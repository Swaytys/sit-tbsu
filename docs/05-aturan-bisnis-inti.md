# 05 — Aturan Bisnis Inti

Setiap aturan bernomor (L1, R3, P7, …) **wajib punya tes** di level service dengan nama yang menyebut nomornya,
contoh `ledger.test.ts › "L2 saldo bucket tidak boleh negatif"`. Aturan yang menyebut konfigurasi membaca nilainya
dari tabel `konfigurasi` (docs/03 §6). Pesan error untuk pengguna ditulis Bahasa Indonesia dan menyebut barang atau
dokumen yang bermasalah.

Semua aturan di sini berlaku M1 kecuali ditandai **[M2]**. Aturan harga, diskon, promo, piutang, hutang, konsinyasi,
dan stok rusak ada di `06-harga-piutang-hutang.md`.

## 1. Angka: uang, kuantitas, pembulatan

| # | Aturan |
|---|---|
| U1 | Uang = integer rupiah. `bulatkanRupiah(x)` = pembulatan ke rupiah terdekat, setengah ke atas (`ROUND_HALF_UP`). Dipakai untuk hasil perkalian qty × harga dan persentase. |
| U2 | Kuantitas = 3 desimal, `ROUND_HALF_UP`. `qty_dasar = qty × faktor` (faktor satuan jual baris, 1 untuk satuan dasar; K-091). Stok, reservasi, HPP, laba, setoran konsinyasi memakai `qty_dasar`; harga, subtotal, struk, surat jalan, retur memakai `qty` satuan baris. |
| U3 | Subtotal baris = `bulatkanRupiah(qty × harga_satuan) − diskon_baris − diskon_promo`, minimal 0. |
| U4 | Persen → rupiah: `bulatkanRupiah(dasar × persen ÷ 100)`. Simpan hasil rupiahnya, bukan persennya, di transaksi. |
| U5 | Semua aritmatika qty lewat `packages/shared/src/qty.ts`; semua uang lewat `money.ts`. Tidak ada `number` float untuk qty, tidak ada `parseFloat` untuk uang. |
| U6 | Waktu disimpan UTC; `tanggal_operasional` = tanggal Asia/Jakarta pada saat dokumen dibuat (bukan saat disetujui). Laporan harian dan penomoran memakai `tanggal_operasional`. |

## 2. Ledger stok

Semua pergerakan stok ditulis oleh satu fungsi:

```ts
catatMutasi(tx, {
  idBarang, jenis, kondisi, qtyMasuk | qtyKeluar, hppSatuan, sumber: { idPenerimaanDetail | idPenjualanDetail | ... },
  idPengguna, tanggalOperasional, keterangan,
})
```

| # | Aturan |
|---|---|
| L1 | `catatMutasi` hanya dipanggil di dalam transaksi DB (`tx`). Langkah pertama: `SELECT … FROM persediaan WHERE id_barang = $1 FOR UPDATE`. Baris `persediaan` untuk setiap barang dibuat saat barang dibuat (L10). |
| L2 | Saldo bucket (BAIK = `stok_fisik`, RUSAK = `stok_rusak`) tidak boleh negatif. Pergerakan keluar yang melebihi saldo ditolak `STOK_TIDAK_CUKUP` dengan menyebut nama barang, saldo, dan qty diminta. Ini pagar kedua; pagar pertama adalah pemeriksaan stok tersedia di service pemanggil (R6). |
| L3 | Satu baris `mutasi_persediaan` per bucket per pergerakan. `saldo_setelah` = saldo bucket itu sesudah mutasi. `hpp_setelah` = `hpp_rata2` barang sesudah mutasi. |
| L4 | **HPP rata-rata tertimbang** (K-008), hanya dihitung pada pergerakan **masuk ke bucket BAIK** barang MILIK_SENDIRI: `hpp_baru = bulatkanRupiah((saldo_lama × hpp_lama + qty_masuk × hpp_satuan) ÷ (saldo_lama + qty_masuk))`. Pergerakan keluar tidak mengubah HPP. Saat saldo menjadi 0, `hpp_rata2` dipertahankan (tidak direset ke 0). |
| L5 | `hpp_satuan` per jenis: PENERIMAAN = `harga_modal_dasar`; SALDO_AWAL = input pengguna; RETUR_JUAL dan VOID = `hpp_saat_transaksi` baris penjualan; PENYESUAIAN masuk = `hpp_rata2` saat itu (HPP tidak berubah); PENJUALAN/TUKAR_RETUR/RETUR_PEMASOK/MUSNAH keluar = `hpp_rata2` saat itu (TUKAR_RETUR memakai HPP barang pengganti). |
| L6 | `harga_beli_terakhir` dan `tanggal_beli_terakhir` hanya diperbarui oleh PENERIMAAN jenis PEMBELIAN (nilai `harga_modal_dasar` baris). Bila dasar markup `D` berubah karenanya, berlaku docs/06 H5/H7 (tanda perlu tinjau atau harga otomatis) di transaksi yang sama (K-086). |
| L7 | Barang KONSINYASI: `hpp_rata2` selalu = `harga_titip` (bukan rata-rata). PENERIMAAN KONSINYASI tidak mengubah `harga_beli_terakhir`. Perubahan `harga_titip` di master memperbarui `hpp_rata2` barang itu (dicatat di log). |
| L8 | Bucket RUSAK: M1 hanya jenis PINDAH_KONDISI (dari penyesuaian RUSAK) yang menulis ke bucket RUSAK. Halaman pengelolaan bucket RUSAK (retur pemasok, musnah) dibangun Fase 10. |
| L9 | `hitungUlangCache(idBarang)`: menghitung `stok_fisik`, `stok_rusak`, `hpp_rata2` dari ledger dan membandingkan dengan `persediaan`. Dipakai tes dan perintah `pnpm db:audit` (Fase 4). Selisih apa pun = bug. |
| L10 | Saat barang dibuat: baris `persediaan` dibuat dengan `stok_fisik = 0`, `hpp_rata2 = harga_beli_terakhir = harga_modal_awal` (KONSINYASI: `hpp_rata2 = harga_titip`, `harga_beli_terakhir = 0`). |
| L11 | Dua transaksi paralel pada barang yang sama harus serial (dijamin `FOR UPDATE`). Tes: 20 penjualan paralel masing-masing 1 dari stok 10 → tepat 10 berhasil, 10 gagal `STOK_TIDAK_CUKUP`, saldo akhir 0. |

## 3. Stok tersedia dan reservasi order

| # | Aturan |
|---|---|
| R1 | `stok_tersedia = stok_fisik − stok_dipesan` (generated column). Angka yang dilihat Staf saat mencari barang adalah stok tersedia. |
| R2 | Order DRAFT tidak menahan stok (membatalkannya tidak melepas reservasi apa pun). Order MENUNGGU, DIPROSES, dan DISIMPAN (R11) menahan `qty_dasar` tiap barisnya di `stok_dipesan`. Input order cepat menyimpan isian yang belum dikirim sebagai DRAFT saat halaman ditinggalkan dan membukanya lagi (K-095). |
| R3 | Kirim ke antrean (DRAFT → MENUNGGU): dalam satu transaksi, untuk tiap baris: `FOR UPDATE persediaan`, cek `stok_tersedia ≥ qty_dasar`, tambah `stok_dipesan`. Satu baris gagal → seluruh order gagal, pesan menyebut semua barang yang kurang. Isi `waktu_masuk_antrean`. |
| R4 | Mengubah baris order MENUNGGU atau DISIMPAN (qty, tambah, hapus; pembuat atau pemegang `penjualan.checkout`): hitung selisih `qty_dasar`, terapkan ke `stok_dipesan` dengan pemeriksaan R3 untuk penambahan. Order DIPROSES hanya bisa diubah oleh `id_kasir_proses`. |
| R5 | Batal (MENUNGGU/DIPROSES/DISIMPAN → BATAL): lepas seluruh `stok_dipesan` baris order. `alasan_batal` wajib. Staf hanya boleh membatalkan order buatannya yang DRAFT, MENUNGGU, atau DISIMPAN (`penjualan.order.batal_sendiri`). |
| R6 | Checkout (DIPROSES → SELESAI): dalam satu transaksi per baris: lepas `stok_dipesan`, lalu `catatMutasi(PENJUALAN, keluar qty_dasar)`. Bila `stok_fisik < qty_dasar` (mis. opname menurunkan stok) → gagal, pesan menyebut barang. |
| R7 | **Order basi**: MENUNGGU dengan `waktu_masuk_antrean` lebih tua dari `konfigurasi.batas_umur_order_jam` (default 24). Ditandai di antrean, masuk notifikasi, dan tampil di tab "Stok Tertahan" (per barang: daftar order penahan, qty, umur). Bila `konfigurasi.auto_batal_order_basi = true`, job tiap 15 menit membatalkan order basi dengan `alasan_batal = 'KADALUARSA'` dan mencatat log. |
| R8 | Kunci DIPROSES: kasir lain tidak bisa membuka order yang sedang DIPROSES. Kasir pemegang kunci bisa melepaskannya (kembali MENUNGGU). Admin/Owner bisa memaksa lepas (log). Order DIPROSES lebih lama dari `konfigurasi.batas_kunci_order_menit` (default 30) otomatis kembali MENUNGGU oleh job yang sama dengan R7. |
| R9 | Order PENGANTARAN wajib pelanggan dan alamat kirim (CHECK DB). Order LANGSUNG boleh tanpa pelanggan; `nama_pembeli` opsional untuk label ("Tukang Bp. Joko"). |
| R10 | Pelanggan order PENGANTARAN wajib punya No. HP (barang diantar, pembelinya harus bisa dihubungi); diperiksa saat order dibuat atau diubah. Penjualan pengantaran boleh dibuat langsung di halaman Penjualan Pengantaran tanpa order dari Order Penjualan (K-104). |
| R11 | **[K-122] Order disimpan** (`POST /api/order/:id/simpan`): untuk pembeli yang pesan sekarang dan mengambil/membayar nanti. Dari DRAFT (pembuat; mulai menahan stok dengan pemeriksaan R3), MENUNGGU (pembuat atau `penjualan.checkout`), atau DIPROSES (kasir pemegang kunci). Wajib nama pembeli (atau pelanggan terdaftar), No. HP (`no_hp_pembeli`), dan `tanggal_ambil` antara hari ini dan 14 hari lagi (`MAKS_HARI_SIMPAN_ORDER`); CHECK DB. Order DISIMPAN tidak tampil di papan antrean; daftar urut tanggal ambil. Lewat tanggal ambil: ditandai dan notifikasi `ORDER_DISIMPAN_LEWAT` (pembuat; semua untuk `penjualan.order.lihat_semua`); **tidak** dibatalkan otomatis. Log `ORDER_SIMPAN`. |
| R12 | **[K-122] Order disimpan dilanjutkan:** DISIMPAN → MENUNGGU lewat kirim ke antrean (pembuat atau kasir; antre dari saat itu), atau DISIMPAN → DIPROSES langsung saat kasir memprosesnya (pembeli datang). Stok tetap ditahan; tidak ada pemeriksaan ulang. |
| R13 | **[K-122] Kembali ke draf** (`POST /api/order/:id/draf`): MENUNGGU/DISIMPAN (pembuat atau kasir) atau DIPROSES (pemegang kunci, atau `penjualan.order.lepas_paksa`) → DRAFT. Seluruh reservasi dilepas, baris order tetap, `tanggal_ambil` dikosongkan, draf tetap milik pembuat order. Log `ORDER_KE_DRAF`. |
| R14 | **[K-122] Barang di draf lain** (`GET /api/order/draf-barang`): saat barang ditambahkan di input order cepat, draf lain (siapa pun pembuatnya) yang memuat barang yang sama diperiksa. Bila stok tersedia < qty barang itu di order ini + total di draf lain, muncul peringatan yang menyebut draf (nomor, pembeli, pembuat, qty) dengan pilihan *biarkan*, *hapus lagi dari order ini*, atau *buka draf itu* (hanya draf milik sendiri; isian sekarang disimpan dulu sebagai draf). Barang ditambahkan lebih dulu agar input cepat tidak tertahan pemeriksaan. Peringatan saja: draf tidak menahan stok. |

## 4. Penomoran dokumen

| # | Aturan |
|---|---|
| N1 | Format `PREFIX-YYMMDD-NNN`. `YYMMDD` dari `tanggal_operasional` dokumen. `NNN` mulai 001 tiap hari per prefix; bila melebihi 999 otomatis 4 digit (1000, 1001, …). |
| N2 | Prefix dibaca dari `konfigurasi.prefix_<KODE>` saat penerbitan. Mengubah prefix tidak mengubah nomor yang sudah terbit. |
| N3 | Penerbitan lewat `penomoran.terbitkan(tx, kode, tanggalOperasional)` di transaksi yang sama dengan penyimpanan dokumen: `INSERT INTO penghitung_nomor … ON CONFLICT (prefix, tanggal_kode) DO UPDATE SET nilai_terakhir = penghitung_nomor.nilai_terakhir + 1 RETURNING nilai_terakhir`. Tes: 50 penerbitan paralel → 50 nomor unik berurutan tanpa celah. |
| N4 | Nomor boleh berlubang bila transaksi dibatalkan setelah penerbitan (rollback). Diterima; tidak ada mekanisme "pakai ulang". |
| N5 | Kode master (`BRG`, `PLG`, `PMS`, `USR`, `PRM`) memakai penghitung yang sama dengan `tanggal_kode = '000000'` dan format `PREFIX-NNNNN` (5 digit, tanpa reset). Pengguna boleh mengganti kode barang dengan kode sendiri selama unik. `PRM` = kode promo (K-087). |

## 5. Status dokumen dan transisi

| Dokumen | Status | Transisi yang diizinkan |
|---|---|---|
| order_penjualan | DRAFT, MENUNGGU, DIPROSES, DISIMPAN, SELESAI, BATAL | DRAFT→MENUNGGU (R3); MENUNGGU→DIPROSES (kasir buka); DIPROSES→MENUNGGU (lepas kunci); DIPROSES→SELESAI (checkout); DRAFT/MENUNGGU/DIPROSES→DISIMPAN (R11); DISIMPAN→MENUNGGU/DIPROSES (R12); MENUNGGU/DIPROSES/DISIMPAN→DRAFT (R13); DRAFT/MENUNGGU/DIPROSES/DISIMPAN→BATAL (R5). SELESAI dan BATAL final. |
| penjualan.status_transaksi | SELESAI, VOID_SEBAGIAN, VOID | SELESAI→VOID_SEBAGIAN (void ITEM sebagian); SELESAI/VOID_SEBAGIAN→VOID (semua baris VOID). VOID final. |
| penjualan.status_pembayaran | BELUM_BAYAR, DP, LUNAS | Dihitung ulang (P9) setiap pembayaran, retur, void. |
| penjualan.status_pengambilan (LANGSUNG) | DIAMBIL, BELUM_DIAMBIL | BELUM_DIAMBIL→DIAMBIL (kasir konfirmasi; log). |
| penjualan.status_pengiriman (PENGANTARAN) | BELUM, SEBAGIAN, SELESAI | Dihitung ulang (S4) setiap perubahan surat jalan. |
| surat_jalan | DIPROSES, DIMUAT, DIKIRIM, SELESAI, BATAL | Maju satu langkah: DIPROSES→DIMUAT→DIKIRIM→SELESAI (isi waktu). DIPROSES/DIMUAT→BATAL (alasan). DIKIRIM tidak bisa BATAL. |
| retur_penjualan, void_transaksi | MENUNGGU, DISETUJUI, DITOLAK | MENUNGGU→DISETUJUI / DITOLAK oleh pemegang izin `*.setujui` (docs/04 §6). Final. |
| penyesuaian_stok | DRAFT, SELESAI, BATAL | DRAFT→SELESAI (tulis mutasi); DRAFT→BATAL. Final. |
| shift_kasir | BUKA, DIHITUNG, TUTUP | BUKA→DIHITUNG (hitungan tutup dikirim, K4, K18); DIHITUNG→TUTUP (clerical check). Kompatibilitas: BUKA→TUTUP sekali jalan. TUTUP final di M1 (K7). |
| penerimaan_barang | (tidak ada status) | Tidak bisa dibatalkan; koreksi lewat retur pemasok [M2] atau penyesuaian. |

Transisi di luar tabel → `STATUS_TIDAK_VALID` (409).

## 6. Penjualan

| # | Aturan |
|---|---|
| P1 | Checkout memakai order (DIPROSES) sebagai sumber baris. Kasir juga bisa "checkout langsung": layar kasir membuat order DRAFT→MENUNGGU→DIPROSES→SELESAI dalam satu transaksi (order tetap tersimpan untuk jejak). |
| P2 | Harga baris = `harga_barang.harga_jual` untuk tier yang dipilih saat baris ditambahkan (snapshot). Harga yang dijanjikan di order berlaku saat checkout meski master berubah; kasir dapat menekan "Perbarui harga" per baris (log). |
| P3 | Harga awal baris = tier dasar (`is_default`) untuk semua pembeli; semua baris otomatis memakai tier transaksi bila total nilai belanja mencapai syarat belanja tier itu (docs/06 H8, K-098). Pelanggan dan qty per barang tidak menentukan tier; harga khusus pelanggan, qty, atau barang lewat promo (docs/06 PR2), yang dipotong dari harga tier (PR9). Tier tidak bisa dipilih manual (K-099). Harga manual (`harga_manual = true`, tier null) butuh `penjualan.harga_manual` dan dicatat log dengan harga tier pembanding. |
| P4 | Total: `total_bruto = Σ bulatkanRupiah(qty × harga_satuan)`; `total_diskon = Σ diskon_baris + Σ diskon_promo + diskon_transaksi`; `total_neto = total_bruto − total_diskon + ongkir`, minimal 0. Diskon mengikuti docs/06 §2. |
| P5 | `hpp_saat_transaksi` = `persediaan.hpp_rata2` saat checkout (KONSINYASI: `harga_titip`). Dibaca setelah `FOR UPDATE` di R6. |
| P6 | LANGSUNG tanpa pelanggan (pembeli umum): wajib LUNAS saat checkout. LANGSUNG dengan pelanggan terdata: boleh DP/BELUM_BAYAR dengan `tanggal_jatuh_tempo` (piutang, docs/06 §4). |
| P7 | PENGANTARAN: pelanggan wajib. Pembayaran saat checkout opsional (PENUH / DP / tidak ada). `bayar_saat_terima` bila pelanggan akan membayar ke sopir. `tanggal_jatuh_tempo` default = `tanggal_operasional + pelanggan.term_hari`; bila term 0 dan belum lunas, default +7 hari (bisa diubah kasir). |
| P8 | Pembayaran: `nominal ≤ sisa_tagihan` (lebih → `LIMIT_TERLAMPAUI` dengan pesan "melebihi sisa tagihan"). TUNAI: `uang_diterima ≥ nominal`, `kembalian = uang_diterima − nominal`, wajib `id_shift` milik pengguna yang BUKA (P12). TRANSFER/EDC/QRIS: rekening tujuan wajib **dipilih** dari rekening penerimaan terdaftar (`idRekening`, K13); teks rekening ketik-bebas ditolak, dan cara bayar tanpa rekening terdaftar tidak bisa dipakai **[K-154]**. `referensi` wajib, 4–40 huruf/angka (boleh spasi . / -); uang masuknya dicek kemudian (K14). Beberapa pembayaran per transaksi diperbolehkan (bayar campuran). `jenis`: PENUH bila satu pembayaran melunasi seluruh tagihan; DP bila belum lunas; PELUNASAN bila pembayaran berikutnya. |
| P9 | `tagihan = total_neto − total_void − total_retur`; `dibayar_bersih = total_dibayar − total_refund`. `status_pembayaran`: tagihan = 0 → LUNAS; dibayar_bersih = 0 → BELUM_BAYAR; 0 < dibayar_bersih < tagihan → DP; ≥ tagihan → LUNAS. Dihitung ulang di transaksi yang sama setiap ada pembayaran, retur disetujui, void disetujui. |
| P10 | Nomor: LANGSUNG → prefix `STR`; PENGANTARAN → prefix `INV`. Struk dicetak setelah checkout LANGSUNG; invoice setelah checkout PENGANTARAN; keduanya bisa dicetak ulang (log CETAK_ULANG). |
| P11 | `status_pengambilan` LANGSUNG default DIAMBIL. Kasir memilih BELUM_DIAMBIL bila barang ditinggal di toko; stok tetap terpotong saat checkout (K-026). Daftar "belum diambil" tampil di halaman penjualan langsung; konfirmasi DIAMBIL dicatat log. |
| P12 | Bila `konfigurasi.checkout_wajib_shift = true`: setiap pembayaran TUNAI hanya bisa dicatat oleh pengguna yang punya shift BUKA (Kasir, atau Admin/Owner yang membuka shift). Pembayaran non-tunai oleh Admin/Owner tanpa shift diperbolehkan (`id_shift` null). |
| P13 | Penjualan yang sudah tersimpan tidak pernah diubah barisnya. Salah input → void (V) bila masih shift terbuka, atau retur (T). |
| P14 | Struk memuat: kop (BonsaiUrip, UD. Sumber Urip, alamat, telp), nomor, tanggal-waktu, kasir, baris (nama, qty × harga, diskon, subtotal), total, pembayaran per metode, kembalian, footer. Invoice memuat tambahan: pelanggan, alamat kirim, status bayar, jatuh tempo, sisa tagihan. Surat jalan memuat: nomor SJ, referensi invoice, penerima, alamat, baris (nama, qty kirim, satuan), sopir, kendaraan, kolom tanda tangan penerima. |

## 7. Surat jalan

| # | Aturan |
|---|---|
| S1 | Hanya untuk penjualan PENGANTARAN dengan `status_transaksi ≠ VOID`. **[K-174]** Surat jalan selalu dibuat di dalam rit DIRENCANAKAN (`idPerjalanan` wajib): teks `sopir`/`kendaraan` diisi dari rit sejak dibuat, sehingga tidak ada surat jalan tanpa sopir dan kendaraan. Membagi order (kirim sebagian) dilakukan saat memasukkan ke rit, bukan dengan surat jalan terpisah lebih dulu. |
| S2 | Boleh banyak surat jalan per invoice. Per baris invoice, qty yang masih boleh dikirim = `qty − qty_retur − qty retur MENUNGGU − Σ qty_terpakai` (VOID = 0), dengan `qty_terpakai` per baris surat jalan tidak BATAL = `qty_diterima` bila hasilnya sudah dicatat (S10), selain itu `qty_kirim` **[K-149]**. Pelanggaran → `STATUS_TIDAK_VALID` menyebut baris. |
| S3 | DIPROSES → DIMUAT lewat tombol *Dimuat* (opsional). Ke DIKIRIM **hanya** lewat Berangkat (S9) dan ke SELESAI **hanya** lewat catat hasil (S10) **[K-149, K-150]**. Setiap transisi mengisi kolom waktunya (`waktu_dimuat`, `waktu_dikirim`, `waktu_selesai`) dan log. |
| S4 | `penjualan.status_pengiriman`: SELESAI bila setiap baris invoice sudah diterima penuh (`Σ qty_diterima` surat jalan SELESAI ≥ `qty − qty_retur`; surat jalan SELESAI sebelum K-149 tanpa hasil = `qty_kirim`); BELUM bila tidak ada surat jalan non-BATAL; selain itu SEBAGIAN. |
| S5 | BATAL hanya dari DIPROSES/DIMUAT dengan `alasan_batal`. Surat jalan BATAL tidak dihitung di S2/S4. |
| S6 | Bayar saat terima: uang yang dibawa pulang sopir dicatat kasir sebagai pembayaran PELUNASAN (P8) pada shift kasir yang menerimanya, bukan otomatis saat SJ SELESAI. |
| S7 | Void invoice menggagalkan otomatis semua surat jalannya yang DIPROSES/DIMUAT (alasan "VOID"); bila ada yang DIKIRIM/SELESAI, void ditolak (V1). |
| S8 | **[K-150] Kendaraan dan sopir** adalah data master (`kendaraan`: plat unik, jenis, kapasitas kg opsional; `sopir`: nama unik tanpa beda huruf besar/kecil, No. HP opsional). Tidak dihapus, hanya dinonaktifkan; yang sedang jalan tidak bisa dinonaktifkan. Plat disimpan huruf besar dengan satu spasi (`S 1234 AB`). Kelola: `master.armada.kelola`. |
| S9 | **[K-150, K-174] Berangkat** (`POST /api/perjalanan/:id/berangkat`): rit DIRENCANAKAN dengan ≥ 1 surat jalan DIPROSES/DIMUAT (boleh dari beberapa invoice). Berangkat langsung tanpa rit dihapus (K-174). Dalam satu transaksi: kunci baris kendaraan dan sopir; tolak bila salah satunya masih punya perjalanan JALAN ("sedang jalan sejak … (TRP-…)"; dijaga juga indeks unik parsial); terbitkan nomor `TRP`; semua surat jalan → DIKIRIM dengan `id_perjalanan`, `waktu_dikirim`, `waktu_dimuat` (bila kosong), serta salinan teks `sopir`/`kendaraan` untuk cetakan. Log `PERJALANAN_BERANGKAT`. |
| S10 | **[K-149, K-176] Catat hasil** (`POST /api/surat-jalan/:id/hasil`, surat jalan DIKIRIM, sekali saja): per baris `diterima + kembali + rusak = qty_kirim`, dengan **alasan wajib** untuk kembali (`KIRIM_ULANG`, `KELEBIHAN`, `SALAH_BARANG`, `BATAL_BELI`) dan rusak (`RUSAK_DI_JALAN`, `RUSAK_SAAT_DICEK`). Kembali `KIRIM_ULANG` disimpan sebagai `qty_kembali`; alasan lain disimpan sebagai `qty_ditolak` kondisi BAIK (retur potong tagihan/refund, stok kembali). Rusak yang tagihannya dikurangi menjadi retur terpisah (`id_retur_rusak`). Refund TRANSFER boleh tanpa rekening: retur DISETUJUI mencatat `nominal_refund` dan `status_transfer` MENUNGGU; `POST /api/retur/:id/transfer` (izin `retur.setujui`, rekening + referensi wajib) → SELESAI, log `RETUR_TRANSFER`, notifikasi `REFUND_TRANSFER`. Ketentuan lama (sebelum K-176): Efek: *kembali utuh* tanpa mutasi stok (barang pembeli dititipkan di toko) dan menjadi belum dikirim lagi; *ditolak* dan *rusak, tagihan dikurangi* → satu retur otomatis (alasan menyebut nomor surat jalan; kondisi ditolak dipilih, rusak = RUSAK; POTONG_TAGIHAN bila nilai ≤ sisa tagihan, selain itu REFUND dengan metode wajib); *rusak, dikirim pengganti* → retur TUKAR_BARANG kondisi RUSAK (T5; stok pengganti kurang → ditolak dengan saran kurangi tagihan) dan qty pengganti menjadi belum dikirim. Persetujuan retur mengikuti T3. Surat jalan → SELESAI; perjalanannya SELESAI (isi `waktu_kembali`) bila tidak ada lagi surat jalan DIKIRIM di dalamnya. Log `SURAT_JALAN_HASIL`. |
| S11 | **[K-151]** Rusak di jalan ditanggung toko: barang rusak masuk stok rusak lewat retur (S10); pembeli memilih *dikirim pengganti* atau *tagihan dikurangi*. |
| S13 | **[K-161] Muatan saat berangkat** (docs/13 §3): berat = Σ qty dasar × `berat_kg`; volume = Σ qty dasar × p×l×t (curah: × `volume_m3`), dibanding volume bak × `muatan_faktor_isi_persen`; barang terpanjang dibanding panjang bak. Berat > daya angkut → ditolak. Volume > 100% sampai 115%, atau barang menjulur sampai `muatan_julur_maks_cm` → wajib `alasanMuatan` (≥ 10 huruf, disimpan di perjalanan dan log); lebih dari itu → ditolak. Data kendaraan/barang yang kosong tidak menghalangi (peringatan saja); barang yang belum lengkap bisa diisi massal lewat Excel (*Data Barang › Data muatan Excel*: dicocokkan dengan kode, sel boleh bersatuan g/ton/mm/m/L, kolom yang dihapus dari berkas tidak mengubah data, semua atau tidak sama sekali, log `BARANG_UBAH` per barang + `IMPORT_MUATAN`). Berat dan volume rit disimpan di perjalanan. Muatan rit rencana dihitung ulang setiap kali daftar rit dibaca (bar muatan papan dan dialog Berangkat). |
| S12 | Riwayat perjalanan per kendaraan dan per sopir: nomor, waktu berangkat/kembali, lama, surat jalan dan pembelinya. Surat jalan lama dengan sopir/kendaraan teks bebas tetap tampil apa adanya. |
| S14 | **[K-160] Rit rencana** (papan Logistik › Pengiriman, docs/13 §4). *Rencanakan* (`POST /api/perjalanan/rencana`): kendaraan dan sopir aktif + jadwal; tidak mengunci kendaraan/sopir, jadi kendaraan yang sedang jalan boleh direncanakan untuk rit berikutnya. *Isi* (`POST /:id/isi`): invoice (surat jalan baru di rit ini untuk seluruh sisa yang belum dikirim, aturan S2–S4), atau pindah surat jalan dari rit rencana lain (teks sopir/kendaraan ikut rit baru); yang sudah berangkat ditolak. Sebagian barang: `POST /api/penjualan/:id/surat-jalan` dengan `idPerjalanan` (S1). *Keluarkan* (`POST /keluar`, K-174): surat jalan BATAL dengan alasan "Dikeluarkan dari rit …", barangnya kembali ke Backlog. *Dimuat* (`POST /:id/dimuat`): semua surat jalan DIPROSES di rit → DIMUAT. *Berangkat* (`POST /:id/berangkat`): aturan S9 dan S13 (kunci kendaraan/sopir, muatan, alasan) lalu rit → JALAN. *Batal* (`POST /:id/batal`, alasan ≥ 3 huruf): rit → BATAL dan semua surat jalannya ikut BATAL (K-174), barangnya kembali ke Backlog. Membatalkan surat jalan yang ada di rit rencana melepasnya dari rit. Semua aksi hanya untuk rit DIRENCANAKAN (rit yang sudah berangkat/batal ditolak dengan pesan "muat ulang halaman"). Log `PERJALANAN_RENCANA/ISI/DIMUAT/BATAL`, berangkat `PERJALANAN_BERANGKAT`. Saat berangkat, semua surat jalan rit dicetak atau disimpan PDF sekaligus (pilihan di dialog, bawaan dari Pengaturan › Dokumen & kertas); cetak ulang dari tombol *Cetak* pada grup rit atau kartu Di jalan. |
| S15 | **[K-162] Catatan BBM, servis, pengingat** (docs/13 §5). Catat BBM (`POST /api/armada/bbm`, izin `penjualan.surat_jalan.kelola`): kendaraan aktif, tanggal tidak setelah hari ini, liter > 0 (2 desimal), total rupiah ≥ 0, odometer opsional; sopir opsional; rit opsional harus rit kendaraan itu. Catat servis (`POST /api/armada/servis`, `master.armada.kelola`): jenis ≥ 3 huruf, biaya ≥ 0. Odometer baru harus ≥ odometer terbesar pada/sebelum tanggalnya dan ≤ odometer terkecil sesudahnya (gabungan BBM + servis yang tidak batal; baris kendaraan dikunci). Batal (`POST /api/armada/{bbm|servis}/:id/batal`, `master.armada.kelola`, alasan wajib, sekali). Servis berikutnya = servis terakhir + `servis_tiap_km` dan/atau + `servis_tiap_bulan`; SEGERA bila sisa ≤ 500 km atau ≤ 14 hari, LEWAT bila terlampaui. STNK/KIR: SEGERA ≤ 30 hari, LEWAT setelah tanggal berlaku. Pengingat masuk notifikasi `ARMADA_SURAT`/`ARMADA_SERVIS` untuk `master.armada.kelola`; kendaraan dengan surat habis tetap bisa dipilih tetapi bertanda. Statistik (`GET /api/armada/statistik`, `master.armada.kelola`) sesuai docs/13 §5.3. Tidak mengubah kas shift. Log `ARMADA_BBM_CATAT`, `ARMADA_SERVIS_CATAT`, `ARMADA_CATATAN_BATAL`. |

## 8. Retur penjualan

| # | Aturan |
|---|---|
| T1 | Syarat: penjualan `status_transaksi ∈ {SELESAI, VOID_SEBAGIAN}`; baris `status_item ∈ {NORMAL, RETUR_SEBAGIAN}`; `qty_retur_dasar_baru ≤ qty_dasar − qty_retur_dasar − qty_void_dasar` baris tersebut. Retur atas baris VOID ditolak. |
| T2 | `harga_satuan_efektif = bulatkanRupiah(subtotal_baris ÷ qty)` (per satuan jual; sudah bersih diskon); `nominal_retur = bulatkanRupiah(qty_retur × harga_satuan_efektif)`; `total_retur = Σ nominal_retur`. |
| T3 | Persetujuan mengikuti docs/04 §6: pengaju Admin/Owner otomatis disetujui; Kasir mengajukan, lalu disetujui atasan di tempat (akun atasan diketik di layar kasir), dari akun atasan, atau langsung bila nilainya di dalam batas tanpa persetujuan (K-099). Sebelum DISETUJUI tidak ada efek stok, kas, atau tagihan. Daftar kandidat retur menampilkan per baris: dibeli, sudah diretur, sedang menunggu, sisa; serta retur yang sudah pernah dibuat untuk penjualan itu. Tanpa kata cari, daftar kandidat berisi 20 penjualan terbaru (K-106). |
| T4 | Saat DISETUJUI, per baris detail: kondisi BAIK → `catatMutasi(RETUR_JUAL, masuk qty_retur_dasar, bucket BAIK, hpp = hpp_saat_transaksi)`; kondisi RUSAK/CACAT → `catatMutasi(RETUR_JUAL, masuk, bucket RUSAK, hpp = hpp_saat_transaksi)` (barang masuk bucket rusak, bukan stok jual; halaman bucket rusak Fase 10). Perbarui `penjualan_detail.qty_retur_dasar` dan `status_item` (RETUR bila seluruh qty, selain itu RETUR_SEBAGIAN). |
| T5 | TUKAR_BARANG ("tukar guling" di layar, K-106): hanya barang yang sama dengan qty pengganti = qty retur (`id_barang_pengganti = id_barang`). Efek: mutasi RETUR_JUAL masuk (T4) lalu `catatMutasi(TUKAR_RETUR, keluar qty_pengganti_dasar, hpp = hpp_rata2 saat itu)`. Tidak mengubah `total_retur`/`total_refund` penjualan (nilai netral). Tukar ke barang lain dilakukan dengan REFUND + penjualan baru. Stok pengganti diperiksa sejak pengajuan; bila kurang, tukar sebagian dan ajukan sisanya sebagai retur lain (K-092). |
| T6 | REFUND: `total_retur += total_retur_dok`, `total_refund += total_retur_dok`. TUNAI → `kas_shift(REFUND_RETUR, KELUAR, nominal, id_retur)` pada shift BUKA yang dipilih saat menyetujui (`retur.id_shift` wajib); TRANSFER → `rekening_refund`, `referensi_refund` dicatat, tanpa kas_shift. Bila `total_retur_dok > dibayar_bersih` (uang yang bisa dikembalikan lebih kecil), refund dibatasi ke `dibayar_bersih` dan sisanya otomatis menjadi potong tagihan (dicatat di `catatan`). |
| T7 | POTONG_TAGIHAN: `total_retur += total_retur_dok`; tidak ada uang keluar. Bila `total_retur_dok > tagihan` saat itu, tolak: gunakan REFUND. Layar hanya menawarkan pilihan ini bila penjualan itu masih punya sisa tagihan, dan menampilkan sisanya (K-106). |
| T8 | Setelah T6/T7 hitung ulang `status_pembayaran` (P9). |
| T9 | Retur atas baris barang KONSINYASI dengan kondisi BAIK mengurangi qty yang akan disetor ke pemasok **[M2]** (docs/06 §7). |
| T10 | DITOLAK: `alasan_penolakan` wajib; tidak ada efek apa pun; dokumen tetap tersimpan. DIBATALKAN (K-099): pengajuan MENUNGGU ditarik pengajunya dengan alasan (disimpan di `alasan_penolakan`); tanpa efek; qty-nya bisa diajukan lagi. Retur DISETUJUI tidak bisa diubah atau dibalik. |

## 9. Void

| # | Aturan |
|---|---|
| V1 | Syarat: shift asal penjualan (`penjualan.id_shift`) berstatus BUKA, atau `id_shift` null dan `tanggal_operasional` = hari ini; tidak ada retur berstatus MENUNGGU/DISETUJUI atas penjualan itu; tidak ada surat jalan DIKIRIM/SELESAI; `status_transaksi ≠ VOID`. Di luar itu → `STATUS_TIDAK_VALID` dengan saran "gunakan retur". Baris barang titipan yang sudah disetor ke pemasok (`id_penyelesaian_konsinyasi` terisi) tidak bisa di-void (K-089). |
| V2 | Lingkup ITEM: pilih ≥ 1 baris `status_item = NORMAL`. Lingkup TRANSAKSI: seluruh baris NORMAL (service tetap membuat satu `void_transaksi_detail` per baris). `nominal_void = Σ subtotal baris`. |
| V3 | Persetujuan mengikuti docs/04 §6 (termasuk di tempat dan batas tanpa persetujuan, K-099). Sebelum DISETUJUI tidak ada efek. |
| V4 | Saat DISETUJUI, per detail: `catatMutasi(VOID, masuk qty_dasar, BAIK, hpp = hpp_saat_transaksi)`; `status_item = VOID`. Header: `total_void += nominal_void`; `status_transaksi` = VOID bila semua baris VOID, selain itu VOID_SEBAGIAN. Surat jalan DIPROSES/DIMUAT → BATAL (S7). Order asal tetap SELESAI. |
| V5 | Refund: `nominal_refund = max(0, dibayar_bersih − (tagihan_baru))` dengan `tagihan_baru = total_neto − total_void − total_retur` setelah V4. `total_refund += nominal_refund`. TUNAI → `kas_shift(REFUND_VOID, KELUAR, nominal_refund, id_void)` pada shift BUKA yang dipilih saat menyetujui; TRANSFER → referensi dicatat. Hitung ulang `status_pembayaran` (P9). |
| V6 | Void tidak menghapus pembayaran: baris `pembayaran_penjualan` tetap ada; uang kembali tercatat sebagai `total_refund` dan `kas_shift`. |
| V7 | DITOLAK: `alasan_penolakan` wajib; tidak ada efek. DIBATALKAN (K-099): pengajuan MENUNGGU ditarik pengajunya; tidak ada efek. |

## 10. Shift toko dan clerical check

| # | Aturan |
|---|---|
| K1 | **[K-132] Satu shift toko.** Hanya satu shift yang belum TUTUP (BUKA atau DIHITUNG) untuk seluruh toko; dibuka dan ditutup siapa pun yang memegang `kas.shift.kelola_sendiri`. Pembukaan diserialkan kunci transaksi (`pg_advisory_xact_lock`) sehingga dua pembukaan bersamaan tetap menghasilkan satu shift; pembukaan kedua ditolak `KONFLIK` menyebut nomor shift dan pembukanya. `shift_kasir.id_kasir` = pembuka. Buka shift: `modal_awal` (boleh 0) menurut salah satu dari tiga cara (K15), `tanggal_operasional` = hari ini. Nomor `SHF`. Status: BUKA → DIHITUNG (hitungan tutup dikirim, K18) → TUTUP. |
| K2 | **[K-132]** Pembayaran TUNAI, refund TUNAI, pembayaran pemasok TUNAI, dan kas manual masuk shift toko yang terbuka, siapa pun pencatatnya (P12, T6, V5); setiap catatan menyimpan pencatatnya (`id_pengguna`). Tanpa shift terbuka → `KONFLIK` "Shift toko belum dibuka". |
| K3 | `kas_shift` mencatat kas non-penjualan: KASBON (KELUAR), SETOR_OWNER (KELUAR: uang diambil owner dari laci), TARIK_OWNER (MASUK: owner menambah uang shift), REFUND_RETUR/REFUND_VOID (KELUAR, otomatis dari T6/V5), BAYAR_PEMASOK (KELUAR, otomatis [M2]), MASUK_LAIN/KELUAR_LAIN (manual, `keterangan` wajib). Entri manual butuh `kas.shift.kelola_sendiri`. Label layar: TARIK_OWNER = *Tambah uang shift* (mis. receh habis), SETOR_OWNER = *Setor ke owner*. |
| K4 | **Tutup shift = clerical check, blind count, dua langkah (K-121).** (1) `POST /api/shift/:id/hitung` dengan hasil hitungan (`uangFisik` atau `rincian` per pecahan): hitungan tercatat di `hitung_kas` dan **terkunci**, shift → DIHITUNG; (2) `GET /api/shift/:id/hasil` menampilkan rekonsiliasi, tinjauan, dan bantuan selisih; (3) `POST /api/shift/:id/tutup` dengan `{ keterangan?, uangDitinggal? }` membuat `clerical_check` dari hitungan terakhir dan mengubah shift → TUTUP. `saldo_sistem` (K5) selalu dihitung **di server**. Angka sistem shift yang belum DIHITUNG hanya untuk pemegang `kas.shift.lihat_semua`; kasir baru melihatnya setelah mengirim hitungan. Kompatibilitas: `/tutup` dengan `uangFisik` saat shift masih BUKA menjalankan langkah 1 dan 3 sekaligus. |
| K5 | `saldo_sistem = modal efektif + Σ pembayaran_penjualan TUNAI (nominal) + Σ kas_shift MASUK − Σ kas_shift KELUAR` untuk shift itu, dengan **modal efektif = `modal_awal` + Σ koreksi modal** (K17) dan kas koreksi modal tidak dihitung lagi di kas masuk/keluar. Hanya `nominal` (bukan `uang_diterima`) karena kembalian sudah keluar dari laci. `selisih = uang_fisik − saldo_sistem`; selisih ≠ 0 wajib `keterangan` (CHECK DB); dalam toleransi keterangan diisi otomatis (K20). |
| K6 | Setelah TUTUP: tidak ada pembayaran tunai, kas_shift, atau void yang merujuk shift itu. Semua order yang masih DIPROSES (kasir mana pun) dikembalikan ke MENUNGGU saat tutup (K-132). |
| K7 | Shift TUTUP tidak dibuka kembali di M1. Koreksi dicatat di shift berikutnya lewat kas_shift MASUK_LAIN/KELUAR_LAIN dengan keterangan merujuk nomor clerical. Kolom `dibuka_kembali_oleh` disiapkan untuk M2. |
| K8 | Riwayat clerical (per shift: pembuka, tanggal, modal, tunai, selisih, keterangan) tampil untuk semua pemegang `kas.shift.kelola_sendiri` (K-132). |
| K9 | **[K-109] Shift terlewat mengunci.** Shift BUKA yang `tanggal_operasional`-nya sebelum hari ini disebut *terlewat*. Selama shift toko terlewat, tidak ada yang bisa mencatat penjualan, pembayaran (tunai maupun non-tunai), kas shift, refund, atau pembayaran pemasok tunai, dan shift baru tidak bisa dibuka (K1), sampai shift itu ditutup lewat clerical check (K-132): ditolak `KONFLIK` (409) dengan nomor dan tanggal shiftnya. Sistem tidak pernah menutup shift sendiri. |
| K10 | **[K-109] Jadwal shift.** `konfigurasi.shift_jam_buka` / `shift_jam_tutup` (`HH:mm` Asia/Jakarta; kosong = tanpa jadwal; tutup harus setelah buka) **dibekukan ke shift saat dibuka** (`shift_kasir.jadwal_buka`, `jadwal_tutup`): mengubah pengaturan hanya berlaku untuk shift yang dibuka sesudahnya. Lewat jam tutup shiftnya = peringatan saja; penjualan tetap diterima. |
| K11 | **[K-109] Pemberitahuan.** Shift yang lewat jam tutup (K10) atau terlewat (K9): notifikasi `SHIFT_SAYA_PERLU_DITUTUP` untuk pemiliknya, `SHIFT_PERLU_DITUTUP` (jumlah) untuk pemegang `kas.shift.lihat_semua`, dan pesan Telegram/email ke pemegang izin itu paling banyak sekali sehari per shift (`shift_kasir.diingatkan_pada`). |
| K12 | **[K-111] Rekening toko** (`rekening_toko`): tujuan pembayaran non-tunai, jenis TRANSFER/EDC/QRIS; `nama` = label dari bank + nomor + atas nama; paling banyak satu bawaan AKTIF per jenis; label tidak boleh kembar dalam satu jenis; tidak dihapus, dinonaktifkan. Dikelola `sistem.pengaturan.kelola`; daftar aktif dibaca `kas.rekening.lihat`. |
| K13 | **[K-111] Pembayaran non-tunai memakai rekening toko.** Bila `idRekening` dikirim, rekening itu harus AKTIF dan `jenis` = metode pembayaran (selain itu `VALIDASI` pada `pembayaran.N.rekening`); labelnya disalin ke `pembayaran_penjualan.rekening` dan `id_rekening` disimpan. Tanpa `idRekening`, `rekening` teks tetap diterima (toko yang belum mendaftarkan rekening). Tanpa keduanya ditolak. |
| K14 | **[K-111] Pengecekan uang masuk.** Pembayaran non-tunai disimpan dengan `status_verifikasi = BELUM_DICEK` (tunai: NULL; CHECK DB). Pemegang `kas.nontunai.verifikasi` menandai SUDAH_MASUK atau TIDAK_MASUK (TIDAK_MASUK wajib catatan) dan boleh mengubahnya lagi; tiap perubahan dicatat `PEMBAYARAN_VERIFIKASI` beserta pemeriksa dan waktunya. Penandaan **tidak mengubah** tagihan, status pembayaran, stok, atau kas: TIDAK_MASUK adalah tanda untuk ditindaklanjuti (tagih pembeli, atau koreksi lewat void/retur). Notifikasi `NONTUNAI_BELUM_DICEK` dan `NONTUNAI_TIDAK_MASUK` untuk pemegang izin. |
| K15 | **[K-121] Tiga cara buka shift.** `SAMA_KEMARIN`: modal = `uang_ditinggal` clerical terakhir (toko memakai satu laci; tanpa catatan ditolak `KONFLIK`). `HITUNG`: modal = hitungan (rincian per pecahan atau total; keduanya dikirim dan berbeda → `VALIDASI`), dicatat juga di `hitung_kas` (jenis BUKA). `HITUNG_NANTI`: modal sementara = `uang_ditinggal` terakhir (tanpa catatan: 0), `batas_hitung_buka = waktu_buka + batas_hitung_buka_menit` (K16). `modal_usulan` (uang ditinggal terakhir) disimpan untuk melihat selisih semalam. Dialog web selalu meminta konfirmasi. |
| K16 | **[K-121, K-134] Hitung susulan** (shift BUKA yang dibuka `HITUNG_NANTI` dan belum disimpan): (1) `POST /api/shift/:id/hitung-buka` mencatat hitungan (`hitung_kas` BUKA_SUSULAN, `saldo_sistem` = modal sementara + uang masuk bersih sejak buka) dan menampilkan hasil: laci − uang masuk sejak buka = modal saat buka; selisih semalam = laci − saldo sistem. Hitungan < uang masuk bersih ditolak `KONFLIK`. Hitung ulang sekali, hanya bila selisih di luar toleransi. (2) `POST /api/shift/:id/hitung-buka/simpan` menerapkan hitungan terakhir: selisih ≠ 0 → kas `KOREKSI_MODAL_TAMBAH/KURANG` berketerangan rumus; `hitung_buka_pada` diisi. Uang penjualan dan kembalian sejak buka tidak perlu dipisah saat menghitung. Spanduk dan notifikasi `SHIFT_HITUNG_BUKA` sampai disimpan. Bila sampai tutup belum disimpan, hasil tutup menandainya. |
| K17 | **[K-121] Koreksi modal.** `modal_awal` tidak pernah diubah; koreksi = kas `KOREKSI_MODAL_TAMBAH` (MASUK) / `KOREKSI_MODAL_KURANG` (KELUAR) sebesar beda modal benar − modal efektif, dengan alasan (3–255 karakter) dan nilai lama → baru di keterangan. Hanya saat shift BUKA dan **tidak** selama hitung susulan menunggu (K-134: hasil hitungan itulah modalnya). Sebelum ada transaksi tunai (pembayaran tunai atau kas selain koreksi) pemegang `kas.shift.kelola_sendiri` boleh mengoreksi sendiri; sesudahnya butuh kode sekali pakai `KOREKSI_KAS` (izin `kas.shift.lihat_semua`, terikat shift + modal benar lewat `sidik`) atau dilakukan pemegang `kas.shift.lihat_semua`. Modal benar = modal sekarang → `VALIDASI`. Log `SHIFT_KOREKSI_MODAL`. |
| K18 | **[K-121] Status DIHITUNG.** Setelah hitungan tutup pertama, pencatatan uang baru ke shift itu (penjualan/pembayaran tunai, kas, refund, bayar pemasok tunai) ditolak `KONFLIK` "shift sedang ditutup"; koreksi modal dan hitung susulan juga ditolak. Order dan pembayaran non-tunai tanpa shift tidak terpengaruh. |
| K19 | **[K-121] Hitung ulang** hanya sekali dan hanya bila hitungan pertama berselisih di luar toleransi (selain itu `KONFLIK`); jenis TUTUP_ULANG. Clerical memakai hitungan terakhir; semua hitungan tetap tercatat (`clerical_check.jumlah_hitung`) dan terlihat atasan. |
| K20 | **[K-121] Toleransi selisih** `toleransi_selisih_kas` (rupiah, 0–100.000, bawaan 1.000) dibekukan ke `clerical_check.toleransi`. \|selisih\| ≤ toleransi: keterangan tidak wajib; bila kosong diisi "Selisih receh (dalam toleransi Rp …)". Di luar toleransi: tanpa keterangan ditolak `KONFLIK` (`perluKeterangan`). |
| K21 | **[K-121] Uang ditinggal** (`uangDitinggal`, 0 ≤ nilai ≤ uang fisik; bawaan min(modal efektif, uang fisik)) disimpan di `clerical_check.uang_ditinggal`; sisanya dianggap disetor. Nilai ini menjadi usulan modal shift berikutnya (K15). |
| K22 | **[K-121] Tinjauan dan bantuan selisih** dihitung saat diminta, tidak disimpan: transaksi per jenis, pembayaran per metode, total kembalian, refund, kas, dan linimasa tunai (setiap uang tunai masuk/keluar dengan saldo laci menurut sistem). Bantuan mencocokkan nilai selisih dengan satu pembayaran tunai, kembalian, pembayaran non-tunai (bila lebih), kas manual, atau kelipatan satu pecahan ≥ Rp 10.000 (≤ 5 lembar), paling banyak 8 petunjuk, plus daftar periksa umum. Terlihat oleh kasir setelah hitungan dikirim; atasan selalu. Saran, bukan tuduhan. |
| K23 | **[K-121] Penjelasan atasan** (`POST /api/shift/:id/penjelasan`, `kas.shift.lihat_semua`): hanya shift TUTUP yang berselisih, sekali; mengisi `penjelasan_atasan`, `dijelaskan_oleh`, `dijelaskan_pada`. Angka clerical tidak berubah. Log `SHIFT_PENJELASAN`. |
| K24 | **[K-121, K-133] Order belum selesai saat tutup:** sebelum menghitung, kotak *Tutup shift* menampilkan semua order MENUNGGU dan DIPROSES (pembuat, kasir pemegang) dengan pilihan per order sesuai izin: ke antrean, simpan untuk nanti (R11), ke draf (R13), batalkan (R5). Yang tidak diubah tetap di antrean dengan stok tetap ditahan; yang DIPROSES kembali ke antrean saat tutup (K6). |
| K25 | **[K-132, K-155] Satu shift toko dijamin database:** indeks unik `uq_shift_toko_terbuka` (`where status <> 'TUTUP'`) menolak shift belum tutup kedua, di samping kunci transaksi saat buka. Migrasi 0024 berhenti dengan pesan bila masih ada shift ganda lama (ditutup dulu lewat halaman Shift). Tab Riwayat hanya menampilkan; shift berjalan ditutup di tab Shift toko. |
| K26 | **[K-141] Kembalian tidak diambil:** pembayaran TUNAI dengan `kembalianTidakDiambil` dan kembalian > 0 mencatat kas `KEMBALIAN_DITINGGAL` (MASUK, sebesar kembalian) di transaksi yang sama. Bukan penjualan: omzet, laba, dan tagihan tidak berubah; saldo sistem laci ikut naik sehingga clerical cocok. |
| K27 | **[K-142] Pengajuan retur/void menunggu:** uang refund baru keluar dari laci saat disetujui, di shift yang terbuka saat itu (T6, V5). `GET /api/shift/menunggu` menampilkan pengajuan yang belum diputuskan di kotak *Tutup shift* sebagai informasi, bukan selisih. |
| K28 | **[K-140] Transaksi setelah shift ditutup:** pembeli tunai dilayani dengan membuka shift baru hari itu (*Pakai uang kemarin* = uang ditinggal saat tutup, satu Enter + konfirmasi). Order dan pembayaran non-tunai tetap mengikuti aturan tanpa shift (P12). |

## 11. Penerimaan barang

| # | Aturan |
|---|---|
| E1 | Wajib: pemasok AKTIF, ≥ 1 baris, `qty_masuk > 0`, `harga_modal_masuk ≥ 0`, barang AKTIF. `subtotal = bulatkanRupiah(qty_masuk × harga_modal_masuk)`; `total_faktur = Σ subtotal` (PEMBELIAN) atau 0 (KONSINYASI). |
| E2 | PEMBELIAN: setiap baris → `catatMutasi(PENERIMAAN, masuk qty_dasar, BAIK, hpp = harga_modal_dasar)` (L4 menghitung HPP baru; L6 memperbarui harga beli terakhir). Barang KONSINYASI tidak boleh diterima sebagai PEMBELIAN. |
| E3 | KONSINYASI: hanya barang `kepemilikan = KONSINYASI` dengan `id_pemasok_konsinyasi` = pemasok penerimaan. `harga_modal_masuk` diisi otomatis `harga_titip` (tidak bisa diubah di form). Mutasi PENERIMAAN dengan `hpp = harga_titip`; L7 berlaku. Tidak membentuk hutang. |
| E4 | PEMBELIAN TUNAI: service membuat `pembayaran_pemasok` (PENUH, `nominal = total_faktur`, metode dari form: TRANSFER default atau TUNAI dari shift) → `status_hutang = LUNAS`. TEMPO: `tanggal_jatuh_tempo` wajib, `status_hutang = BELUM_LUNAS` (pembayaran di Fase 10). |
| E5 | Penerimaan tidak bisa diubah atau dibatalkan. Salah qty → penyesuaian KOREKSI dengan alasan; salah barang/harga → retur pemasok [M2] lalu penerimaan baru. |
| E6 | Riwayat penerimaan menampilkan nomor, tanggal, pemasok, jenis, total, status hutang; detail bisa dicetak sebagai bukti terima. |

## 12. Penyesuaian stok

| # | Aturan |
|---|---|
| A1 | Dokumen `ADJ` dibuat DRAFT; baris bisa ditambah/diubah/dihapus selama DRAFT. SELESAI menulis mutasi (A2–A5) dalam satu transaksi; BATAL tidak berefek. |
| A2 | SALDO_AWAL: baris `qty_fisik` (jumlah awal) dan `hpp_satuan` (nilai per satuan) wajib; `qty_selisih = qty_fisik`. Mutasi SALDO_AWAL masuk dengan `hpp_satuan` input; HPP rata-rata dihitung (L4). Boleh dipakai untuk barang yang stoknya sudah > 0 (menambah). Import Excel saldo awal menghasilkan satu dokumen ini. |
| A3 | OPNAME: saat SELESAI, per baris: `FOR UPDATE persediaan`, `qty_sistem = stok_fisik` saat itu (bukan saat draft dibuat), `qty_selisih = qty_fisik − qty_sistem − qty_belum_diambil`, di mana `qty_belum_diambil` = Σ `qty_dasar` baris penjualan LANGSUNG `status_pengambilan = BELUM_DIAMBIL` untuk barang itu (barang terjual yang masih di toko). Selisih > 0 → PENYESUAIAN masuk (hpp = hpp_rata2); < 0 → PENYESUAIAN keluar; 0 → tidak ada mutasi. Lembar hitung (cetak) menampilkan kolom "Sistem", "Belum diambil", "Fisik dihitung". |
| A3a | Lembar opname (K-069): barang yang sudah tersimpan di dokumen OPNAME tidak bisa dihapus dari dokumen. Barang yang tidak dihitung **dikecualikan** dengan alasan wajib (≥ 3 huruf); tercatat siapa dan kapan, tercetak di lembar hitung, tampil di dokumen selesai, dan tidak menghasilkan mutasi. SELESAI ditolak bila ada baris yang belum diisi dan tidak dikecualikan. Log PENYESUAIAN_UBAH mencatat barang yang dikecualikan/disertakan lagi; log PENYESUAIAN_SELESAI mencatat jumlah dihitung, dikecualikan (beserta alasan), dan barang aktif di luar dokumen. |
| A4 | KOREKSI: `qty_selisih` diisi langsung (± ) dengan `alasan` wajib; mutasi PENYESUAIAN. |
| A5 | RUSAK: `qty_selisih` negatif dari bucket BAIK; dua mutasi PINDAH_KONDISI (keluar BAIK, masuk RUSAK, `hpp = hpp_rata2`). MUSNAH [M2 Fase 10]: keluar dari bucket RUSAK (mutasi MUSNAH, `hpp = hpp_rata2`), alasan wajib; `qty_sistem` = stok rusak (K-088). |
| A6 | Pengurangan `stok_fisik` di bawah `stok_dipesan` ditolak (K-048) dengan daftar order penahan. |
| A7 | Penyesuaian tidak mengubah `harga_beli_terakhir`; SALDO_AWAL mengubah `hpp_rata2` lewat L4. |

## 13. Status stok dan notifikasi

| # | Aturan |
|---|---|
| ST1 | Dihitung dari `stok_fisik` dan `stok_minimum` (tidak disimpan): HABIS bila fisik = 0; KRITIS bila 0 < fisik < minimum; PERLU_RESTOCK bila minimum ≤ fisik ≤ minimum × (1 + `ambang_restock_persen`/100); AMAN di atasnya. Barang dengan `stok_minimum = 0` hanya bisa HABIS atau AMAN. |
| ST2 | Notifikasi topbar (per pengguna, sesuai izin): order basi (`penjualan.order.lihat_semua`), persetujuan retur/void menunggu (`*.setujui`), stok KRITIS/HABIS (`persediaan.stok.lihat`), piutang jatuh tempo H-3 dan lewat (`penjualan.piutang.lihat`), hutang jatuh tempo [M2]. Dihitung saat dibuka (query), tanpa tabel notifikasi. |
| ST3 | Dashboard: kartu "Penjualan hari ini" = Σ `total_neto − total_void − total_retur` penjualan `tanggal_operasional` hari ini (butuh `dashboard.omzet`); "Antrean order" = MENUNGGU + DIPROSES; "Pengiriman aktif" = surat jalan DIMUAT + DIKIRIM; "Peringatan stok" = KRITIS + HABIS; grafik 7 hari = penjualan bersih harian. |

## 14. Definisi angka laporan (Fase 7)

| Angka | Definisi |
|---|---|
| Omzet (penjualan kotor) periode | Σ `total_neto` penjualan dengan `status_transaksi ≠ VOID`, dikurangi `total_void` (untuk VOID_SEBAGIAN), berdasarkan `tanggal_operasional` penjualan. |
| Retur periode | Σ `total_retur` dokumen retur DISETUJUI (REFUND + POTONG_TAGIHAN) berdasarkan `tanggal_operasional` retur. TUKAR_BARANG bernilai netral: ditampilkan terpisah, tidak dihitung (K-079). |
| Penjualan bersih | Omzet − Retur. |
| HPP periode | Σ (`hpp_saat_transaksi` × `qty_dasar`) baris penjualan dengan `status_item ≠ VOID` − Σ (`hpp_saat_transaksi` × `qty_retur_dasar`) untuk retur DISETUJUI kondisi BAIK selain TUKAR_BARANG (K-079). Retur RUSAK/CACAT tidak mengurangi HPP (barang hilang nilainya). |
| Gross profit | Penjualan bersih − HPP periode. Margin % = gross profit ÷ penjualan bersih. Baris laporan gross profit per transaksi/barang mengikuti definisi yang sama pada tingkat baris. |
| Nilai persediaan (per tanggal) | Σ `saldo_setelah × hpp_setelah` dari mutasi terakhir tiap barang ≤ tanggal (bucket BAIK), dipisah MILIK_SENDIRI dan KONSINYASI (titipan bukan aset toko; ditampilkan sebagai informasi). Untuk "hari ini" = Σ `stok_fisik × hpp_rata2`. |
| Stok rekap periode | Per barang: stok awal = saldo sebelum periode; masuk = Σ `qty_masuk`; keluar = Σ `qty_keluar`; stok akhir = awal + masuk − keluar (bucket BAIK). Harus sama dengan `saldo_setelah` mutasi terakhir periode. |
| Kartu stok | Semua mutasi satu barang dalam periode, kronologis, dengan nomor dokumen sumber dan keterangan (mis. "Jual ke CV Bangun Makmur", "Terima dari CV Semen Jaya"). |
| Stok minimum | Semua barang AKTIF dengan status ST1 ≠ AMAN, diurutkan KRITIS/HABIS dulu. |
| Piutang | Penjualan `status_transaksi ≠ VOID`, `status_pembayaran ≠ LUNAS`: sisa tagihan, jatuh tempo, umur (hari lewat jatuh tempo). |
| Produk terlaris | Per barang: Σ `qty_dasar` dan Σ `subtotal` baris `status_item ≠ VOID` (tanpa dikurangi retur), peringkat berdasarkan nilai; kontribusi % terhadap total. |
| Detail invoice | Satu penjualan: header, baris, pembayaran, retur, void, surat jalan. |

Semua total laporan dihitung untuk seluruh periode di server (K-033); paginasi hanya memotong baris tampilan.

## 17. Rekomendasi pemesanan ulang (Fase 14, K-113)

Bagian ini sengaja diletakkan sebelum §15 agar dekat dengan status stok; nomornya mengikuti urutan penambahan.

| # | Aturan |
|---|---|
| RO1 | **Terjual bersih** per barang = Σ `qty_keluar` mutasi PENJUALAN dan TUKAR_RETUR − Σ `qty_masuk` mutasi RETUR_JUAL dan VOID, dengan `tanggal_operasional` dalam periode **N hari penuh sampai kemarin** (`saran_pesan_periode_hari`, bawaan 30; penjualan hari ini tidak ikut). Hasil negatif dianggap 0. **Hari amatan** = min(N, hari sejak mutasi pertama barang sampai kemarin); barang tanpa mutasi sebelum hari ini = 0 hari. **Rata-rata jual per hari** = terjual bersih ÷ hari amatan. |
| RO2 | **Stok pengaman** = terjual bersih × `saran_pesan_hari_pengaman` (bawaan 2) ÷ hari amatan. |
| RO3 | **Lama kirim** = `pemasok.lama_kirim_hari` dari pemasok penerimaan PEMBELIAN terakhir barang itu; kosong atau belum pernah dibeli = `saran_pesan_lama_kirim_default` (bawaan 3). **Titik pesan** = terjual × (lama kirim + hari pengaman) ÷ hari amatan. |
| RO4 | **Jarak belanja** = `pemasok.jarak_belanja_hari`, bawaan `saran_pesan_jarak_belanja_default` (7). **Stok target** = terjual × (lama kirim + jarak belanja + hari pengaman) ÷ hari amatan. |
| RO5 | **Saran pesan** = bulat ke atas (stok target − stok tersedia), paling kecil 0, dalam satuan dasar. Bila barang punya kemasan aktif berfaktor > 1, saran juga ditulis dalam kemasan terbesar: bulat ke atas (saran ÷ faktor). **Stok cukup untuk** = stok tersedia (minimal 0) × hari amatan ÷ terjual (hari). Pembagian dilakukan sekali per angka (tidak dari rata-rata yang sudah dibulatkan); semua angka qty tiga desimal. |
| RO6 | **Status**: terjual bersih 0 atau hari amatan 0 → TIDAK_LAKU (tanpa saran); tersedia ≤ titik pesan → PESAN_SEKARANG; tersedia < stok target → SEGERA; selain itu AMAN. Notifikasi "Barang perlu dipesan" (`persediaan.stok.lihat`) = jumlah PESAN_SEKARANG. |
| RO7 | Rekomendasi tidak disimpan: dihitung setiap kali diminta dari ledger dan cache persediaan. Perkiraan biaya = saran × `harga_beli_terakhir` (bila 0: `hpp_rata2`), hanya untuk `master.barang.lihat_hpp`. |
| RO8 | Hanya barang AKTIF milik sendiri; barang titipan (KONSINYASI) tidak disarankan karena diisi penitipnya. |
| RO9 | **Metode dipilih pengguna (K-127)**: **A** rata-rata (RO1–RO6, bawaan), **B** statistik, **C** min–maks, **D** tren. Metode yang tidak bisa dipakai untuk suatu barang (syarat RO10–RO12 tidak terpenuhi) dihitung dengan A dan barisnya diberi catatan alasannya. Notifikasi RO6 dan laporan Rekomendasi Pesan memakai A. |
| RO10 | **B statistik**: penjualan bersih harian (RO1, hari tanpa penjualan = 0) selama hari amatan; syarat hari amatan ≥ 30. σ = simpangan baku sampel harian. **Stok pengaman** = Z × σ × √lama kirim, Z = 1,2816 / 1,6449 / 2,0537 untuk tingkat layanan 90 / 95 / 98 % (bawaan 95). **Titik pesan** = rata × lama kirim + stok pengaman; **stok target** = rata × (lama kirim + jarak belanja) + stok pengaman. Saran dan status seperti RO5–RO6. |
| RO11 | **C min–maks**: syarat `barang.stok_maksimum` terisi dan > 0. **Titik pesan** = `stok_minimum`; **stok target** = `stok_maksimum`; stok pengaman = `stok_minimum`. Tersedia ≤ minimum → PESAN_SEKARANG (juga bila tidak terjual); tidak terjual dan di atas minimum → TIDAK_LAKU; selain itu AMAN. Saran = maksimum − tersedia (RO5). |
| RO12 | **D tren**: pemulusan eksponensial ganda (Holt) pada penjualan harian, α = 0,3, β = 0,1, level awal = rata 7 hari pertama, tren awal 0; syarat hari amatan ≥ 14. Perkiraan hari ke-k = maks(0, level + k × tren). **Stok pengaman** = perkiraan hari ke-1 × hari pengaman; **titik pesan** = Σ perkiraan hari 1..lama kirim + stok pengaman; **stok target** = Σ perkiraan hari 1..(lama kirim + jarak belanja) + stok pengaman. Rata per hari yang ditampilkan = perkiraan hari ke-1. |
| RO13 | **Simpanan sementara**: hasil hitung semua barang per (metode, tingkat layanan, tanggal operasional, parameter pengaturan, id mutasi persediaan terakhir) disimpan di memori server paling lama 10 menit. Penjualan, retur, void, penerimaan, atau penyesuaian baru menambah mutasi sehingga simpanan lama tidak dipakai lagi. Server dimatikan = simpanan hilang. Saringan (pemasok, kategori, cari, status) diterapkan pada simpanan. |

## 15. Konfigurasi tambahan (melengkapi docs/03 §6)

| Kode | Default | Dipakai |
|---|---|---|
| batas_kunci_order_menit | 30 | R8 |
| jatuh_tempo_default_hari | 7 | P7 (bila term pelanggan 0) |
| toleransi_selisih_kas | 1000 | K20 |
| batas_hitung_buka_menit | 60 | K15, K16 |

## 16. Aksi log aktivitas

Nilai `log_aktivitas.aksi` (huruf besar, `<ENTITAS>_<KEJADIAN>`; daftar di `packages/shared/src/log.ts`): LOGIN_SUKSES, LOGIN_GAGAL, PERSETUJUAN_GAGAL, PERSETUJUAN_KODE_KIRIM, AKUN_KONTAK_UBAH (K-102), LOGOUT, PENGGUNA_BUAT/UBAH/NONAKTIF/AKTIFKAN/RESET_PASSWORD/GANTI_PASSWORD/CABUT_SESI (K-054), PENGATURAN_UBAH, BARANG_BUAT/UBAH/NONAKTIF, HARGA_UBAH, PELANGGAN_BUAT/UBAH/NONAKTIF, PEMASOK_BUAT/UBAH/NONAKTIF, IMPORT_BARANG, IMPORT_SALDO_AWAL, IMPORT_MUATAN (K-161), ORDER_BUAT/ANTREAN/UBAH/PROSES/LEPAS/BATAL, ORDER_SIMPAN, ORDER_KE_DRAF (K-122), PENJUALAN_CHECKOUT, PENJUALAN_HARGA_MANUAL, PENJUALAN_DISKON, PENJUALAN_DIAMBIL, PEMBAYARAN_CATAT, SURAT_JALAN_BUAT/STATUS/BATAL, SURAT_JALAN_HASIL, PERJALANAN_BERANGKAT/SELESAI, PERJALANAN_RENCANA/ISI/DIMUAT/BATAL (K-160), ARMADA_BBM_CATAT, ARMADA_SERVIS_CATAT, ARMADA_CATATAN_BATAL (K-162), TAHUN_TUTUP, TAHUN_BUKA, ARSIP_PERIKSA (K-165), DATA_RAPIKAN (K-137), KENDARAAN_BUAT/UBAH/NONAKTIF/AKTIFKAN, SOPIR_BUAT/UBAH/NONAKTIF/AKTIFKAN (K-149, K-150), RETUR_AJUKAN/SETUJUI/TOLAK/BATAL, VOID_AJUKAN/SETUJUI/TOLAK/BATAL, PENERIMAAN_SIMPAN, PENYESUAIAN_BUAT/UBAH/SELESAI/BATAL, SHIFT_BUKA/TUTUP, SHIFT_HITUNG, SHIFT_HITUNG_BUKA, SHIFT_KOREKSI_MODAL, SHIFT_PENJELASAN (K-121), KAS_SHIFT_CATAT, CETAK_ULANG, LAPORAN_EKSPOR, CADANGAN_JALANKAN, CADANGAN_UJI_PULIH (K-084). HARGA_TINJAU_TERAPKAN, HARGA_TINJAU_ABAIKAN (K-086), PROMO_BUAT/UBAH/NONAKTIF/AKTIFKAN, PENJUALAN_PROMO_LEPAS (K-087). M2 menambah HUTANG_BAYAR, RETUR_PEMASOK_SIMPAN, KONSINYASI_SELESAIKAN.

## 18. Arsip tahunan / tutup tahun (K-165)

| # | Aturan |
|---|---|
| AR1 | Tutup tahun hanya untuk tahun < tahun berjalan, oleh pemegang `sistem.cadangan.kelola` (Owner). Ditolak bila di tahun itu masih ada: order DRAFT/MENUNGGU/DIPROSES/DISIMPAN, shift belum TUTUP, penyesuaian DRAFT, retur/void MENUNGGU, surat jalan DIPROSES/DIMUAT/DIKIRIM, rit DIRENCANAKAN/JALAN (daftar penghalang dikembalikan). Piutang yang belum lunas tidak menghalangi (pelunasan dicatat di tahun berjalan). |
| AR2 | Saat ditutup ditulis berkas `arsip-<tahun>-<waktu>.json.gz` di `STORAGE_DIR/arsip` (ikut cadangan restic): semua baris transaksi tahun itu (kepala menurut tanggal operasional/tanggalnya, rinciannya ikut kepala; termasuk pembayaran, surat jalan + hasil, rit, retur, void, persetujuan, penerimaan, penyesuaian, mutasi, retur pemasok, konsinyasi, pembayaran pemasok, shift + kas + hitung kas, clerical, BBM/servis, log) + potret data master (pengguna tanpa hash password). SHA-256, ukuran, dan ringkasan (jumlah baris per tabel, penjualan, void, retur, penerimaan, piutang terbuka) disimpan di `tutup_tahun`. Log `TAHUN_TUTUP`. |
| AR3 | Tahun DITUTUP dikunci: isian bertanggal tahun itu (catatan BBM/servis dan pembatalannya) ditolak "Tahun … sudah ditutup". Dokumen lain selalu bertanggal hari ini, sehingga retur/pelunasan atas nota tahun lalu tetap boleh. Data tidak dihapus atau dipindah dan tetap tampil di semua layar dan laporan. |
| AR4 | Periksa arsip: berkas ada, SHA-256 cocok, dan jumlah baris tiap tabel di berkas = di database (selisih dilaporkan). Log `ARSIP_PERIKSA`. Unduh berkas lewat aplikasi. |
| AR5 | Buka kembali (alasan ≥ 10 huruf, log `TAHUN_BUKA`) → status DIBUKA, kunci dilepas; tutup ulang memeriksa penghalang lagi dan menulis berkas baru (berkas lama tidak dihapus). |

## 21. Order pembelian ke pemasok (K-125)

| # | Aturan |
|---|---|
| PO1 | **Draf** dibuat Admin/Owner (`persediaan.penerimaan.kelola`) untuk satu pemasok aktif: barang aktif milik sendiri (titipan ditolak), tiap barang sekali, qty > 0, harga beli perkiraan per satuan dasar (mengisi harga butuh `master.barang.lihat_hpp`). Draf belum bernomor dan boleh diubah (baris diganti seluruhnya) atau dibatalkan. |
| PO2 | **Kirim ke pemasok**: nomor `PO-yymmdd-nnn` terbit (penomoran), `tanggal_dipesan` = tanggal operasional, status DIPESAN, isi terkunci. Cetak A4 (kertas *dokumen lain*) atau salin teks untuk WhatsApp. |
| PO3 | **Konfirmasi** (DIPESAN/DIKONFIRMASI/SEBAGIAN): `tanggal_janji_kirim` wajib; qty/harga per baris hanya bila pemasok mengubah, disimpan di `qty_konfirmasi`/`harga_konfirmasi` (angka pesanan tetap). Qty konfirmasi tidak boleh di bawah yang sudah diterima. Qty/harga **berlaku** = konfirmasi bila ada, selain itu pesanan. |
| PO4 | **Uang muka** (DIPESAN/DIKONFIRMASI/SEBAGIAN): `pembayaran_pemasok` ber-`id_order_pembelian` (nomor PBP); TUNAI wajib shift terbuka dan tercatat kas BAYAR_PEMASOK; TRANSFER wajib rekening. |
| PO5 | **Penerimaan dari PO**: hanya jenis PEMBELIAN, pemasok sama, PO berstatus DIPESAN/DIKONFIRMASI/SEBAGIAN (dikunci FOR UPDATE). Baris yang menunjuk baris PO menambah cache `qty_diterima`; baris tanpa PO boleh ditambahkan. Semua baris PO sudah diterima ≥ qty berlaku → SELESAI, selain itu SEBAGIAN. Sisa uang muka dipakai otomatis (uang muka terlama dulu) sebagai pembayaran faktur ini: TEMPO → `total_dibayar` = terpakai (status SEBAGIAN/LUNAS); TUNAI → yang dibayar saat itu = faktur − terpakai. Pemakaian tercatat di `alokasi_uang_muka` (DIPAKAI). |
| PO6 | **Batal** hanya bila belum ada penerimaan (DRAF/DIPESAN/DIKONFIRMASI); **Tutup sisa** hanya SEBAGIAN. Alasan wajib. Sisa uang muka > 0 wajib dicatat dikembalikan pemasok (`alokasi_uang_muka` DIKEMBALIKAN, metode TUNAI → kas MASUK_LAIN di shift terbuka, atau TRANSFER). |
| PO7 | **Saran pesan**: qty berlaku − diterima dari PO berjalan (DIPESAN/DIKONFIRMASI/SEBAGIAN) = *sudah dipesan*; posisi stok untuk status dan saran = tersedia + sudah dipesan; *cukup berapa hari* tetap dari stok tersedia. Tombol *Buat order pembelian* per pemasok membuat draf berisi barang dengan saran > 0. |
| PO8 | **Lama kirim aktual** per pemasok = rata-rata (tanggal penerimaan pertama − `tanggal_dipesan`) dari PO yang sudah menerima barang, dibulatkan ke hari; dipakai saran pesan bila sudah ≥ 3 PO (menggantikan isian Data Pemasok, ditandai "aktual"). |
| PO9 | **Notifikasi** PO_TERLAMBAT (`persediaan.penerimaan.kelola`): PO berjalan yang lewat tanggal janji kirim. Log: PO_BUAT, PO_UBAH, PO_KIRIM, PO_KONFIRMASI, PO_UANG_MUKA, PO_TUTUP, PO_BATAL. Stok tidak berubah oleh PO; hutang tetap lahir dari penerimaan. |

## 20. Hasil Penjualan (K-126)

| # | Aturan |
|---|---|
| HP1 | Halaman *Transaksi › Hasil Penjualan* (izin `laporan.penjualan`; Kasir, Admin, Owner) menampilkan satu periode (paling panjang 366 hari) menurut tanggal operasional. Definisi omzet, retur, penjualan bersih, dan void sama dengan Laporan Penjualan per Periode (§14); laba kotor sama dengan Laporan Laba Kotor dan hanya dikirim untuk `laporan.laba`. |
| HP2 | **Periode lalu** = jumlah hari sama tepat sebelum tanggal awal; persen perubahan dihitung layar dari angka server (tampilan saja). Rata-rata per transaksi = omzet ÷ jumlah transaksi, dibulatkan ke rupiah. |
| HP3 | **Barang terlaris** = Laporan Produk Terlaris (Σ subtotal baris bukan VOID); tampil 20 teratas. **Kelas ABC** menurut kumulatif nilai sebelum barang itu: < 80 % = A, < 95 % = B, sisanya C. |
| HP4 | **Per kasir** = `penjualan.id_kasir`; **per jam** = jam waktu toko dari `penjualan.tanggal`; **per hari** = hari ISO dari tanggal operasional; transaksi VOID penuh tidak ikut. **Uang masuk per cara bayar** = Σ `pembayaran_penjualan.nominal` menurut tanggal pembayaran (termasuk pelunasan piutang transaksi lama). |
| HP5 | **Promo** = Laporan Promo (Σ diskon promo, transaksi berpromo, 5 promo dengan potongan terbesar). **Retur** = dokumen retur DISETUJUI pada periode. |

## 19. Data bersih (K-137)

| # | Aturan |
|---|---|
| DB1 | No. HP (pelanggan, pemasok, order disimpan, sopir, pengguna) disimpan format internasional `+<kode negara><nomor>` tanpa spasi. Isian dirapikan: spasi/strip/kurung dibuang; `0` di depan diganti kode negara (bawaan +62); `62…` diberi `+`; `00` = awalan internasional. Sah bila 8–15 angka termasuk kode negara dan tidak `+620…`. Form: kode negara dipilih + nomor tanpa 0 (0 dibuang otomatis dengan pemberitahuan). |
| DB2 | Nama pelanggan, pemasok, barang: spasi di tepi dan spasi ganda dirapikan. |
| DB3 | Cegah data ganda: menambah, atau mengubah nama/No. HP, pelanggan/pemasok/barang ditolak 409 bila ada data lain (aktif atau nonaktif) dengan **kunci nama** sama (huruf kecil, tanpa awalan Toko/Tk/CV/PT/UD/Pak/Bapak/Bpk/Bu/Ibu/Sdr/Mas/Mbak untuk pelanggan/pemasok, hanya huruf dan angka) atau No. HP sama (pelanggan/pemasok); untuk barang hanya sesama kepemilikan dan pemasok penitip yang sama (versi titipan K-094 boleh bernama sama). Jawaban memuat daftar data mirip (maks. 5). Pengguna boleh menegaskan data berbeda (`abaikanMirip`). Import Excel barang tidak memakai aturan ini (kode yang sudah ada dilewati). |
| DB4 | Pemeriksaan data (`sistem.pengaturan.kelola`): kelompok data lama yang mirip (nama/No. HP) dan format salah (No. HP bukan format internasional, nama berspasi berlebih). *Rapikan No. HP* mengubah semua No. HP pelanggan/pemasok/sopir/pengguna yang bisa dirapikan otomatis dalam satu transaksi, melaporkan yang harus diperbaiki manual; log `DATA_RAPIKAN`. Nomor HP pembeli di order lama (tabel transaksi) tidak diubah. |

## Riwayat

- 2026-09-19 — v1.
- 2026-09-30 — §16: aksi log PENGGUNA_AKTIFKAN, PENGGUNA_GANTI_PASSWORD, PENGGUNA_CABUT_SESI (K-054).
- 2026-10-01 — §16: aksi log PENYESUAIAN_UBAH (K-067).
- 2026-10-02 — §12 A3a: pengecualian barang dari lembar opname dengan alasan (K-069, keputusan pemilik).
- 2026-10-02 — Fase 5: tafsiran R8 (izin `penjualan.order.lepas_paksa`), P8 (jenis pembayaran campuran), P12
  (non-tunai tanpa shift hanya Admin/Owner) dicatat di K-070–K-072; aturan tidak berubah.
- 2026-10-03 — Fase 6: tafsiran shift/kas (K-075), nominal void & refund (K-076), nilai & penyelesaian retur
  (K-077); aturan tidak berubah.
- 2026-10-04 — §14: retur periode dan HPP retur tidak mencakup tukar barang (netral); tafsiran angka laporan
  lain dan format dokumen laporan di K-078–K-079.
- 2026-10-04 — §16: aksi log CADANGAN_JALANKAN, CADANGAN_UJI_PULIH (K-084).
- 2026-10-04 — L6 merujuk H5/H7; §16: aksi log HARGA_TINJAU_TERAPKAN, HARGA_TINJAU_ABAIKAN (K-086).
- 2026-10-04 — N5 kode promo `PRM`; §16 aksi log promo (K-087).
- 2026-10-07 — A5 MUSNAH diaktifkan (Fase 10, K-088).
- 2026-10-07 — V1: baris titipan yang sudah disetor tidak bisa di-void (K-089).
- 2026-10-07 — U2: faktor satuan jual (K-091).
- 2026-10-08 — T5: stok pengganti tukar diperiksa saat pengajuan (K-092).
- 2026-10-10 — P3: tier transaksi menurut total nilai belanja; promo dipotong dari harga tier (K-098).
- 2026-10-10 — P3 tier tidak bisa dipilih; T3, T10, V3, V7 persetujuan di tempat, batas tanpa persetujuan, status DIBATALKAN; log RETUR_BATAL, VOID_BATAL, PERSETUJUAN_GAGAL (K-099).
- 2026-10-11 — R10 pelanggan pengantaran wajib No. HP, pengantaran tanpa order (K-104); log PERSETUJUAN_KODE_KIRIM, AKUN_KONTAK_UBAH (K-102).
- 2026-10-12 — §10 K9–K11 shift terlewat, jadwal, pemberitahuan (K-109); K12–K14 rekening toko dan pengecekan uang masuk, P8 metode QRIS (K-111); T3/T5/T7 tampilan retur (K-106). Nilai `log_aktivitas.aksi` baru: REKENING_BUAT, REKENING_UBAH, REKENING_NONAKTIF, REKENING_AKTIFKAN, PEMBAYARAN_VERIFIKASI.
- 2026-10-17 — §17 rekomendasi pemesanan ulang RO1–RO8 (K-113).
- 2026-10-18 — §10 K1, K4, K5 diperbarui dan K15–K24 shift tiga cara buka, hitung susulan, koreksi modal, tutup dua langkah, toleransi, uang ditinggal, tinjauan, penjelasan atasan (K-121); §15 `toleransi_selisih_kas`, `batas_hitung_buka_menit`; §16 aksi log SHIFT_HITUNG, SHIFT_HITUNG_BUKA, SHIFT_KOREKSI_MODAL, SHIFT_PENJELASAN.
- 2026-10-18 — §3 R2, R4, R5 diperbarui dan R11–R14 order disimpan, kembali ke draf, barang di draf lain; §5 status DISIMPAN dan shift DIHITUNG; K24 pilihan order saat tutup shift; §16 aksi log ORDER_SIMPAN, ORDER_KE_DRAF (K-122).
- 2026-10-18 — §10 satu shift toko: K1, K2, K3 (label), K6, K8, K9, K16 (hitung susulan dua langkah), K17, K24 diperbarui; K25 shift ganda, K26 kembalian tidak diambil, K27 retur/void menunggu, K28 transaksi setelah tutup (K-132–K-134, K-140–K-142).
- 2026-10-23 — S2–S4 disesuaikan; S8–S12 kendaraan, sopir, perjalanan, hasil pengantaran per barang (K-149–K-151).
- 2026-10-24 — P8 rekening penerimaan wajib dipilih dan No. referensi wajib (K-154); K25 satu shift toko dijamin indeks unik (K-155).
- 2026-10-24 — S13 muatan saat berangkat (K-161).
- 2026-10-24 — S14 rit rencana dan papan Pengiriman (K-160).
- 2026-10-28 — S13: atribut dimensi ↔ data muatan diselaraskan saat barang disimpan, beda ditolak (K-169); notifikasi barang kirim tanpa data muatan (K-170).
- 2026-10-28 — S10: alasan per barang, kembali utuh selain kirim ulang mengurangi tagihan, retur rusak terpisah, tugas refund transfer (K-176).
- 2026-10-26 — S1, S9, S13, S14: surat jalan hanya di dalam rit; keluar/batal rit membatalkan surat jalan; cetak semua surat jalan saat berangkat (K-174).
- 2026-10-24 — S15 catatan BBM/servis, pengingat, statistik armada (K-162).
- 2026-10-24 — §18 arsip tahunan / tutup tahun AR1–AR5 (K-165).
- 2026-10-24 — §19 data bersih DB1–DB4 (K-137).
- 2026-10-24 — S13: isi massal data muatan lewat Excel (K-161).
