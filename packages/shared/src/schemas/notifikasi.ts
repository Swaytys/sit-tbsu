/*
 * Notifikasi topbar (docs/05 ST2): dihitung saat dibuka, tanpa tabel. Setiap sumber hanya muncul
 * untuk pengguna yang memegang izinnya. Fase 4: stok HABIS/KRITIS; sumber lain menyusul per fase.
 */

export const JENIS_NOTIFIKASI = ['STOK_HABIS', 'STOK_KRITIS'] as const;
export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI)[number];

export type Notifikasi = {
  jenis: JenisNotifikasi;
  judul: string;
  keterangan: string;
  jumlah: number;
  /** Path halaman web tujuan. */
  tautan: string;
};
