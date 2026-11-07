# Masukan presentasi ke Owner UD. Sumber Urip (7 November 2026, K-222–K-232)

Pemilik proyek mempresentasikan BonsaiUrip 1.18.0 dan mendemokannya kepada Owner UD. Sumber Urip bersama seorang
ahli sistem informasi manajemen. Sebelas masukan dicatat di bawah. Pemilik proyek menyerahkan pembagian versi:
**V1** diselesaikan sampai stabil (tanpa bug besar atau kekurangan berarti), lalu **V2** dikembangkan.

## Ringkasan pembagian versi

| K | Masukan | Versi | Status |
|---|---|---|---|
| K-222 | Nama barang tersusun otomatis dari kategori, merek, atribut (tidak diketik bebas) | V2 | Rencana (rancangan di bawah) |
| K-223 | Jenis kas keluar baru: Biaya entertain | V1 | Selesai |
| K-224 | Bug: draf order tidak ikut harga jual terbaru | V1 | Selesai |
| K-225 | Peran dipisah (Administrator, Admin Persediaan, Kepala Toko) + persetujuan PO + wewenang bayar hutang | V2 | Rencana (rancangan di bawah) |
| K-226 | Sistem berlaku umum untuk toko ritel lain, fitur bahan bangunan tetap | V2 | Rencana (rancangan di bawah) |
| K-227 | Satuan ecer/grosir, kemasan tersegel, dan opname bertahap acak | V2 | Rencana (rancangan di bawah) |
| K-228 | Semua pintasan keyboard juga bisa diklik/disentuh | V1 | Selesai (bilah pintasan + F3 Order); audit menyeluruh di U-uji |
| K-229 | Jaringan HP/tablet lebih mudah: mode LAN toko + Tailscale | V1 | Rencana V1 (rancangan di bawah) |
| K-230 | Alur cetak label & barcode yang jelas, termasuk barang curah tanpa barcode | V1 panduan, V2 label rak | Rencana |
| K-231 | Lokasi barang di gudang (gudang, zona, rak, bin; lebih dari satu gudang) | V2 | Rencana (rancangan di bawah) |
| K-232 | Pemulihan akses Owner hanya bersama pengembang (bukan menu Start) | V1 | Selesai |

Sisa V1 sebelumnya tetap: K-218 (bahasa layar Data), K-219 (buat/ganti data toko dari aplikasi), K-220 (nama tab Data,
Pemeriksaan data dipisah). Urutan V1: K-224, K-228, K-223, K-232 (selesai 7 Nov) → K-218–K-220 → K-229 → panduan
K-230 → uji pemilik → rilis V1 stabil (2.0 dimulai sesudahnya).

---

## K-223 Biaya entertain (V1, selesai)

Jenis kas keluar `BIAYA_ENTERTAIN` di *Shift › Kas masuk/keluar*: uang laci yang diberikan kepada pihak lain atas
kesepakatan tertentu (jamuan, komisi mandor/tukang, tanda terima kasih). Keterangan **wajib**: untuk siapa dan
kesepakatan apa. Tercatat atas nama pencatat, mengurangi saldo laci seperti kas keluar lain, dan tampil terpisah di
riwayat shift sehingga Owner bisa menilai besarnya per bulan. Migrasi 0042 (CHECK `chk_kas_jenis`).

## K-224 Draf order mengikuti harga terbaru (V1, selesai)

Aturan P2 (harga yang dijanjikan di order tetap berlaku meski harga master berubah) ternyata juga berlaku untuk
**draf**. Akibatnya, setelah harga jual diubah di *Harga Jual*, draf yang dibuka lagi masih memakai harga lama. Draf
belum dikirim ke kasir dan belum menahan stok, jadi tidak menjanjikan apa pun. Perbaikan: baris draf tidak memakai
harga janji (pratinjau dan simpan), sehingga draf selalu memakai harga master terbaru. Order yang sudah dikirim ke
antrean/disimpan tetap memakai harga janji (P2 tidak berubah). docs/05 P2 diperjelas.

