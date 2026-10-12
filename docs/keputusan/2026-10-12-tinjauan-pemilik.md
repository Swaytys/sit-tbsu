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
