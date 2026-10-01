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
| U2 | Kuantitas = 3 desimal, `ROUND_HALF_UP`. `qty_dasar = qty × faktor` (M1: faktor = 1). |
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
| L6 | `harga_beli_terakhir` dan `tanggal_beli_terakhir` hanya diperbarui oleh PENERIMAAN jenis PEMBELIAN (nilai `harga_modal_dasar` baris). Bila nilainya berubah, `barang.perlu_tinjau_harga = true` (docs/06 H5). |
| L7 | Barang KONSINYASI: `hpp_rata2` selalu = `harga_titip` (bukan rata-rata). PENERIMAAN KONSINYASI tidak mengubah `harga_beli_terakhir`. Perubahan `harga_titip` di master memperbarui `hpp_rata2` barang itu (dicatat di log). |
| L8 | Bucket RUSAK: M1 hanya jenis PINDAH_KONDISI (dari penyesuaian RUSAK) yang menulis ke bucket RUSAK. Halaman pengelolaan bucket RUSAK (retur pemasok, musnah) dibangun Fase 10. |
| L9 | `hitungUlangCache(idBarang)`: menghitung `stok_fisik`, `stok_rusak`, `hpp_rata2` dari ledger dan membandingkan dengan `persediaan`. Dipakai tes dan perintah `pnpm db:audit` (Fase 4). Selisih apa pun = bug. |
| L10 | Saat barang dibuat: baris `persediaan` dibuat dengan `stok_fisik = 0`, `hpp_rata2 = harga_beli_terakhir = harga_modal_awal` (KONSINYASI: `hpp_rata2 = harga_titip`, `harga_beli_terakhir = 0`). |
| L11 | Dua transaksi paralel pada barang yang sama harus serial (dijamin `FOR UPDATE`). Tes: 20 penjualan paralel masing-masing 1 dari stok 10 → tepat 10 berhasil, 10 gagal `STOK_TIDAK_CUKUP`, saldo akhir 0. |

## 3. Stok tersedia dan reservasi order

| # | Aturan |
|---|---|
| R1 | `stok_tersedia = stok_fisik − stok_dipesan` (generated column). Angka yang dilihat Staf saat mencari barang adalah stok tersedia. |
| R2 | Order DRAFT tidak menahan stok. Order MENUNGGU dan DIPROSES menahan `qty_dasar` tiap barisnya di `stok_dipesan`. |
| R3 | Kirim ke antrean (DRAFT → MENUNGGU): dalam satu transaksi, untuk tiap baris: `FOR UPDATE persediaan`, cek `stok_tersedia ≥ qty_dasar`, tambah `stok_dipesan`. Satu baris gagal → seluruh order gagal, pesan menyebut semua barang yang kurang. Isi `waktu_masuk_antrean`. |
| R4 | Mengubah baris order MENUNGGU (qty, tambah, hapus): hitung selisih `qty_dasar`, terapkan ke `stok_dipesan` dengan pemeriksaan R3 untuk penambahan. Order DIPROSES hanya bisa diubah oleh `id_kasir_proses`. |
| R5 | Batal (MENUNGGU/DIPROSES → BATAL): lepas seluruh `stok_dipesan` baris order. `alasan_batal` wajib. Staf hanya boleh membatalkan order buatannya yang MENUNGGU (`penjualan.order.batal_sendiri`). |
| R6 | Checkout (DIPROSES → SELESAI): dalam satu transaksi per baris: lepas `stok_dipesan`, lalu `catatMutasi(PENJUALAN, keluar qty_dasar)`. Bila `stok_fisik < qty_dasar` (mis. opname menurunkan stok) → gagal, pesan menyebut barang. |
| R7 | **Order basi**: MENUNGGU dengan `waktu_masuk_antrean` lebih tua dari `konfigurasi.batas_umur_order_jam` (default 24). Ditandai di antrean, masuk notifikasi, dan tampil di tab "Stok Tertahan" (per barang: daftar order penahan, qty, umur). Bila `konfigurasi.auto_batal_order_basi = true`, job tiap 15 menit membatalkan order basi dengan `alasan_batal = 'KADALUARSA'` dan mencatat log. |
| R8 | Kunci DIPROSES: kasir lain tidak bisa membuka order yang sedang DIPROSES. Kasir pemegang kunci bisa melepaskannya (kembali MENUNGGU). Admin/Owner bisa memaksa lepas (log). Order DIPROSES lebih lama dari `konfigurasi.batas_kunci_order_menit` (default 30) otomatis kembali MENUNGGU oleh job yang sama dengan R7. |
| R9 | Order PENGANTARAN wajib pelanggan dan alamat kirim (CHECK DB). Order LANGSUNG boleh tanpa pelanggan; `nama_pembeli` opsional untuk label ("Tukang Bp. Joko"). |