## K-228 Semua pintasan bisa diklik (V1, selesai bagian 1)

Aturan baru (melengkapi K-171/K-129, mouse + keyboard): **setiap aksi yang punya tombol keyboard wajib punya
tombol yang bisa diklik/disentuh**, karena HP/tablet tidak punya F1–F12. Dikerjakan: item pintasan di bilah bawah
(Order, Penjualan Langsung/Pengantaran, Pengiriman) kini tombol; label jenis order *LANGSUNG/PENGANTARAN* (F3) di
Order Penjualan kini tombol. Audit layar lain dicatat sebagai uji pemilik.

## K-232 Pemulihan akses Owner bersama pengembang (V1, selesai)

**Masalah:** menu Start *Pulihkan akses Owner* (K-211) bisa dijalankan siapa pun yang memakai akun Windows komputer
server, termasuk karyawan, sehingga akun Owner bisa diambil alih.

**Keputusan:**

1. Menu Start dihapus. Pemulihan hanya lewat `BonsaiUrip.exe --pulihkan`, dan hanya berhasil dengan **kode jawaban
   pengembang**.
2. Cara kerja (tantangan–jawaban dengan tanda tangan digital Ed25519):
   - komputer server membuat **kode tantangan** sekali pakai (berisi ID pemasangan, angka acak, batas 60 menit);
   - Owner mengirim kode itu ke pengembang; pengembang membuat **kode jawaban** dengan kunci rahasia yang hanya ada
     di komputer pengembang (`alat-pengembang/kunci-pemulihan.mjs jawab <kode>`);
   - aplikasi memeriksa jawaban dengan kunci publik yang tertanam; 5 kali salah membatalkan tantangan;
   - berhasil: Owner mendapat password sementara (wajib diganti) dan kode pemulihan baru; semua sesi Owner dicabut;
     **tercatat di log aktivitas** ("dipulihkan dengan kode pengembang").
3. Jalan ini juga menjadi jalan resmi pengembang membantu toko mana pun yang memakai BonsaiUrip, tanpa "pintu
   belakang" tersembunyi: tetap butuh komputer server toko itu dan tetap tercatat.
4. Urutan jalan pemulihan Owner: (a) **Lupa password › kode ke email Owner**; (b) **kode pemulihan** kertas;
   (c) **Owner kedua** (disarankan: pasangan/anggota keluarga dengan akun Owner sendiri bisa me-reset password Owner
   lain); (d) **pengembang** (langkah 2).
5. Batas yang disampaikan apa adanya: orang yang menguasai akun Windows server dan paham teknis tetap bisa merusak
   data dari luar aplikasi. Karena itu SOP-16 menetapkan **akun Windows server berpassword milik Owner**, karyawan
   memakai aplikasi lewat peramban, dan cadangan terenkripsi disimpan terpisah.
6. Kunci rahasia pengembang disimpan di `.pengembang/kunci-pemulihan.pem` (tidak di-commit) dan wajib dicadangkan
   pengembang ke tempat aman. Kunci hilang → buat pasangan baru dan pasang Setup baru di toko.

---

## K-229 Jaringan HP/tablet (V1, rancangan)

**Koreksi fakta:** paket gratis Tailscale *Personal* sejak April 2026 memuat 6 pengguna dengan perangkat tak terbatas,
tetapi hanya untuk pemakaian **non-usaha**; pemakaian toko memakai paket Standard (US$8/pengguna/bulan). Setiap
perangkat juga perlu memasang dan masuk Tailscale, sehingga penyiapan di toko lama.

**Pilihan yang dibandingkan:**

