/** K-180: saran alasan per konteks (dipakai komponen SaranAlasan). */
export const SARAN_ALASAN = {
  batalOrder: [
    'Pembeli tidak jadi membeli',
    'Pembeli tidak bisa dihubungi',
    'Barang tidak tersedia',
    'Salah input order',
    'Order ganda',
  ],
  batalPO: [
    'Pemasok kehabisan stok',
    'Harga pemasok berubah',
    'Salah input order',
    'Pindah ke pemasok lain',
  ],
  tutupPO: [
    'Sisa tidak dikirim pemasok',
    'Kebutuhan sudah terpenuhi',
    'Barang diganti barang lain',
  ],
  batalRit: ['Kendaraan rusak', 'Sopir berhalangan', 'Cuaca buruk', 'Pengiriman dijadwal ulang'],
  batalSuratJalan: [
    'Pembeli minta ditunda',
    'Alamat belum pasti',
    'Salah barang/qty',
    'Masuk rit lain',
  ],
  tolakPengajuan: [
    'Barang tidak sesuai kondisi yang dilaporkan',
    'Melewati batas waktu retur',
    'Nominal/qty tidak sesuai',
    'Perlu dicek ulang di gudang',
  ],
  batalPengajuan: ['Salah qty', 'Salah barang', 'Salah pilih transaksi', 'Pembeli tidak jadi'],
  void: [
    'Salah input barang/qty',
    'Pembeli batal sebelum barang diambil',
    'Transaksi ganda',
    'Salah pilih pelanggan',
  ],
  bukaArsip: [
    'Koreksi transaksi yang salah catat',
    'Pemeriksaan pajak/audit',
    'Data lupa diinput sebelum tutup tahun',
  ],
  kecualiOpname: [
    'Lokasi barang tidak bisa diakses',
    'Barang sedang dipinjam/di luar gudang',
    'Dihitung di opname terpisah',
  ],
  koreksiModal: ['Salah hitung uang awal', 'Uang kecil belum dimasukkan', 'Salah ketik nominal'],
} as const;
