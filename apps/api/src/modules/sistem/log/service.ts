import type { AksiLog, BarisLog, MetaHalaman } from '@sit/shared';
import { db } from '../../../db/client';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
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
