# Keputusan 24 Oktober 2026 — Hasil uji pemilik, perbaikan tampilan, rencana FMS lanjutan

Melanjutkan `2026-10-23-pengantaran-fms.md` (K-146–K-151). Sumber: pesan pemilik malam 23 Oktober (hasil uji U7, U9–U14,
U16 dan masukan baru). Butir **(pemilik)** diputuskan pemilik; butir lain keputusan teknis Claude Code. Status:
**Selesai** = dikerjakan bersama keputusan ini; **Rencana** = masuk backlog v1.0.0 dengan urutan di bawah.

---

## A. Perbaikan (selesai 24 Okt)

### K-152 — Tata letak tidak boleh saling menimpa

**Keputusan (pemilik):** elemen yang meluap dan menimpa elemen lain (halaman Shift: form kas menimpa kotak tutup shift;
papan pengiriman: judul kolom terlipat) diperbaiki di semua halaman, termasuk saat layar diperbesar (zoom 125–150%).
**Teknis:** form kas dua baris; kotak hitung pecahan satu kolom bila wadahnya sempit (container query); halaman kerja
cepat (Order, Langsung, Pengantaran) mengisi tinggi layar yang tersedia, bukan hitungan tetap; tombol Bayar di kasir
dipindah ke luar area gulir; menu samping bisa digulir di layar pendek; topbar diringkas. Pemeriksaan otomatis luapan
di 37 halaman pada lebar 1024, 1152, 1280, 1440 harus bersih sebelum diserahkan.

### K-153 — Teks panjang bisa dibuka-tutup

**Keputusan (pemilik):** catatan/keterangan di tempat sempit tidak boleh terpotong tanpa jalan untuk membacanya.
**Teknis:** komponen `TeksLipat` (satu baris + "lihat semua"/"ringkas", tombol hanya muncul bila memang terpotong),
dipakai di Cek uang non-tunai, Data Pelanggan (alamat, keterangan), Data Pemasok (alamat), Promo (berlaku untuk).

### K-154 — Rekening penerimaan wajib dipilih, No. referensi wajib

**Keputusan (pemilik):** Transfer/EDC/QRIS hanya bisa dipakai bila rekening penerimaannya sudah didaftarkan di
Pengaturan › Pembayaran; kasir hanya memilih, tidak mengetik tujuan. E-wallet (OVO, GoPay, DANA, ShopeePay) termasuk
jenis Transfer; istilahnya **rekening penerimaan** (bank / e-wallet, EDC, QRIS). No. referensi wajib untuk tiap
pembayaran non-tunai. **Teknis:** skema bersama menolak non-tunai tanpa `idRekening` dan tanpa referensi 4–40 huruf/angka
(panjang asli berbeda per penyedia: approval EDC 6, RRN QRIS 12, referensi transfer 8–20, jadi batas dibuat longgar);
API mengabaikan teks rekening; tombol cara bayar tanpa rekening tampil putus-putus dan menjelaskan sebabnya; refund
transfer juga hanya dari daftar.

### K-155 — Satu shift toko dijamin database

**Keputusan (pemilik):** dua shift terbuka bersamaan tidak boleh mungkin sama sekali (U10 tidak relevan lagi).
**Teknis:** migrasi 0024 indeks unik `uq_shift_toko_terbuka` (`where status <> 'TUTUP'`) sebagai pagar kedua setelah
kunci transaksi; migrasi berhenti dengan pesan jelas bila masih ada shift ganda lama (data tidak diubah diam-diam).
Tombol tutup shift di tab Riwayat dan kotak "shift ganda" dihapus; shift yang berjalan ditutup di tab Shift toko.
Anomali: cegah = indeks unik + kunci; ajari = pesan "Shift toko SHF-… sudah dibuka …"; tangani = tidak diperlukan
lagi (tidak bisa terjadi).

### K-156 — Peringatan bisa diciutkan, dialog tidak muncul sendiri

**Keputusan (pemilik, mengulang K-130):** pengingat shift (biru/kuning/merah) bisa diciutkan menjadi lencana berdenyut
di topbar dan dibuka lagi. Dialog Buka shift tidak muncul sendiri di layar kasir; pita kuning dengan tombol **Buka shift**
menggantikannya. Bilah pintasan keyboard bisa diciutkan (klik atau `Ctrl+/`), otomatis tertutup di layar pendek.

### K-157 — Tombol bayar campuran tampil sebagai tombol

**Keputusan (pemilik, U14):** pilihan C (bayar campuran), D (barang ditinggal), Hapus, dan Hapus semua diberi bingkai
dan bayangan seperti tombol sungguhan.

### K-158 — Pengaturan "Harga dasar"

**Keputusan (pemilik):** tab "Harga & diskon" menjadi **Harga dasar**, dengan nama baku metodenya: *Rata-rata
tertimbang (Average)* dan *Harga beli terakhir (Latest cost)*, penjelasan beda Average, harga beli terakhir, LIFO, dan
FIFO (LIFO tidak diperbolehkan PSAK 14; FIFO butuh pencatatan per lapisan pembelian, tidak dipakai karena K-008), serta
kalkulator contoh yang membandingkan ketiganya dengan markup dan pembulatan toko.

