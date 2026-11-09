/**
 * Daftar izin (docs/04 §2). Format `<modul>.<objek>.<aksi>`. Setiap route API dan setiap menu memeriksa
 * satu kode dari daftar ini; kode di luar daftar gagal typecheck.
 */
export const DAFTAR_IZIN = {
  // Sistem dan master
  'sistem.pengaturan.kelola': 'Ubah profil toko, prefix nomor, ambang, batas diskon, dsb.',
  'sistem.log.lihat': 'Lihat log aktivitas semua pengguna',
  'sistem.cadangan.kelola': 'Lihat status cadangan data, cadangkan sekarang, uji pulih (K-084)',
  'sistem.data.kelola':
    'Kelola data aplikasi: pustaka data, ganti data aktif, ekspor/impor (K-213)',
  'master.pengguna.kelola': 'Tambah/ubah/nonaktifkan pengguna, reset password, cabut sesi',
  'master.barang.lihat': 'Lihat daftar dan detail barang tanpa harga modal',
  'master.barang.lihat_hpp': 'Lihat harga modal, HPP, harga beli terakhir, harga titip',
  'master.barang.kelola': 'Tambah/ubah/nonaktifkan barang dan atributnya',
  'master.kategori.kelola': 'Kelola kategori',
  'master.satuan.kelola': 'Kelola satuan, jenis atribut, satuan jual',
  'master.harga.kelola': 'Ubah harga jual per tier per barang; kelola master tier',
  'master.harga.tinjau': '(M2) Terapkan usulan harga dari markup',
  'master.pelanggan.lihat': 'Lihat pelanggan',
  'master.pelanggan.kelola':
    'Tambah pelanggan; ubah/nonaktifkan pelanggan dengan kode persetujuan atasan',
  'master.pelanggan.atur_kredit':
    'Atur golongan, term hari, dan limit kredit; ubah/nonaktifkan pelanggan tanpa kode; menyetujui perubahan pelanggan',
  'master.pemasok.lihat': 'Lihat pemasok',
  'master.pemasok.kelola': 'Tambah/ubah/nonaktifkan pemasok',
  'master.armada.kelola': 'Tambah/ubah/nonaktifkan kendaraan dan sopir (K-150)',
  'master.import.jalankan': 'Import Excel barang / persediaan awal',
  'sistem.izin.atur':
    'Mengatur izin tambahan/dicabut per akun dan peran khusus (K-243; hanya Owner)',
  'sistem.akses.kelola':
    'Akses HP/tablet: mode LAN toko, setujui/cabut perangkat, Tailscale (K-229)',
  // Pembelian (K-225)
  'pembelian.setujui': 'Menyetujui order pembelian sampai batas Kepala Toko (bukan buatan sendiri)',
  'pembelian.setujui_semua':
    'Menyetujui order pembelian di atas batas Kepala Toko dan barang yang wajib disetujui Owner',
  // Penjualan
  'penjualan.order.buat': 'Buat order, kirim ke antrean, ubah order DRAFT miliknya',
  'penjualan.order.batal_sendiri': 'Batalkan order buatannya sendiri yang masih MENUNGGU',
  'penjualan.order.batal': 'Batalkan order siapa pun yang belum SELESAI',
  'penjualan.order.lihat_semua': 'Lihat antrean dan riwayat order semua pengguna',
  'penjualan.order.lepas_paksa': 'Melepas kunci order DIPROSES milik kasir lain (R8)',
  'penjualan.checkout': 'Proses order menjadi penjualan (langsung dan pengantaran)',
  'penjualan.harga_manual': 'Mengisi harga di luar tier',
  'penjualan.pembayaran.catat': 'Catat pembayaran (termasuk DP, pelunasan, bayar saat terima)',
  'penjualan.surat_jalan.kelola':
    'Buat surat jalan, berangkatkan perjalanan, catat hasil pengantaran (S9–S10)',
  'penjualan.riwayat.lihat': 'Lihat daftar dan detail penjualan',
  'penjualan.piutang.lihat': 'Lihat daftar piutang dan jatuh tempo',
  // Retur dan void
  'retur.ajukan': 'Buat permintaan retur',
  'retur.setujui': 'Setujui/tolak retur',
  'void.ajukan': 'Buat permintaan void',
  'void.setujui': 'Setujui/tolak void',
  // Persediaan
  'persediaan.stok.lihat_tersedia': 'Lihat angka stok tersedia saat mencari barang (untuk order)',
  'persediaan.stok.lihat': 'Halaman persediaan penuh: fisik/dipesan/tersedia, mutasi, kartu stok',
  'persediaan.penerimaan.kelola': 'Catat penerimaan barang',
  'persediaan.penyesuaian.kelola': 'Buat penyesuaian: persediaan awal, opname, koreksi, rusak',
  'persediaan.opname.hitung':
    'Mengisi hasil hitung opname yang ditugaskan kepadanya tanpa melihat stok sistem (K-227)',
  'persediaan.opname.atur':
    'Menyusun daftar hitung opname dan menyelesaikan opname yang berselisih (K-240)',
  'persediaan.retur_pemasok.kelola': '(M2) Retur ke pemasok',
  'hutang.lihat': '(M2) Lihat hutang pemasok',
  'hutang.kelola': '(M2) Bayar hutang pemasok',
  'konsinyasi.kelola': '(M2) Penyelesaian konsinyasi',
  // Kas
  'kas.shift.kelola_sendiri':
    'Buka/tutup shift sendiri, kas masuk/keluar dan clerical shift sendiri',
  'kas.shift.lihat_semua': 'Lihat semua shift dan clerical, buka kembali shift',
  'kas.rekening.lihat':
    'Melihat daftar rekening/EDC/QRIS toko untuk dipilih saat mencatat pembayaran atau refund',
  'kas.nontunai.verifikasi':
    'Mengecek uang masuk pembayaran non-tunai (transfer, EDC, QRIS) dan menandai hasilnya',
  // Laporan dan dashboard
  'dashboard.dasar': 'Kartu antrean order, pengiriman aktif, peringatan stok, aksi cepat',
  'dashboard.omzet': 'Kartu penjualan hari ini, grafik penjualan',
  'laporan.penjualan': 'Laporan penjualan (tanpa HPP/laba tanpa lihat_hpp)',
  'laporan.persediaan': 'Stok rekap, kartu stok, stok minimum, nilai persediaan',
  'laporan.laba': 'Gross profit',
  'laporan.piutang': 'Laporan piutang',
  'laporan.hutang': '(M2) Laporan hutang, konsinyasi',
  'laporan.ekspor': 'Cetak PDF dan ekspor Excel untuk laporan yang boleh dilihat',
  // Promo (M2)
  'promo.kelola': '(M2) Buat/ubah/nonaktifkan promo',
} as const satisfies Record<string, string>;

export type Izin = keyof typeof DAFTAR_IZIN;

export const SEMUA_IZIN = Object.keys(DAFTAR_IZIN) as Izin[];
