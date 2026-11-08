import type { LangkahPenyiapan } from '@sit/shared';

/** K-168: teks tiap langkah panduan penyiapan (langkah demi langkah, tanpa istilah teknis). */
export const TEKS_LANGKAH: Record<
  LangkahPenyiapan,
  {
    judul: string;
    guna: string;
    langkah: string[];
    tautan: { label: string; ke: string }[];
    labelContoh?: string;
    opsional?: boolean;
  }
> = {
  PROFIL: {
    judul: 'Profil toko',
    guna: 'Nama, alamat, telepon, dan logo yang tercetak di struk, invoice, dan surat jalan.',
    langkah: [
      'Buka Pengaturan › Profil toko.',
      'Periksa nama toko, nama badan usaha, alamat, dan telepon; perbaiki bila salah lalu Simpan.',
      'Unggah logo toko bila ada (kartu Logo toko).',
      'Kembali ke sini dan centang "Sudah saya periksa dan benar".',
    ],
    tautan: [{ label: 'Buka Profil toko', ke: '/pengaturan?tab=profil' }],
  },
  REKENING: {
    judul: 'Rekening dan cara bayar',
    guna: 'Rekening bank, mesin EDC, dan QRIS tujuan pembayaran non-tunai. Wajib sebelum menerima transfer.',
    langkah: [
      'Buka Pengaturan › Pembayaran.',
      'Tambah setiap rekening/EDC/QRIS: jenis, bank, nomor, atas nama, nama tampilan.',
      'Tandai satu rekening per jenis sebagai bawaan (terpilih otomatis di kasir).',
    ],
    tautan: [{ label: 'Buka Pembayaran', ke: '/pengaturan?tab=pembayaran' }],
  },
  PENGGUNA: {
    judul: 'Akun karyawan',
    guna: 'Satu akun per orang (Staf Penjualan, Kasir, Admin) agar setiap transaksi tercatat siapa pembuatnya.',
    langkah: [
      'Buka Data Pengguna › Tambah pengguna.',
      'Isi nama, username, peran, dan password awal; berikan password awal ke karyawan itu.',
      'Karyawan wajib mengganti password saat masuk pertama.',
    ],
    tautan: [{ label: 'Buka Data Pengguna', ke: '/pengguna' }],
  },
  BARANG: {
    judul: 'Data barang dan harga',
    guna: 'Barang yang dijual beserta kategori, satuan, harga modal, dan harga jual.',
    langkah: [
      'Banyak barang: Data Barang › Import › unduh templat Excel, isi, lalu unggah.',
      'Sedikit barang: Data Barang › Tambah barang.',
      'Isi juga berat/ukuran (Data muatan) agar pemeriksaan muatan kendaraan bekerja.',
    ],
    tautan: [
      { label: 'Buka Data Barang', ke: '/barang' },
      { label: 'Import Excel', ke: '/barang/import' },
    ],
    labelContoh: 'Isi 5 contoh barang',
  },
  STOK: {
    judul: 'Stok awal',
    guna: 'Jumlah barang di gudang saat mulai memakai aplikasi, beserta harga modalnya.',
    langkah: [
      'Hitung stok fisik setiap barang.',
      'Buka Stok Persediaan › Persediaan awal.',
      'Isi jumlah dan harga modal per barang, lalu Selesaikan.',
    ],
    tautan: [
      { label: 'Buat Persediaan awal', ke: '/persediaan/penyesuaian/baru?jenis=SALDO_AWAL' },
    ],
  },
  PELANGGAN: {
    judul: 'Pelanggan tetap',
    guna: 'Pelanggan yang sering membeli, berutang, atau minta diantar (pembeli umum tidak perlu didaftarkan).',
    langkah: [
      'Buka Data Pelanggan › Tambah pelanggan.',
      'Isi nama, No. HP (wajib), alamat; atur limit kredit bila boleh berutang.',
    ],
    tautan: [{ label: 'Buka Data Pelanggan', ke: '/pelanggan' }],
    labelContoh: 'Isi 5 contoh pelanggan',
  },
  PEMASOK: {
    judul: 'Pemasok',
    guna: 'Tempat toko membeli barang; dipakai di penerimaan barang, hutang, dan order pembelian.',
    langkah: [
      'Buka Data Pemasok › Tambah pemasok.',
      'Isi nama, No. HP, kontak person, lama kirim (hari).',
    ],
    tautan: [{ label: 'Buka Data Pemasok', ke: '/pemasok' }],
    labelContoh: 'Isi 5 contoh pemasok',
  },
  ARMADA: {
    judul: 'Kendaraan dan sopir',
    guna: 'Untuk penjualan pengantaran: setiap rit memakai satu kendaraan dan satu sopir.',
    langkah: [
      'Buka Kendaraan & Sopir › Tambah kendaraan: plat, jenis, daya angkut, ukuran bak.',
      'Tab Sopir › Tambah sopir: nama dan No. HP.',
    ],
    tautan: [{ label: 'Buka Kendaraan & Sopir', ke: '/armada' }],
    labelContoh: 'Isi contoh 2 kendaraan + 2 sopir',
    opsional: true,
  },
  PRINTER: {
    judul: 'Printer struk (di komputer kasir)',
    guna: 'Struk langsung keluar tanpa jendela cetak. Diatur di setiap komputer kasir.',
    langkah: [
      'Di komputer kasir: Pengaturan › Struk & printer › Printer struk komputer ini.',
      'Ikuti langkah Pilih printer, lalu Uji cetak sampai kertas keluar.',
      'Tanpa printer thermal: struk tetap bisa dicetak lewat jendela cetak biasa.',
    ],
    tautan: [{ label: 'Buka Struk & printer', ke: '/pengaturan?tab=struk' }],
    opsional: true,
  },
};
