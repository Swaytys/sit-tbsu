# Uji pemilik 8 November 2026: order pembelian, penerimaan, hutang, persediaan awal, shift

Sumber: laporan pemilik 8 Nov 2026 atas U60–U125 (dicoba di `pnpm dev`, branch V2) beserta lima tangkapan layar.
Semua masukan dicatat sebagai K-234–K-245. Setiap anomali dijawab dengan tiga pengaman K-120: **Atasi** (koreksi
aman bila sudah terjadi), **Cegah** (alur/kunci sebelum terjadi), **Ajari** (penjelasan di layar).

| K | Masukan | Versi | Status |
|---|---|---|---|
| K-234 | Bug: Data Barang "kesalahan server" dan rincian order pembelian kosong (abu-abu) | V1 | Selesai |
| K-235 | Diksi uang muka "sisa" membingungkan | V1 | Selesai |
| K-236 | Order pembelian lengkap: syarat bayar, tanggal kirim, dsb.; penerimaan mewarisi dan mengunci | V1 | Selesai |
| K-237 | Penerimaan bervariasi: bayar campur, kurang datang, rusak saat datang, tempo dan keterlambatan | V1 | Selesai |
| K-238 | Kartu order pembelian (rincian kanan) lebih informatif; tombol sesuai tahap | V1 | Selesai |
| K-239 | Pemusnahan: cari hanya barang rusak, tampilkan stok rusak, daftar barang rusak siap klik | V1 | Selesai |
| K-240 | Stok opname di halaman mandiri yang lengkap | V1 | Selesai tahap 1 (kemasan tersegel, timbang, dua penghitung, dashboard menyusul K-227) |
| K-241 | "Saldo awal" → **Persediaan Awal**: input secepat kasir, termasuk hutang awal pemasok | V1 | Selesai (pemasok asal per baris, deposit dan titipan awal menyusul) |
| K-242 | "Saran pesan" → **Perencanaan Pengadaan**: penjelasan dengan contoh, terpadu dengan order dan lama kirim, analisis kekosongan stok | V1 | Selesai (musim ramai dan keandalan pemasok menyusul) |
| K-243 | Izin tambahan per pengguna (mis. kasir boleh urus pengantaran) dan peran buatan sendiri | V2 | Rencana |
| K-244 | Checkout sebelum shift dibuka di jam operasional ditolak; di luar jam operasional hanya non-tunai/order dengan pemberitahuan | V1 | Selesai |
| K-245 | Persetujuan order pembelian jarak jauh dengan kode sekali pakai (seperti retur/void) | V1 | Selesai |

Penamaan dipilih pemilik 8 Nov: **Perencanaan Pengadaan** (pengganti *Saran pesan*) dan **Persediaan Awal**
(pengganti *Saldo awal*; bagian hutangnya *Hutang Awal Pemasok*).

Versi: pemilik meminta V1 sudah standar dan tahan anomali lapangan. Karena perubahan pembelian bersinggungan dengan
K-225 (persetujuan, penerima ≠ pemesan, tiga dokumen), semua dikerjakan berurutan di satu jalur pengembangan
(branch `feat/20-peran-pembelian`), lalu digabung ke main sebagai rilis berikutnya setelah uji pemilik.

---

## K-234 Data Barang galat dan rincian order pembelian kosong (selesai)

**Penyebab:** database pengembangan (`tbsu_dev`) belum menjalankan migrasi 0045–0046 dari branch V2. Kolom baru
(`barang.perlu_persetujuan_beli`, kolom persetujuan di `order_pembelian`) belum ada, sehingga daftar barang dan
rincian order gagal dibaca. Daftar order tetap tampil karena tidak membaca kolom baru. Aplikasi desktop (.exe) tidak
terkena: peluncurnya selalu menjalankan migrasi saat menyala.

**Atasi:** `pnpm db:migrate` dijalankan pada database pengembangan.
**Cegah:** `pnpm dev` kini menjalankan migrasi lebih dulu; server menolak menyala dengan pesan jelas bila masih ada
migrasi yang belum dijalankan.
**Ajari:** rincian order yang gagal dimuat menampilkan pesan galat dan tombol *Coba lagi*, bukan kotak abu-abu.

## K-236 / K-237 / K-238 Siklus pembelian lengkap (rancangan)

Masalah: order pembelian hanya memuat pemasok, barang, qty, harga. Syarat bayar, tanggal kirim, dan pembayaran baru
diisi saat barang datang, sehingga petugas penerimaan harus mengingat kesepakatan dan bisa mengisinya berbeda. Kasus
lapangan (bayar sebagian saat datang, barang kurang, barang rusak, tempo terlewat) belum punya jalur yang jelas.

