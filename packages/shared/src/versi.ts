/*
 * K-166: nomor versi dan catatan perubahan yang tampil di aplikasi (menu pengguna › Tentang aplikasi). Dinaikkan
 * setiap rilis ke server toko: angka tengah = fase/gelombang, angka akhir = perbaikan. Catatan ditulis untuk
 * pengguna (bukan istilah teknis); rincian teknis tetap di docs/11.
 */

export const VERSI_APLIKASI = '1.17.0';

export type CatatanRilis = { versi: string; tanggal: string; isi: string[] };

export const CATATAN_RILIS: CatatanRilis[] = [
  {
    versi: '1.17.0',
    tanggal: '2026-10-31',
    isi: [
      'Pengaturan › Data: Pustaka data (data lama, salinan, impor, dari cadangan harian), pakai data lain dengan pengaman otomatis, hapus, ekspor/impor berkas .bonsai untuk pindah komputer.',
      'Setup awal: pilihan Lanjutkan data yang sudah ada (dari komputer lain atau Pustaka).',
      'Setup Windows Mulai dari nol kini menyimpan data lama ke Pustaka; folder data lama versi sebelumnya dipindah otomatis.',
      'BonsaiUrip tidak bisa dimatikan, diperbarui, atau dihapus selama shift masih terbuka; Windows ditahan saat dimatikan.',
      'Setelah listrik/komputer mati mendadak: aplikasi menyala sendiri dan menampilkan keadaan shift serta langkah pemeriksaan.',
      'Perbaikan setup awal: tombol di dalam langkah tidak lagi memindahkan langkah; bilah Kembali ke setup awal.',
      'Wizard Setup Windows dalam Bahasa Indonesia atau English.',
    ],
  },
  {
    versi: '1.16.0',
    tanggal: '2026-10-31',
    isi: [
      'Setup awal langkah demi langkah saat pertama dipakai: data usaha, cara berjualan, akun Owner, kode pemulihan, logo & struk, rekening, email, cadangan, karyawan, data awal.',
      'Tur aplikasi: sorotan bagian layar dengan penjelasan; tur per fitur ditawarkan saat menu dibuka pertama kali; bisa diulang di menu nama Anda › Tur & panduan.',
      'Owner bisa mengulang setup awal; langkah yang dilewati diingatkan di Dashboard.',
      'Lupa password dengan kode 6 angka ke email, selain kode pemulihan.',
      'Menu Start › Pulihkan akses Owner; Setup menawarkan Mulai dari nol (data lama dipindah, tidak dihapus).',
      'Aplikasi umum: nama, slogan, dan kota usaha dari setup awal tampil di halaman masuk; tanpa nama toko bawaan.',
    ],
  },
  {
    versi: '1.15.0',
    tanggal: '2026-10-30',
    isi: [
      'Setup baru: layar pembuka, ikon BonsaiUrip di pojok kanan bawah (Buka/Matikan), pilih lokasi pasang, panduan mulai pakai.',
      'Pemakaian pertama: buat akun Owner sendiri, kode pemulihan untuk lupa password, panduan penyiapan dengan contoh data.',
      'Cadangan diatur dari Pengaturan › Cadangan (folder dan sandi); program cadangan sudah termasuk.',
      'Hasil pengantaran: barang kembali/rusak diselesaikan menurut status bayar (potong tagihan atau kembalikan uang).',
      'Halaman Pengembalian uang: menunggu transfer dan menunggu tunai; cara pengembalian bisa diganti.',
      'Pengiriman: centang Dimuat per surat jalan, berangkat bila semua dimuat, muatan lebih dari 100% wajib alasan, lebih dari batas ditolak; rit bisa diubah.',
      'Tutup shift menampilkan hal yang belum selesai; transaksi di luar shift masuk shift berikutnya.',
      'No. referensi transfer wajib di semua peran dan semua jalur pembayaran.',
      'Data master yang sama persis ditolak; data ganda yang belum dipakai bisa dihapus.',
      'Qty tidak biasa di kasir ditandai dan dikonfirmasi sebelum bayar; panduan selisih stok.',
      'Promo: beli N potong dengan batas kelipatan; sasaran per kelompok; harga dasar FIFO.',
      'Atribut dimensi/berat dan data muatan selaras langsung; pencarian dan saringan daftar diingat.',
      'Laporan: pratinjau per halaman A4; layar kasir dan pengantaran: pindah panel dan gulir dengan tombol.',
    ],
  },
  {
    versi: '1.14.0',
    tanggal: '2026-10-24',
    isi: [
      'Logistik › Pengiriman: papan rit (rencanakan, seret order kirim, dimuat, berangkat, catat hasil).',
      'Data muatan barang dan kendaraan; pemeriksaan muatan saat berangkat; isi massal lewat Excel.',
      'Catatan BBM dan servis, pengingat servis dan STNK/KIR, statistik armada.',
      'Kampanye promo: waktu sampai menit, hari/jam berlaku, banyak barang/kategori/merk, harga khusus, beli X gratis Y, templat.',
      'Arsip tahunan (Pengaturan › Arsip tahunan): tutup tahun, berkas arsip, periksa, buka kembali.',
      'Pencarian universal Ctrl+K; kiriman ganda dicegah; perubahan data master bersamaan terdeteksi.',
      'Pembaruan aplikasi lebih aman: uji migrasi pada salinan database dan pemeriksaan setelah menyala.',
      'No. HP format internasional (+62) dan pencegahan data dobel; Pengaturan › Pemeriksaan data.',
      'Notifikasi menampilkan rincian; dashboard punya bagian Perlu perhatian.',
      'Order Penjualan: Daftar order lewat F10, saringan Semua, order disimpan jatuh tempo tersemat, nama penginput.',
      'Cari barang: atribut boleh sebagian; label Laris/Lambat/Tidak laku/Baru; stok tebal merah; panel rincian dengan info penjualan.',
      'Surat jalan bisa dicetak 2 rangkap (asli dan salinan); saran alasan di dialog batal; BBM/servis ditunda ke versi berikutnya.',
      'Order pembelian ke pemasok: draf, kirim, konfirmasi, uang muka, terima barang dari PO; mengurangi saran pesan.',
      'Halaman baru Transaksi › Hasil Penjualan: ringkasan, perbandingan periode lalu, barang ABC, kasir, jam ramai, cara bayar.',
      'Log aktivitas bisa diekspor ke Excel dengan rentang tanggal (Owner).',
      'Saran pesan: pilihan metode A rata-rata, B statistik, C min–maks (stok maksimum di Data Barang), D tren.',
      'Cetak: logo di struk, kepekatan Normal/Tebal/Paling tebal, kertas per dokumen (bawaan A4 lanskap), invoice dan surat jalan dicetak langsung/tanya dulu/tidak.',
    ],
  },
];
