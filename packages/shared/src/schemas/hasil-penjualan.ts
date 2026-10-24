import { z } from 'zod';
import type { JenisPenjualan, MetodePembayaran } from '../enums';
import { jumlahHari, tanggalSah } from '../tanggal';

/*
 * K-126: halaman Hasil Penjualan (menu Transaksi). Semua angka dihitung server dengan definisi yang sama dengan
 * laporan (docs/05 §14): omzet = total neto − void sebagian untuk transaksi bukan VOID, menurut tanggal
 * operasional; retur = retur DISETUJUI selain tukar barang. Laba hanya untuk pemegang `laporan.laba`.
 */

export const RENTANG_HASIL_PENJUALAN_MAKS_HARI = 366;

const tanggal = (label: string) =>
  z.string(`${label} wajib diisi.`).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid.`);

export const skemaHasilPenjualan = z
  .object({ dari: tanggal('Tanggal awal'), sampai: tanggal('Tanggal akhir') })
  .superRefine((d, ctx) => {
    if (!tanggalSah(d.dari) || !tanggalSah(d.sampai)) {
      ctx.addIssue({ code: 'custom', path: ['dari'], message: 'Tanggal tidak valid.' });
    } else if (d.dari > d.sampai) {
      ctx.addIssue({
        code: 'custom',
        path: ['sampai'],
        message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
      });
    } else if (jumlahHari(d.dari, d.sampai) > RENTANG_HASIL_PENJUALAN_MAKS_HARI) {
      ctx.addIssue({
        code: 'custom',
        path: ['sampai'],
        message: `Rentang paling panjang ${RENTANG_HASIL_PENJUALAN_MAKS_HARI} hari.`,
      });
    }
  });
export type ParamHasilPenjualan = z.input<typeof skemaHasilPenjualan>;

export type RingkasanHasilPenjualan = {
  omzet: number;
  jumlahTransaksi: number;
  /** Omzet ÷ jumlah transaksi, dibulatkan ke rupiah; 0 bila tidak ada transaksi. */
  rataTransaksi: number;
  retur: number;
  penjualanBersih: number;
  diskon: number;
  ongkir: number;
  voidPenuh: { jumlah: number; nilai: number };
  voidSebagian: number;
  /** Hanya untuk `laporan.laba`. */
  labaKotor?: number;
  marginPersen?: number | null;
};

export type BarisNilai = { kunci: string; label: string; jumlah: number; nilai: number };

export type KelasAbc = 'A' | 'B' | 'C';

export type BarisBarangHasil = {
  peringkat: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  qty: string;
  nilai: number;
  kontribusi: number | null;
  kelas: KelasAbc;
};

export type HasilPenjualanHalaman = {
  periode: { dari: string; sampai: string };
  /** Periode sebanding sebelumnya (jumlah hari sama, tepat sebelum `dari`). */
  periodeLalu: { dari: string; sampai: string };
  ringkasan: RingkasanHasilPenjualan;
  ringkasanLalu: RingkasanHasilPenjualan;
  /** Omzet dan jumlah transaksi per tanggal operasional (semua tanggal dalam periode). */
  harian: { tanggal: string; jumlah: number; omzet: number }[];
  perJenis: Record<JenisPenjualan, { jumlah: number; omzet: number }>;
  /** Barang terlaris (paling banyak 20) dengan kelas ABC (A ≤ 80 % kumulatif, B ≤ 95 %, C sisanya). */
  barang: BarisBarangHasil[];
  abc: Record<KelasAbc, { jumlahBarang: number; nilai: number }>;
  jumlahBarangTerjual: number;
  perKategori: BarisNilai[];
  perPelanggan: BarisNilai[];
  perKasir: BarisNilai[];
  /** Jam 0–23 waktu toko. */
  perJam: BarisNilai[];
  /** 1 = Senin … 7 = Minggu. */
  perHari: BarisNilai[];
  /** Uang masuk per metode menurut tanggal pembayaran (termasuk pelunasan piutang). */
  perMetode: (BarisNilai & { kunci: MetodePembayaran })[];
  promo: { diskonPromo: number; transaksiBerpromo: number; teratas: BarisNilai[] };
  returDokumen: number;
};
