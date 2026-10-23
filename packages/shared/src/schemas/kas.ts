import { z } from 'zod';
import type { MetaHalaman } from '../api';
import {
  CARA_BUKA_SHIFT,
  STATUS_SHIFT,
  type ArahKas,
  type CaraBukaShift,
  type JenisHitungKas,
  type JenisKasShift,
  type JenisPenjualan,
  type MetodePembayaran,
  type StatusShift,
} from '../enums';
import { skemaKodePersetujuan } from './saluran';
import type { WaktuShift } from './penjualan';
import { skemaTanggal } from './persediaan';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Kas: shift kasir, kas masuk/keluar shift, tutup shift = clerical check blind count (docs/05 §10, K1–K8).
 */

/** Jenis kas shift yang dicatat manual oleh kasir (K3); refund & bayar pemasok tercatat otomatis. */
export const JENIS_KAS_MANUAL = [
  'KASBON',
  'SETOR_OWNER',
  'TARIK_OWNER',
  'MASUK_LAIN',
  'KELUAR_LAIN',
] as const satisfies readonly JenisKasShift[];
export type JenisKasManual = (typeof JENIS_KAS_MANUAL)[number];

/** Arah uang tiap jenis kas shift (K3). */
export const ARAH_JENIS_KAS: Record<JenisKasShift, ArahKas> = {
  KASBON: 'KELUAR',
  SETOR_OWNER: 'KELUAR',
  TARIK_OWNER: 'MASUK',
  REFUND_RETUR: 'KELUAR',
  REFUND_VOID: 'KELUAR',
  BAYAR_PEMASOK: 'KELUAR',
  MASUK_LAIN: 'MASUK',
  KELUAR_LAIN: 'KELUAR',
  KOREKSI_MODAL_TAMBAH: 'MASUK',
  KOREKSI_MODAL_KURANG: 'KELUAR',
  KEMBALIAN_DITINGGAL: 'MASUK',
};

/** Jenis kas yang merupakan koreksi modal awal (K-121): dihitung ke modal efektif, bukan kas masuk/keluar lain. */
export const JENIS_KOREKSI_MODAL = [
  'KOREKSI_MODAL_TAMBAH',
  'KOREKSI_MODAL_KURANG',
] as const satisfies readonly JenisKasShift[];

// --- Hitung per pecahan (K-121) ---

/** Pecahan rupiah yang beredar (kertas dan koin), dari besar ke kecil. */
export const PECAHAN_UANG = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

/** Jumlah lembar/keping per pecahan, kunci = nilai pecahan sebagai teks (mis. "50000": 3). */
export const skemaRincianPecahan = z
  .record(z.string(), z.number().int('Jumlah harus bilangan bulat.').min(0).max(100_000))
  .refine(
    (r) => Object.keys(r).every((k) => (PECAHAN_UANG as readonly number[]).includes(Number(k))),
    'Pecahan uang tidak dikenal.',
  );
export type RincianPecahan = z.output<typeof skemaRincianPecahan>;

/** Total rupiah dari rincian pecahan. */
export function totalPecahan(r: RincianPecahan): number {
  return Object.entries(r).reduce((t, [k, n]) => t + Number(k) * n, 0);
}

/** Hitungan uang laci: total langsung, atau rincian pecahan (total dihitung dari rincian). */
export const skemaHitungKas = z
  .object({
    uangFisik: skemaRupiah.optional(),
    rincian: skemaRincianPecahan.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.uangFisik === undefined && d.rincian === undefined) {
      ctx.addIssue({ code: 'custom', path: ['uangFisik'], message: 'Isi hasil hitungan uang.' });
    }
    if (
      d.uangFisik !== undefined &&
      d.rincian !== undefined &&
      totalPecahan(d.rincian) !== d.uangFisik
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['uangFisik'],
        message: 'Total tidak sama dengan jumlah rincian pecahan.',
      });
    }
  });
export type DataHitungKas = z.output<typeof skemaHitungKas>;

/** K-121: buka shift tiga cara. Tanpa `cara` = HITUNG (kompatibel dengan `{ modalAwal }`). */
export const skemaBukaShift = z
  .object({
    cara: z.enum(CARA_BUKA_SHIFT).default('HITUNG'),
    modalAwal: z.preprocess(
      (v) => (v === '' || v === null ? undefined : v),
      skemaRupiah.optional(),
    ),
    rincian: skemaRincianPecahan.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.cara === 'HITUNG' && d.modalAwal === undefined && d.rincian === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['modalAwal'],
        message: 'Isi hasil hitungan uang shift.',
      });
    }
  });
