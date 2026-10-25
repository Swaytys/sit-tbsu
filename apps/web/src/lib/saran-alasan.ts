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
} as const;
