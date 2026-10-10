import type {
  CaraPersetujuan,
  JenisMutasi,
  JenisPotongan,
  JenisPenjualan,
  JenisPenyesuaian,
  KondisiRetur,
  MetodePembayaran,
  MetodePembayaranPemasok,
  PenyelesaianRetur,
  PenyelesaianReturPemasok,
  SasaranPembeli,
  SasaranPromo,
  StatusBerlakuPromo,
  StatusItem,
  StatusPembayaran,
  StatusPersetujuan,
  StatusStok,
  StatusTransaksi,
} from './enums';

/*
 * Label tampilan nilai enum yang dipakai bersama web dan API (dokumen laporan disusun di server, K-078).
 * Nilai enum tetap UPPER_SNAKE di data.
 */

export const LABEL_JENIS_MUTASI: Record<JenisMutasi, string> = {
  SALDO_AWAL: 'Saldo awal',
  PENERIMAAN: 'Penerimaan',
  PENJUALAN: 'Penjualan',
  RETUR_JUAL: 'Retur jual',
  TUKAR_RETUR: 'Tukar retur',
  VOID: 'Void',
  PENYESUAIAN: 'Penyesuaian',
  PINDAH_KONDISI: 'Pindah kondisi',
  RETUR_PEMASOK: 'Retur pemasok',
  MUSNAH: 'Pemusnahan',
};

export const LABEL_JENIS_PENYESUAIAN: Record<JenisPenyesuaian, string> = {
  SALDO_AWAL: 'Saldo awal',
  OPNAME: 'Stok opname',
  KOREKSI: 'Koreksi',
  RUSAK: 'Stok rusak',
  MUSNAH: 'Pemusnahan',
};

export const LABEL_STATUS_STOK: Record<StatusStok, string> = {
  HABIS: 'Habis',
  KRITIS: 'Kritis',
  PERLU_RESTOCK: 'Perlu restock',
  AMAN: 'Aman',
};

export const LABEL_STATUS_PEMBAYARAN: Record<StatusPembayaran, string> = {
  BELUM_BAYAR: 'Belum bayar',
  DP: 'DP',
  LUNAS: 'Lunas',
};

export const LABEL_JENIS_PENJUALAN: Record<JenisPenjualan, string> = {
  LANGSUNG: 'Langsung',
  PENGANTARAN: 'Pengantaran',
};

export const LABEL_METODE_PEMBAYARAN: Record<MetodePembayaran, string> = {
  TUNAI: 'Tunai',
  TRANSFER: 'Transfer',
  EDC: 'EDC',
};

export const LABEL_METODE_PEMBAYARAN_PEMASOK: Record<MetodePembayaranPemasok, string> = {
  TUNAI: 'Tunai',
  TRANSFER: 'Transfer',
  KOMPENSASI: 'Kompensasi retur',
};

export const LABEL_STATUS_TRANSAKSI: Record<StatusTransaksi, string> = {
  SELESAI: 'Selesai',
  VOID_SEBAGIAN: 'Void sebagian',
  VOID: 'Void',
};

export const LABEL_STATUS_ITEM: Record<StatusItem, string> = {
  NORMAL: 'Normal',
  RETUR_SEBAGIAN: 'Retur sebagian',
  RETUR: 'Retur',
  VOID: 'Void',
};

export const LABEL_PENYELESAIAN_RETUR: Record<PenyelesaianRetur, string> = {
  REFUND: 'Refund',
  TUKAR_BARANG: 'Tukar barang',
  POTONG_TAGIHAN: 'Potong tagihan',
};

export const LABEL_KONDISI_RETUR: Record<KondisiRetur, string> = {
  BAIK: 'Baik',
  RUSAK: 'Rusak',
  CACAT: 'Cacat',
};

export const LABEL_STATUS_PERSETUJUAN: Record<StatusPersetujuan, string> = {
  MENUNGGU: 'Menunggu',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  DIBATALKAN: 'Dibatalkan',
};

export const LABEL_CARA_PERSETUJUAN: Record<CaraPersetujuan, string> = {
  SENDIRI: 'oleh pengaju (berwenang)',
  AKUN_ATASAN: 'dari akun atasan',
  DI_TEMPAT: 'atasan, di tempat',
  BATAS_BEBAS: 'tanpa atasan (di bawah batas)',
};

export const LABEL_JENIS_POTONGAN: Record<JenisPotongan, string> = {
  PERSEN: 'Persen',
  NOMINAL: 'Rupiah per satuan',
};

export const LABEL_SASARAN_PROMO: Record<SasaranPromo, string> = {
  SEMUA: 'Semua barang',
  KATEGORI: 'Satu kategori',
  BARANG: 'Satu barang',
};

/** K-097: pembeli yang berhak atas promo. */
export const LABEL_SASARAN_PEMBELI: Record<SasaranPembeli, string> = {
  SEMUA: 'Semua pembeli',
  GOLONGAN: 'Satu golongan pelanggan',
  PELANGGAN: 'Pelanggan tertentu',
};

export const LABEL_STATUS_BERLAKU_PROMO: Record<StatusBerlakuPromo, string> = {
  TERJADWAL: 'Terjadwal',
  BERJALAN: 'Berjalan',
  BERAKHIR: 'Berakhir',
};

export const LABEL_PENYELESAIAN_RETUR_PEMASOK: Record<PenyelesaianReturPemasok, string> = {
  POTONG_HUTANG: 'Potong hutang',
  GANTI_BARANG: 'Ganti barang',
  REFUND: 'Uang kembali',
  PENGEMBALIAN_TITIPAN: 'Pengembalian titipan',
};
