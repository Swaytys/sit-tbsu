import { sql, type SQL } from 'drizzle-orm';

/*
 * K-165: isi berkas arsip tahunan. Setiap entri = satu tabel dan kueri barisnya untuk satu tahun (parameter
 * terikat). Dokumen kepala dipilih menurut tanggal operasional/tanggalnya; baris rinci ikut kepalanya, sehingga
 * dokumen selalu lengkap (mis. retur Januari atas nota Desember tercatat di arsip tahun retur itu). Data master
 * disimpan utuh (potret saat ditutup) agar arsip bisa dibaca tanpa database. Hash password tidak pernah ikut.
 */

export type Periode = { dari: string; sampai: string; awal: Date; akhir: Date };

type Entri = { tabel: string; kueri: (p: Periode) => SQL };

/** Kepala dokumen bertanggal operasional di tahun itu. */
const kepala = (tabel: string): Entri => ({
  tabel,
  kueri: (p) =>
    sql`select * from ${sql.identifier(tabel)} where tanggal_operasional between ${p.dari} and ${p.sampai} order by id`,
});

/** Baris rinci yang induknya ada di arsip (`induk` dipilih dengan kueri entri induk). */
const rinci = (tabel: string, kolom: string, induk: Entri): Entri => ({
  tabel,
  kueri: (p) =>
    sql`select * from ${sql.identifier(tabel)} where ${sql.identifier(kolom)} in (select id from (${induk.kueri(p)}) i) order by id`,
});

const waktu = (tabel: string, kolom: string): Entri => ({
  tabel,
  kueri: (p) =>
    sql`select * from ${sql.identifier(tabel)} where ${sql.identifier(kolom)} >= ${p.awal} and ${sql.identifier(kolom)} < ${p.akhir} order by id`,
});

const order = kepala('order_penjualan');
const penjualan = kepala('penjualan');
const retur = kepala('retur_penjualan');
const voidT = kepala('void_transaksi');
const penerimaan = kepala('penerimaan_barang');
const penyesuaian = kepala('penyesuaian_stok');
const shift = kepala('shift_kasir');
const returPemasok = kepala('retur_pemasok');
const konsinyasi = kepala('penyelesaian_konsinyasi');
const suratJalan = waktu('surat_jalan', 'tanggal');
const hasil = rinci('surat_jalan_hasil', 'id_surat_jalan', suratJalan);

/** Tabel transaksi per tahun (urutan = urutan di berkas). */
export const TABEL_TRANSAKSI: Entri[] = [
  order,
  rinci('order_penjualan_detail', 'id_order', order),
  penjualan,
  rinci('penjualan_detail', 'id_penjualan', penjualan),
  kepala('pembayaran_penjualan'),
  suratJalan,
  rinci('surat_jalan_detail', 'id_surat_jalan', suratJalan),
  hasil,
  rinci('surat_jalan_hasil_detail', 'id_hasil', hasil),
  waktu('perjalanan', 'dibuat_pada'),
  retur,
  rinci('retur_penjualan_detail', 'id_retur', retur),
  voidT,
  rinci('void_transaksi_detail', 'id_void', voidT),
  waktu('permintaan_persetujuan', 'dibuat_pada'),
  penerimaan,
  rinci('penerimaan_barang_detail', 'id_penerimaan', penerimaan),
  penyesuaian,
  rinci('penyesuaian_stok_detail', 'id_penyesuaian', penyesuaian),
  kepala('mutasi_persediaan'),
  returPemasok,
  rinci('retur_pemasok_detail', 'id_retur_pemasok', returPemasok),
  konsinyasi,
  rinci('penyelesaian_konsinyasi_detail', 'id_penyelesaian', konsinyasi),
  kepala('pembayaran_pemasok'),
  shift,
  rinci('kas_shift', 'id_shift', shift),
  rinci('hitung_kas', 'id_shift', shift),
  kepala('clerical_check'),
  {
    tabel: 'catatan_bbm',
    kueri: (p) =>
      sql`select * from catatan_bbm where tanggal between ${p.dari} and ${p.sampai} order by id`,
  },
  {
    tabel: 'catatan_servis',
    kueri: (p) =>
      sql`select * from catatan_servis where tanggal between ${p.dari} and ${p.sampai} order by id`,
  },
  waktu('log_aktivitas', 'waktu'),
];

/** Potret data master saat arsip dibuat (pengguna tanpa hash password). */
export const TABEL_MASTER: { tabel: string; kueri: SQL }[] = [
  ...[
    'kategori',
    'merk',
    'satuan',
    'jenis_atribut',
    'pemasok',
    'tingkat_harga',
    'golongan_pelanggan',
    'pelanggan',
    'barang',
    'barang_atribut',
    'barang_satuan_jual',
    'harga_barang',
    'promo',
    'promo_sasaran',
    'promo_pelanggan',
    'rekening_toko',
    'kendaraan',
    'sopir',
  ].map((tabel) => ({ tabel, kueri: sql`select * from ${sql.identifier(tabel)}` })),
  {
    tabel: 'pengguna',
    kueri: sql`select id, kode, nama_pengguna, username, peran, status_aktif from pengguna order by id`,
  },
];
