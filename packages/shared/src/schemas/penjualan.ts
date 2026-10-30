import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  JENIS_PENJUALAN,
  METODE_PEMBAYARAN,
  PRIORITAS_ORDER,
  STATUS_ORDER,
  STATUS_PEMBAYARAN,
  STATUS_PENGAMBILAN,
  STATUS_PENGIRIMAN,
  STATUS_SURAT_JALAN,
  type JenisPembayaran,
  type JenisPenjualan,
  type Kepemilikan,
  type MetodePembayaran,
  type PrioritasOrder,
  type StatusItem,
  type StatusOrder,
  type StatusPembayaran,
  type StatusPengambilan,
  type StatusPengiriman,
  type StatusSuratJalan,
  type StatusTransaksi,
  type StatusVerifikasi,
} from '../enums';
import type { HasilSuratJalan } from './armada';
import type { RingkasAtribut } from './barang';
import { skemaQtyPositif, skemaTanggal } from './persediaan';
import { skemaKodePersetujuan } from './saluran';
import {
  skemaHalaman,
  skemaNoHpWajib,
  skemaRupiah,
  teksOpsional,
  POLA_REFERENSI,
  PESAN_REFERENSI,
} from './umum';

/*
 * Penjualan (Fase 5): order & antrean (docs/05 §3, §6), harga dan diskon baris (docs/06 §1–2).
 * Harga, subtotal, dan total final dihitung API; web hanya menampilkan perkiraan.
 */

const kosongJadiNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/** Persen diskon 0–100, maksimal 2 desimal (teks). */
const skemaPersen = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : kosongJadiNull(v)),
  z
    .string()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Persen diskon tidak valid.')
    .transform((v) => v.replace(',', '.'))
    .refine((v) => Number(v) <= 100, 'Persen diskon maksimal 100.')
    .nullable(),
);

export const skemaBarisOrder = z
  .object({
    idBarang: z.number('Barang wajib dipilih.').int().positive('Barang wajib dipilih.'),
    qty: skemaQtyPositif('Qty'),
    /** K-091: satuan jual baris; `null` = satuan dasar barang. Qty dan harga dalam satuan ini. */
    idSatuanJual: z.number().int().positive().nullable().default(null),
    /**
     * Harga manual (H9): butuh izin `penjualan.harga_manual`. Selain itu harga selalu otomatis: tier
     * transaksi menurut total nilai belanja (P3, H8); tier tidak bisa dipilih (K-099).
     */
    hargaManual: z.boolean().default(false),
    hargaSatuan: z.preprocess(kosongJadiNull, skemaRupiah.nullable()).default(null),
    /** Diskon baris dalam rupiah, atau persen (diubah ke rupiah oleh API, U4). */
    diskonBaris: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
    diskonBarisPersen: skemaPersen.default(null),
    catatanItem: teksOpsional(150, 'Catatan item maksimal 150 karakter.'),
    /** PR5: promo baris ini dilepas (mengubahnya butuh `penjualan.checkout`, dicatat log). */
    tanpaPromo: z.boolean().default(false),
  })
  .superRefine((b, ctx) => {
    if (b.hargaManual && b.hargaSatuan === null) {
      ctx.addIssue({ code: 'custom', path: ['hargaSatuan'], message: 'Harga manual wajib diisi.' });
    }
  });
export type InputBarisOrder = z.input<typeof skemaBarisOrder>;

/**
 * K-095: satu barang boleh beberapa baris asal satuannya berbeda (mis. 100 dus + 50 buah); baris dikenali
 * dari barang + satuan.
 */
export function kunciBaris(idBarang: number, idSatuanJual: number | null | undefined): string {
  return `${idBarang}:${idSatuanJual ?? 0}`;
}

