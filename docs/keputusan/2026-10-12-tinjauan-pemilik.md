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
