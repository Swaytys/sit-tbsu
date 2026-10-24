/*
 * Notifikasi topbar (docs/05 ST2): dihitung saat dibuka, tanpa tabel. Setiap sumber hanya muncul
 * untuk pengguna yang memegang izinnya. Fase 4: stok HABIS/KRITIS; Fase 5: order basi, piutang jatuh tempo; Fase 6: persetujuan retur/void; sumber lain menyusul per fase.
 */

export const JENIS_NOTIFIKASI = [
  'ORDER_BASI',
  'STOK_HABIS',
  'STOK_KRITIS',
  'PIUTANG_TERLAMBAT',
  'PIUTANG_JATUH_TEMPO',
  'VOID_MENUNGGU',
  'RETUR_MENUNGGU',
  'CADANGAN_BERMASALAH',
  'HUTANG_TERLAMBAT',
  'HUTANG_JATUH_TEMPO',
  'SHIFT_SAYA_PERLU_DITUTUP',
  'SHIFT_PERLU_DITUTUP',
  'NONTUNAI_BELUM_DICEK',
  'NONTUNAI_TIDAK_MASUK',
  'PERLU_DIPESAN',
  'SHIFT_HITUNG_BUKA',
  'ORDER_DISIMPAN_LEWAT',
  'ARMADA_SURAT',
  'ARMADA_SERVIS',
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