### K-159 — Cadangan: alamat folder dan server di cloud

**Keputusan (pemilik):** halaman Cadangan memberi cara membuka folder cadangan dan menjelaskan bila server di cloud.
**Teknis:** peramban tidak boleh membuka folder komputer dari halaman web, jadi disediakan **Salin alamat folder**
(ditempel di File Explorer komputer server). Penjelasan tiga keadaan: server di komputer toko, server di hosting/VPS
(tujuan Cloud wajib, karena folder lokal ada di server sewaan), dan memulihkan. Unduh cadangan lewat aplikasi untuk
server cloud masuk K-165.

---

## B. Rencana (backlog v1.0.0)

### K-160 — Halaman Pengiriman tersendiri, papan kartu (gaya Trello)

**Keputusan (pemilik):** pengiriman dipisah dari Penjualan Pengantaran menjadi halaman sendiri di menu baru
**Logistik**. Setiap invoice pengantaran yang sudah dibuat otomatis menjadi kartu **order kirim** (istilah umum: *delivery
order / DO*). Kolom (adaptasi papan agile): **Backlog** (semua order kirim baru) → **Dijadwalkan** (wajib masuk satu
*rit*: kendaraan, sopir, tanggal-jam berangkat) → **Dimuat** → **Di jalan** → **Selesai** (hasil dicatat), plus jalur
**Perlu tindak lanjut** (kembali/rusak/ditolak). Kartu digeser antar kolom (seret-lepas dan keyboard); kartu di kolom
Dijadwalkan dikelompokkan per rit seperti grup tab peramban (bisa dibuka-tutup, warna per kendaraan). Kartu di
Dijadwalkan yang belum masuk rit ditandai "belum direncanakan". Rit = perjalanan K-150 yang dijadwalkan lebih dulu.
**Teknis rencana:** pustaka seret-lepas `@dnd-kit` (aksesibel, mendukung keyboard) akan diajukan sebagai dependency
baru; status kolom tetap berasal dari status surat jalan/perjalanan (tidak ada status tampilan terpisah).

### K-161 — Muatan: dimensi, berat, dan kapasitas kendaraan

**Keputusan (pemilik):** data barang wajib punya **dimensi (p × l × t) dan berat** dengan satuan yang jelas; sistem
mengerti konversi (mm/cm/dm/m, g/kg/ton). Kendaraan punya ukuran bak (p × l × t), volume, dan **muatan maksimum
(payload)**. Saat order kirim dikelompokkan ke rit, sistem menghitung total berat, volume, dan barang terpanjang lalu
memberi tingkat peringatan: **aman**; **hampir penuh** (cek setelah dimuat); **lebih sedikit** (wajib konfirmasi dan
alasan kronologis bahwa kendaraan aman); **jauh melebihi / berat > payload** (ditolak, sarankan kurangi barang atau
kendaraan lain). Juga saran bila muatan terlalu sedikit untuk tujuan yang jauh/berpencar (pakai kendaraan lebih kecil
atau gabungkan). **Teknis rencana:** ambang mengacu praktik FMS dan aturan ODOL (*Over Dimension Over Load*, UU 22/2009
LLAJ dan PP 55/2012): berat tidak pernah boleh melebihi payload; dimensi dibandingkan per sumbu dengan toleransi
julur belakang yang diatur di Pengaturan. Barang lama tanpa dimensi ditandai "belum lengkap" dan dihitung terpisah.

**Selesai 24 Okt (bagian 1):** migrasi 0026 (data muatan barang per satuan dasar: berat kg, ukuran cm, curah,
volume m³; kendaraan: daya angkut = `kapasitas_kg`, ukuran bak, STNK/KIR; perjalanan: snapshot berat/volume dan
alasan muatan), isian di form barang dengan pilihan satuan (g/kg/ton, mm/cm/dm/m, L/m³), pratinjau muatan di dialog
Berangkat (bar berat/volume/panjang, pesan, saran) dan penegakan di API: berat > daya angkut ditolak; volume
100–115% atau barang menjulur ≤ julur yang diizinkan wajib alasan (≥ 10 huruf, tercatat); lebih dari itu ditolak.
Pengaturan bawaan: faktor isi 85%, julur 100 cm (`muatan_faktor_isi_persen`, `muatan_julur_maks_cm`). Rincian
rancangan di `docs/13-rancangan-logistik.md`. Saringan **Data muatan belum lengkap** di Data Barang dan isian faktor isi/julur di Pengaturan ›
Operasional ikut selesai. **Sisa:** isi data muatan massal lewat Excel.

### K-162 — FMS pendukung

**Keputusan (pemilik):** catatan dan statistik pendukung armada. **Rencana:** utilisasi muatan per rit, jumlah rit dan
lama di jalan per kendaraan/sopir, ketepatan waktu, masa berlaku STNK/KIR dengan pengingat, jadwal servis berdasarkan
odometer/tanggal, catatan BBM, dashboard Logistik. Dirinci setelah K-160/K-161.

### K-163 — Editor kampanye promo

