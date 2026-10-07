import { z } from 'zod';
import type { AksiLog } from '../log';
import { JENIS_PENJUALAN, KEPEMILIKAN } from '../enums';
import type { Izin } from '../permissions';
import { jumlahHari, tanggalSah } from '../tanggal';
import { skemaTanggal } from './persediaan';

/*
 * Laporan (Fase 7, docs/01 §5.9 & §6, docs/05 §14) dan dashboard (docs/05 ST3).
 *
 * Setiap laporan dikirim API sebagai `DokumenLaporan`: dokumen formal yang sudah tersusun (judul, periode,
 * ikhtisar, tabel, catatan, kolom tanda tangan). Layar, cetak PDF, dan ekspor Excel merender dokumen yang
 * sama sehingga angkanya selalu identik (K-078). Semua angka dihitung di server.
 */

// --- Daftar laporan & izin ---

export const JENIS_LAPORAN = [
  'stok-rekap',
  'kartu-stok',
  'stok-minimum',
  'nilai-persediaan',
  'penjualan',
  'produk-terlaris',
  'detail-invoice',
  'retur-penjualan',
  'laba-kotor',
  'piutang',
  'promo',
  'riwayat-harga-beli',
  'hutang',
] as const;
export type JenisLaporan = (typeof JENIS_LAPORAN)[number];

export const GRUP_LAPORAN = {
  PERSEDIAAN: 'Laporan Persediaan',
  PENJUALAN: 'Laporan Penjualan',
  KEUANGAN: 'Laporan Keuangan',
} as const;
export type GrupLaporan = keyof typeof GRUP_LAPORAN;

export type InfoLaporan = {
  kode: JenisLaporan;
  /** Nama pendek di daftar laporan. */
  nama: string;
  /** Judul dokumen. */
  judul: string;
  grup: GrupLaporan;
  /** Semua izin ini wajib dimiliki (docs/04 §2). */
  izin: readonly Izin[];
  deskripsi: string;
};

export const DAFTAR_LAPORAN = [
  {
    kode: 'stok-rekap',
    nama: 'Stok Rekap',
    judul: 'Laporan Stok Rekap',
    grup: 'PERSEDIAAN',
    izin: ['laporan.persediaan'],
    deskripsi:
      'Saldo awal, barang masuk, barang keluar, dan saldo akhir tiap barang dalam periode.',
  },
  {
    kode: 'kartu-stok',
    nama: 'Kartu Stok',
    judul: 'Laporan Kartu Stok',
    grup: 'PERSEDIAAN',
    izin: ['laporan.persediaan'],
    deskripsi: 'Riwayat mutasi satu barang secara kronologis beserta saldo setelah tiap mutasi.',
  },
  {
    kode: 'stok-minimum',
    nama: 'Stok Minimum',
    judul: 'Laporan Stok Minimum',
    grup: 'PERSEDIAAN',
    izin: ['laporan.persediaan'],
    deskripsi: 'Barang yang stoknya habis, kritis, atau perlu restock saat ini.',
  },
  {
    kode: 'nilai-persediaan',
    nama: 'Nilai Persediaan',
    judul: 'Laporan Nilai Persediaan',
    grup: 'PERSEDIAAN',
    izin: ['laporan.persediaan', 'laporan.laba'],
    deskripsi: 'Nilai persediaan per tanggal: kuantitas × HPP rata-rata, per kategori.',
  },
  {
    kode: 'penjualan',
    nama: 'Penjualan per Periode',
    judul: 'Laporan Penjualan per Periode',
    grup: 'PENJUALAN',
    izin: ['laporan.penjualan'],
    deskripsi:
      'Ikhtisar penjualan bruto sampai penjualan bersih, rekap harian, dan rincian transaksi.',
  },
  {
    kode: 'produk-terlaris',
    nama: 'Produk Terlaris',
    judul: 'Laporan Penjualan Produk Terlaris',
    grup: 'PENJUALAN',
    izin: ['laporan.penjualan'],
    deskripsi: 'Peringkat barang menurut nilai penjualan beserta kontribusinya.',
  },
  {
    kode: 'detail-invoice',
    nama: 'Detail Invoice',
    judul: 'Laporan Detail Invoice',
    grup: 'PENJUALAN',
    izin: ['laporan.penjualan'],
    deskripsi: 'Rincian lengkap satu transaksi: barang, pembayaran, retur, void, dan surat jalan.',
  },
  {
    kode: 'retur-penjualan',
    nama: 'Retur Penjualan',
    judul: 'Laporan Retur Penjualan',
    grup: 'PENJUALAN',
    izin: ['laporan.penjualan'],
    deskripsi:
      'Retur yang disetujui dalam periode: barang, kondisi, alasan, penyelesaian, dan nilai.',
  },
  {
    kode: 'laba-kotor',
    nama: 'Gross Profit (Laba Kotor)',
    judul: 'Laporan Gross Profit Penjualan',
    grup: 'KEUANGAN',
    izin: ['laporan.laba'],
    deskripsi:
      'Penjualan bersih dikurangi harga pokok penjualan, per barang, transaksi, atau baris.',
  },
  {
    kode: 'piutang',
    nama: 'Piutang Usaha',
    judul: 'Laporan Piutang Usaha',
    grup: 'KEUANGAN',
    izin: ['laporan.piutang'],
    deskripsi: 'Tagihan pelanggan yang belum lunas, jatuh tempo, dan umurnya, per pelanggan.',
  },
  {
    kode: 'promo',
    nama: 'Promo',
    judul: 'Laporan Promo Penjualan',
    grup: 'PENJUALAN',
    izin: ['laporan.penjualan'],
    deskripsi:
      'Pemakaian promo dalam periode: transaksi, potongan yang diberikan, dan penjualan barang berpromo.',
  },
  {
    kode: 'riwayat-harga-beli',
    nama: 'Riwayat Harga Beli',
    judul: 'Laporan Riwayat Harga Beli',
    grup: 'PERSEDIAAN',
    // Seluruh isinya harga modal (data sensitif, docs/04 §5; K-087).
    izin: ['laporan.persediaan', 'laporan.laba'],
    deskripsi:
      'Harga beli tiap penerimaan pembelian, perubahannya, dan perbandingan harga antarpemasok.',
  },
  {
    kode: 'hutang',
    nama: 'Hutang Usaha',
    judul: 'Laporan Hutang Usaha',
    grup: 'KEUANGAN',
    izin: ['laporan.hutang'],
    deskripsi: 'Hutang ke pemasok yang belum lunas, jatuh tempo, dan umurnya, per pemasok.',
  },
] as const satisfies readonly InfoLaporan[];

