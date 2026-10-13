import type { Peran } from './enums';
import type { Izin } from './permissions';

/*
 * Peran → izin (matriks docs/04 §3). Peran bertingkat: STAF_PENJUALAN ⊂ KASIR ⊂ ADMIN ⊂ OWNER (K-019).
 * Menambah atau memindahkan kemampuan cukup mengubah berkas ini; route tidak menyebut nama peran.
 */

const IZIN_STAF: readonly Izin[] = [
  'master.barang.lihat',
  'master.pelanggan.lihat',
  'master.pelanggan.kelola',
  'penjualan.order.buat',
  'penjualan.order.batal_sendiri',
  'persediaan.stok.lihat_tersedia',
  'dashboard.dasar',
];

const IZIN_KASIR: readonly Izin[] = [
  ...IZIN_STAF,
  'penjualan.order.batal',
  'penjualan.order.lihat_semua',
  'penjualan.checkout',
  'penjualan.diskon',
  'penjualan.pembayaran.catat',
  'penjualan.surat_jalan.kelola',
  'penjualan.riwayat.lihat',
  'penjualan.piutang.lihat',
  'retur.ajukan',
  'void.ajukan',
  'kas.shift.kelola_sendiri',
  'kas.rekening.lihat',
  'dashboard.omzet',
  'laporan.penjualan',
  'laporan.piutang',
  'laporan.ekspor',
];

const IZIN_ADMIN: readonly Izin[] = [
  ...IZIN_KASIR,
  'sistem.pengaturan.kelola',
  'master.barang.lihat_hpp',
  'master.barang.kelola',
  'master.kategori.kelola',
  'master.satuan.kelola',
  'master.harga.kelola',
  'master.harga.tinjau',
  'master.pelanggan.atur_kredit',
  'master.pemasok.lihat',
  'master.pemasok.kelola',
  'master.import.jalankan',
  'penjualan.harga_manual',
  'penjualan.order.lepas_paksa',
  'retur.setujui',
  'void.setujui',
  'persediaan.stok.lihat',
  'persediaan.penerimaan.kelola',
  'persediaan.penyesuaian.kelola',
  'persediaan.retur_pemasok.kelola',
  'hutang.lihat',
  'hutang.kelola',
  'konsinyasi.kelola',
  'kas.shift.lihat_semua',
  'kas.nontunai.verifikasi',
  'laporan.persediaan',
  'laporan.laba',
  'laporan.hutang',
  'promo.kelola',
];

const IZIN_OWNER: readonly Izin[] = [
  ...IZIN_ADMIN,
  'sistem.log.lihat',
  'master.pengguna.kelola',
  'sistem.cadangan.kelola',
];

export const IZIN_PER_PERAN: Readonly<Record<Peran, ReadonlySet<Izin>>> = {
  STAF_PENJUALAN: new Set(IZIN_STAF),
  KASIR: new Set(IZIN_KASIR),
  ADMIN: new Set(IZIN_ADMIN),
  OWNER: new Set(IZIN_OWNER),
};

export function punyaIzin(peran: Peran, izin: Izin): boolean {
  return IZIN_PER_PERAN[peran].has(izin);
}

/** Daftar izin sebuah peran (dikirim ke web setelah login untuk menyaring menu). */
export function izinPeran(peran: Peran): Izin[] {
  return [...IZIN_PER_PERAN[peran]];
}

export const LABEL_PERAN: Record<Peran, string> = {
  STAF_PENJUALAN: 'Staf Penjualan',
  KASIR: 'Kasir',
  ADMIN: 'Administrator',
  OWNER: 'Owner',
};
