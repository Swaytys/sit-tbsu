import { AppError } from '../../../lib/errors';
import { logger } from '../../../lib/logger';
import * as repo from './repo';

export type StatusKesehatan = { status: 'ok'; db: 'ok' };

/** Server sehat bila database bisa dihubungi. */
export async function cekKesehatan(): Promise<StatusKesehatan> {
  try {
    await repo.ping();
  } catch (err) {
    logger.error({ err }, 'Health check: database tidak dapat dihubungi');
    throw new AppError('INTERNAL', 'Database tidak dapat dihubungi.', 503);
  }
  return { status: 'ok', db: 'ok' };
}
