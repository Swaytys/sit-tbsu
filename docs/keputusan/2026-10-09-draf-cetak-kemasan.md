# Keputusan dari Tinjauan Pemilik (lanjutan 2): Draf Order, Cetak Struk, Kemasan Campur — 9 Oktober 2026

Melanjutkan penomoran dari `2026-10-09-harga-satuan-cetak.md`. Butir **(pemilik)** berasal dari masukan pemilik
proyek; butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-095 — Draf order otomatis, pilihan cetak struk, beberapa satuan untuk satu barang, modal belum diketahui

**Keputusan:**

1. **(pemilik) Satu barang boleh beberapa baris asal satuannya berbeda** (menggantikan K-091 #3), mis. 100 dus +
   50 buah keramik, masing-masing dengan harganya sendiri. Baris dikenali dari barang + satuan
   (`kunciBaris`); barang dan satuan yang sama dalam dua baris ditolak ("ubah qty-nya saja"). Stok, reservasi,
   dan pesan stok kurang dihitung dari total satuan dasar semua baris barang itu; syarat qty tier otomatis (H8)
   juga memakai total satuan dasar barang itu. Promo tetap per baris. Di kasir, memilih kemasan lain di hasil
   cari menambah baris baru; tombol **S** tidak dipakai bila satuan tujuannya sudah punya baris.
2. **(pemilik) Isian Order Penjualan (input cepat) tidak hilang:** isian yang belum dikirim disimpan otomatis
   sebagai **draf** (status DRAFT, tidak menahan stok) saat halaman ditinggalkan — pindah menu, muat ulang, atau
   tab ditutup (`fetch keepalive`). Saat halaman dibuka lagi, draf terakhir milik pengguna dibuka kembali; draf
   lain bisa diklik di daftar "Order saya". **F9** pada draf membuang draf itu (dibatalkan dengan alasan
   "Draf dikosongkan sebelum dikirim"). Isian pengantaran yang belum lengkap (tanpa pelanggan/alamat) tidak bisa
   disimpan sebagai draf.
   - Ditemukan dan diperbaiki: membatalkan order DRAFT sebelumnya gagal (galat 500) karena mencoba melepas
     reservasi yang tidak pernah ada. Reservasi kini hanya dilepas untuk order yang menahan stok (R2).
3. **(pemilik) Cetak struk setelah bayar** (Pengaturan › Profil toko, konfigurasi `struk_cetak`):
   **Langsung cetak** (bawaan), **Tanya dulu** (dialog "Cetak struk?", Enter = cetak, Esc = tidak), atau **Tidak
   dicetak**. Layar hasil penjualan langsung punya tombol *Cetak struk* / *Cetak struk lagi* (cetak kedua dicatat
   sebagai cetak ulang). Jendela pratinjau print dari peramban tidak bisa dimatikan oleh halaman web; hanya
   Chrome/Edge yang dijalankan lewat `scripts/kasir/buka-kasir.cmd` (`--kiosk-printing`) yang mencetak langsung
   ke printer bawaan Windows, termasuk printer thermal Bluetooth yang sudah dipasang drivernya (K-074).
   Invoice pengantaran tetap memakai pratinjau A4.
4. **(pemilik) Harga modal boleh belum diketahui** saat barang dibuat: centang *Belum tahu harga modalnya* di form
   barang. Harga yang ikut markup (termasuk Normal) bernilai Rp 0 sampai penerimaan pertama mengisi dasar modal;
   selama itu barang tidak bisa dijual (pesan: harga belum ada) kecuali harganya diisi Rp. Harga otomatis
   menaikkan harga dari Rp 0 ke harga markup begitu penerimaan dicatat. Harga Rp tetap tier default tetap tidak
   boleh 0. Data Barang menampilkan "menunggu modal", hasil cari kasir "harga belum ada". Import Excel mengikuti
   aturan yang sama.
5. **(pemilik) Pesan galat qty** memakai angka biasa dan satuannya ("tersedia 50 sak, diminta 100 sak"), bukan
   format penyimpanan tiga desimal ("50.000") yang terbaca seperti lima puluh ribu. Berlaku untuk stok kurang,
   stok dipesan, retur, tukar, dan surat jalan.
6. **(pemilik) Hasil cari kasir/order lebih ringkas:** nama, atribut ringkas (nilai saja), satuan/kemasan, harga
   per satuan, dan stok; kode barang tidak lagi di baris. Info lengkap barang yang disorot (kode, barcode,
   kategori, merk, atribut "Nama: nilai", penitip) tampil di bawah daftar saat dipilih dengan panah atau kursor.
   Daftar barang API memuat `ringkasAtribut`.
7. **(pemilik) Data Barang › Saring:** tombol *Saring* memilih saringan yang tampil (status, kepemilikan,
   kategori, merk, perlu tinjau harga; bawaan: kategori), diingat per perangkat. Kotak cari selebar tetap dan
   tidak terdesak saringan (berlaku untuk semua bilah saring data master).
8. **Layar kasir:** daftar barang minimal ±4 baris walau panel bayar membesar (transfer/EDC/campuran); kolom
   kanan bisa digulir. Petunjuk tombol **S** dipindah dari baris barang ke bilah tombol bawah.
9. **(pemilik, v2.0.0)** Tata letak POS yang bisa diperlebar/dipersempit pengguna dicatat sebagai Sprint F F6
   di `docs/08-backlog.md`.

*Ditolak:*
- Menyimpan isian order di `localStorage`/`sessionStorage`: data bisnis tidak boleh di penyimpanan browser
  (CLAUDE.md), dan draf di server bisa dilanjutkan dari komputer lain.
- Menyimpan draf setiap kali isian berubah: membuat log `ORDER_UBAH` sangat banyak; cukup saat halaman ditinggalkan.
- Menggabungkan 100 dus + 50 buah menjadi satu baris satuan dasar: harga dus (grosir) dan harga buah (ecer)
  harus tetap terpisah di struk.

### K-096 — Tombol "Simpan draf & order baru" dan tombol qty ±1 di baris barang

**Keputusan:**

1. **(pemilik)** Order Penjualan › Input cepat: tombol **Simpan draf & order baru** (tampil bila ada barang)
   menyimpan isian sebagai draf (tidak menahan stok) lalu mengosongkan form untuk pembeli berikutnya. Draf
   dilanjutkan dengan mengkliknya di "Order saya". Draf yang dibuka dan belum diubah tidak disimpan ulang.
2. **(pemilik)** Tombol kecil **−** / **+** di sebelah qty setiap baris barang: layar kasir (penjualan langsung,
   pengantaran), input order cepat, dan form order lengkap. Qty tidak bisa turun di bawah 1 lewat tombol (hapus
   baris tetap dengan Del). Tombol tidak mengambil fokus agar navigasi keyboard di daftar tidak terganggu; tombol
   keyboard + / − tetap berlaku.

