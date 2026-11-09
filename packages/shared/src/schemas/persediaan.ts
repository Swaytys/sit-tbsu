import { z } from 'zod';
import {
  CARA_HITUNG,
  SEBAB_SELISIH,
  type JenisMutasiSegel,
  JENIS_MUTASI,
  JENIS_PENERIMAAN,
  JENIS_PENYESUAIAN,
  KEPEMILIKAN,
  KONDISI_STOK,
  STATUS_PENYESUAIAN,
  STATUS_STOK,
  SYARAT_BAYAR,
  TINDAKAN_TOLAK,
  type CaraHitung,
  type SebabSelisih,
  type JenisMutasi,
  type JenisPenerimaan,
  type JenisPenyesuaian,
  type Kepemilikan,
  type KondisiStok,
  type StatusStok,
  type StatusHutang,
  type StatusPenyesuaian,
  type SyaratBayar,
  type TindakanTolak,
} from '../enums';
import type { MetaHalaman } from '../api';
import { POLA_QTY } from '../qty';
import {
  PESAN_REFERENSI_KELUAR,
  referensiSah,
  skemaHalaman,
  skemaRupiah,
  teksOpsional,
} from './umum';

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

/** Qty ≥ 0 (boleh 0 bila semua yang datang ditolak, K-237). */
const qtyBolehNol = (label: string) =>
  z.preprocess(
    angkaKeTeks,
    z
      .string(`${label} wajib diisi.`)
      .regex(POLA_QTY, `${label} harus angka dengan maksimal 3 desimal.`),
  );
const adaQty = (v: string | undefined) => v !== undefined && /[1-9]/.test(v);

export const skemaBarisPenerimaan = z.object({
  idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
  /** Qty diterima baik (masuk stok, ditagih). */
  qtyMasuk: qtyBolehNol('Qty'),
  /** K-237: qty yang datang tetapi ditolak (rusak/tidak sesuai); hanya untuk penerimaan dari order. */
  qtyDitolak: qtyBolehNol('Qty ditolak').optional(),
  alasanTolak: teksOpsional(150, 'Alasan tolak maksimal 150 karakter.'),
  tindakanTolak: z
    .enum(TINDAKAN_TOLAK, 'Pilih tindak lanjut barang ditolak.')
    .nullable()
    .optional(),
  /** Per satuan dasar. KONSINYASI: diabaikan, diisi harga titip oleh server (E3). */
  hargaModalMasuk: z.preprocess((v) => (v === null || v === '' ? 0 : v), skemaRupiah),
  keterangan: teksOpsional(150, 'Keterangan maksimal 150 karakter.'),
  /** K-125: baris order pembelian yang diterima. */
  idOrderPembelianDetail: z.number().int().positive().nullable().optional(),
  /**
   * K-227: barang berkemasan tersegel: berapa box utuh tersegel di antara qty diterima. Kosong = box utuh terbanyak
   * (qty ÷ isi dibulatkan ke bawah); sisanya ecer.
   */
  qtySegel: z
    .preprocess(
      (v) => (v === '' || v === undefined ? null : typeof v === 'number' ? String(v) : v),
      z
        .string()
        .regex(/^\d{1,9}$/, 'Jumlah box segel harus bilangan bulat ≥ 0.')
        .nullable(),
    )
    .optional(),
});