/** Isi order tanpa aturan lintas kolom (dipakai pratinjau harga saat isian belum lengkap). */
const bentukOrder = z.object({
  jenisPenjualan: z.enum(JENIS_PENJUALAN, 'Jenis penjualan tidak valid.'),
  idPelanggan: z.number().int().positive().nullable().default(null),
  namaPembeli: teksOpsional(100, 'Nama pembeli maksimal 100 karakter.'),
  prioritas: z.enum(PRIORITAS_ORDER).default('NORMAL'),
  alamatKirim: teksOpsional(255, 'Alamat kirim maksimal 255 karakter.'),
  catatanKirim: teksOpsional(255, 'Catatan kirim maksimal 255 karakter.'),
  ongkir: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
  diskonTransaksi: z.preprocess((v) => (v === '' || v == null ? 0 : v), skemaRupiah).default(0),
  diskonTransaksiPersen: skemaPersen.default(null),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
  /** H9: Admin/Owner menyetujui harga manual di bawah modal. */
  setujuDiBawahModal: z.boolean().default(false),
  baris: z
    .array(skemaBarisOrder)
    .min(1, 'Tambahkan minimal satu barang.')
    .max(200, 'Maksimal 200 barang per order.'),
});

export const skemaOrder = bentukOrder.superRefine((d, ctx) => {
  if (d.jenisPenjualan === 'PENGANTARAN') {
    if (d.idPelanggan === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['idPelanggan'],
        message: 'Pengantaran wajib memilih pelanggan.',
      });
    }
    if (!d.alamatKirim) {
      ctx.addIssue({
        code: 'custom',
        path: ['alamatKirim'],
        message: 'Alamat kirim wajib diisi untuk pengantaran.',
      });
    }
  }
  const terlihat = new Map<string, number>();
  d.baris.forEach((b, i) => {
    const k = kunciBaris(b.idBarang, b.idSatuanJual);
    const lain = terlihat.get(k);
    if (lain !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['baris', i, 'idBarang'],
        message: `Barang dan satuan sama dengan baris ${lain + 1}; ubah qty-nya saja.`,
      });
    }
    terlihat.set(k, i);
  });
});
export type InputOrder = z.input<typeof skemaOrder>;
export type DataOrder = z.output<typeof skemaOrder>;

/**
 * Pratinjau harga order (PR5): harga, promo, diskon, dan total dihitung API tanpa menyimpan apa pun, dipanggil
 * layar order/kasir setiap isi berubah. `idOrder` = order yang sedang diubah (harga janji P2).
 */
export const skemaPratinjauOrder = z.object({
  idOrder: z.number().int().positive().nullable().default(null),
  order: bentukOrder,
});
export type InputPratinjauOrder = z.input<typeof skemaPratinjauOrder>;

export type BarisPratinjau = {
  idBarang: number;
  idSatuanJual: number | null;
  /** Tier yang dipakai baris (selalu otomatis, H8); `null` = harga manual. */
  idTingkatHarga: number | null;
  hargaSatuan: number;
  /** bulatkanRupiah(qty × harga satuan). */
  bruto: number;
  idPromo: number | null;
  namaPromo: string | null;
  diskonPromo: number;
  promoNonaktif: boolean;
  /** PR5: promo yang tidak diberikan karena dilepas. */
  promoDilepas: { nama: string; potongan: number } | null;
  /** PR6: promo yang lebih besar tidak berlaku karena harga jadi di bawah modal (tanpa angka modal). */
  promoDitolak: boolean;
  diskonBaris: number;
  subtotal: number;
  /**
   * K-200: qty (satuan dasar) jauh di atas kebiasaan barang ini (lebih dari 2× qty terbanyak satu transaksi dalam 90
   * hari terakhir): kemungkinan salah ketik. `biasanya` = qty terbanyak itu. `null` = wajar/belum ada riwayat.
   */
  qtyTidakBiasa: { qty: string; biasanya: string } | null;
};

/** K-098: tier harga transaksi menurut total nilai belanja (berlaku untuk semua barang). */
export type InfoTierBelanja = {
  /** Σ qty × harga tier dasar seluruh baris, sebelum promo dan diskon. */
  nilaiBelanja: number;
  /** Tier yang dipakai otomatis untuk transaksi ini. */
  idTingkatHarga: number;
  /** Tier berikutnya yang belum tercapai dan kekurangan belanjanya; `null` = sudah tier tertinggi. */
  berikut: { idTingkatHarga: number; kurang: number } | null;
};

