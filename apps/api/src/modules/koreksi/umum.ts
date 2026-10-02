import { and, eq, inArray } from 'drizzle-orm';
import { formatRupiah, type DataSetujui, type StatusTransaksi } from '@sit/shared';
import type { Tx } from '../../db/client';
import { penjualan, suratJalan } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { sekarang } from '../../lib/waktu';
import { catatKas } from '../kas/shift/service';
import { hitungTagihan, statusPembayaran, type NilaiTagihan } from '../penjualan/pembayaran';
import { sinkronStatusPengiriman } from '../penjualan/surat-jalan/service';

/*
 * Bagian bersama void dan retur (docs/05 §8–§9): refund ke pembeli, pembaruan cache tagihan (P9), dan
 * pembatalan surat jalan yang belum berangkat (S7). Semua di dalam transaksi persetujuan.
 */

/**
 * Mencatat refund (T6/V5): TUNAI keluar dari laci shift BUKA milik penyetuju (kas_shift), TRANSFER cukup
 * referensi. Mengembalikan id shift (TUNAI) untuk disimpan di dokumen.
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