export type InputBukaShift = z.input<typeof skemaBukaShift>;
export type DataBukaShift = z.output<typeof skemaBukaShift>;

/** Usulan modal awal: uang yang dicatat ditinggal di laci saat shift terakhir ditutup (K-121). */
export type UsulanBukaShift = {
  uangDitinggal: number | null;
  nomorShift: string | null;
  namaKasir: string | null;
  waktuTutup: string | null;
  /** Batas menit untuk hitung susulan (pengaturan). */
  batasHitungMenit: number;
};

/** K-121: koreksi modal awal. `kode` = kode atasan bila sudah ada transaksi tunai. */
export const skemaKoreksiModal = z.object({
  modalBenar: skemaRupiah,
  alasan: z
    .string('Alasan wajib diisi.')
    .trim()
    .min(3, 'Tulis alasan koreksi.')
    .max(255, 'Alasan maksimal 255 karakter.'),
  kode: skemaKodePersetujuan.optional(),
});
export type DataKoreksiModal = z.output<typeof skemaKoreksiModal>;

/** K-121: penjelasan selisih oleh Admin/Owner setelah shift ditutup (angka tidak berubah). */
export const skemaPenjelasanSelisih = z.object({
  penjelasan: z
    .string('Penjelasan wajib diisi.')
    .trim()
    .min(3, 'Tulis penjelasannya.')
    .max(255, 'Penjelasan maksimal 255 karakter.'),
});

export type BarisHitungKas = {
  jenis: JenisHitungKas;
  waktu: string;
  uangFisik: number;
  rincian: RincianPecahan | null;
  /** Saldo sistem saat hitungan (tutup) atau tunai bersih sejak buka (hitung susulan). */
  saldoSistem: number | null;
  namaPengguna: string;
};

export const skemaKasShift = z
  .object({
    jenis: z.enum(JENIS_KAS_MANUAL, 'Jenis kas tidak valid.'),
    nominal: skemaRupiah.refine((v) => v > 0, 'Nominal harus lebih dari 0.'),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
  })
  .superRefine((d, ctx) => {
    if (d.jenis !== 'SETOR_OWNER' && d.jenis !== 'TARIK_OWNER' && !d.keterangan) {
      ctx.addIssue({
        code: 'custom',
        path: ['keterangan'],
        message:
          d.jenis === 'KASBON'
            ? 'Tulis siapa yang kasbon dan untuk apa.'
            : 'Keterangan wajib diisi.',
      });
    }
  });
export type InputKasShift = z.input<typeof skemaKasShift>;
export type DataKasShift = z.output<typeof skemaKasShift>;

/** K4: tutup shift = input uang fisik (blind count). Selisih ≠ 0 wajib keterangan (dicek server). */
export const skemaTutupShift = z.object({
  /** Satu langkah (kompatibel): hitungan dikirim bersama penutupan. Alur layar memakai /hitung lalu /tutup. */
  uangFisik: skemaRupiah.optional(),
  rincian: skemaRincianPecahan.optional(),
  keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
  /** K-121: uang yang ditinggal di laci untuk shift berikutnya (sisanya disetor). */
  uangDitinggal: skemaRupiah.optional(),
});
export type DataTutupShift = z.output<typeof skemaTutupShift>;