export type PratinjauOrder = {
  baris: BarisPratinjau[];
  tierBelanja: InfoTierBelanja;
  totalBruto: number;
  totalDiskonPromo: number;
  totalDiskonBaris: number;
  /** Σ subtotal baris (setelah promo dan diskon baris). */
  subtotal: number;
  diskonTransaksi: number;
  ongkir: number;
  total: number;
};

export const skemaCariOrder = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  /** AKTIF = MENUNGGU + DIPROSES. */
  status: z.enum([...STATUS_ORDER, 'AKTIF'] as const).optional(),
  jenis: z.enum(JENIS_PENJUALAN).optional(),
  /** Hanya order buatan sendiri. */
  milikSaya: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Hanya order yang sedang diproses (dikunci) pengguna ini (tutup shift, K-121 butir 9). */
  dipegangSaya: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariOrder = z.input<typeof skemaCariOrder>;

export const skemaBatalOrder = z.object({
  alasan: z
    .string('Alasan batal wajib diisi.')
    .trim()
    .min(3, 'Alasan batal wajib diisi (min. 3 huruf).')
    .max(255, 'Alasan maksimal 255 karakter.'),
});

/** K-122: order disimpan paling lama sekian hari dari hari ini. */
export const MAKS_HARI_SIMPAN_ORDER = 14;

/** K-122: simpan order untuk diambil/dibayar nanti. Nama wajib bila order tanpa pelanggan (diperiksa service). */
export const skemaSimpanOrder = z.object({
  namaPembeli: teksOpsional(100, 'Nama pembeli maksimal 100 karakter.'),
  noHp: skemaNoHpWajib,
  tanggalAmbil: skemaTanggal('Tanggal ambil'),
});
export type InputSimpanOrder = z.input<typeof skemaSimpanOrder>;
export type DataSimpanOrder = z.output<typeof skemaSimpanOrder>;

/** K-122 butir 4: barang yang juga ada di draf lain, untuk peringatan saat ditambahkan. */
export const skemaCariDrafBarang = z.object({
  idBarang: z.coerce.number().int().positive(),
  /** Draf yang sedang diisi (tidak ikut dihitung). */
  kecuali: z.coerce.number().int().positive().optional(),
});

export type DrafBarang = {
  /** Stok tersedia barang (satuan dasar). */
  stokTersedia: string;
  kodeSatuanDasar: string;
  draf: {
    id: number;
    nomor: string;
    noAntrean: number;
    namaPembeli: string | null;
    namaPengguna: string;
    milikSaya: boolean;
    /** Qty barang ini di draf itu (satuan dasar, semua baris satuan digabung). */
    qtyDasar: string;
    diubahPada: string | null;
  }[];
};

export type BarisDaftarOrder = {
  id: number;
  nomor: string;
  tanggal: string;
  jenisPenjualan: JenisPenjualan;
  status: StatusOrder;
  prioritas: PrioritasOrder;
  idPelanggan: number | null;
  namaPelanggan: string | null;
  namaPembeli: string | null;
  idPengguna: number;
  namaPengguna: string;
  idKasirProses: number | null;
  namaKasirProses: string | null;
  jumlahItem: number;
  total: number;
  waktuMasukAntrean: string | null;
  /** R7: MENUNGGU lebih lama dari batas umur order. */
  basi: boolean;
  /** Nomor antrean harian = nomor urut ORD hari itu (mis. ORD-261002-057 → 57), untuk dipanggil (K-073). */
  noAntrean: number;
  /** Isi order (nama barang & qty) agar order tanpa nama pembeli tetap bisa dikenali (K-073). */
  ringkasan: RingkasBarisOrder[];
  /** Catatan pembuat order untuk kasir (tampil di tiket antrean dan layar kasir, K-099). */
  catatan: string | null;
  /** K-122: No. HP pembeli dan rencana tanggal ambil (order disimpan). */
  noHpPembeli: string | null;
  tanggalAmbil: string | null;
  /** K-122: order DISIMPAN yang tanggal ambilnya sudah lewat (hubungi pembeli). */
  lewatTanggalAmbil: boolean;
};