## 4. Penomoran dokumen

| # | Aturan |
|---|---|
| N1 | Format `PREFIX-YYMMDD-NNN`. `YYMMDD` dari `tanggal_operasional` dokumen. `NNN` mulai 001 tiap hari per prefix; bila melebihi 999 otomatis 4 digit (1000, 1001, …). |
| N2 | Prefix dibaca dari `konfigurasi.prefix_<KODE>` saat penerbitan. Mengubah prefix tidak mengubah nomor yang sudah terbit. |
| N3 | Penerbitan lewat `penomoran.terbitkan(tx, kode, tanggalOperasional)` di transaksi yang sama dengan penyimpanan dokumen: `INSERT INTO penghitung_nomor … ON CONFLICT (prefix, tanggal_kode) DO UPDATE SET nilai_terakhir = penghitung_nomor.nilai_terakhir + 1 RETURNING nilai_terakhir`. Tes: 50 penerbitan paralel → 50 nomor unik berurutan tanpa celah. |
| N4 | Nomor boleh berlubang bila transaksi dibatalkan setelah penerbitan (rollback). Diterima; tidak ada mekanisme "pakai ulang". |
| N5 | Kode master (`BRG`, `PLG`, `PMS`, `USR`) memakai penghitung yang sama dengan `tanggal_kode = '000000'` dan format `PREFIX-NNNNN` (5 digit, tanpa reset). Pengguna boleh mengganti kode barang dengan kode sendiri selama unik. |

## 5. Status dokumen dan transisi

| Dokumen | Status | Transisi yang diizinkan |
|---|---|---|
| order_penjualan | DRAFT, MENUNGGU, DIPROSES, SELESAI, BATAL | DRAFT→MENUNGGU (R3); MENUNGGU→DIPROSES (kasir buka); DIPROSES→MENUNGGU (lepas kunci); DIPROSES→SELESAI (checkout); DRAFT/MENUNGGU/DIPROSES→BATAL (R5). SELESAI dan BATAL final. |
| penjualan.status_transaksi | SELESAI, VOID_SEBAGIAN, VOID | SELESAI→VOID_SEBAGIAN (void ITEM sebagian); SELESAI/VOID_SEBAGIAN→VOID (semua baris VOID). VOID final. |
| penjualan.status_pembayaran | BELUM_BAYAR, DP, LUNAS | Dihitung ulang (P9) setiap pembayaran, retur, void. |
| penjualan.status_pengambilan (LANGSUNG) | DIAMBIL, BELUM_DIAMBIL | BELUM_DIAMBIL→DIAMBIL (kasir konfirmasi; log). |
| penjualan.status_pengiriman (PENGANTARAN) | BELUM, SEBAGIAN, SELESAI | Dihitung ulang (S4) setiap perubahan surat jalan. |
| surat_jalan | DIPROSES, DIMUAT, DIKIRIM, SELESAI, BATAL | Maju satu langkah: DIPROSES→DIMUAT→DIKIRIM→SELESAI (isi waktu). DIPROSES/DIMUAT→BATAL (alasan). DIKIRIM tidak bisa BATAL. |
| retur_penjualan, void_transaksi | MENUNGGU, DISETUJUI, DITOLAK | MENUNGGU→DISETUJUI / DITOLAK oleh pemegang izin `*.setujui` (docs/04 §6). Final. |
| penyesuaian_stok | DRAFT, SELESAI, BATAL | DRAFT→SELESAI (tulis mutasi); DRAFT→BATAL. Final. |
| shift_kasir | BUKA, TUTUP | BUKA→TUTUP lewat clerical check (K4). TUTUP final di M1 (K7). |
| penerimaan_barang | (tidak ada status) | Tidak bisa dibatalkan; koreksi lewat retur pemasok [M2] atau penyesuaian. |

