import type { DataMirip } from '@sit/shared';
import { GalatApi } from '@/api/client';

/** K-137: ambil daftar data mirip dari galat 409 API (pencegah data ganda); `null` bila bukan galat itu. */
export function miripDariGalat(err: unknown): DataMirip[] | null {
  if (!(err instanceof GalatApi)) return null;
  const d = err.detail as { mirip?: DataMirip[] } | undefined;
  return d?.mirip && d.mirip.length > 0 ? d.mirip : null;
}