export type RingkasBarisOrder = { namaBarang: string; qty: string; kodeSatuan: string };

/** Tiket di papan antrean kasir/pengantaran (MENUNGGU & DIPROSES, FIFO). */
export type TiketAntrean = BarisDaftarOrder & { alamatKirim: string | null };

export const skemaCariAntrean = z.object({ jenis: z.enum(JENIS_PENJUALAN) });

/** Nomor antrean dari nomor dokumen ORD (bagian angka terakhir). */
export function nomorAntrean(nomor: string): number {
  const bagian = nomor.split('-');
  return Number.parseInt(bagian[bagian.length - 1] ?? '0', 10) || 0;
}

export type BarisDetailOrder = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  /** Kategori barang (sasaran promo, PR2). */
  idKategori: number;
  /** Satuan baris (satuan jual, atau satuan dasar). */
  kodeSatuan: string;
  kodeSatuanDasar: string;
  /** K-091: `null` = satuan dasar; faktor ke satuan dasar (snapshot). */
  idSatuanJual: number | null;
  faktor: string;
  kepemilikan: Kepemilikan;
  qty: string;
  qtyDasar: string;
  idTingkatHarga: number | null;
  namaTier: string | null;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  /** PR4: promo baris (dievaluasi ulang saat checkout, PR5). */
  idPromo: number | null;
  namaPromo: string | null;
  diskonPromo: number;
  promoNonaktif: boolean;
  subtotal: number;
  catatanItem: string | null;
  /** Atribut barang untuk tampilan ringkas di daftar barang transaksi (K-099). */
  ringkasAtribut: RingkasAtribut[];
  /** Stok tersedia untuk order ini (stok tersedia + yang sudah ditahan order ini). */
  stokTersedia: string;
  /** Harga jual barang per tier saat ini untuk satuan baris (pilihan tier di form). */
  hargaTier: { idTingkatHarga: number; hargaJual: number }[];
  /** Pilihan satuan baris (satuan dasar + satuan jual aktif) dengan harga per tier (K-091). */
  opsiSatuan: OpsiSatuanBaris[];
};

/** Pilihan satuan untuk baris transaksi; satuan dasar = `idSatuanJual` null, faktor "1". */
export type OpsiSatuanBaris = {
  idSatuanJual: number | null;
  kodeSatuan: string;
  faktor: string;
  hargaTier: { idTingkatHarga: number; hargaJual: number }[];
};

export type DetailOrder = BarisDaftarOrder & {
  alamatKirim: string | null;
  catatanKirim: string | null;
  alasanBatal: string | null;
  idPenjualan: number | null;
  subtotal: number;
  diskonTransaksi: number;
  ongkir: number;
  baris: BarisDetailOrder[];
};

export type DaftarOrder = { data: BarisDaftarOrder[]; meta: MetaHalaman };

/** Stok tertahan (R7): per barang, order yang menahan stok. */
export type BarisStokTertahan = {
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  kodeSatuan: string;
  stokFisik: string;
  stokDipesan: string;
  order: {
    id: number;
    nomor: string;
    status: StatusOrder;
    qtyDasar: string;
    namaPengguna: string;
    namaPelanggan: string | null;
    waktuMasukAntrean: string | null;
    basi: boolean;
  }[];
};

// --- Checkout & pembayaran (docs/05 P1–P13) ---

/**
 * U12: No. referensi pembayaran non-tunai wajib, 4–40 karakter huruf/angka (boleh spasi . / -). Panjang aslinya
 * berbeda per bank/penyedia (approval EDC 6, RRN QRIS 12, referensi transfer 8–20), jadi dibatasi longgar.
 */
export const POLA_REFERENSI_BAYAR = POLA_REFERENSI;
export const PESAN_REFERENSI_BAYAR = PESAN_REFERENSI;