export function infoLaporan(kode: JenisLaporan): InfoLaporan {
  const info = DAFTAR_LAPORAN.find((l) => l.kode === kode);
  if (!info) throw new Error(`Laporan tidak dikenal: ${kode}`);
  return info;
}

/** Laporan boleh dibuka bila semua izinnya dimiliki. */
export function bolehLihatLaporan(izin: Iterable<Izin>, kode: JenisLaporan): boolean {
  const punya = new Set(izin);
  return infoLaporan(kode).izin.every((i) => punya.has(i));
}

// --- Parameter ---

/** Rentang laporan maksimal satu tahun (laporan tahunan, docs/01 §5.9). */
export const RENTANG_LAPORAN_MAKS_HARI = 366;

const bentukPeriode = {
  dari: skemaTanggal('Tanggal awal'),
  sampai: skemaTanggal('Tanggal akhir'),
};

function cekPeriode(d: { dari: string; sampai: string }, ctx: z.RefinementCtx) {
  if (!tanggalSah(d.dari)) {
    ctx.addIssue({ code: 'custom', path: ['dari'], message: 'Tanggal awal tidak valid.' });
  } else if (!tanggalSah(d.sampai)) {
    ctx.addIssue({ code: 'custom', path: ['sampai'], message: 'Tanggal akhir tidak valid.' });
  } else if (d.dari > d.sampai) {
    ctx.addIssue({
      code: 'custom',
      path: ['sampai'],
      message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
    });
  } else if (jumlahHari(d.dari, d.sampai) > RENTANG_LAPORAN_MAKS_HARI) {
    ctx.addIssue({
      code: 'custom',
      path: ['sampai'],
      message: `Rentang laporan maksimal ${RENTANG_LAPORAN_MAKS_HARI} hari (satu tahun).`,
    });
  }
}

const idOpsional = z.coerce.number().int().positive().optional();

export const skemaLaporanStokRekap = z
  .object({
    ...bentukPeriode,
    idKategori: idOpsional,
    kepemilikan: z.enum(KEPEMILIKAN).optional(),
    /** BERMUTASI: hanya barang yang punya mutasi dalam periode. */
    cakupan: z.enum(['SEMUA', 'BERMUTASI']).default('SEMUA'),
  })
  .superRefine(cekPeriode);
export type ParamLaporanStokRekap = z.input<typeof skemaLaporanStokRekap>;

