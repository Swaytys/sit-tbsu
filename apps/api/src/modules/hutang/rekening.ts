import { eq } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { pemasok } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';

const rapikan = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * K-225: transfer ke pemasok hanya ke rekening yang tercatat di Data Pemasok (diatur Owner). Rekening lain hanya boleh
 * dipakai Owner. Pemasok tanpa rekening tercatat: rekening ketikan diterima (tercatat di pembayaran).
 */
export async function pastikanRekeningPemasok(
  tx: Tx,
  idPemasok: number,
  rekening: string | null | undefined,
  pelaku: PenggunaAktif,
): Promise<void> {
  if (pelaku.izin.has('pembelian.setujui_semua')) return;
  const [p] = await tx
    .select({ rekening: pemasok.rekening })
    .from(pemasok)
    .where(eq(pemasok.id, idPemasok));
  if (!p?.rekening) return;
  if (rapikan(rekening ?? '') !== rapikan(p.rekening)) {
    throw new AppError(
      'TIDAK_BERIZIN',
      `Rekening tujuan berbeda dari Data Pemasok (${p.rekening}). Transfer ke rekening lain hanya bisa dilakukan Owner.`,
      403,
      { kolom: { rekening: ['Harus sama dengan rekening di Data Pemasok.'] } },
    );
  }
}
