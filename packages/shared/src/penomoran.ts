/**
 * Kode dokumen transaksi (K-022, K-045). Prefix tampilnya dibaca dari `konfigurasi.prefix_<KODE>`;
 * penerbitan nomor hanya lewat apps/api/src/modules/sistem/penomoran.ts (CLAUDE.md aturan 11).
 */
export const KODE_DOKUMEN = [
  'ORD',
  'STR',
  'INV',
  'SJ',
  'TRP',
  'BYR',
  'RTR',
  'VD',
  'RCV',
  'PO',
  'ADJ',
  'RTP',
  'KSG',
  'PBP',
  'SHF',
  'CLC',
] as const;
export type KodeDokumen = (typeof KODE_DOKUMEN)[number];

/** Kode master (docs/05 N5): `PREFIX-NNNNN`, penghitung tanpa reset harian. */
export const KODE_MASTER = ['BRG', 'PLG', 'PMS', 'USR', 'PRM'] as const;
export type KodeMaster = (typeof KODE_MASTER)[number];

export const LABEL_KODE_DOKUMEN: Record<KodeDokumen, string> = {
  ORD: 'Order penjualan',
  STR: 'Struk penjualan langsung',
  INV: 'Invoice pengantaran',
  SJ: 'Surat jalan',
  TRP: 'Perjalanan pengantaran',
  BYR: 'Pembayaran',
  RTR: 'Retur penjualan',
  VD: 'Void',
  RCV: 'Penerimaan barang',
  PO: 'Order pembelian',
  ADJ: 'Penyesuaian stok',
  RTP: 'Retur pemasok',
  KSG: 'Penyelesaian konsinyasi',
  PBP: 'Pembayaran pemasok',
  SHF: 'Shift kasir',
  CLC: 'Clerical check',
};
