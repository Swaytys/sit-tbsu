import type { StatusAktif } from '@sit/shared';
import { Badge } from '@/components/ui/badge';
import { LABEL_STATUS_AKTIF } from '@/lib/label';
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
