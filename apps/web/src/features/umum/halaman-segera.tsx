import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { NAMA_FASE, type ItemMenu } from '@/lib/menu';

/** Halaman menu yang belum dibangun: menu sudah tampil sesuai izin (docs/04 §4), isinya menyusul. */
export function HalamanSegera({ item }: { item: ItemMenu }) {
  const fase = item.fase;
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">{item.label}</h1>
      <Card className="flex flex-row items-center gap-4 p-6">
        <Construction className="size-8 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-slate-800">Halaman ini sedang disiapkan.</p>
          {fase !== undefined && (
            <p className="text-sm text-slate-500">
              Dibangun pada Fase {fase}
              {NAMA_FASE[fase] ? ` — ${NAMA_FASE[fase]}` : ''} (docs/07-roadmap.md).
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
