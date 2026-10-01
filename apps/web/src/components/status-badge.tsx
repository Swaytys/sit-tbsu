import type { StatusAktif, StatusPembayaran, StatusStok } from '@sit/shared';
import { Badge } from '@/components/ui/badge';
import { LABEL_STATUS_AKTIF, LABEL_STATUS_PEMBAYARAN, LABEL_STATUS_STOK } from '@/lib/label';
import { cn } from '@/lib/utils';

/** Badge status aktif/nonaktif data master (hijau / abu). */
export function BadgeStatusAktif({ status }: { status: StatusAktif }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === 'AKTIF'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-slate-200 bg-slate-100 text-slate-500',
      )}
    >
      {LABEL_STATUS_AKTIF[status]}
    </Badge>
  );
}

const WARNA_STATUS_STOK: Record<StatusStok, string> = {
  HABIS: 'border-red-200 bg-red-50 text-red-700',
  KRITIS: 'border-orange-200 bg-orange-50 text-orange-700',
  PERLU_RESTOCK: 'border-amber-200 bg-amber-50 text-amber-700',
  AMAN: 'border-green-200 bg-green-50 text-green-700',
};

/** Badge status stok ST1 (dihitung API). */
export function BadgeStatusStok({ status }: { status: StatusStok }) {
  return (
    <Badge variant="outline" className={WARNA_STATUS_STOK[status]}>
      {LABEL_STATUS_STOK[status]}
    </Badge>
  );
}

const WARNA_STATUS_BAYAR: Record<StatusPembayaran, string> = {
  BELUM_BAYAR: 'border-red-200 bg-red-50 text-red-700',
  DP: 'border-amber-200 bg-amber-50 text-amber-700',
  LUNAS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

/** Badge status pembayaran penjualan (P9). */
export function BadgeStatusBayar({ status }: { status: StatusPembayaran }) {
  return (
    <Badge variant="outline" className={WARNA_STATUS_BAYAR[status]}>
      {LABEL_STATUS_PEMBAYARAN[status]}
    </Badge>
  );
}
