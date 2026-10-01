import { z } from 'zod';
import {
  JENIS_PENERIMAAN,
  SYARAT_BAYAR,
  type JenisPenerimaan,
  type StatusHutang,
  type SyaratBayar,
} from '../enums';
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