| Cara | Biaya | Penyiapan perangkat | Keamanan | Dari luar toko |
|---|---|---|---|---|
| **LAN toko + HTTPS lokal** (baru) | Gratis | Sekali: pindai QR, pasang sertifikat toko, buka alamat | Terenkripsi (HTTPS); perangkat harus didaftarkan Owner | Tidak |
| Tailscale (sudah ada) | US$8/bulan untuk usaha | Pasang aplikasi + masuk akun | Terenkripsi ujung ke ujung | Ya |
| Cloudflare Tunnel + Access | Gratis (perlu domain ± Rp 210 rb/tahun) | Tidak ada; buka alamat web, masuk dengan kode email | HTTPS + verifikasi email | Ya |
| OpenVPN/WireGuard sendiri | Gratis | Pasang aplikasi VPN | Baik | Butuh IP publik/port forwarding; kebanyakan internet rumah di Indonesia memakai CGNAT, jadi sering tidak bisa |

**Keputusan V1:** tambah **mode LAN toko** sebagai cara utama di dalam toko, tetap menyediakan Tailscale untuk dari
luar. Rancangan:

1. Saat mode LAN dinyalakan (*Pengaturan › Akses HP/tablet*), aplikasi membuat **sertifikat toko** sendiri
   (CA lokal milik toko, berlaku 10 tahun) dan sertifikat server untuk IP/nama komputer, lalu melayani HTTPS di
   jaringan toko (mis. `https://192.168.1.10:7443`).
2. Penyiapan perangkat (sekali): pindai QR di layar *Akses HP/tablet* → unduh sertifikat toko → pasang (Android:
   *Setelan › Keamanan › Pasang sertifikat CA*; iPhone/iPad: profil + *Percayai*) → buka alamat → *Tambahkan ke
   layar utama*. Panduan bergambar per jenis HP.
3. **Perangkat terdaftar:** perangkat baru di LAN harus disetujui Owner/Kepala Toko (kode 6 angka di layar
   perangkat dicocokkan di *Akses HP/tablet*). Orang yang tahu password WiFi tetap tidak bisa membuka aplikasi tanpa
   perangkat disetujui dan akun.
4. Saran jaringan di panduan: WiFi toko WPA2/WPA3 dengan password kuat, **WiFi tamu terpisah** untuk pembeli, IP
   tetap (DHCP reservation) untuk komputer server.
5. Database tetap satu di komputer server; mode jaringan hanya mengubah cara perangkat tersambung (tidak ada
   sinkronisasi), jadi data tetap seketika sama di semua perangkat.
6. Akses dari luar toko: Tailscale (sudah ada) atau Cloudflare Tunnel (V2, gratis untuk usaha).

---

## K-230 Label dan barcode (V1 panduan, V2 label rak)

**Fungsi label:** (1) barang tanpa barcode pabrik diberi kode BonsaiUrip lalu dicetak labelnya agar kasir cukup
memindai; (2) label harga di barang/rak; (3) kemasan (dus/sak) punya barcode sendiri sehingga memindai dus langsung
memakai satuan dus.

**Pemindai:** label memakai Code 128, yang terbaca semua pemindai barcode 1D/2D USB/Bluetooth. Pemindai bekerja
seperti keyboard: kode diketik ke kotak yang sedang aktif lalu Enter. Di kasir, tekan F2 (atau sentuh kotak cari),
pindai, barang langsung masuk keranjang. Tidak perlu program tambahan.

**Barang curah/kecil (baut, paku, kawat, pasir):** tidak dilabeli satu per satu. Standar toko: **label rak/wadah**
(barcode + nama + harga per satuan) ditempel di wadah/rak, dan **lembar barcode kasir** (daftar barang curah dengan
barcode, dicetak dan ditempel di meja kasir) untuk dipindai saat menjual. V1: panduan langkah demi langkah memakai
fitur cetak label yang ada. V2: jenis cetak *Label rak* dan *Lembar barcode kasir* (bersama lokasi K-231).

---

## K-225 Peran, persetujuan pembelian, dan wewenang pembayaran (V2, rancangan)

