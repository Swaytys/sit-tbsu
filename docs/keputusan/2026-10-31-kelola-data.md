# Uji setup awal, kelola data, shift dan mati mendadak (31 Oktober 2026, K-212–K-216)

Pemilik mencoba Setup 1.16.0 dan setup awal. Masukan dan keputusan dicatat di bawah.

## Temuan

- Di langkah setup (Cara bayar, Logo dan struk, Email toko, Akun karyawan, Data awal), tombol di dalam kotak
  (Tambah rekening, Simpan, atur Telegram, Isi contoh) malah memindahkan setup ke langkah berikutnya.
- Switch *Kop struk memakai logo toko* kembali mati setelah Simpan.
- Tautan ke halaman lain dari setup (mis. *Buka Data Pengguna*) meninggalkan setup tanpa jalan kembali yang jelas.
- Pertanyaan pemilik: data "Mulai dari nol" disimpan di mana; bagaimana memakai data dari perangkat lain; bagaimana
  bila aplikasi tidak sengaja dihapus; bagaimana menghapus data lama yang tidak dipakai; perlu pengelolaan beberapa
  versi data (cadangan, data lama, data rusak, data toko lain) tanpa membebani disk.

## Keputusan

- **K-212 Perbaikan setup awal.** Tombol di dalam langkah hanya menjalankan tugasnya sendiri; pindah langkah hanya
  lewat tombol bawah (Kembali / Lewati / Sudah, lanjut). Halaman lain yang dibuka dari setup menampilkan bilah
  *Kembali ke setup awal* (langkah terakhir diingat). Pengaturan struk tersimpan apa adanya. *Selesai 31 Okt (versi 1.17.0).*
- **K-213 Kelola data (Pengaturan › Data, Owner).** Standar aplikasi desktop: satu **data aktif** dan **Pustaka
  data** di folder data aplikasi.
  - Setiap data di Pustaka menampilkan nama toko, jenis (data lama, impor, dari cadangan harian, pengaman otomatis),
    tanggal dibuat, rentang tanggal transaksi, daftar pengguna, jumlah barang/pelanggan/transaksi, ukuran.
  - **Pakai data ini**: data aktif disimpan dulu sebagai *pengaman otomatis*, lalu data terpilih dipulihkan dan
    diperbarui ke versi aplikasi; semua orang masuk lagi dengan akun data itu. Gagal = kembali otomatis ke pengaman.
  - **Pengaman otomatis** tidak bisa dihapus dari layar, hanya bisa dipakai (rollback); disimpan 3 terbaru saja.
  - **Hapus** data di Pustaka yang tidak dipakai (konfirmasi password Owner).
  - **Ekspor** data aktif ke satu berkas `.bonsai` terenkripsi sandi untuk pindah perangkat; **Impor** berkas itu.
  - **Ambil dari cadangan harian**: snapshot cadangan (K-198) dijadikan data di Pustaka untuk dilihat/dipakai.
  - Setup Windows *Mulai dari nol*: data lama disimpan ke Pustaka (tidak lagi berupa folder mentah); folder
    `BonsaiUrip-lama-*` dari versi 1.16.0 dikonversi ke Pustaka lalu dihapus.
  - Setup awal langkah 1: pilihan **Lanjutkan data yang sudah ada** (impor berkas dari perangkat lain, atau pakai data
    di Pustaka komputer ini).
  - Aplikasi yang tidak sengaja dihapus: data tetap di folder data pengguna; memasang ulang memakai data itu lagi.
  *Selesai 31 Okt (versi 1.17.0).*
- **K-214 Installer dwibahasa.** Wizard Setup Windows tersedia dalam Bahasa Indonesia dan English (dipilih di awal).
  *Selesai 31 Okt (versi 1.17.0).*

- **K-215 Aplikasi tidak bisa dimatikan selama shift terbuka.** Masukan susulan pemilik (31 Okt): *Matikan BonsaiUrip*
  (ikon tray dan menu Start), Setup pembaruan, dan menghapus aplikasi ditolak selama ada shift yang belum ditutup,
  dengan pesan langkah menutup shift. Saat Windows hendak dimatikan dengan shift terbuka, BonsaiUrip menahan dengan
  alasan yang tampil di layar Windows (pengguna masih bisa memaksa; Windows tidak mengizinkan aplikasi menahan
  mutlak). Menutup tab peramban tetap diperingatkan (K-186). *Selesai 31 Okt (versi 1.17.0).*
- **K-216 Mati mendadak.** Pilihan *Nyalakan otomatis saat Windows dimulai* dicentang bawaan sehingga aplikasi menyala
  lagi setelah listrik/komputer mati. Bila sebelumnya mati mendadak saat shift terbuka, peramban dibuka dan bilah
  pemulihan tampil di atas semua halaman: keadaan shift (nomor, dibuka oleh, modal; bagi atasan juga jumlah
  transaksi, tunai, kas masuk/keluar, uang laci seharusnya) dan langkah pemeriksaan (transaksi terakhir, struk, hitung
  uang, lanjut atau tutup shift, pakai cadangan harian bila data rusak), sampai pemegang shift menandai *Sudah saya
  periksa*. Transaksi yang sudah tersimpan aman (database mencatat saat itu juga). *Selesai 31 Okt (versi 1.17.0).*

Sesudah ini: K-204 bagian 2 (HP/tablet).