export const skemaPembayaran = z
  .object({
    metode: z.enum(METODE_PEMBAYARAN, 'Metode bayar tidak valid.'),
    /**
     * Nominal yang diakui. `null` = lunasi sisa tagihan (dihitung server, K-073): TUNAI memakai
     * min(uang diterima, sisa); non-tunai memakai sisa. Mencegah selisih bila harga final berbeda dari layar.
     */
    nominal: z
      .preprocess(
        (v) => (v === '' || v === undefined ? null : v),
        skemaRupiah.refine((v) => v > 0, { message: 'Nominal harus lebih dari 0.' }).nullable(),
      )
      .default(null),
    /** TUNAI: uang yang diserahkan pembeli (kembalian dihitung server). */
    uangDiterima: z.preprocess(kosongJadiNull, skemaRupiah.nullable()).default(null),
    /**
     * K-111: rekening toko tujuan (dari daftar Pengaturan › Pembayaran) untuk pembayaran non-tunai. Bila
     * diisi, `rekening` diabaikan dan diisi server dari label rekening itu.
     */
    idRekening: z.number().int().positive().nullable().default(null),
    rekening: teksOpsional(60, 'Rekening maksimal 60 karakter.'),
    referensi: teksOpsional(60, 'Referensi maksimal 60 karakter.'),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    /** K-141: TUNAI, pembeli tidak mengambil kembalian; dicatat kas masuk khusus (bukan penjualan). */
    kembalianTidakDiambil: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (
      p.metode === 'TUNAI' &&
      p.uangDiterima !== null &&
      p.nominal !== null &&
      p.uangDiterima < p.nominal
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['uangDiterima'],
        message: 'Uang diterima kurang dari nominal.',
      });
    }
    // U12: tujuan non-tunai hanya dari rekening penerimaan terdaftar (tidak ada tujuan ketik-bebas).
    if (p.metode !== 'TUNAI' && p.idRekening === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['idRekening'],
        message:
          'Pilih rekening penerimaan dari daftar. Belum ada? Admin/Owner menambahkannya di Pengaturan › Pembayaran.',
      });
    }
    if (p.metode !== 'TUNAI' && !POLA_REFERENSI_BAYAR.test(p.referensi ?? '')) {
      ctx.addIssue({ code: 'custom', path: ['referensi'], message: PESAN_REFERENSI_BAYAR });
    }
  });
export type InputPembayaran = z.input<typeof skemaPembayaran>;
export type DataPembayaran = z.output<typeof skemaPembayaran>;

export const skemaCheckout = z
  .object({
    /** Checkout dari order antrean (MENUNGGU, atau DIPROSES milik kasir ini) … */
    idOrder: z.number().int().positive().nullable().default(null),
    /**
     * … atau checkout langsung: order dibuat dan diselesaikan dalam satu transaksi (P1). Bila diisi BERSAMA
     * `idOrder`, isinya menggantikan isi order itu (kasir mengubah order saat checkout, R4) dalam transaksi
     * yang sama (K-073).
     */
    order: skemaOrder.nullable().default(null),
    pembayaran: z.array(skemaPembayaran).max(5, 'Maksimal 5 pembayaran.').default([]),
    statusPengambilan: z.enum(STATUS_PENGAMBILAN).default('DIAMBIL'),
    /** Wajib bila belum lunas; kosong = default P7. */
    tanggalJatuhTempo: skemaTanggal('Tanggal jatuh tempo').nullable().default(null),
    bayarSaatTerima: z.boolean().default(false),
    catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
    /** P2: barang yang harganya diperbarui ke harga tier saat ini (dicatat log). */
    perbaruiHarga: z.array(z.number().int().positive()).default([]),
    /** PT6: lanjut walau limit kredit terlampaui (butuh `master.pelanggan.atur_kredit`, dicatat log). */
    setujuLimit: z.boolean().default(false),
    /**
     * PT6 (K-102): kode sekali pakai dari Admin/Owner untuk melampaui limit kredit, bila pengguna yang login
     * tidak memegang `master.pelanggan.atur_kredit` (docs/04 §6).
     */
    kodeLimit: skemaKodePersetujuan.nullable().default(null),
  })
  .refine((d) => d.idOrder !== null || d.order !== null, {
    message: 'Pilih order dari antrean atau isi keranjang.',
    path: ['idOrder'],
  });
