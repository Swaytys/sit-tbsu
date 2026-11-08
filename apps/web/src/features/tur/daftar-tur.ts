import type { Izin, KodeTur, LayananToko } from '@sit/shared';

/*
 * K-206: isi tur fitur. Tiap langkah menyorot satu bagian layar (sasaran) dan menjelaskan gunanya. Sasaran berupa
 * selektor CSS, atau { teks } = tombol/tautan/tab/judul yang tulisannya diawali teks itu. Bila sasaran tidak ada
 * (mis. peran tidak punya tombolnya), penjelasan tampil di tengah layar.
 */

export type Sasaran = string | { teks: string };

export type LangkahTur = {
  judul: string;
  isi: string[];
  sasaran?: Sasaran;
};

export type Tur = {
  kode: KodeTur;
  judul: string;
  ringkas: string;
  /** Halaman tempat tur berjalan (tur ditawarkan saat halaman ini dibuka pertama kali). */
  rute: string;
  /** Tur hanya untuk pemegang salah satu izin ini. */
  izin: Izin[];
  /** Tur relevan hanya bila toko memakai layanan ini (setup awal). */
  layanan?: LayananToko;
  langkah: LangkahTur[];
};

export const DAFTAR_TUR: Tur[] = [
  {
    kode: 'PENGENALAN',
    judul: 'Pengenalan aplikasi',
    ringkas: 'Bagian-bagian layar yang selalu ada: menu, pencarian, notifikasi, akun.',
    rute: '/dashboard',
    izin: ['dashboard.dasar'],
    langkah: [
      {
        judul: 'Selamat datang di BonsaiUrip',
        isi: [
          'Tur ini menunjukkan bagian-bagian layar yang selalu ada di setiap halaman. ± 2 menit.',
          'Tombol: → atau Enter = lanjut, ← = kembali, Esc = lewati tur. Bisa juga diklik.',
          'Tur bisa diulang kapan saja dari Pengaturan › Tur & panduan (atau menu nama Anda › Tur & panduan).',
        ],
      },
      {
        judul: 'Menu utama',
        sasaran: 'nav[aria-label="Menu utama"]',
        isi: [
          'Semua halaman ada di sini, dikelompokkan: Data Master, Transaksi, Logistik, Persediaan, Shift, Laporan, Pengaturan.',
          'Yang tampil hanya menu sesuai peran Anda. Kasir, misalnya, tidak melihat Pengaturan.',
          'Tombol ☰ di kiri atas menyembunyikan/menampilkan menu supaya layar lebih lega.',
        ],
      },
      {
        judul: 'Cari apa saja (Ctrl+K)',
        sasaran: '[aria-label="Cari (Ctrl+K)"]',
        isi: [
          'Ketik nama halaman, barang, pelanggan, pemasok, atau nomor dokumen (boleh sebagian, mis. 261031-0).',
          'Tekan Ctrl+K dari mana saja. Panah atas/bawah memilih, Enter membuka.',
        ],
      },
      {
        judul: 'Pindah layar penjualan',
        sasaran: 'nav[aria-label="Pindah layar penjualan"]',
        isi: [
          'Tiga layar kerja harian: Order (staf mencatat pesanan), Langsung (kasir), Pengantaran (dijual lalu diantar).',
          'Pintasan: Alt+1, Alt+2, Alt+3.',
        ],
      },
      {
        judul: 'Notifikasi',
        sasaran: '[aria-label^="Notifikasi"]',
        isi: [
          'Lonceng berisi hal yang perlu ditindaklanjuti: stok habis/kritis, order terlalu lama, piutang jatuh tempo, void/retur menunggu persetujuan, shift yang perlu ditutup, cadangan bermasalah.',
          'Angka merah = jumlah yang belum ditangani. Klik satu baris untuk langsung ke halamannya.',
        ],
      },
      {
        judul: 'Akun Anda',
        sasaran: '[aria-label="Menu pengguna"]',
        isi: [
          'Akun saya: ganti password, email/Telegram untuk kode, kode pemulihan.',
          'Tur & panduan: mengulang tur ini dan tur per fitur.',
          'Tentang aplikasi: versi dan daftar perubahan. Keluar: tutup sesi (wajib bila komputer dipakai bergantian).',
        ],
      },
      {
        judul: 'Bantuan di tiap halaman',
        isi: [
          'Banyak halaman punya tombol ? (lingkaran biru) di kanan atas. Klik untuk penjelasan istilah dan aturan di halaman itu.',
          'Saat Anda membuka sebuah menu untuk pertama kali, muncul tawaran tur singkat untuk fitur itu di pojok kanan bawah. Pilih Mulai tur, Nanti, atau Jangan tawarkan lagi.',
        ],
      },
      {
        judul: 'Siap dipakai',
        isi: [
          'Mulai dari Dashboard: ringkasan hari ini dan bagian Perlu perhatian.',
          'Pertama kali berjualan: buka shift dulu (menu Shift & Clerical Check), lalu pakai layar Langsung.',
        ],
      },
    ],
  },
  {
    kode: 'DASHBOARD',
    judul: 'Dashboard',
    ringkas: 'Membaca ringkasan hari ini dan hal yang perlu perhatian.',
    rute: '/dashboard',
    izin: ['dashboard.dasar'],
    langkah: [
      {
        judul: 'Dashboard',
        isi: [
          'Halaman pertama setelah masuk. Isinya menyesuaikan peran: kasir melihat penjualan hari ini, pemilik melihat juga laba dan stok.',
        ],
      },
      {
        judul: 'Pengingat penyiapan',
        sasaran: '[data-testid="pengingat-setup-awal"]',
        isi: [
          'Bila ada langkah setup yang dilewati ("atur nanti"), kotak kuning ini menautkannya. Klik nama langkah untuk melanjutkan.',
        ],
      },
      {
        judul: 'Aksi cepat dan ringkasan',
        sasaran: 'main h1',
        isi: [
          'Kartu angka: penjualan, transaksi, piutang, stok kritis hari ini.',
          'Aksi cepat: tombol ke pekerjaan yang paling sering dilakukan peran Anda.',
          'Grafik 7 hari dan Aktivitas terkini: siapa mengerjakan apa. Klik nomor dokumen (ikon i) untuk melihat ringkasannya.',
        ],
      },
    ],
  },
  {
    kode: 'KASIR',
    judul: 'Kasir (Penjualan Langsung)',
    ringkas: 'Menjual di kasir sepenuhnya dengan keyboard.',
    rute: '/penjualan-langsung',
    izin: ['penjualan.checkout'],
    layanan: 'LANGSUNG',
    langkah: [
      {
        judul: 'Layar kasir',
        isi: [
          'Dipakai untuk pembeli yang membeli dan membayar langsung di toko. Shift harus sudah dibuka (uang laci dihitung).',
          'Kiri: antrean order dari staf penjualan. Kanan: transaksi yang sedang dikerjakan.',
        ],
      },
      {
        judul: 'Cari dan tambah barang (F2)',
        sasaran: { teks: 'Cari barang' },
        isi: [
          'Tekan F2, ketik nama/kode/barcode. Ketik "2*semen" untuk langsung qty 2. Enter menambah ke keranjang.',
          'Qty jauh di atas biasanya diberi tanda kuning dan ditanyakan sebelum bayar (mencegah salah ketik 2 jadi 20).',
          'Harga tier (grosir/eceran) dan promo dihitung otomatis dari total belanja.',
        ],
      },
      {
        judul: 'Bayar (F8 / Enter)',
        isi: [
          'Tekan F8, pilih cara bayar: tunai (ketik uang diterima, kembalian dihitung) atau non-tunai (pilih rekening/EDC/QRIS dan isi No. referensi dari bukti transfer).',
          'Enter menyimpan dan mencetak struk sesuai pengaturan. F9 membatalkan transaksi yang belum dibayar.',
        ],
      },
      {
        judul: 'Daftar tombol',
        isi: [
          'Semua pintasan tampil di bilah hitam dekat tab Kasir/Riwayat. Ctrl+/ menampilkan atau menyembunyikannya.',
          'Alt+← / Alt+→ pindah panel antrean/transaksi; PgUp/PgDn menggulir keranjang panjang.',
        ],
      },
      {
        judul: 'Riwayat dan barang belum diambil',
        isi: [
          'Tab Riwayat: transaksi hari ini, cetak ulang struk. Tab Belum diambil: barang yang sudah dibayar tapi belum diserahkan.',
          'Salah transaksi di shift yang sama: Void Transaksi. Sudah lewat: Retur Penjualan.',
        ],
      },
    ],
  },
  {
    kode: 'ORDER',
    judul: 'Order Penjualan',
    ringkas: 'Staf mencatat pesanan; kasir menagih.',
    rute: '/order',
    izin: ['penjualan.order.buat'],
    layanan: 'ORDER',
    langkah: [
      {
        judul: 'Order penjualan',
        isi: [
          'Staf penjualan mencatat pesanan pembeli di sini (input cepat dengan keyboard). Order lalu muncul di antrean kasir untuk dibayar.',
          'Stok barang dalam order dipesan (tidak bisa dijual ke orang lain) sampai order dibayar atau dibatalkan.',
        ],
      },
      {
        judul: 'Daftar order (F10)',
        sasaran: { teks: 'Daftar order' },
        isi: [
          'Melihat semua order: menunggu bayar, disimpan (diambil nanti), selesai, batal. Saring per status.',
          'Order disimpan yang lewat tanggal ambil disematkan di atas dan muncul di notifikasi.',
        ],
      },
    ],
  },
  {
    kode: 'PENGANTARAN',
    judul: 'Penjualan Pengantaran',
    ringkas: 'Menjual barang yang diantar, DP, invoice, surat jalan.',
    rute: '/penjualan-pengantaran',
    izin: ['penjualan.checkout'],
    layanan: 'ANTAR',
    langkah: [
      {
        judul: 'Penjualan pengantaran',
        isi: [
          'Untuk pembeli yang barangnya diantar: isi pelanggan dan alamat kirim, barang, lalu bayar penuh, DP (uang muka), atau kredit (bila pelanggan punya limit).',
          'Hasilnya invoice. Barang dikirim lewat surat jalan di dalam rit (menu Pengiriman).',
        ],
      },
      {
        judul: 'Setelah dikirim',
        isi: [
          'Hasil kirim dicatat per barang: diterima, kembali, atau rusak. Barang kembali/rusak diselesaikan menurut status bayar: belum bayar → tagihan dipotong; sudah bayar → uang dikembalikan (tunai atau transfer).',
          'Sisa tagihan ditagih di Piutang.',
        ],
      },
    ],
  },
  {
    kode: 'PENGIRIMAN',
    judul: 'Pengiriman (rit)',
    ringkas: 'Merencanakan rit, memuat, berangkat, mencatat hasil.',
    rute: '/pengiriman',
    izin: ['penjualan.surat_jalan.kelola'],
    layanan: 'ANTAR',
    langkah: [
      {
        judul: 'Papan pengiriman',
        isi: [
          'Kolom Backlog: invoice yang belum dikirim. Seret kartu ke grup rit (atau pakai keyboard) untuk membuat surat jalan.',
          'Satu rit = satu kendaraan + sopir + jadwal.',
        ],
      },
      {
        judul: 'Rit baru',
        sasaran: { teks: 'Rit baru' },
        isi: [
          'Pilih kendaraan, sopir, dan jadwal berangkat. Rit yang belum berangkat bisa diubah (tombol Ubah).',
        ],
      },
      {
        judul: 'Muat dan berangkat',
        isi: [
          'Centang Dimuat di tiap surat jalan setelah barangnya naik ke kendaraan. Berangkat aktif bila semua dicentang.',
          'Muatan lebih dari 100% kapasitas wajib diberi alasan; lebih dari batas (bawaan 110%) ditolak: ganti kendaraan atau bagi rit.',
        ],
      },
      {
        judul: 'Catat hasil',
        isi: [
          'Setelah kendaraan kembali, Catat hasil per barang: diterima semua, kembali (dengan alasan), atau rusak.',
        ],
      },
    ],
  },
  {
    kode: 'SHIFT',
    judul: 'Shift & Clerical Check',
    ringkas: 'Membuka shift, kas masuk/keluar, menutup dan mencocokkan uang.',
    rute: '/shift',
    izin: ['kas.shift.kelola_sendiri'],
    langkah: [
      {
        judul: 'Satu shift untuk toko',
        isi: [
          'Uang tunai hanya bisa diterima saat shift toko terbuka. Pagi: buka shift dengan menghitung uang laci (modal). Malam: tutup shift dan hitung lagi.',
        ],
      },
      {
        judul: 'Buka shift',
        sasaran: { teks: 'Buka shift' },
        isi: [
          'H = hitung sekarang per pecahan uang (paling teliti). Bisa juga Buka dulu, hitung nanti (batas waktu diatur Owner).',
          'Uang yang ditinggal dari shift kemarin ditawarkan sebagai modal.',
        ],
      },
      {
        judul: 'Kas masuk/keluar',
        isi: [
          'Catat uang yang keluar/masuk laci selain penjualan: kasbon, beli bensin, setoran ke pemilik. Wajib supaya hitungan akhir cocok.',
        ],
      },
      {
        judul: 'Tutup shift',
        isi: [
          'Kotak Sebelum menutup menampilkan yang masih menggantung (void menunggu, non-tunai belum dicek, transaksi di luar shift). Baca, centang sudah diperiksa.',
          'Hitung uang laci, kirim, lalu tutup. Selisih di atas toleransi wajib diberi keterangan. Bantuan selisih menampilkan linimasa uang tunai.',
        ],
      },
    ],
  },
  {
    kode: 'BARANG',
    judul: 'Data Barang',
    ringkas: 'Menambah barang, harga, satuan, impor Excel.',
    rute: '/barang',
    izin: ['master.barang.kelola'],
    langkah: [
      {
        judul: 'Data barang',
        isi: [
          'Daftar semua barang dengan stok dan harga. Cari dengan nama/kode, saring per kategori/merk/status. Pencarian diingat saat kembali dari halaman ubah.',
        ],
      },
      {
        judul: 'Tambah barang',
        sasaran: { teks: 'Tambah barang' },
        isi: [
          'Isi nama, kategori, satuan dasar (mis. sak), satuan lain (mis. 1 palet = 40 sak), harga modal awal, harga jual per tier.',
          'Data muatan (berat, ukuran) dipakai untuk menghitung muatan kendaraan pengiriman.',
          'Nama yang sama persis dengan barang lain ditolak; yang mirip ditanyakan dulu.',
        ],
      },
      {
        judul: 'Impor dari Excel',
        sasaran: { teks: 'Import Excel' },
        isi: [
          'Banyak barang sekaligus: unduh templat, isi di Excel, unggah. Baris yang salah ditandai beserta sebabnya sebelum disimpan.',
          'Stok awal diisi lewat Stok Persediaan › Persediaan awal.',
        ],
      },
      {
        judul: 'Menu ⋮ per barang',
        isi: [
          'Ubah, nonaktifkan (barang tidak dihapus agar riwayat tetap utuh), kartu stok, cetak label/barcode.',
        ],
      },
    ],
  },
  {
    kode: 'MITRA',
    judul: 'Pelanggan & Pemasok',
    ringkas: 'Data pelanggan (limit kredit) dan pemasok.',
    rute: '/pelanggan',
    izin: ['master.pelanggan.lihat'],
    langkah: [
      {
        judul: 'Data pelanggan',
        isi: [
          'Pelanggan tetap: nama, No. HP (format +62), alamat kirim, golongan, limit kredit dan lama tempo.',
          'Pembeli umum di kasir tidak perlu didaftarkan.',
        ],
      },
      {
        judul: 'Tambah pelanggan',
        sasaran: { teks: 'Tambah pelanggan' },
        isi: [
          'Nama + No. HP yang sama persis dengan pelanggan lain ditolak. Bila mirip, aplikasi menawarkan membuka data yang sudah ada.',
          'Pemasok diatur dengan cara yang sama di menu Data Pemasok.',
        ],
      },
    ],
  },
  {
    kode: 'PENERIMAAN',
    judul: 'Penerimaan Barang',
    ringkas: 'Mencatat barang datang dari pemasok; stok dan HPP bertambah.',
    rute: '/penerimaan',
    izin: ['persediaan.penerimaan.kelola'],
    langkah: [
      {
        judul: 'Penerimaan barang',
        isi: [
          'Setiap barang datang dari pemasok dicatat di sini. Stok bertambah dan harga modal rata-rata (HPP) dihitung ulang otomatis.',
        ],
      },
      {
        judul: 'Catat penerimaan',
        sasaran: { teks: 'Catat penerimaan' },
        isi: [
          'Pilih pemasok, isi No. faktur, barang, qty, dan harga beli. Bayar tunai (dari kas/transfer dengan No. referensi) atau kredit (masuk Hutang Pemasok).',
          'Order pembelian yang sudah dikirim ke pemasok tampil di sini dan bisa langsung diterima.',
        ],
      },
    ],
  },
  {
    kode: 'STOK',
    judul: 'Stok Persediaan',
    ringkas: 'Melihat stok, penyesuaian/opname, saran pesan.',
    rute: '/persediaan',
    izin: ['persediaan.stok.lihat'],
    langkah: [
      {
        judul: 'Stok persediaan',
        isi: [
          'Stok fisik, dipesan (tertahan order), dan tersedia per barang. Stok berubah hanya lewat transaksi; tidak bisa diketik langsung.',
        ],
      },
      {
        judul: 'Penyesuaian',
        sasaran: { teks: 'Penyesuaian' },
        isi: [
          'Persediaan awal (pertama kali), Opname (hitung fisik lalu cocokkan), Koreksi (rusak, hilang, salah serah). Setiap penyesuaian wajib alasan dan tercatat.',
        ],
      },
      {
        judul: 'Saran pesan',
        sasaran: { teks: 'Saran pesan' },
        isi: [
          'Barang yang perlu dipesan ulang dihitung dari penjualan beberapa hari terakhir dan lama kirim pemasok. Bisa langsung dijadikan order pembelian.',
        ],
      },
    ],
  },
  {
    kode: 'KOREKSI',
    judul: 'Retur & Void',
    ringkas: 'Memperbaiki transaksi yang salah tanpa menghapusnya.',
    rute: '/retur',
    izin: ['retur.ajukan'],
    langkah: [
      {
        judul: 'Transaksi tidak pernah dihapus',
        isi: [
          'Kesalahan diperbaiki dengan dokumen baru supaya jejaknya jelas: Void (batalkan transaksi, biasanya di shift yang sama) dan Retur (barang dikembalikan pembeli).',
        ],
      },
      {
        judul: 'Ajukan retur',
        sasaran: { teks: 'Ajukan retur' },
        isi: [
          'Pilih transaksi, barang, qty, kondisi (kembali ke stok atau rusak), dan cara pengembalian uang. Di atas batas tertentu perlu persetujuan atasan dengan kode sekali pakai.',
          'Pengembalian uang yang menunggu (tunai/transfer) ada di tab Pengembalian uang.',
        ],
      },
    ],
  },
  {
    kode: 'LAPORAN',
    judul: 'Laporan',
    ringkas: 'Memilih laporan, periode, mencetak, ekspor Excel.',
    rute: '/laporan',
    izin: ['laporan.penjualan', 'laporan.persediaan'],
    langkah: [
      {
        judul: 'Laporan',
        isi: [
          'Pilih kelompok (Penjualan, Persediaan, Keuangan) lalu jenis laporan. Pilih periode: hari ini, minggu ini, bulan ini, atau rentang tanggal.',
          'Pratinjau tampil per halaman A4 seperti hasil cetak.',
        ],
      },
      {
        judul: 'Cetak dan ekspor',
        sasaran: { teks: 'Cetak / PDF' },
        isi: [
          'Cetak / PDF: cetak ke printer atau simpan PDF (pilih "Simpan sebagai PDF" di jendela cetak). Ekspor Excel: untuk diolah lebih lanjut.',
          'Angka laba dan harga modal hanya tampil untuk peran yang berhak.',
        ],
      },
    ],
  },
  {
    kode: 'PENGATURAN',
    judul: 'Pengaturan',
    ringkas: 'Profil usaha, operasional, harga, cadangan, tur.',
    rute: '/pengaturan',
    izin: ['sistem.pengaturan.kelola'],
    langkah: [
      {
        judul: 'Pengaturan',
        isi: [
          'Semua isian setup awal bisa diubah di sini: profil usaha, struk & printer, rekening, operasional (jam shift, toleransi selisih), harga dasar, keamanan, cadangan.',
          'Tab Log Aktivitas: siapa mengubah apa dan kapan.',
        ],
      },
      {
        judul: 'Tur & panduan',
        sasaran: { teks: 'Tur & panduan' },
        isi: [
          'Mengulang tur mana pun, atau mengulang setup awal dari langkah pertama (data usaha tampil terisi).',
        ],
      },
    ],
  },
];

export const TUR_PER_KODE = Object.fromEntries(DAFTAR_TUR.map((t) => [t.kode, t])) as Record<
  KodeTur,
  Tur
>;