export const skemaPenerimaan = z
  .object({
    idPemasok: z.number('Pemasok wajib dipilih.').int().positive('Pemasok wajib dipilih.'),
    jenis: z.enum(JENIS_PENERIMAAN),
    syaratBayar: z.enum(SYARAT_BAYAR).nullable().optional(),
    tanggalJatuhTempo: skemaTanggal('Tanggal jatuh tempo').nullable().optional(),
    /** Cara bayar penerimaan TUNAI (E4). */
    metodeBayar: z.enum(METODE_BAYAR_PENERIMAAN).default('TRANSFER'),
    /** K-196: No. referensi transfer ke pemasok (pembelian TUNAI dibayar transfer). */
    referensi: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
    noFakturPemasok: teksOpsional(50, 'No. faktur maksimal 50 karakter.'),
    noSuratJalanPemasok: teksOpsional(50, 'No. surat jalan maksimal 50 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    /** K-125: penerimaan dari order pembelian. */
    idOrderPembelian: z.number().int().positive().nullable().optional(),
    /**
     * K-237 (dari order): nominal dibayar saat ini. Kosong = sesuai kesepakatan (tunai saat datang: lunasi sisa
     * tagihan; tempo: 0). Kurang dari kesepakatan tunai = penyimpangan (alasan, jatuh tempo, Kepala Toko/Owner).
     */
    bayarSekarang: z.preprocess((v) => (v === '' ? null : v), skemaRupiah.nullable().optional()),
    alasanKurangBayar: teksOpsional(255, 'Alasan maksimal 255 karakter.'),
    jatuhTempoKurangBayar: skemaTanggal('Jatuh tempo sisa').nullable().optional(),
    baris: z
      .array(skemaBarisPenerimaan)
      .min(1, 'Tambahkan minimal satu barang.')
      .max(200, 'Maksimal 200 baris per penerimaan.'),
  })
  .superRefine((d, ctx) => {
    // K-236: dari order, syarat bayar diambil dari kesepakatan order (isian diabaikan).
    if (d.jenis === 'PEMBELIAN' && !d.syaratBayar && !d.idOrderPembelian) {
      ctx.addIssue({
        code: 'custom',
        path: ['syaratBayar'],
        message: 'Syarat bayar wajib dipilih.',
      });
    }
    if (
      d.jenis === 'PEMBELIAN' &&
      !d.idOrderPembelian &&
      d.syaratBayar === 'TUNAI' &&
      d.metodeBayar === 'TRANSFER' &&
      !referensiSah(d.referensi)
    ) {
      ctx.addIssue({ code: 'custom', path: ['referensi'], message: PESAN_REFERENSI_KELUAR });
    }
    if (
      d.jenis === 'PEMBELIAN' &&
      !d.idOrderPembelian &&
      d.syaratBayar === 'TEMPO' &&
      !d.tanggalJatuhTempo
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['tanggalJatuhTempo'],
        message: 'Tanggal jatuh tempo wajib diisi untuk pembelian tempo.',
      });
    }
    let diterima = 0;
    d.baris.forEach((b, i) => {
      const tolak = adaQty(b.qtyDitolak);
      if (adaQty(b.qtyMasuk)) diterima += 1;
      if (!adaQty(b.qtyMasuk) && !tolak) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'qtyMasuk'],
          message: 'Qty harus lebih dari 0.',
        });
      }
      if (tolak && !d.idOrderPembelian) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'qtyDitolak'],
          message: 'Barang ditolak hanya dicatat pada penerimaan dari order pembelian.',
        });
      }
      if (tolak && (b.alasanTolak ?? '').length < 3) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'alasanTolak'],
          message: 'Alasan barang ditolak wajib diisi.',
        });
      }
      if (tolak && !b.tindakanTolak) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'tindakanTolak'],
          message: 'Pilih tindak lanjut barang ditolak.',
        });
      }
    });
    if (d.baris.length > 0 && diterima === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['baris'],
        message:
          'Tidak ada barang yang diterima. Bila semua ditolak, catat di order (Konfirmasi/Tutup sisa).',
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
  /** K-225: hanya pembelian tanpa order pembelian (daftar tinjau Kepala Toko/Owner). */
  tanpaOrder: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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
  /** K-237: barang yang datang tetapi ditolak. */
  ditolak: {
    namaBarang: string;
    kodeSatuan: string;
    qty: string;
    alasan: string;
    tindakan: TindakanTolak;
  }[];
  /** K-237: dibayar kurang dari kesepakatan order. */
  penyimpanganBayar: boolean;
  alasanPenyimpangan: string | null;
  /** K-125. */
  nomorOrderPembelian: string | null;
  idOrderPembelian: number | null;
};