**Keputusan (pemilik):** promo dibuat sebagai **kampanye** dengan **syarat** (boleh lebih dari satu) dan **manfaat**.
Syarat: periode mulai–akhir sampai **jam dan menit** (wajib), barang terpilih (banyak barang sekaligus), kategori, merk,
atribut, qty minimum, total belanja minimum, pelanggan/golongan, hari/jam berlaku, anggaran, batas per pembeli, riwayat
belanja pembeli. Manfaat: potongan persen/nominal, harga khusus, gratis barang (beli X gratis Y), voucher, kupon
undian. Kampanye bisa disimpan sebagai **templat** dan dipakai ulang. Istilah "Satu barang" menjadi **Per barang
(pilih beberapa)**.

### K-164 — Kebal *race condition* lebih lanjut

**Keputusan (teknis):** pengaman yang sudah ada dicatat di docs/02 (kunci baris, kunci transaksi, indeks unik,
penghitung nomor). Tambahan: **kunci idempoten** pada kiriman form uang (pembayaran, checkout, retur/void) agar kiriman
ganda karena jaringan tidak tercatat dua kali, dan **cek versi** (`diubah_pada`) pada ubah data master agar dua admin
yang mengubah barang yang sama tidak saling menimpa diam-diam.

**Selesai 24 Okt (rincian):** tabel `kunci_idempoten` (migrasi 0025; data teknis, dibersihkan otomatis setelah 24 jam).
Klien web memberi header `Idempotency-Key` pada setiap kiriman perubahan; kunci dibuang begitu ada jawaban, dan hanya
dipakai ulang bila jaringan gagal (tanpa jawaban), sehingga pembeli lain dengan transaksi yang kebetulan sama tetap
tercatat. Server: kunci baru dijalankan dan jawabannya disimpan; kunci selesai dengan isi sama dijawab dari simpanan;
isi beda ditolak; kunci yang masih diproses ditolak sementara. Cek versi untuk Barang, Pelanggan, dan Pemasok: form
mengirim `versi` (waktu ubah terakhir saat dibuka); beda dengan sekarang → `KONFLIK` "sudah diubah orang lain sejak
Anda membukanya". Klien tanpa versi tetap diterima.

### K-165 — Arsip tahunan dan perapian data

**Keputusan (pemilik):** setelah berbulan-bulan, data rutin (transaksi, mutasi, log, promo lama) dirapikan lewat
**tutup buku tahunan**: cadangan penuh dulu, ekspor arsip yang terdokumentasi (laporan tahunan, buku besar stok),
ringkasan saldo awal tahun baru, lalu data operasional lama dipindah ke arsip (tetap bisa dibuka baca-saja), bukan
dihapus: dokumen pembukuan wajib disimpan 10 tahun (UU KUP pasal 28). Data teknis (sesi login, kode persetujuan,
log teknis) boleh dibersihkan otomatis sesuai masa simpan. Termasuk unduh cadangan lewat aplikasi untuk server di cloud.

### K-166 — Pembaruan aplikasi yang aman bagi data lama

**Keputusan (pemilik):** pembaruan tidak boleh merusak data nyata. **Rencana (alur rilis):** (1) migrasi hanya maju
dan tidak pernah diedit (sudah berlaku); (2) cadangan otomatis "Sebelum pembaruan" (sudah ada) dan berhenti bila gagal;
(3) uji migrasi pada salinan database toko sebelum dipasang; (4) 5 alur kritis e2e wajib lulus (K-085); (5) nomor
versi dan catatan perubahan tampil di aplikasi; (6) langkah pulih bila pembaruan gagal. Ditulis sebagai prosedur di
panduan server.

### K-167 — Pencarian universal di topbar

**Keputusan (pemilik):** kotak cari di topbar (`Ctrl+K`) untuk menu, barang, pelanggan, pemasok, dan nomor dokumen
(ORD, STR, INV, SJ, RTR, …) sesuai izin. Tombol Order/Langsung/Pengantaran diperkecil agar muat.

**Selesai 24 Okt (rincian):** `GET /api/cari?q=` (izin `dashboard.dasar`, hasil per kelompok disaring izin: barang,
pelanggan, pemasok, penjualan, order — milik sendiri bila tanpa `lihat_semua` —, surat jalan, retur, void, penerimaan;
5 per kelompok; nomor dokumen dicari bila kata memuat angka). Menu dicari di peramban. Palet `Ctrl+K`: panah atas/bawah,
Enter membuka, Esc menutup. Daftar Barang/Pelanggan/Pemasok membaca `?cari=`.

---

## Urutan

1. A (K-152–K-159): selesai, di-push bersama keputusan ini.
2. K-164 (idempoten + cek versi) dan K-167 (pencarian universal) — **selesai 24 Okt**.
3. K-161 data dimensi/berat barang dan kendaraan — **bagian 1 selesai 24 Okt** (rancangan docs/13); lalu K-160 halaman Pengiriman, lalu K-162.
4. K-163 editor kampanye promo.
5. K-165 dan K-166 (alur arsip dan pembaruan), bersama sisa gelombang 3–4 lama (K-129 sisa, K-131, K-137, K-138, K-139,
   K-143) dan K-123 dst.
