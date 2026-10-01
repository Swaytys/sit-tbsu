import { eq } from 'drizzle-orm';
import {
  formatRupiah,
  type DataPembayaran,
  type JenisPembayaran,
  type StatusPembayaran,
} from '@sit/shared';
import type { Tx } from '../../db/client';
import { pembayaranPenjualan, penjualan } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../lib/konteks';
import { sekarang, tanggalOperasional } from '../../lib/waktu';
import { shiftBuka } from '../kas/shift/service';
import { ambilTeks } from '../sistem/konfigurasi/service';
import { catatLog } from '../sistem/log-aktivitas';
import { terbitkanNomor } from '../sistem/penomoran';

/*
 * Pembayaran penjualan (docs/05 P8, P9, P12). Dipakai checkout dan pelunasan; selalu di dalam transaksi yang
 * sama dengan penulisan penjualan sehingga cache `total_dibayar` dan `status_pembayaran` selalu sinkron.
 */

export type NilaiTagihan = {
  totalNeto: number;
  totalVoid: number;
  totalRetur: number;
  totalDibayar: number;
  totalRefund: number;
};

/** P9: tagihan = neto − void − retur; dibayar bersih = dibayar − refund. */
export function hitungTagihan(p: NilaiTagihan) {
  const tagihan = p.totalNeto - p.totalVoid - p.totalRetur;
  const dibayarBersih = p.totalDibayar - p.totalRefund;
  return { tagihan, dibayarBersih, sisa: tagihan - dibayarBersih };
}

/** P9: status pembayaran dari angka cache. */
export function statusPembayaran(p: NilaiTagihan): StatusPembayaran {
  const { tagihan, dibayarBersih } = hitungTagihan(p);
  if (tagihan === 0 || dibayarBersih >= tagihan) return 'LUNAS';
  return dibayarBersih === 0 ? 'BELUM_BAYAR' : 'DP';
}

export type PenjualanTerkunci = NilaiTagihan & { id: number; nomor: string };

/**
 * Mencatat satu atau beberapa pembayaran (bayar campuran) atas penjualan yang sudah dikunci pemanggil, lalu
 * memperbarui cache. Mengembalikan nilai cache baru.
 */
export async function catatPembayaran(
  tx: Tx,
  pj: PenjualanTerkunci,
  daftar: DataPembayaran[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<NilaiTagihan & { statusPembayaran: StatusPembayaran }> {
  let nilai: NilaiTagihan = { ...pj };
  if (daftar.length === 0) return { ...nilai, statusPembayaran: statusPembayaran(nilai) };

  const shift = await shiftBuka(tx, pelaku.id);
  const wajibShift = (await ambilTeks('checkout_wajib_shift', 'true', tx)) === 'true';
  const tanggal = tanggalOperasional();
  for (const [i, p] of daftar.entries()) {
    const { sisa, dibayarBersih } = hitungTagihan(nilai);
    if (p.nominal > sisa) {
      throw new AppError(
        'LIMIT_TERLAMPAUI',
        `Pembayaran ${formatRupiah(p.nominal)} melebihi sisa tagihan ${formatRupiah(sisa)}.`,
        400,
        { kolom: { [`pembayaran.${i}.nominal`]: ['Melebihi sisa tagihan.'] } },
      );
    }
    // P8/P12: tunai selalu terikat shift BUKA milik pencatat (juga CHECK DB). Non-tunai tanpa shift hanya
    // untuk Admin/Owner bila checkout wajib shift (K-070).
    if (
      !shift &&
      (p.metode === 'TUNAI' || (wajibShift && !pelaku.izin.has('kas.shift.lihat_semua')))
    ) {
      throw new AppError(
        'KONFLIK',
        'Buka shift kasir terlebih dahulu sebelum menerima pembayaran.',
        409,
      );
    }
    const jenis: JenisPembayaran =
      dibayarBersih > 0 || i > 0 ? 'PELUNASAN' : p.nominal === sisa ? 'PENUH' : 'DP';
    const uangDiterima = p.metode === 'TUNAI' ? (p.uangDiterima ?? p.nominal) : null;
    const nomor = await terbitkanNomor(tx, 'BYR', tanggal);
    await tx.insert(pembayaranPenjualan).values({
      nomor,
      idPenjualan: pj.id,
      idPengguna: pelaku.id,
      idShift: shift?.id ?? null,
      tanggalOperasional: tanggal,
      jenis,
      metode: p.metode,
      nominal: p.nominal,
      uangDiterima,
      kembalian: uangDiterima === null ? 0 : uangDiterima - p.nominal,
      rekening: p.metode === 'TUNAI' ? null : (p.rekening ?? null),
      referensi: p.metode === 'TUNAI' ? null : (p.referensi ?? null),
      catatan: p.catatan ?? null,
    });
    await catatLog(tx, {
      aksi: 'PEMBAYARAN_CATAT',
      idPengguna: pelaku.id,
      entitas: 'penjualan',
      idEntitas: pj.id,
      nomorDokumen: pj.nomor,
      ringkasan: `${nomor}: ${jenis.toLowerCase()} ${p.metode.toLowerCase()} ${formatRupiah(p.nominal)} untuk ${pj.nomor}`,
      ip: asal.ip,
    });
    nilai = { ...nilai, totalDibayar: nilai.totalDibayar + p.nominal };
  }
  const status = statusPembayaran(nilai);
  await tx
    .update(penjualan)
    .set({ totalDibayar: nilai.totalDibayar, statusPembayaran: status, diubahPada: sekarang() })
    .where(eq(penjualan.id, pj.id));
  return { ...nilai, statusPembayaran: status };
}
