/*
 * Notifikasi topbar (docs/05 ST2): dihitung saat dibuka, tanpa tabel. Setiap sumber hanya muncul
 * untuk pengguna yang memegang izinnya. Fase 4: stok HABIS/KRITIS; Fase 5: order basi, piutang jatuh tempo; sumber lain menyusul per fase.
 */

export const JENIS_NOTIFIKASI = [
  'ORDER_BASI',
  'STOK_HABIS',
  'STOK_KRITIS',
  'PIUTANG_TERLAMBAT',
  'PIUTANG_JATUH_TEMPO',
] as const;
export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI)[number];

export type Notifikasi = {
  jenis: JenisNotifikasi;
  judul: string;
  keterangan: string;
  jumlah: number;
  /** Path halaman web tujuan. */
  tautan: string;
};