Transisi di luar tabel → `STATUS_TIDAK_VALID` (409).

## 6. Penjualan

| # | Aturan |
|---|---|
| P1 | Checkout memakai order (DIPROSES) sebagai sumber baris. Kasir juga bisa "checkout langsung": layar kasir membuat order DRAFT→MENUNGGU→DIPROSES→SELESAI dalam satu transaksi (order tetap tersimpan untuk jejak). |
| P2 | Harga baris = `harga_barang.harga_jual` untuk tier yang dipilih saat baris ditambahkan (snapshot). Harga yang dijanjikan di order berlaku saat checkout meski master berubah; kasir dapat menekan "Perbarui harga" per baris (log). |
| P3 | Tier baris: default = `pelanggan.id_tingkat_harga` bila pelanggan dipilih, selain itu tier `is_default`. Mengganti tier butuh `penjualan.tier.ubah`. Harga manual (`harga_manual = true`, tier null) butuh `penjualan.harga_manual` dan dicatat log dengan harga tier pembanding. |
| P4 | Total: `total_bruto = Σ bulatkanRupiah(qty × harga_satuan)`; `total_diskon = Σ diskon_baris + Σ diskon_promo + diskon_transaksi`; `total_neto = total_bruto − total_diskon + ongkir`, minimal 0. Diskon mengikuti docs/06 §2. |
| P5 | `hpp_saat_transaksi` = `persediaan.hpp_rata2` saat checkout (KONSINYASI: `harga_titip`). Dibaca setelah `FOR UPDATE` di R6. |
| P6 | LANGSUNG tanpa pelanggan (pembeli umum): wajib LUNAS saat checkout. LANGSUNG dengan pelanggan terdata: boleh DP/BELUM_BAYAR dengan `tanggal_jatuh_tempo` (piutang, docs/06 §4). |
| P7 | PENGANTARAN: pelanggan wajib. Pembayaran saat checkout opsional (PENUH / DP / tidak ada). `bayar_saat_terima` bila pelanggan akan membayar ke sopir. `tanggal_jatuh_tempo` default = `tanggal_operasional + pelanggan.term_hari`; bila term 0 dan belum lunas, default +7 hari (bisa diubah kasir). |
| P8 | Pembayaran: `nominal ≤ sisa_tagihan` (lebih → `LIMIT_TERLAMPAUI` dengan pesan "melebihi sisa tagihan"). TUNAI: `uang_diterima ≥ nominal`, `kembalian = uang_diterima − nominal`, wajib `id_shift` milik pengguna yang BUKA (P12). TRANSFER/EDC: `rekening` wajib, `referensi` opsional. Beberapa pembayaran per transaksi diperbolehkan (bayar campuran). `jenis`: PENUH bila satu pembayaran melunasi seluruh tagihan; DP bila belum lunas; PELUNASAN bila pembayaran berikutnya. |
| P9 | `tagihan = total_neto − total_void − total_retur`; `dibayar_bersih = total_dibayar − total_refund`. `status_pembayaran`: tagihan = 0 → LUNAS; dibayar_bersih = 0 → BELUM_BAYAR; 0 < dibayar_bersih < tagihan → DP; ≥ tagihan → LUNAS. Dihitung ulang di transaksi yang sama setiap ada pembayaran, retur disetujui, void disetujui. |
| P10 | Nomor: LANGSUNG → prefix `STR`; PENGANTARAN → prefix `INV`. Struk dicetak setelah checkout LANGSUNG; invoice setelah checkout PENGANTARAN; keduanya bisa dicetak ulang (log CETAK_ULANG). |
| P11 | `status_pengambilan` LANGSUNG default DIAMBIL. Kasir memilih BELUM_DIAMBIL bila barang ditinggal di toko; stok tetap terpotong saat checkout (K-026). Daftar "belum diambil" tampil di halaman penjualan langsung; konfirmasi DIAMBIL dicatat log. |
| P12 | Bila `konfigurasi.checkout_wajib_shift = true`: setiap pembayaran TUNAI hanya bisa dicatat oleh pengguna yang punya shift BUKA (Kasir, atau Admin/Owner yang membuka shift). Pembayaran non-tunai oleh Admin/Owner tanpa shift diperbolehkan (`id_shift` null). |
| P13 | Penjualan yang sudah tersimpan tidak pernah diubah barisnya. Salah input → void (V) bila masih shift terbuka, atau retur (T). |
| P14 | Struk memuat: kop (BonsaiUrip, UD. Sumber Urip, alamat, telp), nomor, tanggal-waktu, kasir, baris (nama, qty × harga, diskon, subtotal), total, pembayaran per metode, kembalian, footer. Invoice memuat tambahan: pelanggan, alamat kirim, status bayar, jatuh tempo, sisa tagihan. Surat jalan memuat: nomor SJ, referensi invoice, penerima, alamat, baris (nama, qty kirim, satuan), sopir, kendaraan, kolom tanda tangan penerima. |