Patokan: siklus *procure-to-pay* baku: **order (kesepakatan) → penerimaan (fakta barang) → faktur/hutang (fakta
tagihan) → pembayaran**, dengan pencocokan tiga dokumen. Istilah: **hutang** = kewajiban toko ke pemasok; **klaim
pemasok** = hak toko atas pemasok (barang kurang yang sudah dibayar, barang rusak, kelebihan uang muka). Klaim bukan
piutang pelanggan; dicatat terpisah per pemasok.

### 1. Order pembelian memuat kesepakatan lengkap (K-236)

Kepala order (wajib kecuali disebut):

| Isian | Keterangan |
|---|---|
| Pemasok | aktif |
| Tanggal kirim diminta | tanggal barang diharapkan datang |
| Cara kirim | *Diantar pemasok* atau *Diambil sendiri* |
| **Syarat bayar** | *Bayar di muka* (lunas sebelum dikirim), *Tunai saat barang datang*, *Tempo N hari* (bawaan dari Data Pemasok), dan bisa digabung dengan *uang muka* (nominal atau %) |
| Rencana cara bayar | Tunai/Transfer (bawaan; pembayaran sungguhan tetap mencatat caranya sendiri) |
| Ongkos kirim/biaya lain | opsional; ditambahkan ke tagihan dan dibagi ke harga modal barang menurut nilai |
| Catatan | opsional |

Baris: barang, qty, harga beli (wajib > 0 untuk dikirim; harga kosong tetap alasan persetujuan PO10).

Syarat bayar ikut menentukan persetujuan (PO10) dan tampil di cetakan/teks WhatsApp. Setelah order dikirim, syarat
bayar **terkunci**. Mengubahnya (pemasok minta ganti syarat) memakai aksi *Ubah kesepakatan* dengan alasan dan
persetujuan Kepala Toko/Owner; riwayat perubahan tersimpan.

### 2. Penerimaan dari order mewarisi kesepakatan (K-236, K-237)

- Pemasok, syarat bayar, dan cara hitung jatuh tempo **diambil dari order dan tidak bisa diganti** di penerimaan.
  Jatuh tempo = tanggal penerimaan + N hari (tempo) dan **tidak diketik**.
- Per baris barang dicatat terpisah:
  - **Datang** (dihitung petugas);
  - **Diterima baik** (masuk stok dan menjadi tagihan);
  - **Ditolak rusak/tidak sesuai** (tidak masuk stok dan tidak ditagih; menjadi *klaim pemasok*: *ganti barang*
    = sisa order tetap ditunggu, atau *potong order* = qty order dikurangi).
  - Harga di faktur bila berbeda dari order: selisih naik melewati ambang PO10 wajib alasan dan persetujuan.
- Kurang datang (190 dari 200): order tetap *Datang sebagian*, sisa 10 tercatat sebagai **barang belum datang**
  (bukan hutang dan bukan piutang). Sisa ditunggu, atau *Tutup sisa* dengan alasan.
- Pembayaran saat penerimaan dihitung otomatis dari kesepakatan:
  1. uang muka yang belum terpakai dipakai lebih dulu;
  2. *tunai saat datang*: sisa tagihan **wajib dibayar sekarang**;
  3. *tempo*: sisa tagihan menjadi hutang dengan jatuh tempo otomatis.
- **Bayar kurang dari kesepakatan** (mis. kesepakatan tunai, toko hanya mampu bayar sebagian): pilih *Bayar
  sebagian, sisanya hutang*, isi alasan dan tanggal jatuh tempo (maksimal tempo pemasok di Data Pemasok, atau
  bawaan 30 hari bila kosong). Butuh persetujuan Kepala Toko/Owner (akun sendiri atau kode). Tercatat sebagai
  *penyimpangan syarat bayar* dan tampil di kartu order.
- Contoh pemilik (dapat dicatat): order 200 sak, uang muka 60% dibayar di depan; datang 200, 20 sak rusak ditolak
  (klaim ganti); dari tagihan 180 sak: uang muka terpakai, 10% dari nilai order dibayar saat datang, sisanya
  hutang tempo. Kartu order menampilkan setiap bagian ini.
- Uang muka **melebihi** nilai barang yang diterima saat order ditutup: kelebihan menjadi *klaim pemasok* dengan
  pilihan: dikembalikan (tunai/transfer) atau **deposit pemasok** (dipakai untuk order berikutnya ke pemasok yang
  sama).
- Rusak yang ketahuan **setelah** diterima (sudah masuk stok): lewat *Retur ke Pemasok* (sudah ada) dengan rujukan
  penerimaan; penyelesaian potong hutang, uang kembali, atau ganti barang.
- Penerima barang **bukan pembuat order** (K-225 butir 4), kecuali Owner; hitung tanpa melihat qty order bila
  dinyalakan di pengaturan (hitung buta), lalu dibandingkan otomatis.