export type InputCheckout = z.input<typeof skemaCheckout>;
export type DataCheckout = z.output<typeof skemaCheckout>;

export const skemaBayarPenjualan = z.object({ pembayaran: skemaPembayaran });

export const skemaCariPenjualan = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  jenis: z.enum(JENIS_PENJUALAN).optional(),
  statusPembayaran: z.enum(STATUS_PEMBAYARAN).optional(),
  statusPengambilan: z.enum(STATUS_PENGAMBILAN).optional(),
  statusPengiriman: z.enum(STATUS_PENGIRIMAN).optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
});
export type ParamCariPenjualan = z.input<typeof skemaCariPenjualan>;

export type BarisDaftarPenjualan = {
  id: number;
  nomor: string;
  tanggal: string;
  tanggalOperasional: string;
  jenisPenjualan: JenisPenjualan;
  idPelanggan: number | null;
  namaPelanggan: string | null;
  namaPembeli: string | null;
  namaKasir: string;
  totalNeto: number;
  totalDibayar: number;
  sisaTagihan: number;
  statusPembayaran: StatusPembayaran;
  statusTransaksi: StatusTransaksi;
  statusPengambilan: StatusPengambilan | null;
  statusPengiriman: StatusPengiriman | null;
  tanggalJatuhTempo: string | null;
};

export type BarisDetailPenjualan = {
  id: number;
  idBarang: number;
  kodeBarang: string;
  namaBarang: string;
  /** Satuan baris (satuan jual, atau satuan dasar). */
  kodeSatuan: string;
  kodeSatuanDasar: string;
  idSatuanJual: number | null;
  faktor: string;
  qty: string;
  qtyDasar: string;
  namaTier: string | null;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  /** PR4/PR7: promo baris (nama dicetak di bawah baris struk). */
  idPromo: number | null;
  namaPromo: string | null;
  diskonPromo: number;
  subtotal: number;
  statusItem: StatusItem;
  /** PENGANTARAN: qty di surat jalan yang tidak BATAL, dan yang sudah SELESAI (S2/S4). */
  qtyDikirim: string;
  qtyTerkirim: string;
  /** Qty yang masih boleh dibuatkan surat jalan (S2). */
  qtyBelumDikirim: string;
  /** Sensitif (`master.barang.lihat_hpp`). */
  hppSaatTransaksi?: number;
};

export type PembayaranPenjualan = {
  id: number;
  nomor: string;
  tanggal: string;
  jenis: JenisPembayaran;
  metode: MetodePembayaran;
  nominal: number;
  uangDiterima: number | null;
  kembalian: number;
  rekening: string | null;
  referensi: string | null;
  namaPengguna: string;
  /** K-111: hasil pengecekan uang masuk; `null` untuk tunai. */
  statusVerifikasi: StatusVerifikasi | null;
  catatanVerifikasi: string | null;
};

export type DetailPenjualan = BarisDaftarPenjualan & {
  nomorOrder: string | null;
  idOrder: number | null;
  nomorShift: string | null;
  alamatKirim: string | null;
  catatanKirim: string | null;
  catatan: string | null;
  bayarSaatTerima: boolean;
  noHpPelanggan: string | null;
  totalBruto: number;
  totalDiskon: number;
  diskonTransaksi: number;
  ongkir: number;
  totalVoid: number;
  totalRetur: number;
  totalRefund: number;
  baris: BarisDetailPenjualan[];
  pembayaran: PembayaranPenjualan[];
  /** PENGANTARAN: surat jalan invoice ini (terbaru dulu). */
  suratJalan: BarisSuratJalan[];
};

// --- Shift (K1; tutup & clerical di Fase 6) ---

/**
 * Keadaan waktu sebuah shift BUKA (K-109), dihitung server saat diminta.
 * `terlewat`: shift dari hari operasional sebelumnya yang belum ditutup; selama itu pemiliknya tidak bisa
 * mencatat penjualan atau uang sampai shift ditutup.
 */
