import { and, eq, inArray } from 'drizzle-orm';
import {
  formatRupiah,
  type CaraPersetujuan,
  type DataSetujui,
  type StatusTransaksi,
} from '@sit/shared';
import type { Tx } from '../../db/client';
import { penjualan, suratJalan } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { sekarang } from '../../lib/waktu';
import { catatKas } from '../kas/shift/service';
import { hitungTagihan, statusPembayaran, type NilaiTagihan } from '../penjualan/pembayaran';
import { sinkronStatusPengiriman } from '../penjualan/surat-jalan/service';
import type { Atasan } from '../sistem/kode-persetujuan/service';

/*
 * Bagian bersama void dan retur (docs/05 §8–§9): refund ke pembeli, pembaruan cache tagihan (P9), dan
 * pembatalan surat jalan yang belum berangkat (S7). Semua di dalam transaksi persetujuan.
 */

/** Siapa yang menyetujui retur/void, dengan cara apa, dan laci siapa yang dipakai (docs/04 §6, K-099). */
export type Persetujuan = {
  /** Tercatat sebagai penyetuju dokumen dan pelaku mutasi stok. */
  idPenyetuju: number;
  /** Pengguna yang login di perangkat itu: refund tunai keluar dari laci shift-nya. */
  kasir: PenggunaAktif;
  cara: CaraPersetujuan;
  /** Keterangan cara persetujuan untuk ringkasan log. */
  catatanLog: string;
};

/**
 * Persetujuan langsung saat mengajukan (docs/04 §6): pengaju berwenang (K-017) atau nilai dokumen masih di
 * dalam batas bebas (K-099). `null` = dokumen menunggu persetujuan (akun atasan atau kode sekali pakai).
 */
export function persetujuanLangsung(p: {
  pengaju: PenggunaAktif;
  berwenang: boolean;
  /** Batas tanpa persetujuan (rupiah) bila nilai dokumen masih di dalamnya; selain itu `null`. */
  batasBebas: number | null;
}): Persetujuan | null {
  if (p.berwenang) {
    return {
      idPenyetuju: p.pengaju.id,
      kasir: p.pengaju,
      cara: 'SENDIRI',
      catatanLog: ' (diajukan & disetujui sendiri, K-017)',
    };
  }
  if (p.batasBebas !== null) {
    return {
      idPenyetuju: p.pengaju.id,
      kasir: p.pengaju,
      cara: 'BATAS_BEBAS',
      catatanLog: ` (tanpa atasan: di bawah batas ${formatRupiah(p.batasBebas)})`,
    };
  }
  return null;
}

/**
 * Atasan menyetujui di layar pengaju lewat kode sekali pakai miliknya (K-102): dokumen atas nama atasan,
 * uang dari laci pengaju.
 */
export function persetujuanDiTempat(atasan: Atasan, pengaju: PenggunaAktif): Persetujuan {
  return {
    idPenyetuju: atasan.id,
    kasir: pengaju,
    cara: 'DI_TEMPAT',
    catatanLog: ` (disetujui ${atasan.namaPengguna} di tempat dengan kode sekali pakai, sesi ${pengaju.username})`,
  };
}

/** Atasan menyetujui dari akunnya sendiri (tab Persetujuan). */
export function persetujuanAkunAtasan(penyetuju: PenggunaAktif): Persetujuan {
  return { idPenyetuju: penyetuju.id, kasir: penyetuju, cara: 'AKUN_ATASAN', catatanLog: '' };
}

/** K-102: kode persetujuan hanya bisa diminta pengaju atas pengajuannya sendiri yang masih menunggu. */
export function pastikanBolehMintaKode(
  dok: { nomor: string; status: string; idPengaju: number },
  pelaku: PenggunaAktif,
): void {
  if (dok.status !== 'MENUNGGU') {
    throw new AppError('STATUS_TIDAK_VALID', `${dok.nomor} sudah diputuskan.`, 409);
  }
  if (dok.idPengaju !== pelaku.id) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Kode persetujuan hanya bisa diminta oleh pengaju dokumen itu.',
      403,
    );
  }
}