## 7. Surat jalan

| # | Aturan |
|---|---|
| S1 | Hanya untuk penjualan PENGANTARAN dengan `status_transaksi ≠ VOID`. |
| S2 | Boleh banyak surat jalan per invoice. Per baris invoice: `Σ qty_kirim` (surat jalan tidak BATAL) `≤ qty − qty_void − qty_retur`. Pelanggaran → `STATUS_TIDAK_VALID` menyebut baris. |
| S3 | Ke DIKIRIM wajib `sopir` terisi. Setiap transisi mengisi kolom waktunya (`waktu_dimuat`, `waktu_dikirim`, `waktu_selesai`) dan log. |
| S4 | `penjualan.status_pengiriman`: SELESAI bila setiap baris invoice sudah terkirim penuh oleh surat jalan berstatus SELESAI; BELUM bila tidak ada surat jalan non-BATAL; selain itu SEBAGIAN. |
| S5 | BATAL hanya dari DIPROSES/DIMUAT dengan `alasan_batal`. Surat jalan BATAL tidak dihitung di S2/S4. |
| S6 | Bayar saat terima: uang yang dibawa pulang sopir dicatat kasir sebagai pembayaran PELUNASAN (P8) pada shift kasir yang menerimanya, bukan otomatis saat SJ SELESAI. |
| S7 | Void invoice menggagalkan otomatis semua surat jalannya yang DIPROSES/DIMUAT (alasan "VOID"); bila ada yang DIKIRIM/SELESAI, void ditolak (V1). |

## 8. Retur penjualan