export const skemaLaporanKartuStok = z
  .object({
    ...bentukPeriode,
    idBarang: z.coerce.number('Pilih barang.').int().positive('Pilih barang.'),
  })
  .superRefine(cekPeriode);
export type ParamLaporanKartuStok = z.input<typeof skemaLaporanKartuStok>;

export const skemaLaporanStokMinimum = z.object({ idKategori: idOpsional });
export type ParamLaporanStokMinimum = z.input<typeof skemaLaporanStokMinimum>;

export const skemaLaporanNilaiPersediaan = z
  .object({ tanggal: skemaTanggal('Tanggal'), idKategori: idOpsional })
  .refine((d) => tanggalSah(d.tanggal), { path: ['tanggal'], message: 'Tanggal tidak valid.' });
export type ParamLaporanNilaiPersediaan = z.input<typeof skemaLaporanNilaiPersediaan>;

export const skemaLaporanPenjualan = z
  .object({ ...bentukPeriode, jenis: z.enum(JENIS_PENJUALAN).optional() })
  .superRefine(cekPeriode);
export type ParamLaporanPenjualan = z.input<typeof skemaLaporanPenjualan>;

/** Banyak barang yang ditampilkan; 0 = semua. */
export const BATAS_PRODUK_TERLARIS = [10, 25, 50, 0] as const;

export const skemaLaporanProdukTerlaris = z
  .object({
    ...bentukPeriode,
    idKategori: idOpsional,
    batas: z.coerce
      .number()
      .int()
      .refine((v) => (BATAS_PRODUK_TERLARIS as readonly number[]).includes(v), 'Batas tidak valid.')
      .default(10),
  })
  .superRefine(cekPeriode);
export type ParamLaporanProdukTerlaris = z.input<typeof skemaLaporanProdukTerlaris>;

/** Pencarian transaksi untuk Laporan Detail Invoice. */
export const skemaCariInvoiceLaporan = z.object({
  cari: z.string().trim().max(100).default(''),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
});
export type ParamCariInvoiceLaporan = z.input<typeof skemaCariInvoiceLaporan>;

export type KandidatInvoiceLaporan = {
  id: number;
  nomor: string;
  tanggalOperasional: string;
  jenisPenjualan: (typeof JENIS_PENJUALAN)[number];
  namaPembeli: string | null;
  totalNeto: number;
};

export const skemaLaporanRetur = z.object({ ...bentukPeriode }).superRefine(cekPeriode);
export type ParamLaporanRetur = z.input<typeof skemaLaporanRetur>;

/** Rincian laporan laba kotor: per barang, per transaksi, atau per baris (seperti rancangan KP). */
export const TAMPILAN_LABA = ['BARANG', 'TRANSAKSI', 'BARIS'] as const;
export type TampilanLaba = (typeof TAMPILAN_LABA)[number];

export const skemaLaporanLabaKotor = z
  .object({ ...bentukPeriode, tampilan: z.enum(TAMPILAN_LABA).default('BARANG') })
  .superRefine(cekPeriode);
export type ParamLaporanLabaKotor = z.input<typeof skemaLaporanLabaKotor>;