/** K-099: pengajuan MENUNGGU hanya boleh ditarik pengajunya sendiri atau pemegang izin setujui. */
export function pastikanBolehBatal(
  dok: { nomor: string; status: string; idPengaju: number },
  pelaku: PenggunaAktif,
  berwenang: boolean,
): void {
  if (dok.status !== 'MENUNGGU') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `${dok.nomor} sudah diputuskan dan tidak bisa dibatalkan. Yang sudah disetujui tidak bisa dibalik.`,
      409,
    );
  }
  if (dok.idPengaju !== pelaku.id && !berwenang) {
    throw new AppError('TIDAK_BERIZIN', 'Hanya pengaju yang bisa membatalkan pengajuannya.', 403);
  }
}

/**
 * Mencatat refund (T6/V5): TUNAI keluar dari laci shift BUKA milik `pelaku` (pengguna yang login di perangkat
 * itu), TRANSFER cukup referensi. Mengembalikan id shift (TUNAI) untuk disimpan di dokumen.
 */
export async function catatRefund(
  tx: Tx,
  r: {
    nominal: number;
    persetujuan: DataSetujui;
    pelaku: PenggunaAktif;
    jenis: 'REFUND_RETUR' | 'REFUND_VOID';
    nomorDokumen: string;
    nomorPenjualan: string;
    idRetur?: number;
    idVoid?: number;
  },
): Promise<number | null> {
  if (r.nominal <= 0) return null;
  const metode = r.persetujuan.metodeRefund;
  if (!metode) {
    throw new AppError(
      'VALIDASI',
      `Ada uang yang harus dikembalikan ${formatRupiah(r.nominal)}: pilih metode refund (tunai/transfer).`,
      400,
      { kolom: { metodeRefund: ['Pilih metode refund.'] }, nominalRefund: r.nominal },
    );
  }
  if (metode === 'TRANSFER') {
    if (!r.persetujuan.rekeningRefund) {
      throw new AppError('VALIDASI', 'Isi rekening tujuan refund transfer.', 400, {
        kolom: { rekeningRefund: ['Rekening wajib diisi.'] },
      });
    }
    return null;
  }
  const { idShift } = await catatKas(tx, {
    jenis: r.jenis,
    nominal: r.nominal,
    pelaku: r.pelaku,
    keterangan: `${r.nomorDokumen}: refund ${r.nomorPenjualan}`,
    idRetur: r.idRetur,
    idVoid: r.idVoid,
  });
  return idShift;
}

/** Menulis cache tagihan penjualan dan menghitung ulang status pembayaran (P9). */
export async function simpanTagihan(
  tx: Tx,
  idPenjualan: number,
  nilai: NilaiTagihan,
  statusTransaksi?: StatusTransaksi,
): Promise<void> {
  await tx
    .update(penjualan)
    .set({
      totalVoid: nilai.totalVoid,
      totalRetur: nilai.totalRetur,
      totalRefund: nilai.totalRefund,
      statusPembayaran: statusPembayaran(nilai),
      ...(statusTransaksi ? { statusTransaksi } : {}),
      diubahPada: sekarang(),
    })
    .where(eq(penjualan.id, idPenjualan));
}

/** Uang yang harus dikembalikan bila yang sudah dibayar melebihi tagihan baru (V5/T6). */
export function kelebihanBayar(nilai: NilaiTagihan): number {
  const { tagihan, dibayarBersih } = hitungTagihan(nilai);
  return Math.max(0, dibayarBersih - tagihan);
}

/** S7: surat jalan yang belum berangkat ikut batal saat invoice di-void. */
export async function batalkanSuratJalanBelumBerangkat(
  tx: Tx,
  idPenjualan: number,
  alasan: string,
): Promise<string[]> {
  const batal = await tx
    .update(suratJalan)
    .set({ status: 'BATAL', alasanBatal: alasan, diubahPada: sekarang() })
    .where(
      and(
        eq(suratJalan.idPenjualan, idPenjualan),
        inArray(suratJalan.status, ['DIPROSES', 'DIMUAT']),
      ),
    )
    .returning({ nomor: suratJalan.nomor });
  if (batal.length > 0) await sinkronStatusPengiriman(tx, idPenjualan);
  return batal.map((b) => b.nomor);
}