| # | Aturan |
|---|---|
| T1 | Syarat: penjualan `status_transaksi ∈ {SELESAI, VOID_SEBAGIAN}`; baris `status_item ∈ {NORMAL, RETUR_SEBAGIAN}`; `qty_retur_dasar_baru ≤ qty_dasar − qty_retur_dasar − qty_void_dasar` baris tersebut. Retur atas baris VOID ditolak. |
| T2 | `harga_satuan_efektif = bulatkanRupiah(subtotal_baris ÷ qty)` (per satuan jual; sudah bersih diskon); `nominal_retur = bulatkanRupiah(qty_retur × harga_satuan_efektif)`; `total_retur = Σ nominal_retur`. |
| T3 | Persetujuan mengikuti docs/04 §6 (Kasir mengajukan; Admin/Owner menyetujui dari akun sendiri; pengaju Admin/Owner otomatis disetujui). Sebelum DISETUJUI tidak ada efek stok, kas, atau tagihan. |
| T4 | Saat DISETUJUI, per baris detail: kondisi BAIK → `catatMutasi(RETUR_JUAL, masuk qty_retur_dasar, bucket BAIK, hpp = hpp_saat_transaksi)`; kondisi RUSAK/CACAT → `catatMutasi(RETUR_JUAL, masuk, bucket RUSAK, hpp = hpp_saat_transaksi)` (barang masuk bucket rusak, bukan stok jual; halaman bucket rusak Fase 10). Perbarui `penjualan_detail.qty_retur_dasar` dan `status_item` (RETUR bila seluruh qty, selain itu RETUR_SEBAGIAN). |
| T5 | TUKAR_BARANG: hanya barang yang sama dengan qty pengganti = qty retur (`id_barang_pengganti = id_barang`). Efek: mutasi RETUR_JUAL masuk (T4) lalu `catatMutasi(TUKAR_RETUR, keluar qty_pengganti_dasar, hpp = hpp_rata2 saat itu)`. Tidak mengubah `total_retur`/`total_refund` penjualan (nilai netral). Tukar ke barang lain dilakukan dengan REFUND + penjualan baru. |
| T6 | REFUND: `total_retur += total_retur_dok`, `total_refund += total_retur_dok`. TUNAI → `kas_shift(REFUND_RETUR, KELUAR, nominal, id_retur)` pada shift BUKA yang dipilih saat menyetujui (`retur.id_shift` wajib); TRANSFER → `rekening_refund`, `referensi_refund` dicatat, tanpa kas_shift. Bila `total_retur_dok > dibayar_bersih` (uang yang bisa dikembalikan lebih kecil), refund dibatasi ke `dibayar_bersih` dan sisanya otomatis menjadi potong tagihan (dicatat di `catatan`). |
| T7 | POTONG_TAGIHAN: `total_retur += total_retur_dok`; tidak ada uang keluar. Bila `total_retur_dok > tagihan` saat itu, tolak: gunakan REFUND. |
| T8 | Setelah T6/T7 hitung ulang `status_pembayaran` (P9). |
| T9 | Retur atas baris barang KONSINYASI dengan kondisi BAIK mengurangi qty yang akan disetor ke pemasok **[M2]** (docs/06 §7). |
| T10 | DITOLAK: `alasan_penolakan` wajib; tidak ada efek apa pun; dokumen tetap tersimpan. |

## 9. Void

| # | Aturan |
|---|---|
| V1 | Syarat: shift asal penjualan (`penjualan.id_shift`) berstatus BUKA, atau `id_shift` null dan `tanggal_operasional` = hari ini; tidak ada retur berstatus MENUNGGU/DISETUJUI atas penjualan itu; tidak ada surat jalan DIKIRIM/SELESAI; `status_transaksi ≠ VOID`. Di luar itu → `STATUS_TIDAK_VALID` dengan saran "gunakan retur". |
| V2 | Lingkup ITEM: pilih ≥ 1 baris `status_item = NORMAL`. Lingkup TRANSAKSI: seluruh baris NORMAL (service tetap membuat satu `void_transaksi_detail` per baris). `nominal_void = Σ subtotal baris`. |
| V3 | Persetujuan mengikuti docs/04 §6. Sebelum DISETUJUI tidak ada efek. |
| V4 | Saat DISETUJUI, per detail: `catatMutasi(VOID, masuk qty_dasar, BAIK, hpp = hpp_saat_transaksi)`; `status_item = VOID`. Header: `total_void += nominal_void`; `status_transaksi` = VOID bila semua baris VOID, selain itu VOID_SEBAGIAN. Surat jalan DIPROSES/DIMUAT → BATAL (S7). Order asal tetap SELESAI. |
| V5 | Refund: `nominal_refund = max(0, dibayar_bersih − (tagihan_baru))` dengan `tagihan_baru = total_neto − total_void − total_retur` setelah V4. `total_refund += nominal_refund`. TUNAI → `kas_shift(REFUND_VOID, KELUAR, nominal_refund, id_void)` pada shift BUKA yang dipilih saat menyetujui; TRANSFER → referensi dicatat. Hitung ulang `status_pembayaran` (P9). |
| V6 | Void tidak menghapus pembayaran: baris `pembayaran_penjualan` tetap ada; uang kembali tercatat sebagai `total_refund` dan `kas_shift`. |
| V7 | DITOLAK: `alasan_penolakan` wajib; tidak ada efek. |