export type WaktuShift = {
  /** Jadwal yang berlaku untuk shift ini, dibekukan saat shift dibuka (`HH:mm`); `null` = tanpa jadwal. */
  jadwalBuka: string | null;
  jadwalTutup: string | null;
  /** Saat jam tutup shift ini (ISO); `null` bila tanpa jadwal tutup. */
  batasTutup: string | null;
  lewatJadwal: boolean;
  terlewat: boolean;
};

export type ShiftAktif = WaktuShift & {
  id: number;
  nomor: string;
  /** BUKA atau DIHITUNG (hitungan tutup sudah dikirim, belum selesai ditutup). */
  status: 'BUKA' | 'DIHITUNG' | 'TUTUP';
  tanggalOperasional: string;
  waktuBuka: string;
  modalAwal: number;
  /** K-121 */
  caraBuka: 'SAMA_KEMARIN' | 'HITUNG' | 'HITUNG_NANTI';
  /** Batas hitung susulan (cara HITUNG_NANTI) bila belum dikirim; `null` bila tidak perlu. */
  batasHitungBuka: string | null;
  /** Koreksi modal bersih (+/−) sejauh ini. */
  koreksiModal: number;
  /** Sudah ada transaksi tunai (koreksi modal setelahnya butuh kode atasan). */
  adaTransaksiTunai: boolean;
  /** K-132: pengguna yang membuka shift toko ini. */
  namaPembuka: string;
  /** K-132: shift lain yang masih terbuka (sisa aturan lama, satu shift per pengguna); harus ditutup. */
  lainTerbuka: { id: number; nomor: string; namaPembuka: string }[];
  /** K-134: hasil hitung susulan yang sudah dikirim tetapi belum disimpan. */
  hitungBuka: HasilHitungBuka | null;
};

/**
 * K-134: hasil hitung susulan (shift "buka dulu, hitung nanti"). Selisih = laci − (modal sementara + uang masuk
 * bersih sejak buka) = selisih semalam.
 */
export type HasilHitungBuka = {
  jumlahHitung: number;
  waktu: string;
  laci: number;
  masukSejakBuka: number;
  modalSementara: number;
  modalSaatBuka: number;
  ditinggalKemarin: number | null;
  selisih: number;
  toleransi: number;
  dalamToleransi: boolean;
  bolehHitungUlang: boolean;
};

/** K-132: status shift toko untuk semua pengguna (indikator di topbar). */
export type StatusShiftToko = {
  id: number;
  nomor: string;
  status: 'BUKA' | 'DIHITUNG';
  waktuBuka: string;
  namaPembuka: string;
  lewatJadwal: boolean;
  terlewat: boolean;
} | null;

/** K-142: pengajuan retur/void yang menunggu persetujuan (informasi saat tutup shift). */
export type PengajuanMenunggu = {
  jenis: 'RETUR' | 'VOID';
  id: number;
  nomor: string;
  nomorPenjualan: string;
  nilai: number;
  namaPengaju: string;
  tanggal: string;
};

// --- Surat jalan (docs/05 §7, S1–S7) ---

export const skemaSuratJalan = z.object({
  /** K-174: surat jalan hanya dibuat di dalam rit rencana; sopir dan kendaraannya diambil dari rit itu. */
  idPerjalanan: z
    .number('Pilih rit (kendaraan dan sopir).')
    .int()
    .positive('Pilih rit (kendaraan dan sopir).'),
  alamatKirim: teksOpsional(255, 'Alamat maksimal 255 karakter.'),
  namaPenerima: teksOpsional(100, 'Nama penerima maksimal 100 karakter.'),
  noHpPenerima: teksOpsional(20, 'No. HP maksimal 20 karakter.'),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
  baris: z
    .array(
      z.object({
        idPenjualanDetail: z.number().int().positive(),
        qtyKirim: skemaQtyPositif('Qty kirim'),
      }),
    )
    .min(1, 'Pilih minimal satu barang yang dikirim.'),
});
export type InputSuratJalan = z.input<typeof skemaSuratJalan>;
export type DataSuratJalan = z.output<typeof skemaSuratJalan>;

