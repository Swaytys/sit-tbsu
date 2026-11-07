# Panduan label dan barcode (K-230)

Untuk Admin/Owner yang mencetak label, dan kasir yang memakai pemindai barcode.

## 1. Gunanya label

| Fungsi | Contoh | Hasil |
|---|---|---|
| **Barang tanpa barcode pabrik** diberi barcode toko | Kuas, meteran, kran, fitting pipa | Kasir cukup memindai, tidak perlu mengetik nama |
| **Label harga** di barang atau rak | Cat, alat tukang | Pembeli dan staf melihat harga yang sama dengan kasir |
| **Label wadah/rak barang curah** | Baut, paku, sekrup, kawat | Satu label untuk satu wadah, bukan per buah (lihat bagian 4) |

Barcode di label berisi **barcode pabrik** bila barang punya, selain itu **kode barang** BonsaiUrip (mis.
`BRG-00123`). Keduanya dikenali di semua kotak cari barang.

## 2. Pemindai barcode

- Jenis yang cocok: pemindai **1D/2D USB atau Bluetooth** apa pun (mis. Zebra LS2208, Honeywell HH400, atau merek
  lain). Label BonsaiUrip memakai **Code 128**, jenis barcode yang terbaca semua pemindai.
- Cara kerjanya seperti **keyboard**: pemindai "mengetik" isi barcode lalu menekan Enter. Tidak perlu program atau
  pengaturan tambahan di BonsaiUrip.
- **Memasang:** colokkan kabel USB pemindai ke komputer kasir (Bluetooth: pasangkan di Windows seperti keyboard
  Bluetooth). Uji: buka Notepad, pindai sebuah barcode; angkanya harus muncul dan pindah baris.
- **Memakai di kasir:** tekan **F2** (atau sentuh kotak cari barang) → pindai → barang langsung masuk keranjang.
  Memindai barang yang sama dua kali menambah jumlahnya. Di Order Penjualan sama: kursor di kotak cari, pindai.
- Pemindai tidak membaca? Periksa: label tidak tergores/terlipat, cetakan tidak pudar (lihat 3.5), jarak pindai
  10–20 cm, pemindai diatur ke mode "USB HID keyboard" (lihat buku pemindai).

## 3. Mencetak label

1. *Data Master › Data Barang* › **Cetak label**.
2. Cari dan pilih barang; isi **jumlah label** tiap barang.
3. Pilih **jenis kertas**: rol printer thermal (57/58/80 mm) atau **stiker A4 4 × 10** (48,5 × 25,4 mm, dijual di
   toko alat tulis).
4. Pilih **harga tier** yang tercetak (biasanya Normal).
5. Stiker A4 yang sudah terpakai sebagian: isi **Mulai dari label ke-** (mis. 13) agar label tidak tercetak di
   tempat yang sudah kosong.
6. **Cetak** → di jendela cetak pilih printer yang benar dan **skala 100%** (jangan "Fit to page"), lalu cetak.
7. Uji satu label dengan pemindai sebelum menempel semuanya.

### 3.5 Label pudar atau tidak terbaca

Printer thermal: *Pengaturan › Struk & printer › Pengaturan lanjutan › Kepekatan cetak* → Tebal. Printer A4: pakai
mode kualitas normal/tinggi, bukan draft.

## 4. Barang curah dan barang kecil (tidak dilabeli satu per satu)

Baut, paku, sekrup, kawat, pasir, semen curah, dan barang potong per meter tidak mungkin diberi label per buah.
Standar toko:

1. **Label wadah/rak:** cetak **satu label** untuk setiap barang curah dan tempel di **wadah atau raknya** (kotak
   baut M10, laci paku 5 cm, gulungan kawat). Isi label: nama, harga per satuan, barcode.
2. **Lembar barcode kasir:** cetak label barang-barang curah di stiker A4, tempel berurutan pada satu karton/map
   plastik di meja kasir (dikelompokkan: baut, paku, sekrup, kawat, …). Saat menjual, kasir memindai barcode dari
   lembar ini lalu mengetik jumlahnya (mis. `25*` lalu pindai = 25 buah).
3. Barang yang dijual per **meter/kg**: pindai labelnya, lalu ketik jumlah dengan koma (mis. `2,5*` lalu pindai).
4. Barang tanpa label sama sekali tetap bisa dicari dengan nama atau cirinya (mis. `baut 10 mm`).
5. Saat ada barang curah baru, cetak labelnya **sebelum** barang dipajang.

*V2 (K-230/K-231):* jenis cetak khusus **Label rak** (dengan kode lokasi) dan **Lembar barcode kasir** yang tersusun
otomatis per kategori.

## 5. Kemasan (dus/sak/rol) dengan barcode sendiri

Bila dus punya barcode pabrik berbeda dengan isinya, isi barcode itu di *Data Barang › Ubah › Kemasan (satuan jual
lain)*. Memindai barcode dus di kasir langsung memakai satuan dus dengan harganya.