## 10. Shift kasir dan clerical check

| # | Aturan |
|---|---|
| K1 | Satu shift BUKA per pengguna (index parsial). Buka shift: `modal_awal` (boleh 0), `tanggal_operasional` = hari ini. Nomor `SHF`. |
| K2 | Pembayaran TUNAI, refund TUNAI, dan pembayaran pemasok TUNAI selalu terikat ke shift BUKA milik pengguna yang mencatatnya (P12, T6, V5). |
| K3 | `kas_shift` mencatat kas non-penjualan: KASBON (KELUAR), SETOR_OWNER (KELUAR: uang diambil owner dari laci), TARIK_OWNER (MASUK: owner menambah uang laci), REFUND_RETUR/REFUND_VOID (KELUAR, otomatis dari T6/V5), BAYAR_PEMASOK (KELUAR, otomatis [M2]), MASUK_LAIN/KELUAR_LAIN (manual, `keterangan` wajib). Entri manual butuh `kas.shift.kelola_sendiri` untuk shift sendiri. |
| K4 | **Tutup shift = clerical check, blind count.** Urutan API: (1) `POST /api/kas/shift/:id/tutup` dengan `{ uang_fisik, keterangan? }`; (2) server menghitung `saldo_sistem` (K5) **di server**, membuat `clerical_check`, mengubah shift → TUTUP, mengembalikan hasil (saldo sistem, selisih). Endpoint rangkuman kas shift yang masih BUKA hanya boleh diakses pemegang `kas.shift.lihat_semua`; kasir sendiri baru melihat angka sistem setelah menutup. UI kasir tidak menampilkan saldo sistem sebelum input uang fisik. |
| K5 | `saldo_sistem = modal_awal + Σ pembayaran_penjualan TUNAI (nominal) + Σ kas_shift MASUK − Σ kas_shift KELUAR` untuk shift itu. Hanya `nominal` (bukan `uang_diterima`) karena kembalian sudah keluar dari laci. `selisih = uang_fisik − saldo_sistem`; selisih ≠ 0 wajib `keterangan` (CHECK DB). |
| K6 | Setelah TUTUP: tidak ada pembayaran tunai, kas_shift, atau void yang merujuk shift itu. Order yang masih DIPROSES oleh kasir tersebut dikembalikan ke MENUNGGU saat tutup. |
| K7 | Shift TUTUP tidak dibuka kembali di M1. Koreksi dicatat di shift berikutnya lewat kas_shift MASUK_LAIN/KELUAR_LAIN dengan keterangan merujuk nomor clerical. Kolom `dibuka_kembali_oleh` disiapkan untuk M2. |
| K8 | Riwayat clerical (per shift: kasir, tanggal, modal, tunai, selisih, keterangan) tampil untuk Admin/Owner; kasir melihat miliknya. |

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
| A4 | KOREKSI: `qty_selisih` diisi langsung (± ) dengan `alasan` wajib; mutasi PENYESUAIAN. |
| A5 | RUSAK: `qty_selisih` negatif dari bucket BAIK; dua mutasi PINDAH_KONDISI (keluar BAIK, masuk RUSAK, `hpp = hpp_rata2`). MUSNAH [M2]: keluar dari bucket RUSAK. |
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
| Retur periode | Σ `total_retur` dokumen retur DISETUJUI (REFUND + POTONG_TAGIHAN) berdasarkan `tanggal_operasional` retur. |
| Penjualan bersih | Omzet − Retur. |
| HPP periode | Σ (`hpp_saat_transaksi` × `qty_dasar`) baris penjualan dengan `status_item ≠ VOID` − Σ (`hpp_saat_transaksi` × `qty_retur_dasar`) untuk retur DISETUJUI kondisi BAIK. Retur RUSAK/CACAT tidak mengurangi HPP (barang hilang nilainya). |
| Gross profit | Penjualan bersih − HPP periode. Margin % = gross profit ÷ penjualan bersih. Baris laporan gross profit per transaksi/barang mengikuti definisi yang sama pada tingkat baris. |
| Nilai persediaan (per tanggal) | Σ `saldo_setelah × hpp_setelah` dari mutasi terakhir tiap barang ≤ tanggal (bucket BAIK), dipisah MILIK_SENDIRI dan KONSINYASI (titipan bukan aset toko; ditampilkan sebagai informasi). Untuk "hari ini" = Σ `stok_fisik × hpp_rata2`. |
| Stok rekap periode | Per barang: stok awal = saldo sebelum periode; masuk = Σ `qty_masuk`; keluar = Σ `qty_keluar`; stok akhir = awal + masuk − keluar (bucket BAIK). Harus sama dengan `saldo_setelah` mutasi terakhir periode. |
| Kartu stok | Semua mutasi satu barang dalam periode, kronologis, dengan nomor dokumen sumber dan keterangan (mis. "Jual ke CV Bangun Makmur", "Terima dari CV Semen Jaya"). |
| Stok minimum | Semua barang AKTIF dengan status ST1 ≠ AMAN, diurutkan KRITIS/HABIS dulu. |
| Piutang | Penjualan `status_transaksi ≠ VOID`, `status_pembayaran ≠ LUNAS`: sisa tagihan, jatuh tempo, umur (hari lewat jatuh tempo). |
| Produk terlaris | Per barang: Σ `qty_dasar` dan Σ `subtotal` baris `status_item ≠ VOID` (tanpa dikurangi retur), peringkat berdasarkan nilai; kontribusi % terhadap total. |
| Detail invoice | Satu penjualan: header, baris, pembayaran, retur, void, surat jalan. |

