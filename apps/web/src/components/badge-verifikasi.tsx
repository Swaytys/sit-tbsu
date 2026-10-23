import { LABEL_STATUS_VERIFIKASI, type StatusVerifikasi } from '@sit/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const WARNA: Record<StatusVerifikasi, string> = {
  BELUM_DICEK: 'border-amber-300 bg-amber-50 text-amber-800',
  SUDAH_MASUK: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TIDAK_MASUK: 'border-red-300 bg-red-50 text-red-700',
};

const ARTI: Record<StatusVerifikasi, string> = {
  BELUM_DICEK:
    'Kasir sudah mencatat pembayaran ini, tetapi Admin/Owner belum mencocokkannya dengan mutasi rekening.',
  SUDAH_MASUK: 'Admin/Owner sudah memastikan uangnya masuk ke rekening penerimaan toko.',
  TIDAK_MASUK:
    'Admin/Owner tidak menemukan uangnya di rekening penerimaan toko. Perlu ditindaklanjuti (tagih pembeli, atau koreksi penjualan).',
};

/** Hasil pengecekan uang masuk sebuah pembayaran non-tunai (K-111). */
export function BadgeVerifikasi({
  status,
  catatan,
}: {
  status: StatusVerifikasi;
  catatan?: string | null;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(WARNA[status])}
      title={catatan ? `${ARTI[status]} Catatan: ${catatan}` : ARTI[status]}
    >
      {LABEL_STATUS_VERIFIKASI[status]}
    </Badge>
  );
}
