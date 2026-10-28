import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ambilData, api, pesanGalat } from '@/api/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';

function IsiInfo({ nomor, onTutup }: { nomor: string; onTutup: () => void }) {
  const info = useQuery({
    queryKey: ['info-cepat', nomor],
    queryFn: async () => ambilData(await api['info-cepat'].$get({ query: { nomor } })),
    staleTime: 30_000,
  });
  const d = info.data;
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md" data-testid="info-cepat">
        <DialogHeader>
          <DialogTitle className="font-mono">{nomor}</DialogTitle>
          <DialogDescription>
            {d
              ? `${d.jenis} · ${d.judul} · ${d.status}${d.waktu ? ` · ${formatWaktu(d.waktu)}` : ''}`
              : info.isError
                ? pesanGalat(info.error)
                : 'Memuat…'}
          </DialogDescription>
        </DialogHeader>
        {d && (
          <>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
              {d.ringkas.map((r) => (
                <div key={r.label} className="contents">
                  <dt className="text-slate-500">{r.label}</dt>
                  <dd className="font-medium">{r.nilai}</dd>
                </div>
              ))}
            </dl>
            {d.barang.length > 0 && (
              <ul className="divide-y rounded-md border text-sm">
                {d.barang.map((b, i) => (
                  <li key={`${b.nama}-${i}`} className="flex justify-between gap-3 px-2 py-1">
                    <span className="truncate">{b.nama}</span>
                    <span className="shrink-0 tabular-nums">{b.qty}</span>
                  </li>
                ))}
              </ul>
            )}
            {d.tautan && (
              <Link
                to={d.tautan}
                className="text-sm text-blue-700 hover:underline"
                onClick={onTutup}
              >
                Buka halaman lengkap
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * K-181: nomor dokumen dengan tombol info cepat (pop-up ringkas: pihak, status, total, barang). Klik nomor tetap
 * menjalankan tautan/aksi aslinya (`children`); tombol (i) di sebelahnya membuka info.
 */
export function KodeInfo({
  nomor,
  children,
  className,
}: {
  nomor: string;
  children?: ReactNode;
  className?: string;
}) {
  const [buka, setBuka] = useState(false);
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {children ?? <span className="font-mono">{nomor}</span>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setBuka(true);
        }}
        aria-label={`Info cepat ${nomor}`}
        title="Info cepat"
        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
      >
        <Info className="size-3.5" />
      </button>
      {buka && <IsiInfo nomor={nomor} onTutup={() => setBuka(false)} />}
    </span>
  );
}
