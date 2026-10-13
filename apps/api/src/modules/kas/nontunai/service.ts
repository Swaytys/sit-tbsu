import {
  formatRupiah,
  LABEL_STATUS_VERIFIKASI,
  type BarisNonTunai,
  type DaftarNonTunai,
  type DataVerifikasiPembayaran,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * Pengecekan uang masuk non-tunai (K-111). Tiap pembayaran transfer/EDC/QRIS dicatat kasir dengan status
 * BELUM_DICEK. Pemegang `kas.nontunai.verifikasi` mencocokkannya dengan mutasi rekening, rekap settlement
 * EDC, atau riwayat QRIS, lalu menandai SUDAH_MASUK atau TIDAK_MASUK (wajib catatan).
 *
 * Pengecekan ini manual: sistem tidak tersambung ke bank. TIDAK_MASUK adalah TANDA untuk ditindaklanjuti;
 * ia tidak mengubah tagihan penjualan. Tindak lanjutnya: menagih pembeli lalu menandai SUDAH_MASUK, atau
 * mengoreksi penjualannya lewat void/retur.
 */

type Baris = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

function keRespons(b: Baris): BarisNonTunai {
  return {
    ...b,
    tanggal: b.tanggal.toISOString(),
    // Non-tunai selalu punya status (CHECK DB); nilai cadangan hanya untuk tipe.
    statusVerifikasi: b.statusVerifikasi ?? 'BELUM_DICEK',
    diverifikasiPada: b.diverifikasiPada?.toISOString() ?? null,
  };
}

export async function daftarNonTunai(
  p: repo.SaringNonTunai & { halaman: number; perHalaman: number },
): Promise<DaftarNonTunai> {
  const { baris, total, ringkasan } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p), ringkasan };
}

export async function verifikasiPembayaran(
  id: number,
  input: DataVerifikasiPembayaran,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisNonTunai> {
  await dalamTransaksi(async (tx) => {
    const p = await repo.kunci(tx, id);
    if (!p || p.metode === 'TUNAI') {
      throw new AppError('TIDAK_DITEMUKAN', 'Pembayaran non-tunai tidak ditemukan.', 404);
    }
    const catatan = input.catatan ?? null;
    if (p.statusVerifikasi === input.status && p.catatanVerifikasi === catatan) return;
    const kembali = input.status === 'BELUM_DICEK';
    await repo.simpanVerifikasi(tx, id, {
      statusVerifikasi: input.status,
      diverifikasiOleh: kembali ? null : pelaku.id,
      diverifikasiPada: kembali ? null : sekarang(),
      catatanVerifikasi: catatan,
    });
    await catatLog(tx, {
      aksi: 'PEMBAYARAN_VERIFIKASI',
      idPengguna: pelaku.id,
      entitas: 'pembayaran_penjualan',
      idEntitas: id,
      nomorDokumen: p.nomor,
      ringkasan:
        `Pengecekan uang masuk ${p.nomor} (${p.metode.toLowerCase()} ${formatRupiah(p.nominal)}` +
        `${p.rekening ? ` ke ${p.rekening}` : ''}): ${LABEL_STATUS_VERIFIKASI[input.status].toLowerCase()}` +
        (catatan ? `. ${catatan}` : ''),
      dataLama: { statusVerifikasi: p.statusVerifikasi, catatanVerifikasi: p.catatanVerifikasi },
      dataBaru: { statusVerifikasi: input.status, catatanVerifikasi: catatan },
      ip: asal.ip,
    });
  });
  const b = await repo.byId(db, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Pembayaran non-tunai tidak ditemukan.', 404);
  return keRespons(b);
}

/** Untuk notifikasi: pembayaran non-tunai yang belum dicek dan yang ditandai tidak masuk. */
export async function hitungNonTunai(): Promise<{ belumDicek: number; tidakMasuk: number }> {
  const [belumDicek, tidakMasuk] = await Promise.all([
    repo.jumlahPerStatus(db, 'BELUM_DICEK'),
    repo.jumlahPerStatus(db, 'TIDAK_MASUK'),
  ]);
  return { belumDicek, tidakMasuk };
}
