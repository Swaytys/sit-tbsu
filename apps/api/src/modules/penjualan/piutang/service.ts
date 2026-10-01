import type { DaftarPiutang } from '@sit/shared';
import { db } from '../../../db/client';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { tambahHari, tanggalOperasional } from '../../../lib/waktu';
import * as repo from './repo';

/** Piutang pelanggan (docs/06 PT1–PT4): daftar per penjualan, terlambat, ringkasan per pelanggan. */
export async function daftarPiutang(
  p: repo.SaringPiutang & { halaman: number; perHalaman: number },
): Promise<DaftarPiutang> {
  const hariIni = tanggalOperasional();
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) }, hariIni);
  return {
    data: baris.map((b) => ({
      ...b,
      idPelanggan: b.idPelanggan ?? 0,
      tanggal: b.tanggal.toISOString(),
      sisaTagihan: b.sisaTagihan ?? 0,
      terlambat: b.hariTerlambat !== null && b.hariTerlambat > 0,
    })),
    meta: metaHalaman(total, p),
    ringkasan: await repo.ringkasan(db, hariIni),
  };
}

/** PT4: H-3 dan terlambat (notifikasi ST2). */
export async function piutangJatuhTempo() {
  const hariIni = tanggalOperasional();
  return repo.hitungJatuhTempo(db, hariIni, tambahHari(hariIni, 3));
}