- Penerimaan **tanpa order** hanya untuk pembelian tunai kecil di bawah batas pengaturan (K-225 butir 5); selain itu
  ditolak dengan arahan membuat order.

### 3. Hutang dan jatuh tempo (K-237)

- Satu penerimaan = satu tagihan dengan jatuh tempo sendiri; semua tampil di kartu order dan di *Hutang Pemasok*.
- **Jatuh tempo tidak bisa dimundurkan lewat penerimaan atau form apa pun.** Perpanjangan memakai aksi tersendiri
  *Perpanjang jatuh tempo*: alasan wajib, persetujuan Owner, tercatat dengan tanggal lama dan baru, jumlah
  perpanjangan tampil (pengawasan).
- Hutang lewat jatuh tempo: penanda merah di kartu order dan Hutang Pemasok, notifikasi lonceng (sudah ada),
  laporan umur hutang.
- Pembayaran hutang bisa dari kartu order (*Bayar tagihan*) atau dari Hutang Pemasok; dua jalan itu memakai dokumen
  pembayaran yang sama.

### 4. Kartu order pembelian (K-238)

Rincian di kanan memakai seluruh ruang:

- **Linimasa:** dibuat → diajukan → disetujui → dikirim → dikonfirmasi → datang sebagian/semua → lunas; tiap titik
  dengan tanggal dan nama.
- **Kesepakatan:** syarat bayar, uang muka, tanggal kirim diminta, janji pemasok (dan berapa kali berubah), cara
  kirim, ongkos.
- **Ringkasan uang:** nilai order; uang muka dibayar / terpakai / **belum terpakai** (pengganti kata "sisa",
  K-235); nilai barang diterima; dibayar saat datang; **sisa tagihan** (hutang) dengan jatuh tempo terdekat dan
  status terlambat; klaim pemasok.
- **Barang:** dipesan, datang, diterima baik, ditolak, belum datang.
- **Penerimaan dan pembayaran:** daftar dengan nomor, tanggal, nilai, status bayar.
- **Tombol sesuai tahap:** *Uang muka* hanya sebelum barang pertama datang; sesudahnya *Bayar tagihan*.
  *Konfirmasi pemasok* (janji kirim) boleh sampai semua barang datang, setiap perubahan tercatat. *Perpanjang
  jatuh tempo* hanya untuk tagihan tempo (Owner).

### Pelaksanaan (8 Nov, selesai)

- Tahap A (migrasi 0047): kesepakatan di order + `pemasok.tempo_hari`; janji pertama dan jumlah perubahannya.
- Tahap B (0048): penerimaan mewarisi kesepakatan, barang ditolak (ganti/kurangi), bayar kurang = penyimpangan.
- Tahap C (0049): perpanjangan jatuh tempo hanya Owner; uang muka hanya sebelum barang datang.
- Tahap D: kartu order dua kolom (kesepakatan, barang, tagihan per penerimaan, ringkasan uang, riwayat).
- **Bug yang ditemukan:** jumlah uang muka *terpakai* selalu terbaca 0 (subquery merujuk kolom tanpa nama tabel).
  Akibatnya tampilan "sisa" uang muka sama dengan uang muka (U118) dan uang muka yang sudah dipakai bisa terpakai
  lagi pada penerimaan berikutnya. Diperbaiki; tes ringkasan uang menjaganya.
- **Deposit pemasok (selesai 8 Nov):** sisa uang muka saat order ditutup bisa disimpan sebagai deposit dan dipakai
  untuk uang muka order lain atau membayar hutang pemasok yang sama (PO26).

### K-225 tahap 3 (8 Nov, sebagian selesai)

Pilihan pemilik 8 Nov: pembelian tanpa order **dibatasi nilai** (tunai ≤ Rp 500.000, bawaan) dan penerima **wajib
beda** dari pembuat order tetapi **bisa dimatikan** di Pengaturan. Keduanya tidak berlaku untuk Owner. Selesai: PO24,
PO25, daftar tinjau *Tanpa order*, pencocokan harga faktur dengan order (PO27), batas wewenang bayar hutang (PO28).
Ditunda: hitung buta (penerima tetap bisa melihat kartu order, jadi manfaatnya kecil di toko ini). Rekening pemasok hanya
diatur Owner dan transfer ke rekening lain ditolak (PO29). Laporan Pengawasan Pembelian
(PO30) selesai. K-225 selesai kecuali hitung buta (ditunda).

## K-239 Pemusnahan barang rusak

