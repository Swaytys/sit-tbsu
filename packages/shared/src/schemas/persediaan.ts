import { z } from 'zod';
import {
  JENIS_MUTASI,
  JENIS_PENERIMAAN,
  JENIS_PENYESUAIAN,
  KEPEMILIKAN,
  KONDISI_STOK,
  STATUS_PENYESUAIAN,
  STATUS_STOK,
  SYARAT_BAYAR,
  type JenisMutasi,
  type JenisPenerimaan,
  type JenisPenyesuaian,
  type Kepemilikan,
  type KondisiStok,
  type StatusStok,
  type StatusHutang,
  type StatusPenyesuaian,
  type SyaratBayar,
} from '../enums';
import type { MetaHalaman } from '../api';
import { POLA_QTY } from '../qty';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Persediaan (Fase 4): penerimaan barang (docs/05 §11), penyesuaian stok (§12), posisi dan kartu stok.
 * Qty selalu teks desimal (numeric 14,3); uang rupiah bulat.
 */

const angkaKeTeks = (v: unknown) =>
  typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : v;

/** Qty > 0, maksimal 3 desimal (boleh koma). */
export const skemaQtyPositif = (label: string) =>
  z.preprocess(
    angkaKeTeks,
    z
      .string(`${label} wajib diisi.`)
      .regex(POLA_QTY, `${label} harus angka dengan maksimal 3 desimal.`)
      .refine((v) => /[1-9]/.test(v), `${label} harus lebih dari 0.`),
  );