// --- Penyesuaian stok (docs/05 §12, A1–A7) ---

/** Jenis yang bisa dibuat pengguna (MUSNAH = pemusnahan stok rusak, Fase 10). */
export const JENIS_PENYESUAIAN_M1 = ['SALDO_AWAL', 'OPNAME', 'KOREKSI', 'RUSAK', 'MUSNAH'] as const;
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
  /** OPNAME (K-227): sebab baku barang yang berselisih; wajib saat diselesaikan bila ada selisih. */
  sebabSelisih: z.preprocess(
    kosongJadiNull,
    z.enum(SEBAB_SELISIH, 'Sebab selisih tidak valid.').nullable(),
  ),
  /** OPNAME (K-069): barang di lembar yang sengaja tidak dihitung; alasan wajib. */
  dikecualikan: z.boolean().default(false),
  alasanKecuali: teksOpsional(150, 'Alasan maksimal 150 karakter.'),
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
    if (d.jenis === 'MUSNAH' && !d.alasan) salah(['alasan'], 'Alasan pemusnahan wajib diisi.');
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
      if (b.sebabSelisih) {
        if (d.jenis !== 'OPNAME') {
          salah(['baris', i, 'sebabSelisih'], 'Sebab selisih hanya untuk stok opname.');
        } else if (b.sebabSelisih === 'LAINNYA' && (!b.keterangan || b.keterangan.length < 3)) {
          salah(['baris', i, 'keterangan'], 'Sebab "Lainnya": tulis sebabnya di keterangan.');
        }
      }
      if (b.dikecualikan) {
        if (d.jenis !== 'OPNAME') {
          salah(['baris', i, 'dikecualikan'], 'Pengecualian hanya untuk stok opname.');
        } else if (!b.alasanKecuali || b.alasanKecuali.length < 3) {
          salah(['baris', i, 'alasanKecuali'], 'Alasan pengecualian wajib diisi (min. 3 huruf).');
        }
      }
      if (d.jenis === 'KOREKSI' && nol(b.qtySelisih)) {
        salah(['baris', i, 'qtySelisih'], 'Selisih koreksi tidak boleh 0.');
      }
      if (d.jenis === 'RUSAK' || d.jenis === 'MUSNAH') {
        if (nol(b.qtySelisih) || b.qtySelisih?.startsWith('-')) {
          salah(
            ['baris', i, 'qtySelisih'],
            d.jenis === 'RUSAK'
              ? 'Jumlah rusak harus lebih dari 0.'
              : 'Jumlah dimusnahkan harus lebih dari 0.',
          );
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

/** K-227: satu hasil hitung opname (tidak pernah dihapus). */
export type HitunganOpname = {
  id: number;
  idPenghitung: number;
  namaPenghitung: string;
  waktu: string;
  qty: string;
  cara: CaraHitung;
  beratGram: string | null;
  /** K-227 barang tersegel: box segel yang dihitung (sebelum uji petik) dan isi kemasan saat itu. */
  qtySegel: string | null;
  isiSegel: string | null;
  /** K-227 uji petik: isi box yang dibuka dan dihitung. */
  isiUjiPetik: string | null;
  /** Selisih terhadap stok sistem pada waktu hitungan itu; `null` untuk hitung buta. */
  selisih: string | null;
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
  /** OPNAME: tidak dihitung, dengan alasan, siapa, dan kapan (K-069). */
  dikecualikan: boolean;
  alasanKecuali: string | null;
  namaPenggunaKecuali: string | null;
  waktuKecuali: string | null;
  /** K-227 (OPNAME): sebab baku selisih. */
  sebabSelisih: SebabSelisih | null;
  /** K-227 (OPNAME): riwayat hitung. Hitung buta: hanya hitungan pengguna itu sendiri. */
  hitungan: HitunganOpname[];
  /** K-227: ada hitungan orang lain yang disembunyikan dari pengguna ini (hitung buta). */
  dihitungOrangLain: boolean;
  /** K-227: waktu hitungan terakhir; stok sistem dan selisih dihitung pada waktu ini. */
  waktuHitung: string | null;
  /** K-227: selisih melewati toleransi (atau kelas A) sehingga wajib dikonfirmasi hitungan orang lain. */
  perluHitungUlang: boolean;
  /** K-227: hasil akhir sudah sama dengan hitungan orang lain. */
  terkonfirmasi: boolean;
  /** K-227: kelas ABC barang (hanya untuk pengatur opname). */
  kelas: KelasABC | null;
  /** K-227: barang ini diminta uji petik (buka 1 box segel acak, hitung isinya). */
  ujiPetik: boolean;
};

export type DetailPenyesuaian = BarisDaftarPenyesuaian & {
  catatan: string | null;
  baris: BarisDetailPenyesuaian[];
  /** K-227 (OPNAME): penghitung yang ditugaskan; `null` = terbuka untuk semua penghitung. */
  penghitung: { id: number; nama: string } | null;
  waktuMulaiHitung: string | null;
  /** K-227: tampilan ini hitung buta (tanpa stok sistem, selisih, dan hitungan orang lain). */
  hitungButa: boolean;
  /** K-227: nilai selisih (Rp) yang masih boleh tanpa hitung ulang (kecuali kelas A). */
  toleransiRp: number;
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
  /** K-227: box utuh tersegel dan kemasannya (`null` = barang tanpa kemasan tersegel). */
  stokSegel: string;
  segel: { kodeSatuan: string; isi: string } | null;
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
  /** Milik sendiri / titipan (konsinyasi). */
  kepemilikan: z.enum(KEPEMILIKAN).optional(),
  /** Stok baik / stok rusak. */
  kondisi: z.enum(KONDISI_STOK).optional(),
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
  kepemilikan: Kepemilikan;
  /** Penitip, untuk barang titipan. */
  namaPemasokKonsinyasi: string | null;
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

// --- K-240/K-227: Stok Opname bertahap ---

export type KelasABC = 'A' | 'B' | 'C';

export type RingkasanOpname = {
  kelas: { kelas: KelasABC; selangHari: number; jumlah: number; jatuhTempo: number }[];
  /** Akurasi catatan persediaan 30 hari (%): baris opname cocok ÷ baris dihitung; `null` bila belum ada. */
  akurasi30Hari: number | null;
  barisDihitung30Hari: number;
  /** Nilai mutlak selisih × HPP (rupiah) 30 hari. */
  nilaiSelisih30Hari: number;
  /** K-227: barang rawan (selisih di 2 dari 3 opname terakhir): dihitung paling lambat tiap 30 hari. */
  rawan: number;
  /** K-227: barang aktif yang belum dihitung sama sekali tahun ini. */
  belumDihitungTahunIni: number;
  /** K-227: jumlah barang per hari kerja agar semua kelas terhitung tepat waktu. */
  saranPerHari: number;
  toleransiRp: number;
  /** K-227: draf opname yang menunggu tindakan (perlu hitung ulang / siap diselesaikan). */
  drafAktif: number;
};

/** K-227: kinerja opname (akurasi catatan persediaan) untuk Owner/Kepala Toko. */
export type KinerjaOpname = {
  bulan: {
    bulan: string;
    dihitung: number;
    cocok: number;
    akurasi: number | null;
    nilaiSelisih: number;
    /** Σ selisih × HPP bertanda: negatif = stok hilang/kurang. */
    nilaiBersih: number;
  }[];
  kelas: { kelas: KelasABC; dihitung: number; cocok: number; akurasi: number | null }[];
  penghitung: {
    idPengguna: number;
    nama: string;
    hitungan: number;
    /** Hitungan yang sama dengan hasil akhir yang disetujui. */
    tepat: number;
    akurasi: number | null;
  }[];
  sebab: { sebab: SebabSelisih | null; baris: number; nilaiSelisih: number; nilaiBersih: number }[];
  /** K-227 uji petik 90 hari: box segel yang dibuka saat opname dan yang isinya kurang. */
  ujiPetik: { dibuka: number; kurang: number; kurangQty: string };
};

/** K-227: lapisan segel satu barang. */
export type SegelBarang = {
  idSatuanJual: number;
  kodeSatuan: string;
  isi: string;
  qtySegel: string;
  ecer: string;
  riwayat: {
    id: number;
    waktu: string;
    jenis: JenisMutasiSegel;
    qtyMasuk: string;
    qtyKeluar: string;
    saldoSetelah: string;
    namaPengguna: string;
    keterangan: string | null;
  }[];
};

/** K-227: menandai satu kemasan (satuan jual) barang sebagai tersegel; `null` = tidak ada. */
export const skemaKemasanSegel = z.object({
  idSatuanJual: z.number().int().positive().nullable(),
});

/** K-227: buka N box segel menjadi ecer. */
export const skemaBukaSegel = z.object({
  jumlah: z.coerce
    .number('Jumlah box harus angka.')
    .int('Jumlah box harus bilangan bulat.')
    .min(1, 'Minimal 1 box.'),
  alasan: z
    .string('Alasan wajib diisi.')
    .trim()
    .min(3, 'Alasan minimal 3 huruf.')
    .max(150, 'Alasan maksimal 150 huruf.'),
});
export type InputBukaSegel = z.input<typeof skemaBukaSegel>;

export type PenghitungOpname = { id: number; nama: string; peran: string };

/** K-227: lembar hitung untuk penghitung (hitung buta). */
export type BarisLembarHitung = {
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  /** Satuan dihitung per buah: hasil timbang dibulatkan ke bilangan bulat. */
  satuanBulat: boolean;
  timbang: { jumlahSampel: string; beratSampelGram: string } | null;
  /** K-227: kemasan tersegel barang ini (hitung box segel dan ecer terpisah). */
  segel: { kodeSatuan: string; isi: string } | null;
  /** K-227: buka 1 box segel acak dan hitung isinya. */
  ujiPetik: boolean;
  dikecualikan: boolean;
  /** Hitungan terakhir pengguna ini. */
  hitunganSaya: HitunganOpname | null;
  dihitungOrangLain: boolean;
  /** Barang ini masih perlu dihitung (ulang) oleh orang lain dan pengguna ini belum menghitungnya. */
  perluDihitung: boolean;
};

export type LembarHitung = {
  id: number;
  nomor: string;
  status: StatusPenyesuaian;
  catatan: string | null;
  penghitung: { id: number; nama: string } | null;
  waktuMulaiHitung: string | null;
  /** Lembar ditugaskan ke pengguna ini dan belum dimulai: daftar barang baru tampil setelah "Mulai hitung". */
  belumMulai: boolean;
  jumlahBaris: number;
  baris: BarisLembarHitung[];
};

export type TugasOpname = {
  id: number;
  nomor: string;
  tanggal: string;
  catatan: string | null;
  jumlahBaris: number;
  /** Barang yang sudah dihitung pengguna ini. */
  sudahSaya: number;
  /** Barang yang belum dihitung siapa pun. */
  belumDihitung: number;
  ditugaskan: boolean;
  dimulai: boolean;
};

export const skemaDaftarHarian = z.object({
  jumlah: z.coerce
    .number('Jumlah barang harus angka.')
    .int('Jumlah barang harus bilangan bulat.')
    .min(1, 'Minimal 1 barang.')
    .max(100, 'Maksimal 100 barang per daftar.'),
  /** K-227: daftar harian langsung ditugaskan ke satu penghitung (tidak terlihat penghitung lain). */
  idPenghitung: z.coerce
    .number('Pilih penghitung.')
    .int('Pilih penghitung.')
    .positive('Pilih penghitung.'),
});

/** K-227: menugaskan (atau memindah) lembar opname ke penghitung; `null` = terbuka untuk semua penghitung. */
export const skemaTugaskanOpname = z.object({
  idPenghitung: z.number().int().positive().nullable(),
});

const POLA_GRAM = /^\d{1,9}(\.\d{1,3})?$/;
const angkaGram = (label: string) =>
  z.preprocess(
    (v) => kosongJadiNull(angkaKeTeks(v)),
    z
      .string()
      .regex(POLA_GRAM, `${label} harus angka, maksimal 3 desimal.`)
      .refine((v) => Number(v) > 0, `${label} harus lebih dari 0.`)
      .nullable(),
  );

/** K-227: satu hasil hitung dari lembar hitung. TIMBANG: qty dihitung server dari berat bersih. */
export const skemaHitungOpname = z
  .object({
    idBarang: z.number().int().positive(),
    cara: z.enum(CARA_HITUNG).default('HITUNG'),
    qty: z.preprocess(
      (v) => kosongJadiNull(angkaKeTeks(v)),
      z.string().regex(POLA_QTY, 'Jumlah harus angka ≥ 0, maksimal 3 desimal.').nullable(),
    ),
    beratGram: angkaGram('Berat'),
    /** K-227 barang tersegel: jumlah box utuh tersegel yang dihitung; `qty`/`beratGram` = ecer saja. */
    qtySegel: z.preprocess(
      (v) => kosongJadiNull(angkaKeTeks(v)),
      z
        .string()
        .regex(/^\d{1,9}$/, 'Jumlah box segel harus bilangan bulat ≥ 0.')
        .nullable(),
    ),
    /** K-227 uji petik: isi box yang dibuka (box itu ikut dihitung di `qtySegel`). */
    isiUjiPetik: z.preprocess(
      (v) => kosongJadiNull(angkaKeTeks(v)),
      z.string().regex(POLA_QTY, 'Isi box harus angka ≥ 0, maksimal 3 desimal.').nullable(),
    ),
  })
  .superRefine((d, ctx) => {
    if (d.cara === 'HITUNG' && d.qty === null)
      ctx.addIssue({ code: 'custom', path: ['qty'], message: 'Isi jumlah hasil hitung.' });
    if (d.cara === 'TIMBANG' && d.beratGram === null)
      ctx.addIssue({ code: 'custom', path: ['beratGram'], message: 'Isi berat bersih (gram).' });
    if (d.isiUjiPetik !== null && (d.qtySegel === null || Number(d.qtySegel) < 1))
      ctx.addIssue({
        code: 'custom',
        path: ['qtySegel'],
        message: 'Uji petik butuh minimal 1 box segel yang dihitung.',
      });
  });
export type InputHitungOpname = z.input<typeof skemaHitungOpname>;
export type DataHitungOpname = z.output<typeof skemaHitungOpname>;

/** K-227: data timbang barang: `jumlahSampel` buah (satuan dasar) beratnya `beratSampelGram` gram. */
export const skemaTimbangBarang = z
  .object({
    jumlahSampel: z.preprocess(
      (v) => kosongJadiNull(angkaKeTeks(v)),
      z
        .string()
        .regex(POLA_QTY, 'Jumlah sampel harus angka, maksimal 3 desimal.')
        .refine((v) => Number(v) > 0, 'Jumlah sampel harus lebih dari 0.')
        .nullable(),
    ),
    beratSampelGram: angkaGram('Berat sampel'),
  })
  .refine((d) => (d.jumlahSampel === null) === (d.beratSampelGram === null), {
    path: ['beratSampelGram'],
    message: 'Isi keduanya (jumlah sampel dan beratnya) atau kosongkan keduanya.',
  });
export type InputTimbangBarang = z.input<typeof skemaTimbangBarang>;
export type DataTimbangBarang = z.output<typeof skemaTimbangBarang>;
