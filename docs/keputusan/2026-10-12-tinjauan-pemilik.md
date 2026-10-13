# Keputusan Tinjauan Pemilik — 12 Oktober 2026

Melanjutkan penomoran dari `2026-10-11-tinjauan-pemilik.md`. Sumbernya masukan pemilik proyek dan seorang
programmer yang ikut menguji aplikasi (disampaikan lewat pemilik). Butir **(pemilik)** diputuskan pemilik
(sebagian lewat pilihan yang diajukan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-106 — Perbaikan tampilan dan alur layar (gelombang 1)

**Status:** tidak mengubah aturan bisnis maupun skema. Mengubah tampilan, satu jawaban API (kandidat retur),
dan cara tes e2e disiapkan.

**Keputusan:**

1. **Data akun lama dibuang setiap login.** Laporan pemilik: email yang didaftarkan untuk Owner "ikut" tampil
   di akun Admin. Di database email Admin tidak berubah; yang salah tampilannya. Berpindah akun tanpa menekan
   Keluar (tombol masuk cepat, atau login lagi setelah sesi berakhir) tidak membuang data yang sudah dimuat
   peramban untuk akun sebelumnya, sehingga form Admin menampilkan kontak Owner sampai datanya kadaluarsa
   (±30 detik). Kini setiap login membuang semua data akun sebelumnya (`gantiPengguna`), sama seperti logout.
2. **Judul halaman tidak lagi terhimpit saat jendela dipersempit.** Tombol di kanan judul turun ke baris
   berikutnya, dan teks keterangan tidak pernah lebih sempit dari 20rem. Berlaku di semua halaman daftar dan
   halaman detail yang punya tombol di samping judul.
3. **Form sejajar.** Penyebab label dan kotak isian yang tidak segaris: `FormItem` yang lebih pendek (tanpa
   teks keterangan) ikut diregangkan setinggi tetangganya, sehingga label dan kotaknya turun. `FormItem` kini
   rapat ke atas (`content-start`); satu perubahan ini merapikan semua form. Baris centang (mis. "Jadikan
   limit ini bawaan") kembali sebaris dengan labelnya, dan pilihan (select) di form promo selebar kolomnya.
4. **(pemilik) Keterangan tier belanja dibuat menonjol.** "Belanja Rp … lagi untuk harga …" tampil sebagai
   kotak kuning dengan angka besar berwarna merah; tier yang sedang berlaku tampil sebagai kotak hijau. Nama
   tier yang sudah diawali kata "Harga" tidak lagi ditulis "harga Harga 23%".
5. **(pemilik) Daftar laporan menjadi pohon.** Tiga kelompok (Persediaan, Penjualan, Keuangan) bisa dibuka dan
   ditutup; isinya menjorok dengan garis penghubung; kelompok yang ditutup tetap bertanda bila memuat laporan
   yang sedang dibuka. Kelompok mana yang ditutup diingat per komputer (preferensi tampilan).
6. **(pemilik) Retur penjualan:**
   - Daftar transaksi langsung tampil (20 transaksi terbaru) tanpa harus mencari; pencarian tetap ada untuk
     transaksi lama. `GET /api/retur/kandidat` tanpa kata cari mengembalikan transaksi terbaru.
   - **Potong tagihan hanya ditawarkan bila transaksi itu masih punya sisa tagihan** (aturan T7 memang hanya
     memotong tagihan transaksi yang diretur). Sisa tagihan tampil di daftar dan di kepala form; bila nilai
     retur melebihi sisa tagihan, tombol proses nonaktif dengan petunjuk memakai "Uang dikembalikan".
   - "Tukar barang sama" dinamai **"Tukar barang sama (tukar guling)"** dan dijelaskan di tempat.
7. **(pemilik) Bayar campuran dirapikan.** Bayar campuran = satu tagihan dibayar dengan lebih dari satu cara.
   Alur: pilih cara bayar bagian pertama, ketik nominalnya, tekan **C**; bagian itu masuk daftar bernomor dan
   sisa tagihan berkurang; ulangi; **Enter** pada bagian terakhir. Yang berubah:
   - tiap bagian bisa dihapus (tombol silang; **Backspace** saat kotak bayar kosong menghapus bagian terakhir;
     "Hapus semua");
   - daftar menampilkan jumlah yang sudah dicatat dan sisa;
   - **pesan galat tampil tepat di bawah kotak bayar** (sebelumnya di dasar panel, tergulung di layar pendek);
   - menekan C tanpa nominal menjelaskan langkahnya, bukan sekadar menolak.
8. **(pemilik) Tombol "Mulai dari awal"** di Order Penjualan (input cepat dan form lengkap), Penjualan
   Langsung, dan Penjualan Pengantaran. Bisa diklik atau lewat **F9**, dan **selalu bertanya dulu**; tombol
   bawaan dialog adalah Batal, jadi F9 yang terpencet lalu Enter tidak mengosongkan apa pun. Di layar kasir
   dan pengantaran, order dari antrean **tidak dihapus**: dikembalikan ke antrean dan bisa diproses lagi. Di
   Order Penjualan, isian order yang belum dikirim dikosongkan (draf yang sedang diisi ikut dibuang).
9. **Tes e2e tidak lagi bergantung pada tier harga yang sedang aktif.** Tes berjalan di database
   pengembangan; tier yang diaktifkan pemilik saat mencoba (mis. "Harga 23%" mulai Rp 500.000) mengubah total
   dan menggagalkan tes lain. `apps/web/e2e/penyiapan-global.ts` menonaktifkan tier selain tier dasar selama
   tes dan mengaktifkannya kembali sesudahnya; bila tes terhenti paksa, penyiapan berikutnya memulihkannya.

*Alasan:* semuanya masukan langsung dari percobaan di layar. Butir 1 dan 3 punya satu akar masalah
masing-masing, jadi diperbaiki di akarnya, bukan per halaman.

*Ditolak:*
- **Menebak cara penyelesaian retur dari data** (mis. otomatis potong tagihan bila ada tagihan): kasir yang
  tahu kesepakatan dengan pembeli; sistem cukup tidak menawarkan pilihan yang pasti ditolak.
- **F9 langsung mengosongkan seperti sebelumnya dengan Ctrl+Z sebagai pengaman**: pemilik meminta peringatan;
  Ctrl+Z tetap ada sebagai lapis kedua.
- **Mengubah data tier pemilik secara permanen untuk tes**, atau menulis ulang tiap tes agar kebal tier:
  penyiapan global lebih kecil dan memulihkan keadaan semula.

---

### K-107 — Data Pelanggan: posisi kredit di daftar; ubah/nonaktif oleh Kasir/Staf butuh kode atasan

**Status:** mengubah docs/04 §3 dan §6 (arti izin `master.pelanggan.kelola` dan `master.pelanggan.atur_kredit`),
docs/03 (kolom `permintaan_persetujuan.sidik`, jenis `UBAH_PELANGGAN`; migrasi 0015).

**Keputusan:**

1. **(pemilik) Kasir dan Staf Penjualan tidak lagi bisa mengubah atau menonaktifkan pelanggan sendiri.**
   - **Menambah pelanggan baru tetap bebas** (dibutuhkan saat melayani pembeli baru, mis. pengantaran).
   - **Mengubah data pelanggan yang sudah ada, menonaktifkan, atau mengaktifkannya kembali** oleh pengguna
     tanpa `master.pelanggan.atur_kredit` butuh **kode sekali pakai dari Admin/Owner**, dengan mekanisme
     K-102: pengguna menekan *Simpan dengan persetujuan…*, sistem mengirim kode ke Telegram/email tiap
     Admin/Owner beserta **rincian perubahannya** (kolom, nilai lama → nilai baru; atau "Nonaktifkan
     pelanggan X, piutang berjalan Rp …"), atasan yang setuju menyebutkan kodenya.
   - Golongan, term, dan limit kredit tetap hanya bisa diatur Admin/Owner (K-059), tanpa jalur kode.
   - Admin/Owner mengubah langsung seperti sebelumnya.
2. **Kode terikat pada isian.** Permintaan menyimpan sidik (SHA-256) dari pelanggan + isian yang dimintakan
   (`permintaan_persetujuan.sidik`). Saat kode dipakai, sidik isian yang dikirim harus sama: kode untuk
   "ubah alamat menjadi A" tidak bisa dipakai untuk "ubah alamat menjadi B" atau untuk menonaktifkan. Sifat
   lain sama dengan K-102 (10 menit, sekali pakai, 5 kali salah ketik, hanya untuk pengaju). Log perubahan
   mencatat pengubah dan atasan pemilik kode.
3. **Tidak ada izin baru.** Pemegang `master.pelanggan.atur_kredit` (Admin, Owner) = yang boleh mengubah
   langsung dan yang kodenya sah. Keterangan kedua izin di daftar izin diperbarui.
4. **(pemilik) Kolom Data Pelanggan diperkaya** dengan posisi kredit yang dihitung server dari penjualan
   belum lunas (bukan VOID): **limit kredit dan sisanya**, **tagihan berjalan** (jumlah dan banyaknya nota),
   **jatuh tempo terdekat** dengan jaraknya ("5 hari lagi", "jatuh tempo hari ini", "terlambat 3 hari"), dan
   status aktif. `Pelanggan.kredit` ikut di semua jawaban API pelanggan. Tombol "?" menjelaskan tiap kolom.
5. **Server tes e2e tidak pernah mengirim pesan sungguhan.** Sejak pemilik mengisi bot Telegram dan SMTP di
   database pengembangan, tiap tes persetujuan mengirim kode ke Telegram/email pemilik. `SALURAN_TIRUAN=1`
   (hanya di luar produksi) membuat semua pesan kode masuk kotak keluar uji saja. `LOGIN_MAKS_PER_MENIT`
   (juga hanya di luar produksi) menaikkan batas login untuk server tes, yang login puluhan kali semenit.

*Alasan:* limit sudah terlindungi, tetapi menonaktifkan pelanggan (sehingga tidak bisa bertransaksi) atau
mengganti kontaknya juga bisa disalahgunakan atau dilakukan tanpa sengaja. Kode sekali pakai sudah dikenal
kasir dan atasan dari retur/void, dan tidak butuh atasan berada di toko.

*Ditolak:*
- **Hanya Admin/Owner yang boleh mengubah (tanpa kode):** ditawarkan; pemilik memilih jalur kode supaya
  kasir tetap bisa memperbaiki kontak pelanggan saat atasan tidak di tempat.
- **Menambah pelanggan baru juga pakai kode:** ditawarkan dan tidak dipilih; kasir akan sering tertahan.
- **Antrean "usulan perubahan" yang disetujui belakangan:** butuh layar dan status baru; perubahan kontak
  biasanya dibutuhkan saat itu juga.
- **Kode yang menyetujui "pelanggan X" tanpa mengikat isinya:** kode bisa dipakai untuk perubahan yang
  berbeda dari yang dibaca atasan.

---

### K-108 — Pencarian barang lewat atribut dan kategori; katalog bergambar dijadwalkan v2.0.0

**Status:** mengubah perilaku `GET /api/barang?cari=` (dipakai semua kotak cari barang) dan kotak cari layar
Order Penjualan, Penjualan Langsung, dan Penjualan Pengantaran. Tidak mengubah skema.

**Keputusan:**

1. **(pemilik) Atribut dan kategori ikut dicari.** Kotak cari dipecah per kata; **semua kata harus cocok**,
   masing-masing boleh di kolom berbeda: nama, kode, barcode, merk, **kategori**, barcode satuan jual, atau
   **atribut** (nilai teks seperti warna, nama jenis atribut, nilai angka yang sama, kode satuannya, atau
   gabungannya seperti `40kg`). Contoh: `pipa 3 inch putih`, `cat 5 kg`, `besi 12 mm`. Angka pada atribut
   dicocokkan utuh ("2" tidak menemukan 12,5); koma desimal diterima.
2. **Urutan relevansi.** Barang yang cocok lewat nama/kode/barcode tampil di atas barang yang hanya cocok
   lewat kategori, merk, atau atribut. Tanpa ini kata "semen" menaruh semua barang berkategori Semen di atas
   "Semen Gresik", dan Enter cepat bisa menambah barang yang salah.
3. **Saring kategori dan daftar tanpa mengetik.** Di samping kotak cari ada pilihan kategori dan tombol
   **Daftar** (atau Alt+↓): daftar barang tampil urut nama (30 pertama) dan bisa diklik, atau disorot dengan
   panah lalu Enter. Enter pada kotak kosong tanpa memindah sorotan tetap berarti "lanjut bayar/kirim".
4. **Foto kecil di hasil cari**, dan foto lebih besar untuk barang yang disorot. Memakai gambar barang yang
   sudah ada, dimuat malas (`loading="lazy"`), paling banyak 8 hasil saat mencari dan 30 saat menjelajah.
5. **(pemilik) Katalog bergambar dijadwalkan v2.0.0** (docs/08 F8): kisi kartu barang dengan foto besar,
   kategori, atribut, harga per satuan, stok, dan tanda promo; bisa dicari dan disaring di dalamnya; dibuka
   dari kotak bergaris putus-putus di area "Belum ada barang". Pencarian cepat tetap ada: dua cara untuk dua
   kebiasaan (cepat dengan keyboard, nyaman dengan gambar).

*Alasan:* atribut dan kategori yang sudah susah payah diisi tidak berguna bila tidak bisa dicari. Katalog
bergambar butuh gambar kecil (thumbnail) buatan server supaya tidak berat, jadi dikerjakan sebagai satu
pekerjaan tersendiri.

*Ditolak:*
- **Satu frasa utuh seperti sebelumnya:** "semen 40" hanya cocok bila tertulis persis berurutan di nama.
- **Mencocokkan angka atribut sebagai potongan teks:** "2" akan menemukan 12, 20, 2,5, dan seterusnya.
- **Membuat katalog sekarang dengan gambar asli (sampai 2 MB per gambar):** puluhan gambar besar sekaligus
  membuat layar kasir tersendat di jaringan toko.

---

### K-109 — Shift: terlewat mengunci pencatatan, jadwal buka/tutup, pengingat

**Status:** menambah aturan K9–K11 di docs/05 §10; migrasi 0016 (`shift_kasir.jadwal_buka`, `jadwal_tutup`,
`diingatkan_pada`); kunci konfigurasi `shift_jam_buka`, `shift_jam_tutup`.

**Latar:** pemilik melihat baris berstatus Buka di riwayat shift dan menilainya bug berat. Pemeriksaan: tiga
shift (akun demo Admin, Kasir, Owner; dibuka 10–11 Oktober) memang tidak pernah ditutup pemiliknya. Datanya
tidak rusak; yang kurang adalah aturannya: sistem membiarkan shift melewati hari tanpa peringatan atau kunci,
sehingga penjualan hari berikutnya ikut masuk shift lama.

**Keputusan:**

1. **Sistem tidak pernah menutup shift sendiri.** Menutup shift = clerical check, yang butuh hitungan uang di
   laci (K4). Yang dilakukan sistem: mengingatkan dan, bila perlu, mengunci.
2. **(pemilik) K9 — shift terlewat mengunci.** Shift BUKA yang `tanggal_operasional`-nya sebelum hari ini
   disebut *terlewat*. Selama pemiliknya punya shift terlewat, ia **tidak bisa mencatat penjualan, pembayaran
   (tunai maupun non-tunai), kas masuk/keluar, atau refund**, dan tidak bisa membuka shift baru, sampai shift
   itu ditutup. Pesan galatnya menyebut nomor dan tanggal shift serta langkahnya. Tujuannya: satu shift tidak
   memuat uang beberapa hari, dan selisih kas diketahui paling lambat keesokan harinya.
3. **(pemilik) K10 — jadwal shift toko** (Pengaturan › Operasional, hanya Admin/Owner): jam buka dan jam tutup
   (`JJ:MM`, boleh kosong). **Jadwal dibekukan ke tiap shift saat shift itu dibuka**; mengubah pengaturan
   hanya memengaruhi shift yang dibuka sesudahnya. Jam tutup harus setelah jam buka.
4. **Lewat jam tutup = peringatan, bukan kunci.** 15 menit sebelum jam tutup: pengingat biru di atas semua
   halaman kasir itu. Setelah lewat: peringatan kuning, dan penjualan tetap bisa (pembeli yang datang
   terlambat tetap dilayani).
5. **K11 — atasan diberi tahu.** Lonceng menampilkan "Shift perlu ditutup" (jumlah shift yang lewat jam tutup
   atau terlewat) bagi pemegang `kas.shift.lihat_semua`, dan "Shift Anda belum ditutup" bagi pemilik shift.
   Server juga mengirim pesan Telegram/email ke Admin/Owner, paling banyak sekali sehari per shift.
6. **Admin/Owner bisa menutup shift orang lain dari layar.** API-nya sudah ada sejak Fase 6, layarnya belum.
   Di tab *Semua shift*, nomor shift yang masih buka menampilkan bagian *Tutup shift ini*: Admin/Owner
   menghitung uang di laci kasir itu dan mengisinya. Ada saringan *Hanya yang perlu ditutup* dan tanda warna
   (Buka / Buka, lewat jam tutup / Terlewat, belum ditutup).

*Alasan:* dipilih pemilik dari tiga pilihan. Kunci tepat setelah jam tutup menolak pembeli yang datang
terlambat; peringatan saja mengulang masalah yang dilaporkan.

*Ditolak:*

- **Menutup shift otomatis dengan uang fisik = saldo sistem:** menghilangkan inti clerical check (selisih
  tidak pernah ketahuan).
- **Hanya mengunci pembayaran tunai:** penjualan non-tunai kasir itu tetap akan menempel ke shift lama dan
  mengacaukan rekap hari sebelumnya.
- **Jadwal langsung berlaku untuk shift berjalan:** diminta pemilik agar tidak berubah di tengah shift.

---

### K-110 — Promo: pindah ke Pengaturan, jumlah potongan yang diberikan, anggaran, batas per pembeli

**Status:** menambah PR10–PR11 di docs/06 §3; migrasi 0017 (`promo.anggaran`, `promo.maks_per_pembeli`).

**Keputusan:**

1. **(pemilik) Promo menjadi tab Pengaturan › Promo.** Menu samping "Promo" dihapus; alamat lama `/promo`
   dialihkan. Izinnya tetap `promo.kelola`.
2. **(pemilik) Jumlah potongan yang sudah diberikan tampil di daftar promo**: Σ `diskon_promo` baris
   penjualan yang memakai promo itu, tidak termasuk baris atau penjualan VOID.
3. **(pemilik) PR10 — anggaran promo** (`anggaran`, rupiah, opsional): jumlah seluruh potongan yang boleh
   diberikan promo. Bila sisa anggaran lebih kecil dari potongan sebuah baris, baris itu dipotong **sebesar
   sisanya**; setelah habis promo gugur dan promo cocok berikutnya (bila ada) yang dipakai. Sisa dibagi ke
   baris-baris satu transaksi secara berurutan. Void mengembalikan anggaran; retur tidak.
4. **(pemilik) PR11 — batas per pembeli** (`maks_per_pembeli`, rupiah, opsional): potongan paling banyak
   untuk satu pembeli dari promo itu, supaya satu pembeli tidak menghabiskan anggaran. Pelanggan terdata:
   dijumlah dari semua transaksinya. Pembeli umum (tanpa identitas): per transaksi. Bila anggaran juga diisi,
   batas per pembeli **harus lebih kecil** dari anggaran.
5. Anggaran dan batas per pembeli **boleh diubah walau promo sudah dipakai** (keduanya bukan aturan potongan
   yang dikunci K-087), tetapi anggaran tidak boleh di bawah yang sudah diberikan.
6. Saat checkout, promo berbatas dikunci dulu (`FOR UPDATE`, urut id) sebelum sisanya dibaca, supaya dua
   kasir yang membayar bersamaan tidak sama-sama memakai sisa yang sama. Pratinjau di keranjang memakai sisa
   saat itu tanpa mengunci; angka final selalu dari checkout (PR5).

*Alasan:* promo adalah pengaturan toko, bukan pekerjaan harian; dan pemilik perlu tahu berapa uang yang
"mengucur" serta bisa membatasinya.

*Ditolak:*

- **Promo gugur seluruhnya bila sisa anggaran kurang dari potongan penuh:** pembeli terakhir tidak mendapat
  apa-apa padahal masih ada sisa; memotong sebesar sisa lebih mudah dijelaskan di kasir.
- **Batas per pembeli dalam persen anggaran:** rupiah lebih langsung dibaca dan dihitung.
- **Membatasi pembeli umum lintas transaksi:** tidak ada identitas untuk menghitungnya. Promo yang benar-benar
  harus dibatasi per orang sebaiknya disasarkan ke pelanggan terdata (K-097).

---

### K-111 — Rekening toko, metode QRIS, dan pengecekan uang masuk non-tunai

**Status:** menambah K12–K14 di docs/05 §10 dan mengubah P8; migrasi 0018 (tabel `rekening_toko`; kolom
`pembayaran_penjualan.id_rekening`, `status_verifikasi`, `diverifikasi_oleh`, `diverifikasi_pada`,
`catatan_verifikasi`; metode `QRIS`); izin baru `kas.rekening.lihat` dan `kas.nontunai.verifikasi`.

**Latar:** pemilik meminta (a) pengaturan bank/EDC yang diterima toko supaya kasir tidak mengetik nomor
rekening, dan (b) cara mengetahui bahwa transfer/QRIS/EDC "beneran masuk", dengan anggapan pemantauan seperti
itu gratis.

**Keputusan:**

1. **Pemantauan otomatis tidak ada yang gratis dan resmi**, dan itu disampaikan apa adanya kepada pemilik:
   mutasi rekening hanya bisa dibaca aplikasi lewat API bank (butuh kontrak) atau perantara berbayar (payment
   gateway dengan potongan per transaksi, atau layanan cek mutasi berlangganan). **(pemilik)** memilih:
   daftar rekening + **pengecekan manual** sekarang; payment gateway dicatat untuk v2.0.0 (docs/08 A12).
2. **K12 — rekening toko** (Pengaturan › Pembayaran, `sistem.pengaturan.kelola`): rekening bank (untuk
   Transfer), mesin EDC, dan QRIS. Isian: jenis, nama bank/penyedia, nomor (opsional untuk EDC/QRIS), atas
   nama (opsional); labelnya disusun otomatis. Satu **bawaan** per jenis. Data master: dinonaktifkan, tidak
   dihapus. Daftar aktifnya dibaca pencatat pembayaran lewat izin `kas.rekening.lihat` (Kasir ke atas).
   Konfigurasi lama `rekening_transfer_default` / `rekening_edc_default` (K-073) dipindahkan migrasi menjadi
   baris tabel ini dan isiannya di Pengaturan › Operasional dihapus.
3. **Metode pembayaran QRIS** ditambahkan di samping Tunai, Transfer, EDC (huruf **Q** di layar kasir).
4. **K13 — kasir memilih, tidak mengetik.** Pada pembayaran non-tunai, rekening tujuan dipilih dari daftar
   (`idRekening`); bawaannya terpilih sendiri. API memeriksa rekening itu aktif dan jenisnya sama dengan
   metode, lalu menyalin labelnya ke `pembayaran_penjualan.rekening`. Bila toko belum mendaftarkan rekening
   untuk metode itu, kasir masih boleh mengetik tujuannya (dengan petunjuk mendaftarkannya), supaya penjualan
   tidak terhenti.
5. **K14 — pengecekan uang masuk.** Tiap pembayaran non-tunai mulai dari `BELUM_DICEK`. Pemegang
   `kas.nontunai.verifikasi` (Admin, Owner) membuka *Shift & Clerical Check › Cek uang non-tunai*,
   mencocokkannya dengan mutasi m-banking / rekap settlement EDC / riwayat QRIS, lalu menandai `SUDAH_MASUK`
   atau `TIDAK_MASUK` (wajib catatan). Layar menampilkan jumlah dan total per rekening untuk saringan yang
   dipilih (angka yang dibandingkan dengan mutasi), dan lonceng menampilkan yang belum dicek serta yang tidak
   masuk. Hasilnya tampil di rincian penjualan. Tiap perubahan tercatat di log (`PEMBAYARAN_VERIFIKASI`).
6. **`TIDAK_MASUK` adalah tanda, bukan koreksi.** Penjualan tetap tercatat seperti semula. Tindak lanjutnya
   oleh manusia: menagih pembeli lalu mengubah tanda menjadi Sudah masuk, atau mengoreksi penjualan lewat
   void/retur. Pembatalan pembayaran otomatis dicatat sebagai usulan (docs/08 D-K12).
7. **Refund retur/void lewat transfer** memilih rekening toko asal uangnya dari daftar yang sama; rekening
   pembeli/nomor referensi menjadi isian opsional. Kasir tidak lagi wajib mengetik nomor rekening.
8. Pembayaran non-tunai yang dicatat sebelum migrasi ditandai `SUDAH_MASUK` dengan catatan khusus, supaya
   daftar "belum dicek" hanya berisi pembayaran setelah fitur ini ada.
9. `pembayaran_penjualan` tetap append-only: yang berubah hanya kolom status pengecekan (docs/03).

*Alasan:* daftar rekening menghilangkan salah ketik dan membuat rekap per rekening mungkin; pengecekan manual
memberi kepastian tanpa biaya dan tanpa bergantung pada pihak ketiga; daftar rekening ini juga dasar yang
dibutuhkan bila kelak memakai payment gateway.

*Ditolak:*

- **Payment gateway sekarang:** butuh pendaftaran usaha dan akun penyedia dari pemilik, potongan per
  transaksi, dan server toko tidak punya alamat publik untuk menerima pemberitahuan.
- **Membaca mutasi dengan menyimpan nama pengguna dan kata sandi internet banking di aplikasi** (cara
  layanan tidak resmi): berisiko pemblokiran rekening dan melanggar ketentuan bank.
- **`TIDAK_MASUK` otomatis membuka kembali tagihan:** pembeli umum tidak boleh punya piutang (P7), dan
  mengubah tagihan tanpa dokumen koreksi melanggar aturan append-only.
- **Memakai kembali isian teks rekening di Pengaturan › Operasional:** hanya satu rekening per metode dan
  tetap bisa diubah kasir dengan mengetik.

---

### K-112 — Cetak: printer per jenis dokumen menjadi syarat aplikasi desktop

**Status:** tidak ada perubahan kode. Menambah syarat Fase 13.1 (docs/07) dan butir F4 (docs/08).

**Latar:** pemilik mencetak laporan dan pratinjaunya memakai setelan printer thermal dari cetakan struk
sebelumnya.

**Keputusan:**

1. **Ukuran dan arah kertas sudah ditentukan tiap dokumen** oleh aplikasi: struk = lebar gulungan, invoice
   dan surat jalan = A4 potret, laporan = A4 potret atau lanskap menurut jumlah kolomnya, label = ukuran label.
   Ini tidak perlu pengaturan baru.
2. **Yang "ingat setelan sebelumnya" adalah jendela cetak peramban**: ia mengingat printer terakhir (mis.
   POS58), dan halaman web tidak diizinkan memilih printer. Itu batas peramban, bukan pengaturan aplikasi.
3. **Jalan keluar sekarang:** struk dicetak langsung ke printer thermal (K-103, K-105). Sejak itu jendela cetak
   hanya dipakai dokumen A4, sehingga yang diingatnya adalah printer A4. Bila struk masih lewat jendela cetak,
   pakai jendela kasir tersendiri (`scripts/kasir/buka-kasir.cmd`), yang punya ingatan printernya sendiri.
4. **Jalan keluar tuntas = aplikasi desktop (Fase 13.1):** pengaturan *printer per jenis dokumen* (struk,
   label, invoice/surat jalan, laporan), dan cetak tanpa jendela untuk semuanya. Dicatat sebagai syarat fase
   itu.

*Ditolak:* membuat pengaturan "printer per dokumen" di versi peramban: peramban tidak menyediakan cara
menerapkannya, sehingga pengaturannya tidak akan berpengaruh.
