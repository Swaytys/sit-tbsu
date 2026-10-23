# Keputusan 23 Oktober 2026 — Diskon manual, istilah uang shift, hasil pengantaran, FMS

Melanjutkan `2026-10-18-uji-pemilik-lanjutan.md` (K-128–K-145). Butir **(pemilik)** diputuskan pemilik (sebagian
lewat pilihan yang diajukan Claude Code); butir lain keputusan teknis Claude Code.

---

### K-146 — Diskon manual dihapus

**Status:** menggantikan K-144 dan docs/06 D1–D2 untuk transaksi baru.

**Keputusan (pemilik):** diskon manual per barang dan per transaksi (menu titik tiga, tombol `%`) dihapus dari
semua layar. Potongan harga hanya lewat **Promo** (Pengaturan › Promo), supaya konsisten dan tidak bisa
disalahgunakan. API menolak diskon manual baru ("Potongan harga hanya lewat Promo"). Diskon yang sudah tersimpan
sebelum keputusan ini tetap sah (dokumen tidak diubah) dan tetap dihitung di laporan. Pengaturan "batas diskon per
peran" dan izin `penjualan.diskon` dihapus. Form order lengkap ikut dihapus (K-129); tombol **Ubah** di Daftar
order membuka order di input cepat (mode ubah: F8 simpan, F9 buang perubahan).

---

### K-147 — Istilah "uang shift"

**Keputusan (pemilik):** di layar dan pesan, istilah tidak baku "uang laci" diganti **uang shift** (uang tunai yang
dipegang selama satu shift). Contoh: *Hitung uang shift*, *Total uang shift*, *Tambah uang shift*, *Ditinggal
untuk shift berikutnya*. "Laci kas" hanya untuk perangkat keras (laci yang dibuka printer).

---

### K-148 — Koreksi modal selama hitung susulan

**Keputusan (pemilik):** rumus hitung susulan K-134 disetujui. Koreksi modal **tidak bisa diakses** selama fase
hitung susulan; baru tersedia setelah hasilnya disimpan (sudah berlaku sejak K-134: tombol nonaktif dan API menolak).

---

### K-149 — Hasil pengantaran per barang

**Keputusan (pemilik):** setelah barang diantar, **admin/kasir di toko** mencatat hasil surat jalan (sopir tidak
perlu akun; ia kembali membawa surat jalan bertanda tangan dan uang bila bayar di tempat). Hasil dicatat per barang:

- **Diterima** — selesai.
- **Kembali utuh** (rumah tutup, alamat salah, pembeli menunda) — stok kembali; barang bisa dikirim ulang dengan
  surat jalan baru; tagihan tidak berubah.
- **Rusak di jalan** — lihat K-151.
- **Ditolak pembeli** (bukan rusak di jalan) — menjadi retur otomatis: barang kembali ke stok (kondisinya dipilih),
  tagihan berkurang, refund bila sudah dibayar lebih.

Halaman *Pengiriman aktif* dirancang ulang supaya hal yang umum dikerjakan (muat, berangkat, catat hasil, kirim
ulang) cepat dan jelas, dengan anomali dicegah (lihat docs/12).

---

### K-150 — FMS inti: kendaraan dan sopir

**Keputusan (pemilik):** data master **Kendaraan** (plat, jenis, kapasitas, status aktif) dan **Sopir** (nama, No. HP,
status aktif). Di surat jalan tinggal dipilih, tidak diketik ulang. Kendaraan/sopir yang sedang mengantar ditandai
**sedang jalan** dan tidak bisa dipilih untuk surat jalan lain sampai surat jalannya selesai/batal. Ada riwayat trip
per kendaraan dan per sopir. Servis, odometer, dan biaya BBM di luar v1.0.0.

---

### K-151 — Barang rusak di jalan

**Keputusan (pemilik):** barang rusak saat pengantaran (bukan salah pembeli) **ditanggung toko**: masuk stok rusak
(tercatat sebagai kerugian). Pembeli memilih: **dikirim pengganti** (surat jalan baru, tagihan tetap) atau
**tagihan dikurangi** (retur potong tagihan/refund).

---

### Rincian teknis K-149–K-151 (keputusan Claude Code)

**Perjalanan (trip).** Satu kendaraan biasanya membawa beberapa surat jalan sekaligus (beberapa pembeli dalam
satu rute). Karena itu "sedang jalan" dicatat per **perjalanan** (nomor `TRP-YYMMDD-NNN`), bukan per surat jalan:
tombol **Berangkat** memilih kendaraan, sopir, dan satu atau lebih surat jalan yang siap; semuanya menjadi
DIKIRIM dalam satu perjalanan. Kendaraan dan sopir yang masih punya perjalanan berjalan tidak bisa dipakai untuk
perjalanan lain (dicek di service dan dijaga indeks unik parsial di database). Perjalanan selesai otomatis saat
hasil semua surat jalannya sudah dicatat. Riwayat trip = daftar perjalanan per kendaraan/sopir.

**Stok saat hasil dicatat.** Stok barang pengantaran sudah keluar saat checkout (R6), dan barang itu sudah milik
pembeli. Akibatnya per hasil:

- *Kembali utuh*: tidak ada mutasi stok (barang pembeli dititipkan di toko, sama seperti "belum diambil",
  K-026). Qty itu kembali menjadi "belum dikirim" sehingga bisa dibuatkan surat jalan baru. Bila pembeli
  akhirnya membatalkan, dibuat retur biasa.
- *Ditolak pembeli*: retur otomatis dengan kondisi yang dipilih (BAIK kembali ke stok jual, RUSAK/CACAT ke stok
  rusak). Uangnya potong tagihan bila sisa tagihan cukup, selain itu dikembalikan (tunai/transfer).
- *Rusak di jalan, tagihan dikurangi*: ikut retur di atas dengan kondisi RUSAK.
- *Rusak di jalan, dikirim pengganti*: retur **tukar barang** kondisi RUSAK (barang rusak masuk stok rusak,
  pengganti keluar dari stok jual, tagihan tetap). Qty pengganti menjadi "belum dikirim". Stok pengganti
  kurang → ditolak dengan saran *kurangi tagihan*.

Retur otomatis mengikuti aturan persetujuan retur yang sudah ada (T3, K-099): langsung disetujui bila pencatat
berwenang atau nilainya di bawah batas bebas; selain itu menunggu atasan. Selama menunggu, qty-nya tidak dihitung
"belum dikirim" agar tidak terkirim ganda.

**Hasil dicatat sekali** per surat jalan (tabel `surat_jalan_hasil`, append-only). Per baris: diterima + kembali
utuh + rusak + ditolak = qty kirim. Tombol cepat **Semua diterima** untuk kasus umum.

---

## Urutan

1. K-146, K-147 (selesai bersama keputusan ini).
2. K-149–K-151 pengantaran + FMS (migrasi, aturan docs/05 §7, tes, layar).
3. Lanjut gelombang 3 (K-129, K-130, K-131, K-138, K-139, K-143) dan seterusnya.