Pencarian di form pemusnahan hanya menampilkan barang yang punya stok rusak, dengan angka **stok rusak** (bukan stok
siap jual). Di atas pencarian ada daftar semua barang rusak (nama, stok rusak, nilai) yang tinggal diklik untuk
ditambahkan. Qty yang dimusnahkan tidak boleh melebihi stok rusak (sudah dijaga API).

## K-240 Stok opname di halaman mandiri

Opname dipindah dari form penyesuaian ke halaman sendiri dengan alur lengkap; isi rancangannya K-227 (opname
bertahap, hitung buta, persetujuan selisih).

## K-241 Persediaan Awal (rancangan)

- Nama menu dan dokumen: **Persediaan Awal** (jenis `SALDO_AWAL` di database tetap; hanya nama tampilan).
- Input secepat kasir: kotak cari/pindai selalu terfokus → Enter menambah baris → kursor ke Qty → Enter ke Harga
  modal → Enter kembali ke cari. Barang yang sama digabung. Tempel dari Excel tetap ada. Simpan draf otomatis
  berkala.
- Per baris boleh diisi **pemasok asal** (opsional). Di bawah daftar ada bagian **Hutang Awal Pemasok**: per pemasok,
  nomor faktur lama, sisa hutang, jatuh tempo. Menjadi tagihan di Hutang Pemasok (tanpa menambah stok lagi).
  Bagian *Uang muka/deposit awal di pemasok* dan *barang titipan awal* juga tersedia.
- Pemeriksaan sebelum selesai: barang tanpa harga modal, qty tidak wajar, barang yang sudah punya persediaan awal.

## K-242 Perencanaan Pengadaan (rancangan)

- Ganti nama menu dan semua teks dari *Saran pesan*.
- **Panduan dengan contoh**: tiap metode (rata-rata, statistik, min–maks, tren) dijelaskan dengan contoh angka
  satu barang (mis. semen: terjual 20 sak/hari, lama kirim 5 hari …) dan kapan sebaiknya dipakai; tersedia sebagai
  panel *Pelajari* di halaman, bukan hanya tombol "?".
- **Terpadu dengan order dan lama kirim**: barang yang sedang dipesan dihitung beserta **tanggal datangnya** (janji
  pemasok, atau tanggal kirim diminta, atau lama kirim aktual). Bila perkiraan **stok habis lebih dulu** daripada
  barang datang, tampil **celah kosong**: berapa hari, perkiraan penjualan hilang (qty dan rupiah laba kotor),
  dan saran tindakan berurutan:
  1. minta pemasok mempercepat (tombol salin pesan WhatsApp);
  2. beli sebagian dari pemasok lain yang lama kirimnya lebih cepat (dari riwayat penerimaan);
  3. batasi penjualan besar/jaga stok untuk pelanggan tetap.
- Musim ramai: periode ramai (dari pola penjualan tahun lalu atau ditandai Owner) menaikkan perkiraan.
- Keandalan pemasok: ketepatan janji kirim (dari K-238) ikut dipakai sebagai cadangan hari.

## K-243 Izin tambahan per pengguna (V2)

Di Data Pengguna, Owner dapat menambah atau mencabut izin tertentu per akun (mis. Kasir diberi *urus pengantaran*),
lalu membuat peran buatan sendiri dari kumpulan izin. Bawaan Kasir tanpa tugas logistik baru diterapkan setelah
pengaturan per pengguna ini ada, agar toko kecil tetap bisa mendelegasikan pengantaran ke kasir.

## K-244 Checkout dan jam operasional

- **Di jam operasional** (antara jam buka dan jam tutup shift di Pengaturan) dan shift belum dibuka: **semua**
  checkout ditolak (tunai maupun non-tunai/order), dengan arahan *Buka shift* (boleh *Buka dulu, hitung nanti*).
- **Di luar jam operasional** tanpa shift: hanya non-tunai dan order (bayar nanti) yang boleh, dengan pemberitahuan
  "Di luar jam operasional: hanya non-tunai/bayar nanti"; tercatat di transaksi.
- Jadwal belum diisi: aturan lama tetap (non-tunai boleh) dan layar menyarankan mengisi jadwal shift.

## K-245 Persetujuan order pembelian jarak jauh

Selain menyetujui dari akunnya sendiri (K-225), Owner/Kepala Toko yang tidak di toko bisa menyetujui lewat **kode
sekali pakai**: pembuat order menekan *Minta kode ke Owner*; Owner menerima pesan Telegram/email berisi ringkasan
order (pemasok, total, alasan) dan kode 6 angka; bila setuju, Owner memberikan kode itu ke pembuat (telepon/WA);
kode dimasukkan di kartu order dan order tercatat **disetujui atas nama Owner**. Kode terikat pada order dan isinya
(order diubah = kode tidak berlaku), berlaku terbatas, sekali pakai. Ini mekanisme yang sama dengan retur/void
(K-102).
