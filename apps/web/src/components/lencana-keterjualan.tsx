import type { Keterjualan, LabelKeterjualan } from '@sit/shared';
import { formatDesimal, formatTanggal } from '@/lib/format';
import { cn } from '@/lib/utils';

/** K-123: label keterjualan (penjualan 30 hari terakhir, dihitung server). */
const GAYA: Record<LabelKeterjualan, { teks: string; kelas: string; arti: string }> = {
  LARIS: {
    teks: 'Laris',
    kelas: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    arti: 'Termasuk 20% barang dengan nilai penjualan tertinggi 30 hari terakhir',
  },
  LAMBAT: {
    teks: 'Lambat',
    kelas: 'border-amber-300 bg-amber-50 text-amber-800',
    arti: 'Terjual sedikit 30 hari terakhir (di bawah separuh barang yang terjual)',
  },
  TIDAK_LAKU: {
    teks: 'Tidak laku',
    kelas: 'border-red-300 bg-red-50 text-red-700',
    arti: 'Tidak terjual 30 hari terakhir',
  },
  BARU: {
    teks: 'Baru',
    kelas: 'border-blue-300 bg-blue-50 text-blue-700',
    arti: 'Barang ditambahkan kurang dari 30 hari lalu',
  },
};

export function LencanaKeterjualan({
  k,
  className,
}: {
  k: Keterjualan | undefined;
  className?: string;
}) {
  if (!k?.label) return null;
  const g = GAYA[k.label];
  const rinci =
    `${g.arti}. Terjual 30 hari: ${formatDesimal(k.terjual30)}` +
    (k.terakhirTerjual
      ? `; terakhir ${formatTanggal(k.terakhirTerjual)}`
      : '; belum pernah terjual');
  return (
    <span
      title={rinci}
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1 text-[11px] leading-4 font-semibold',
        g.kelas,
        className,
      )}
    >
      {g.teks}
    </span>
  );
}