**Masalah:** peran Admin merangkap tiga fungsi: administrator sistem, petugas administrasi persediaan, dan pengganti
Owner di toko (persetujuan). Rangkap ini melanggar pemisahan tugas (orang yang memesan, menerima, dan membayar barang
bisa orang yang sama), membuka risiko pembelian fiktif, "toko di dalam toko", dan pemalsuan data.

**Prinsip (pengendalian internal standar, siklus pembelian *purchase-to-pay*):** tidak boleh satu orang memegang dua
dari empat fungsi berikut untuk transaksi yang sama: **memesan (otorisasi), menerima barang (penyimpanan), mencatat,
dan membayar.** Setiap pembayaran harus didukung **pencocokan tiga dokumen** (PO disetujui × penerimaan × faktur).

**Peran V2 (peran atas tidak otomatis mewarisi semua peran bawah; izin ditetapkan per peran):**

| Peran | Fungsi | Tidak boleh |
|---|---|---|
| **Owner** | Pemilik dan otoritas tertinggi (super admin): semua izin, menetapkan batas persetujuan, membuat akun Kepala Toko/Administrator, menyetujui di atas batas | — |
| **Kepala Toko** | Manajemen harian pengganti Owner di toko: persetujuan void/retur, persetujuan PO sampai batas, persetujuan penyesuaian/opname, tinjau shift dan selisih, jadwal opname | Mengubah pengaturan sistem, membuat akun Owner, membayar hutang di atas batas, menyetujui PO buatannya sendiri |
| **Administrator Sistem** | Teknis: akun karyawan (selain Owner/Kepala Toko), printer, cadangan, akses perangkat, pemeriksaan data | Transaksi uang, persetujuan, melihat laba/harga modal (kecuali diberi Owner) |
| **Admin Persediaan** (staf administrasi gudang & pembelian) | Data barang & harga (usulan), draf PO, penerimaan barang, pengiriman/rit, kendaraan, mencatat hitungan opname | Menyetujui PO, membayar hutang, menyetujui selisih opname, mengubah rekening pemasok |
| **Petugas Gudang** (opsional, akun HP) | Mengambil/menyiapkan barang (pick list), menghitung opname tanpa melihat angka sistem, mencatat hasil muat | Harga, uang |
| **Kasir** | Shift, pembayaran, struk, ajukan retur/void | Persetujuan |
| **Staf Penjualan** | Order | Uang |

Catatan: di toko kecil satu orang boleh memegang dua akun peran, tetapi aplikasi tetap menolak orang yang sama
menyetujui atau membayar dokumen yang ia buat sendiri.

**Alur pembelian V2:**

1. **Draf PO** oleh Admin Persediaan (dari *Saran pesan* atau manual).
2. **Persetujuan PO** (matriks yang diatur Owner):
   - total PO ≤ batas Kepala Toko dan tidak memuat barang *perlu persetujuan* → disetujui Kepala Toko;
   - di atas batas, atau memuat barang yang ditandai **perlu persetujuan Owner** (mahal, langka, harga sering
     berubah) → Owner;
   - harga beli di PO lebih tinggi > X% dari harga beli terakhir → wajib alasan dan persetujuan.
   Persetujuan memakai kode sekali pakai (seperti K-102), tercatat.
3. **Kirim ke pemasok** hanya setelah disetujui.
4. **Penerimaan barang** oleh petugas yang **bukan pembuat PO**; jumlah dihitung **tanpa melihat jumlah PO** (hitung
   buta), lalu dibandingkan otomatis; selisih > toleransi ditandai.
5. **Penerimaan tanpa PO** hanya untuk pembelian tunai kecil (≤ batas, mis. Rp 500.000) dan bukan barang *perlu
   persetujuan*; selain itu ditolak. Semua penerimaan tanpa PO masuk daftar tinjau Kepala Toko/Owner.