export const skemaCariShift = skemaHalaman.extend({
  status: z.enum(STATUS_SHIFT).optional(),
  /** Hanya shift BUKA dari hari sebelumnya atau yang sudah lewat jam tutupnya (K-109). */
  perluDitutup: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  idKasir: z.coerce.number().int().positive().optional(),
  dari: skemaTanggal('Tanggal awal').optional(),
  sampai: skemaTanggal('Tanggal akhir').optional(),
  /** Hanya shift dengan selisih clerical ≠ 0. */
  adaSelisih: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariShift = z.input<typeof skemaCariShift>;

export type BarisKasShift = {
  id: number;
  waktu: string;
  jenis: JenisKasShift;
  arah: ArahKas;
  nominal: number;
  keterangan: string | null;
  namaPengguna: string;
  /** Nomor dokumen sumber (retur/void/pembayaran pemasok) bila otomatis. */
  nomorDokumen: string | null;
};

export type HasilClerical = {
  nomor: string;
  tanggal: string;
  /** Modal efektif (modal awal + koreksi modal). */
  modalAwal: number;
  koreksiModal: number;
  uangDitinggal: number;
  toleransi: number;
  jumlahHitung: number;
  penjelasanAtasan: string | null;
  dijelaskanOleh: string | null;
  dijelaskanPada: string | null;
  tunaiPenjualan: number;
  kasMasukLain: number;
  kasKeluar: number;
  saldoSistem: number;
  uangFisik: number;
  selisih: number;
  keterangan: string | null;
  namaPemeriksa: string;
};

/** Ringkasan kas shift yang dihitung server (K5). */
export type RingkasanKasShift = {
  /** Modal efektif (modal awal + koreksi modal). */
  modalAwal: number;
  koreksiModal: number;
  tunaiPenjualan: number;
  kasMasukLain: number;
  kasKeluar: number;
  saldoSistem: number;
  jumlahTransaksi: number;
};

export type BarisShift = {
  id: number;
  nomor: string;
  idKasir: number;
  namaKasir: string;
  tanggalOperasional: string;
  waktuBuka: string;
  waktuTutup: string | null;
  modalAwal: number;
  status: StatusShift;
  /** Hanya untuk shift TUTUP. */
  clerical: HasilClerical | null;
  /** Hanya untuk shift BUKA (K-109); `null` bila sudah TUTUP. */
  waktu: WaktuShift | null;
};

export type DaftarShift = { data: BarisShift[]; meta: MetaHalaman };

/**
 * Detail shift. `ringkasan` hanya dikirim bila shift TUTUP atau pembaca memegang `kas.shift.lihat_semua`
 * (blind count, K4); kasir melihat daftar kas manualnya sendiri.
 */
export type DetailShift = BarisShift & {
  kas: BarisKasShift[];
  ringkasan: RingkasanKasShift | null;
  /** K-121: semua hitungan uang laci (buka, susulan, tutup, tutup ulang). */
  hitungan: BarisHitungKas[];
  caraBuka: CaraBukaShift;
  /** Tinjauan shift: untuk shift TUTUP, atau pembaca `kas.shift.lihat_semua`. */
  tinjauan: TinjauanShift | null;
  /** Bantuan selisih untuk shift TUTUP yang selisihnya di luar toleransi. */
  bantuan: BantuanSelisih | null;
};

// --- Tutup shift dua langkah, tinjauan, bantuan selisih (K-121) ---

/** Satu kejadian uang tunai di laci selama shift, urut waktu, dengan saldo laci menurut sistem sesudahnya. */
export type BarisLinimasaTunai = {
  waktu: string;
  jenis: 'MODAL' | 'BAYAR' | 'KAS';
  /** Mis. "Penjualan STR-261018-004", "Kasbon: Budi", "Koreksi modal". */
  label: string;
  nomor: string | null;
  masuk: number;
  keluar: number;
  /** Uang diterima dan kembalian untuk pembayaran tunai (informasi). */
  uangDiterima: number | null;
  kembalian: number | null;
  saldo: number;
};

/** Ringkasan kejadian satu shift ("tinjauan shift"). */
export type TinjauanShift = {
  jumlahTransaksi: number;
  perJenis: { jenis: JenisPenjualan; jumlah: number; total: number }[];
  perMetode: { metode: MetodePembayaran; jumlah: number; total: number }[];
  totalKembalian: number;
  void: { jumlah: number; total: number };
  retur: { jumlah: number; total: number };
  linimasa: BarisLinimasaTunai[];
};

export type PetunjukSelisih = {
  /** Mis. "Sama dengan kembalian STR-261018-004". */
  judul: string;
  /** Apa yang perlu diperiksa. */
  rincian: string;
  nomor: string | null;
};

/** Saran pencarian sebab selisih: dicocokkan dengan kejadian di shift; bukan tuduhan, tidak mengubah data. */
export type BantuanSelisih = {
  selisih: number;
  dalamToleransi: boolean;
  petunjuk: PetunjukSelisih[];
  periksa: string[];
};

export type RekonsiliasiShift = RingkasanKasShift & {
  uangFisik: number;
  selisih: number;
  toleransi: number;
  dalamToleransi: boolean;
};

/** Jawaban setelah hitungan tutup dikirim (shift berstatus DIHITUNG). */
export type HasilHitungTutup = {
  idShift: number;
  nomorShift: string;
  rekonsiliasi: RekonsiliasiShift;
  hitungan: BarisHitungKas[];
  bolehHitungUlang: boolean;
  perluKeterangan: boolean;
  /** Usulan uang ditinggal di laci (= modal awal shift ini). */
  usulanDitinggal: number;
  /** Hitung susulan (cara HITUNG_NANTI) tidak pernah dikirim. */
  hitungBukaTidakDilakukan: boolean;
  tinjauan: TinjauanShift;
  bantuan: BantuanSelisih;
};