export const skemaLaporanPiutang = z.object({
  idPelanggan: idOpsional,
  terlambat: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamLaporanPiutang = z.input<typeof skemaLaporanPiutang>;

export const skemaLaporanPromo = z.object({ ...bentukPeriode }).superRefine(cekPeriode);
export type ParamLaporanPromo = z.input<typeof skemaLaporanPromo>;

export const skemaLaporanRiwayatHargaBeli = z
  .object({
    ...bentukPeriode,
    idBarang: idOpsional,
    idPemasok: idOpsional,
    idKategori: idOpsional,
  })
  .superRefine(cekPeriode);
export type ParamLaporanRiwayatHargaBeli = z.input<typeof skemaLaporanRiwayatHargaBeli>;

export const skemaLaporanHutang = z.object({
  idPemasok: idOpsional,
  terlambat: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamLaporanHutang = z.input<typeof skemaLaporanHutang>;

/** Catatan cetak PDF (log LAPORAN_EKSPOR); ekspor Excel dicatat server saat berkas dibuat. */
export const skemaCatatCetakLaporan = z.object({
  kode: z.enum(JENIS_LAPORAN),
  keterangan: z.string().trim().max(200).default(''),
});

// --- Dokumen laporan (model tampilan bersama layar / cetak / Excel) ---

/** Warna makna teks status (bukan dekorasi): baik = hijau, peringatan = jingga, bahaya = merah. */
export type NadaSel = 'baik' | 'peringatan' | 'bahaya' | 'info';

export type SelLaporan =
  | { j: 'teks'; v: string; tebal?: boolean; mono?: boolean; nada?: NadaSel }
  /** Rupiah utuh; negatif ditulis dalam kurung, nol sebagai tanda pisah. */
  | { j: 'uang'; v: number }
  /** Kuantitas numeric(14,3) sebagai teks. */
  | { j: 'qty'; v: string }
  /** Bilangan bulat (jumlah transaksi, peringkat). */
  | { j: 'angka'; v: number }
  /** Persen, mis. 12.34 → "12,3%"; `null` bila tidak terdefinisi (pembagi nol). */
  | { j: 'persen'; v: number | null }
  /** Tanggal kalender `YYYY-MM-DD`. */
  | { j: 'tanggal'; v: string }
  | { j: 'kosong' };

export type JenisKolomLaporan = 'teks' | 'uang' | 'qty' | 'angka' | 'persen' | 'tanggal';

export type KolomLaporan = {
  judul: string;
  jenis: JenisKolomLaporan;
  /** Lebar relatif (satuan karakter, dipakai juga sebagai lebar kolom Excel). */
  lebar: number;
  /** Judul kelompok di atas beberapa kolom berurutan (header dua tingkat). */
  grup?: string;
};

/**
 * data = baris biasa; grup = judul kelompok (mis. kategori) melintang seluruh kolom;
 * subtotal = garis tunggal di atas; total = garis tunggal di atas dan garis ganda di bawah.
 * Pada subtotal/total, `label` ditulis melintang di kolom-kolom awal yang selnya `kosong`.
 */
export type BarisTabelLaporan = {
  gaya: 'data' | 'grup' | 'subtotal' | 'total';
  sel: SelLaporan[];
  label?: string;
};

export type TabelLaporan = {
  kolom: KolomLaporan[];
  baris: BarisTabelLaporan[];
  /** Teks bila tidak ada baris data. */
  kosong?: string;
};

/**
 * Baris ikhtisar bergaya laporan laba rugi: `tingkat` = indentasi; `kurang` = pengurang (ditulis dalam
 * kurung); subtotal bergaris tunggal di atas; total bergaris tunggal di atas dan ganda di bawah.
 */
export type BarisIkhtisar = {
  label: string;
  nilai?: SelLaporan;
  tingkat?: 0 | 1 | 2;
  gaya?: 'biasa' | 'judul' | 'kurang' | 'subtotal' | 'total';
};

export type BagianLaporan =
  | { jenis: 'info'; judul?: string; pasangan: { label: string; nilai: string }[] }
  | { jenis: 'ikhtisar'; judul?: string; baris: BarisIkhtisar[] }
  | { jenis: 'tabel'; judul?: string; tabel: TabelLaporan };

export type TandaTanganLaporan = { label: string; jabatan: string; nama: string | null };

export type DokumenLaporan = {
  kode: JenisLaporan;
  /** Judul dokumen (ditulis kapital saat dicetak). */
  judul: string;
  /** Baris di bawah judul: periode/per tanggal, kriteria, satuan mata uang. */
  subjudul: string[];
  orientasi: 'potret' | 'lanskap';
  bagian: BagianLaporan[];
  /** Catatan atas laporan, dinomori saat dirender. */
  catatan: string[];
  tandaTangan: TandaTanganLaporan[];
  /** Waktu laporan disusun server (ISO). */
  disusunPada: string;
  disusunOleh: string;
  /** Nama berkas unduhan tanpa ekstensi, mis. `laporan-stok-rekap-2026-01-01_2026-01-31`. */
  namaBerkas: string;
};

// --- Dashboard (docs/05 ST3) ---

export type RingkasanDashboard = {
  tanggal: string;
  antreanOrder: { total: number; diproses: number };
  pengirimanAktif: { total: number; dikirim: number };
  /** Retur & void menunggu persetujuan; hanya untuk pemegang `*.setujui`. */
  persetujuan?: { retur: number; void: number };
  /** Hanya untuk pemegang `dashboard.omzet`. */
  omzet?: {
    hariIni: number;
    kemarin: number;
    jumlahTransaksiHariIni: number;
    /** Penjualan bersih 7 hari terakhir (lama → baru). */
    tujuhHari: { tanggal: string; nilai: number }[];
  };
};

export type AktivitasDashboard = {
  id: number;
  waktu: string;
  aksi: AksiLog;
  namaPengguna: string | null;
  nomorDokumen: string | null;
  ringkasan: string | null;
};
