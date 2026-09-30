import { Save, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Kartu satu bagian pengaturan (seperti mockup: judul berikon, isi, tombol simpan di kanan bawah). */
export function KartuBagian({
  ikon: Ikon,
  judul,
  keterangan,
  children,
  bisaSimpan,
  menyimpan,
}: {
  ikon: LucideIcon;
  judul: string;
  keterangan: string;
  children: ReactNode;
  bisaSimpan: boolean;
  menyimpan: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b bg-slate-50 px-6 py-4">
        <Ikon className="size-4 text-blue-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{judul}</h2>
          <p className="text-xs text-slate-500">{keterangan}</p>
        </div>
      </div>
      <div className="space-y-4 p-6">{children}</div>
      <div className="flex justify-end border-t px-6 py-3">
        <Button type="submit" disabled={!bisaSimpan || menyimpan}>
          <Save /> {menyimpan ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </Card>
  );
}
