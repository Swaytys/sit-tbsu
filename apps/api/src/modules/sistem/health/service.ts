import { VERSI_APLIKASI } from '@sit/shared';
import jurnal from '../../../db/migrations/meta/_journal.json' with { type: 'json' };
import { AppError } from '../../../lib/errors';
import { logger } from '../../../lib/logger';
import * as repo from './repo';

export type StatusKesehatan = {
  status: 'ok';
  db: 'ok';
  /** K-166: versi aplikasi dan migrasi (terpasang di database / dibawa aplikasi). */
  versi: string;
  migrasi: { terpasang: number | null; tersedia: number };
};

/** Server sehat bila database bisa dihubungi. */
export async function cekKesehatan(): Promise<StatusKesehatan> {
  try {
    await repo.ping();
  } catch (err) {
    logger.error({ err }, 'Health check: database tidak dapat dihubungi');
    throw new AppError('INTERNAL', 'Database tidak dapat dihubungi.', 503);
  }
  return {
    status: 'ok',
    db: 'ok',
    versi: VERSI_APLIKASI,
    migrasi: { terpasang: await repo.jumlahMigrasiTerpasang(), tersedia: jurnal.entries.length },
  };
}