Semua total laporan dihitung untuk seluruh periode di server (K-033); paginasi hanya memotong baris tampilan.

## 15. Konfigurasi tambahan (melengkapi docs/03 §6)

| Kode | Default | Dipakai |
|---|---|---|
| batas_kunci_order_menit | 30 | R8 |
| jatuh_tempo_default_hari | 7 | P7 (bila term pelanggan 0) |

## 16. Aksi log aktivitas

Nilai `log_aktivitas.aksi` (huruf besar, `<ENTITAS>_<KEJADIAN>`; daftar di `packages/shared/src/log.ts`): LOGIN_SUKSES, LOGIN_GAGAL, LOGOUT, PENGGUNA_BUAT/UBAH/NONAKTIF/AKTIFKAN/RESET_PASSWORD/GANTI_PASSWORD/CABUT_SESI (K-054), PENGATURAN_UBAH, BARANG_BUAT/UBAH/NONAKTIF, HARGA_UBAH, PELANGGAN_BUAT/UBAH/NONAKTIF, PEMASOK_BUAT/UBAH/NONAKTIF, IMPORT_BARANG, IMPORT_SALDO_AWAL, ORDER_BUAT/ANTREAN/UBAH/PROSES/LEPAS/BATAL, PENJUALAN_CHECKOUT, PENJUALAN_HARGA_MANUAL, PENJUALAN_DISKON, PENJUALAN_DIAMBIL, PEMBAYARAN_CATAT, SURAT_JALAN_BUAT/STATUS/BATAL, RETUR_AJUKAN/SETUJUI/TOLAK, VOID_AJUKAN/SETUJUI/TOLAK, PENERIMAAN_SIMPAN, PENYESUAIAN_BUAT/UBAH/SELESAI/BATAL, SHIFT_BUKA/TUTUP, KAS_SHIFT_CATAT, CETAK_ULANG, LAPORAN_EKSPOR. M2 menambah HUTANG_BAYAR, RETUR_PEMASOK_SIMPAN, KONSINYASI_SELESAIKAN, PROMO_BUAT/UBAH, HARGA_TINJAU_TERAPKAN.

## Riwayat

- 2026-09-19 — v1.
- 2026-09-30 — §16: aksi log PENGGUNA_AKTIFKAN, PENGGUNA_GANTI_PASSWORD, PENGGUNA_CABUT_SESI (K-054).
- 2026-10-01 — §16: aksi log PENYESUAIAN_UBAH (K-067).