/** Tanggal kalender `YYYY-MM-DD` (input type=date). */
export const skemaTanggal = (label: string) =>
  z.string(`${label} wajib diisi.`).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid.`);

// --- Penerimaan barang ---

export const METODE_BAYAR_PENERIMAAN = ['TRANSFER', 'TUNAI'] as const;

export const skemaBarisPenerimaan = z.object({
  idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
  qtyMasuk: skemaQtyPositif('Qty'),
  /** Per satuan dasar. KONSINYASI: diabaikan, diisi harga titip oleh server (E3). */
  hargaModalMasuk: z.preprocess((v) => (v === null || v === '' ? 0 : v), skemaRupiah),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});

export const skemaPenerimaan = z
  .object({
    idPemasok: z.number('Pemasok wajib dipilih.').int().positive('Pemasok wajib dipilih.'),
    jenis: z.enum(JENIS_PENERIMAAN),
    syaratBayar: z.enum(SYARAT_BAYAR).nullable().optional(),
    tanggalJatuhTempo: skemaTanggal('Tanggal jatuh tempo').nullable().optional(),
    /** Cara bayar penerimaan TUNAI (E4). */
    metodeBayar: z.enum(METODE_BAYAR_PENERIMAAN).default('TRANSFER'),
    noFakturPemasok: teksOpsional(50, 'No. faktur maksimal 50 karakter.'),
    noSuratJalanPemasok: teksOpsional(50, 'No. surat jalan maksimal 50 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    baris: z
      .array(skemaBarisPenerimaan)
      .min(1, 'Tambahkan minimal satu barang.')
      .max(200, 'Maksimal 200 baris per penerimaan.'),
  })
  .superRefine((d, ctx) => {
    if (d.jenis === 'PEMBELIAN' && !d.syaratBayar) {
      ctx.addIssue({
        code: 'custom',
        path: ['syaratBayar'],
        message: 'Syarat bayar wajib dipilih.',
      });
    }
    if (d.jenis === 'PEMBELIAN' && d.syaratBayar === 'TEMPO' && !d.tanggalJatuhTempo) {
      ctx.addIssue({
        code: 'custom',
        path: ['tanggalJatuhTempo'],
        message: 'Tanggal jatuh tempo wajib diisi untuk pembelian tempo.',
      });
    }
    const terlihat = new Map<number, number>();
    d.baris.forEach((b, i) => {
      const lain = terlihat.get(b.idBarang);
      if (lain !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'idBarang'],
          message: `Barang sama dengan baris ${lain + 1}; gabungkan qty-nya.`,
        });
      }
      terlihat.set(b.idBarang, i);
    });
  });
export type InputPenerimaan = z.input<typeof skemaPenerimaan>;
export type DataPenerimaan = z.output<typeof skemaPenerimaan>;

export const skemaCariPenerimaan = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  jenis: z.enum(JENIS_PENERIMAAN).optional(),
  idPemasok: z.coerce.number().int().positive().optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
});
export type ParamCariPenerimaan = z.input<typeof skemaCariPenerimaan>;

export type BarisDaftarPenerimaan = {
  id: number;
  nomor: string;
  tanggal: string;
  tanggalOperasional: string;
  idPemasok: number;
  namaPemasok: string;
  jenis: JenisPenerimaan;
  syaratBayar: SyaratBayar | null;
  tanggalJatuhTempo: string | null;
  noFakturPemasok: string | null;
  totalFaktur: number;
  sisaHutang: number;
  statusHutang: StatusHutang;
  jumlahBaris: number;
  namaPengguna: string;
};

export type DetailPenerimaan = BarisDaftarPenerimaan & {
  kodePemasok: string;
  noSuratJalanPemasok: string | null;
  catatan: string | null;
  totalDibayar: number;
  baris: {
    id: number;
    idBarang: number;
    kodeBarang: string;
    namaBarang: string;
    kodeSatuan: string;
    qtyMasuk: string;
    hargaModalMasuk: number;
    subtotal: number;
    keterangan: string | null;
  }[];
  pembayaran: { nomor: string; tanggal: string; nominal: number; metode: string }[];
};

// --- Penyesuaian stok (docs/05 §12, A1–A7) ---

/** Jenis yang bisa dibuat di M1 (MUSNAH = M2, Fase 10). */
export const JENIS_PENYESUAIAN_M1 = ['SALDO_AWAL', 'OPNAME', 'KOREKSI', 'RUSAK'] as const;
export type JenisPenyesuaianM1 = (typeof JENIS_PENYESUAIAN_M1)[number];

const POLA_QTY_BERTANDA = /^-?\d{1,11}(\.\d{1,3})?$/;
const kosongJadiNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const skemaBarisPenyesuaian = z.object({
  idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
  /** SALDO_AWAL: jumlah awal (> 0). OPNAME: hasil hitung (≥ 0; kosong = belum dihitung). */
  qtyFisik: z.preprocess(
    (v) => kosongJadiNull(angkaKeTeks(v)),
    z.string().regex(POLA_QTY, 'Qty fisik harus angka ≥ 0, maksimal 3 desimal.').nullable(),
  ),
  /** KOREKSI: selisih bertanda (+ masuk, − keluar). RUSAK: jumlah yang rusak (positif). */
  qtySelisih: z.preprocess(
    (v) => kosongJadiNull(angkaKeTeks(v)),
    z
      .string()
      .regex(POLA_QTY_BERTANDA, 'Selisih harus angka (boleh negatif), maksimal 3 desimal.')
      .nullable(),
  ),
  /** SALDO_AWAL: nilai per satuan dasar. Lainnya diisi server (hpp_rata2 saat selesai). */
  hppSatuan: z.preprocess(kosongJadiNull, skemaRupiah.nullable()),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
});
export type InputBarisPenyesuaian = z.input<typeof skemaBarisPenyesuaian>;

export const skemaPenyesuaian = z
  .object({
    jenis: z.enum(JENIS_PENYESUAIAN_M1, 'Jenis penyesuaian tidak valid.'),
    alasan: teksOpsional(255, 'Alasan maksimal 255 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    baris: z.array(skemaBarisPenyesuaian).max(5000, 'Maksimal 5000 baris.'),
  })
  .superRefine((d, ctx) => {
    const salah = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (d.jenis === 'KOREKSI' && !d.alasan) salah(['alasan'], 'Alasan koreksi wajib diisi.');
    const terlihat = new Map<number, number>();
    d.baris.forEach((b, i) => {
      const lain = terlihat.get(b.idBarang);
      if (lain !== undefined) {
        salah(['baris', i, 'idBarang'], `Barang sama dengan baris ${lain + 1}.`);
      }
      terlihat.set(b.idBarang, i);
      const nol = (v: string | null) => v === null || !/[1-9]/.test(v);
      if (d.jenis === 'SALDO_AWAL') {
        if (nol(b.qtyFisik)) salah(['baris', i, 'qtyFisik'], 'Jumlah awal harus lebih dari 0.');
        if (b.hppSatuan === null) salah(['baris', i, 'hppSatuan'], 'Nilai per satuan wajib diisi.');
      }
      if (d.jenis === 'KOREKSI' && nol(b.qtySelisih)) {
        salah(['baris', i, 'qtySelisih'], 'Selisih koreksi tidak boleh 0.');
      }
      if (d.jenis === 'RUSAK') {
        if (nol(b.qtySelisih) || b.qtySelisih?.startsWith('-')) {
          salah(['baris', i, 'qtySelisih'], 'Jumlah rusak harus lebih dari 0.');
        }
      }
    });
  });
export type InputPenyesuaian = z.input<typeof skemaPenyesuaian>;
export type DataPenyesuaian = z.output<typeof skemaPenyesuaian>;

export const skemaCariPenyesuaian = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  jenis: z.enum(JENIS_PENYESUAIAN).optional(),
  status: z.enum(STATUS_PENYESUAIAN).optional(),
});

/** Membuat draf OPNAME berisi barang aktif (semua atau satu kategori) untuk lembar hitung. */
export const skemaBuatLembarOpname = z.object({
  idKategori: z.number().int().positive().nullable().default(null),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});

export type BarisDaftarPenyesuaian = {
  id: number;
  nomor: string;
  tanggal: string;
  jenis: JenisPenyesuaian;
  status: StatusPenyesuaian;
  alasan: string | null;
  jumlahBaris: number;
  namaPengguna: string;
  waktuSelesai: string | null;
};

export type BarisDetailPenyesuaian = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kondisi: KondisiStok;
  /** DRAFT: stok sistem saat ini; SELESAI: stok sistem saat diselesaikan. */
  qtySistem: string;
  /** A3: barang terjual yang belum diambil (hanya OPNAME). */
  qtyBelumDiambil: string;
  qtyFisik: string | null;
  qtySelisih: string;
  hppSatuan: number;
  keterangan: string | null;
};

export type DetailPenyesuaian = BarisDaftarPenyesuaian & {
  catatan: string | null;
  baris: BarisDetailPenyesuaian[];
};

// --- Posisi stok, mutasi, kartu stok (docs/05 ST1, docs/01 §6) ---

export const skemaCariStok = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
  statusStok: z.enum(STATUS_STOK).optional(),
  kepemilikan: z.enum(KEPEMILIKAN).optional(),
});
export type ParamCariStok = z.input<typeof skemaCariStok>;

export type BarisPosisiStok = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  stokFisik: string;
  stokDipesan: string;
  stokTersedia: string;
  stokRusak: string;
  stokMinimum: string;
  statusStok: StatusStok;
  terakhirMutasi: string | null;
  /** Sensitif (`master.barang.lihat_hpp`). */
  hppRata2?: number;
  /** Fisik × HPP; 0 untuk konsinyasi (L7: bukan milik toko). Sensitif. */
  nilaiPersediaan?: number;
};

export type RingkasanStok = {
  jumlahBarang: number;
  perStatus: Record<StatusStok, number>;
  /** Σ nilai persediaan milik sendiri (barang aktif). Sensitif. */
  nilaiPersediaan?: number;
};

export type DaftarPosisiStok = {
  data: BarisPosisiStok[];
  meta: MetaHalaman;
  ringkasan: RingkasanStok;
};

export const skemaCariMutasi = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idBarang: z.coerce.number().int().positive().optional(),
  jenis: z.enum(JENIS_MUTASI).optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
});
export type ParamCariMutasi = z.input<typeof skemaCariMutasi>;

export type BarisMutasi = {
  id: number;
  waktu: string;
  tanggalOperasional: string;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  jenis: JenisMutasi;
  kondisi: KondisiStok;
  qtyMasuk: string;
  qtyKeluar: string;
  saldoSetelah: string;
  /** Nomor dokumen sumber (RCV/ADJ/…) bila ada. */
  nomorDokumen: string | null;
  /** Tautan halaman dokumen sumber di web, bila halamannya ada. */
  jenisDokumen:
    'PENERIMAAN' | 'PENYESUAIAN' | 'PENJUALAN' | 'RETUR' | 'VOID' | 'RETUR_PEMASOK' | null;
  idDokumen: number | null;
  namaPengguna: string;
  keterangan: string | null;
  /** Sensitif. */
  hppSatuan?: number;
  hppSetelah?: number;
};

export const skemaKartuStok = z.object({
  kondisi: z.enum(KONDISI_STOK).default('BAIK'),
  dari: skemaTanggal('Tanggal awal'),
  sampai: skemaTanggal('Tanggal akhir'),
});
export type ParamKartuStok = z.input<typeof skemaKartuStok>;

export type KartuStok = {
  barang: {
    id: number;
    kode: string;
    namaBarang: string;
    kodeSatuan: string;
    kepemilikan: Kepemilikan;
    stokMinimum: string;
  };
  kondisi: KondisiStok;
  dari: string;
  sampai: string;
  /** Saldo pada akhir hari sebelum `dari`. */
  saldoAwal: string;
  totalMasuk: string;
  totalKeluar: string;
  saldoAkhir: string;
  baris: BarisMutasi[];
  /** Sensitif: HPP rata-rata sebelum periode dan sesudah baris terakhir. */
  hppAwal?: number | null;
  hppAkhir?: number | null;
};

// --- Peringatan stok (ST2/ST3) ---

export type BarangPeringatanStok = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  kodeSatuan: string;
  stokFisik: string;
  stokMinimum: string;
  statusStok: StatusStok;
};

export type PeringatanStok = {
  habis: number;
  kritis: number;
  perluRestock: number;
  /** KRITIS/HABIS lebih dulu, dibatasi beberapa baris teratas. */
  barang: BarangPeringatanStok[];
};
