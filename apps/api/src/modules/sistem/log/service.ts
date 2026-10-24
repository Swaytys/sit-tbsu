import {
  BATAS_EKSPOR_LOG,
  type AksiLog,
  type BarisLog,
  type MetaHalaman,
  type ParamEksporLog,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, keBytes, workbookBaru } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { waktuTeks } from '../../laporan/umum';
import { catatLog } from '../log-aktivitas';
import * as repo from './repo';

export async function daftarLog(p: {
  cari?: string | undefined;
  aksi?: AksiLog | undefined;
  halaman: number;
  perHalaman: number;
}): Promise<{ data: BarisLog[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarLog(db, { ...p, ...batasHalaman(p) });
  return {
    data: baris.map((b) => ({ ...b, waktu: b.waktu.toISOString() })),
    meta: metaHalaman(total, p),
  };
}

/**
 * Ekspor log aktivitas ke Excel (K-113 butir ekspor log, Owner). Saringan sama dengan layar + rentang tanggal;
 * paling banyak BATAS_EKSPOR_LOG baris (terbaru dulu). Ekspor dicatat sebagai LAPORAN_EKSPOR.
 */
export async function eksporLog(
  p: ParamEksporLog,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ isi: Uint8Array<ArrayBuffer>; header: Record<string, string> }> {
  const { baris, total } = await repo.daftarLog(db, {
    ...p,
    limit: BATAS_EKSPOR_LOG,
    offset: 0,
  });
  if (total > BATAS_EKSPOR_LOG) {
    throw new AppError(
      'VALIDASI',
      `Log terlalu banyak (${total} baris; paling banyak ${BATAS_EKSPOR_LOG}). Persempit rentang tanggal.`,
      400,
    );
  }
  const wb = workbookBaru();
  const ws = wb.addWorksheet('Log Aktivitas', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Waktu (WIB)', key: 'waktu', width: 19 },
    { header: 'Pengguna', key: 'pengguna', width: 22 },
    { header: 'Aksi', key: 'aksi', width: 24 },
    { header: 'Entitas', key: 'entitas', width: 16 },
    { header: 'No. dokumen', key: 'nomor', width: 20 },
    { header: 'Ringkasan', key: 'ringkasan', width: 60 },
    { header: 'Alamat IP', key: 'ip', width: 16 },
    { header: 'Data lama', key: 'lama', width: 40 },
    { header: 'Data baru', key: 'baru', width: 40 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  for (const b of baris) {
    ws.addRow({
      waktu: waktuTeks(b.waktu),
      pengguna: b.namaPengguna ?? (b.usernamePercobaan ? `(${b.usernamePercobaan})` : '—'),
      aksi: b.aksi,
      entitas: b.entitas ?? '',
      nomor: b.nomorDokumen ?? '',
      ringkasan: b.ringkasan ?? '',
      ip: b.ip ?? '',
      lama: b.dataLama === null ? '' : JSON.stringify(b.dataLama),
      baru: b.dataBaru === null ? '' : JSON.stringify(b.dataBaru),
    });
  }
  ws.autoFilter = { from: 'A1', to: 'I1' };
  const isi = await keBytes(wb);
  await catatLog(db, {
    aksi: 'LAPORAN_EKSPOR',
    idPengguna: pelaku.id,
    entitas: 'log_aktivitas',
    ringkasan: `Ekspor Excel log aktivitas (${baris.length} baris)`,
    dataBaru: { format: 'XLSX', parameter: p },
    ip: asal.ip,
  });
  const nama = `log-aktivitas${p.dari ? `-${p.dari}` : ''}${p.sampai ? `-sd-${p.sampai}` : ''}.xlsx`;
  return { isi, header: headerUnduhan(nama) };
}