6. **Pencocokan tiga dokumen** (PO × penerimaan × faktur pemasok): hutang baru siap dibayar bila cocok; selisih
   harga/jumlah harus diselesaikan dulu (retur, nota debit, atau persetujuan).
7. **Pembayaran hutang:** Admin Persediaan menyiapkan jadwal bayar; **pembayaran dijalankan Owner** (atau Kepala
   Toko sampai batas yang ditetapkan Owner). Pembayar tidak boleh pembuat PO. Pembayaran tunai dari laci tetap lewat
   shift; transfer wajib No. referensi.
8. **Data pemasok:** menambah pemasok baru dan **mengubah rekening pemasok** wajib persetujuan Owner (mencegah
   pemasok fiktif atau pengalihan pembayaran).
9. **Laporan pengawasan:** PO per penyetuju, penerimaan tanpa PO, pembelian di atas harga terakhir, pemasok baru,
   selisih tiga dokumen, umur hutang.

---

## K-227 Satuan ecer/grosir, kemasan tersegel, dan opname bertahap acak (V2, rancangan)

**Masalah lapangan:** varian barang sangat banyak, gudang tidak tertata, dan barang kecil yang dijual per buah
(baut, paku, sekrup) jumlahnya ribuan. Menghitung semua barang sekaligus memakan satu shift penuh dan hasilnya tidak
akurat; jadwal opname yang bisa ditebak membuka celah kecurangan sesudah opname.

**Rancangan (gabungan praktik baku *cycle counting* dan usulan pemilik):**

1. **Satuan ecer dan satuan simpan/grosir per barang.** Setiap barang punya satuan dasar (ecer, mis. pcs) dan boleh
   punya satu atau lebih **kemasan simpan** dengan isi tetap (mis. *box segel isi 250 pcs*, *dus isi 12*, *sak 40
   kg*). Isi per kemasan berbeda untuk setiap barang dan diisi di data barang.
2. **Stok dua lapis:** stok tercatat sebagai **kemasan utuh tersegel** + **ecer terbuka**. Contoh 1.726 baut = 6
   box segel (1.500) + 226 ecer. Total tetap satu angka di satuan dasar; lapisan hanya menjelaskan wujudnya.
3. **Buka kemasan** adalah dokumen kecil: satu box segel dipindah ke ecer (stok total tidak berubah), tercatat siapa
   dan kapan. Penjualan ecer mengurangi ecer; bila ecer habis, aplikasi meminta catat *buka kemasan* dulu.
4. **Segel:** box segel diberi label segel bernomor (label BonsaiUrip). Opname menghitung box segel sebagai jumlah
   box (cepat). Untuk mencegah box diisi kurang, setiap periode aplikasi memilih **box acak untuk dibuka dan dihitung**
   (uji petik).
5. **Hitung dengan timbangan (counting scale) untuk barang kecil:** data barang menyimpan berat per buah (dari
   menimbang 50 buah). Saat opname, ecer boleh ditimbang: berat total ÷ berat per buah = jumlah buah, dibulatkan dan
   ditandai "hasil timbang". Ini metode baku untuk baut, paku, mur, dan sekrup.
6. **Opname bertahap (cycle count) menurut kelas ABC:**
   - kelas A (≈ 20% barang penyumbang ≈ 80% nilai/penjualan): dihitung **tiap bulan**;
   - kelas B: **tiap 3 bulan**; kelas C: **tiap 6 bulan**;
   - barang dengan selisih berulang, barang mahal, dan barang *perlu persetujuan* masuk lebih sering;
   - ecer terbuka dihitung lebih sering daripada box segel;
   - **opname penuh** tetap minimal setahun sekali sebelum tutup tahun.