/** S3: hanya DIPROSES → DIMUAT; DIKIRIM lewat berangkat (S9), SELESAI lewat catat hasil (S10). */
/** S3 + K-203: centang muat (DIPROSES → DIMUAT) dan lepas centang (DIMUAT → DIPROSES) selama rit belum berangkat. */
export const skemaStatusSuratJalan = z.object({
  status: z.enum(['DIMUAT', 'DIPROSES']),
});

export const skemaBatalSuratJalan = skemaBatalOrder;

export const skemaCariSuratJalan = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  /** AKTIF = DIPROSES + DIMUAT + DIKIRIM. */
  status: z.enum([...STATUS_SURAT_JALAN, 'AKTIF'] as const).optional(),
});

export type BarisSuratJalan = {
  id: number;
  nomor: string;
  /** K-173: nomor antrean order asal (null bila invoice langsung dari kasir). */
  noAntrean: number | null;
  tanggal: string;
  idPenjualan: number;
  nomorPenjualan: string;
  namaPelanggan: string | null;
  alamatKirim: string;
  namaPenerima: string | null;
  noHpPenerima: string | null;
  sopir: string | null;
  kendaraan: string | null;
  status: StatusSuratJalan;
  waktuDimuat: string | null;
  waktuDikirim: string | null;
  waktuSelesai: string | null;
  alasanBatal: string | null;
  catatan: string | null;
  namaPengguna: string;
  /** K-150: perjalanan yang membawanya (null untuk surat jalan sebelum K-150 atau yang belum berangkat). */
  idPerjalanan: number | null;
  nomorPerjalanan: string | null;
  /** K-149: hasil pengantaran (null bila belum dicatat atau surat jalan SELESAI sebelum K-149). */
  hasil: HasilSuratJalan | null;
  baris: {
    idPenjualanDetail: number;
    namaBarang: string;
    kodeBarang: string;
    kodeSatuan: string;
    qtyKirim: string;
  }[];
};

/** Invoice pengantaran yang masih punya barang belum dikirim (kolom "Perlu surat jalan"). */
export type PerluDikirim = {
  idPenjualan: number;
  nomor: string;
  tanggal: string;
  namaPelanggan: string | null;
  alamatKirim: string | null;
  bayarSaatTerima: boolean;
  /** Ada surat jalan selesai sebelumnya: sisa ini kiriman ulang/pengganti. */
  kirimUlang: boolean;
  /** K-173: nomor antrean order asal (null bila invoice langsung dari kasir). */
  noAntrean: number | null;
  noHp: string | null;
  catatanKirim: string | null;
  /** Sebagian barang sudah dibuatkan surat jalan (order dibagi); sisa ini belum. */
  sebagian: boolean;
  baris: {
    idBarang: number;
    namaBarang: string;
    kodeSatuan: string;
    qtyBelumDikirim: string;
    /** K-170: berat atau ukuran barang belum diisi (muatan rit tidak bisa dihitung penuh). */
    tanpaMuatan: boolean;
  }[];
};

// --- Piutang (docs/06 PT1–PT4) ---

export const skemaCariPiutang = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idPelanggan: z.coerce.number().int().positive().optional(),
  terlambat: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariPiutang = z.input<typeof skemaCariPiutang>;

export type BarisPiutang = {
  id: number;
  nomor: string;
  tanggal: string;
  jenisPenjualan: JenisPenjualan;
  idPelanggan: number;
  namaPelanggan: string;
  totalNeto: number;
  totalDibayar: number;
  sisaTagihan: number;
  statusPembayaran: StatusPembayaran;
  tanggalJatuhTempo: string | null;
  /** Hari lewat jatuh tempo (negatif = masih sekian hari lagi). */
  hariTerlambat: number | null;
  terlambat: boolean;
};

export type RingkasanPiutangPelanggan = {
  idPelanggan: number;
  namaPelanggan: string;
  jumlahInvoice: number;
  totalSisa: number;
  jatuhTempoTerlama: string | null;
};

export type DaftarPiutang = {
  data: BarisPiutang[];
  meta: MetaHalaman;
  ringkasan: {
    totalSisa: number;
    jumlah: number;
    jumlahTerlambat: number;
    totalTerlambat: number;
    perPelanggan: RingkasanPiutangPelanggan[];
  };
};
