/*
 * K-166: nomor versi dan catatan perubahan yang tampil di aplikasi (menu pengguna › Tentang aplikasi). Dinaikkan
 * setiap rilis ke server toko: angka tengah = fase/gelombang, angka akhir = perbaikan. Catatan ditulis untuk
 * pengguna (bukan istilah teknis); rincian teknis tetap di docs/11.
 */

export const VERSI_APLIKASI = '1.14.0';

export type CatatanRilis = { versi: string; tanggal: string; isi: string[] };

export const CATATAN_RILIS: CatatanRilis[] = [
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
      'Order pembelian ke pemasok: draf, kirim, konfirmasi, uang muka, terima barang dari PO; mengurangi saran pesan.',
      'Halaman baru Transaksi › Hasil Penjualan: ringkasan, perbandingan periode lalu, barang ABC, kasir, jam ramai, cara bayar.',
      'Log aktivitas bisa diekspor ke Excel dengan rentang tanggal (Owner).',
      'Saran pesan: pilihan metode A rata-rata, B statistik, C min–maks (stok maksimum di Data Barang), D tren.',
      'Cetak: logo di struk, kepekatan Normal/Tebal/Paling tebal, kertas per dokumen (bawaan A4 lanskap), invoice dan surat jalan dicetak langsung/tanya dulu/tidak.',
    ],
  },
];