7. **Jadwal acak yang tidak bisa ditebak:** setiap hari aplikasi menyusun **daftar hitung harian** kecil (mis. 10–30
   barang, ±30 menit kerja) secara acak berbobot dari barang yang jatuh tempo hitung. Daftar hanya terlihat oleh
   Kepala Toko/Owner sampai diberikan ke penghitung pada hari itu, dan dicetak/dibuka saat hitung dimulai. Barang
   yang sudah dihitung tetap bisa terpilih lagi (acak dengan pengembalian kecil) sehingga "aman setelah opname"
   tidak berlaku.
8. **Cara menghitung:** **hitung buta** (penghitung tidak melihat angka sistem); per **lokasi** (K-231); dua orang
   untuk barang kelas A/mahal; waktu hitung dicatat sehingga transaksi selama penghitungan diperhitungkan.
9. **Selisih:** di atas toleransi (per barang/nilai) → **hitung ulang** oleh orang lain; tetap berselisih → wajib
   **kode sebab** (salah serah, rusak, salah input, hilang, belum tercatat) dan **persetujuan Kepala Toko/Owner**
   sebelum stok dikoreksi. Penghitung tidak boleh menyetujui penyesuaiannya sendiri.
10. **Ukuran kinerja:** **akurasi catatan persediaan** (IRA) = barang yang cocok ÷ barang dihitung (target ≥ 95%),
    nilai selisih per bulan, selisih per penghitung/area, jumlah box segel yang terbukti kurang. Ditampilkan di
    dashboard Owner.

---

## K-231 Lokasi barang di gudang (V2, rancangan)

**Masalah:** aplikasi tahu stok ada, tetapi tidak tahu **di mana**. Gudang luas, lebih dari satu gudang, dan barang
tidak tertata membuat karyawan mencari dari ingatan.

**Rancangan (sistem alamat lokasi, standar pergudangan):**

1. **Struktur lokasi:** Gudang → Zona/Lorong → Rak → Tingkat/Bin. Kode lokasi pendek, mis. `G1-B-03-2` (Gudang 1,
   lorong B, rak 03, tingkat 2) atau `G2-HALAMAN` untuk area terbuka (pasir, batu, besi panjang).
2. **Label lokasi** berbarcode dipasang di setiap rak/area.
3. **Barang ↔ lokasi:** satu barang boleh di beberapa lokasi (lokasi utama/ambil + lokasi simpan cadangan). Stok
   per lokasi dicatat bila toko memilih mode *stok per lokasi*; mode sederhana cukup menyimpan **lokasi utama**.
4. **Multi-gudang:** stok per gudang, **transfer antar gudang** sebagai dokumen (keluar G1 → masuk G2), penerimaan
   memilih gudang tujuan.
5. **Pemakaian sehari-hari:** hasil cari barang menampilkan lokasinya; order yang dikirim ke kasir/gudang punya
   **daftar ambil** (*pick list*) urut lokasi; HP petugas gudang bisa memindai label lokasi untuk memastikan barang
   diambil dari tempat yang benar.
6. **Opname per lokasi:** daftar hitung K-227 disusun per lokasi sehingga penghitung berjalan satu jalur.
7. **Penataan fisik** (di luar aplikasi, masuk SOP): barang sejenis dalam satu zona, barang laris dekat pintu/kasir,
   barang berat di bawah, barang tidak layak jual dipisah ke *zona rusak*.

---

## K-222 Nama barang tersusun otomatis (V2, rancangan)

**Masalah:** nama barang diketik lengkap padahal kategori, merek, dan atribut juga diisi; terjadi input ganda dan nama
bisa tidak sesuai isian.

**Rancangan (penamaan baku dari atribut, praktik umum katalog ritel):**

1. Nama barang **disusun aplikasi** dan **tidak bisa diketik langsung**: `[Jenis/kategori] [Merek] [atribut kunci
   menurut urutan templat kategori] [varian]`, mis. *Semen Tiga Roda 50 kg* atau *Baut Hex M10 × 50 mm Galvanis*.
2. **Templat per kategori** (diatur Admin): atribut mana yang wajib, urutannya, dan satuannya (mis. kategori Pipa:
   diameter, panjang, tebal/kelas, warna).
3. **Kembar terdeteksi:** dua barang dengan kategori + merek + semua atribut kunci yang sama ditolak (kunci unik).
4. **Nama pendek** untuk struk dihasilkan otomatis (dipotong rapi); **nama pasar/alias** boleh ditambah untuk
   pencarian ("semen tiga roda", "PC").
5. **Excel/impor:** kolom kategori, merek, dan atribut kunci; nama dihitung di pratinjau; baris kembar ditolak.
6. **Perpindahan data lama:** nama lama disimpan sebagai alias; nama baru disusun dari isian; daftar barang yang
   atributnya belum lengkap ditampilkan untuk dilengkapi.

## K-226 Sistem berlaku umum untuk ritel (V2, rancangan)

1. **Inti umum** (semua toko ritel): barang/varian, satuan & kemasan, harga bertingkat, promo, kasir, order,
   persediaan, opname, pembelian, hutang/piutang, shift, laporan, peran.
2. **Modul per jenis usaha** dinyalakan di setup awal sesuai *jenis usaha* (sudah ada pilihannya): bahan bangunan
   (data muatan & armada, barang potong per meter, barang curah per volume, pengantaran truk), toko kelontong/
   minimarket (kedaluwarsa & batch, barang timbang), toko pakaian (varian ukuran/warna), apotek (V3).
3. Istilah dan menu mengikuti modul yang menyala; fitur bahan bangunan tetap dikembangkan.
4. Data contoh dan templat kategori per jenis usaha.

---

## Sisa backlog V1 lama yang diselesaikan (7 November)

- **K-119 Tes layar memakai database sendiri.** Akun database pengembangan tidak berhak membuat database, jadi tes
  layar memakai **klaster PostgreSQL sekali pakai** (program PostgreSQL bawaan paket) di `.uji-e2e/`, port 54399,
  database `tbsu_e2e` yang dibuat ulang setiap putaran, dengan server API/web uji sendiri (3100/5174).
  `pnpm test:e2e` dan `pnpm test:e2e:kritis` kini memakai cara ini; `pnpm test:e2e:dev` untuk server pengembangan.
  Diuji: 5 alur kritis lulus. *Selesai.*
- **K-168 Mode demo terpisah → data latihan.** Dengan K-219 (ganti data toko tanpa memasang ulang), mode demo dibuat
  sebagai **data latihan**: Pengaturan › Data toko › **Buat data latihan** (password Owner). Data yang sedang dipakai
  disimpan dulu; data baru bernama *LATIHAN – <nama toko>* berisi akun Owner yang sama (username dan password), contoh
  barang dengan stok 100, pelanggan, pemasok, kendaraan & sopir, setup awal dianggap selesai. Konfigurasi
  `mode_latihan` menampilkan pita ungu **MODE LATIHAN** di semua layar (Owner mendapat tautan kembali ke data asli).
  Kembali: Data toko › data asli › Pakai data ini. Dipakai untuk pelatihan karyawan (proposal Bab 9). *Selesai.*
- **K-145 Pintasan keyboard per pengguna.** Menu akun › **Pintasan keyboard**: tombol F untuk aksi layar kasir (cari,
  antrean, pelanggan, bayar, mulai dari awal) dan Order Penjualan (cari, jenis, pelanggan, simpan nanti, kirim, mulai
  dari awal, daftar order) bisa diganti. Pilihan F2–F4, F6–F10; F1 tetap untuk tanda kali jumlah; F5/F11/F12 dipakai
  peramban. Tombol yang sama dalam satu layar ditolak (aturan di `packages/shared/src/pintasan.ts`, dipakai API dan
  layar). Disimpan di akun (`pengguna.pintasan`, migrasi 0043), bukan peramban, sehingga ikut ke perangkat lain.
  Bilah pintasan, petunjuk tombol, dan pesan memakai tombol pilihan pengguna. *Selesai.*
