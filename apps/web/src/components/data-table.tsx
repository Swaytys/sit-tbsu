import type { MetaHalaman } from '@sit/shared';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type KolomTabel<T> = {
  kunci: string;
  judul: ReactNode;
  sel: (baris: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  kolom: KolomTabel<T>[];
  data: T[] | undefined;
  kunciBaris: (baris: T) => string | number;
  /** Paginasi server (docs/02 §4). Tanpa meta = tanpa paginasi. */
  meta?: MetaHalaman | undefined;
  onHalaman?: (halaman: number) => void;
  memuat: boolean;
  galat?: unknown;
  onUlang?: () => void;
  kosong: string;
};

/** Tabel padat seperti mockup: judul abu, baris bergaris, paginasi di bawah. */
export function DataTable<T>({
  kolom,
  data,
  kunciBaris,
  meta,
  onHalaman,
  memuat,
  galat,
  onUlang,
  kosong,
}: Props<T>) {
  if (memuat && !data) {
    return (
      <div className="space-y-2 p-4" aria-label="Memuat data">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600">{pesanGalat(galat)}</p>
        {onUlang && (
          <Button variant="outline" size="sm" onClick={onUlang}>
            <RefreshCw /> Coba lagi
          </Button>
        )}
      </div>
    );
  }

  const baris = data ?? [];
  const awal = meta && meta.total > 0 ? (meta.halaman - 1) * meta.perHalaman + 1 : 0;
  const akhir = meta ? Math.min(meta.halaman * meta.perHalaman, meta.total) : baris.length;
  const halamanTerakhir = meta ? Math.max(1, Math.ceil(meta.total / meta.perHalaman)) : 1;

  return (
    <div className={cn(memuat && 'opacity-60 transition-opacity')}>
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            {kolom.map((k) => (
              <TableHead
                key={k.kunci}
                className={cn(
                  'px-4 text-xs font-semibold tracking-wide text-slate-500 uppercase',
                  k.className,
                )}
              >
                {k.judul}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {baris.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={kolom.length}
                className="py-12 text-center text-sm text-slate-400"
              >
                {kosong}
              </TableCell>
            </TableRow>
          ) : (
            baris.map((b) => (
              <TableRow key={kunciBaris(b)}>
                {kolom.map((k) => (
                  <TableCell key={k.kunci} className={cn('px-4', k.className)}>
                    {k.sel(b)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {meta && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-slate-500">
          <span>
            {meta.total === 0
              ? 'Tidak ada data'
              : `Menampilkan ${awal}–${akhir} dari ${meta.total}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Halaman sebelumnya"
              disabled={meta.halaman <= 1 || memuat}
              onClick={() => onHalaman?.(meta.halaman - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-2">
              Halaman {meta.halaman} dari {halamanTerakhir}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Halaman berikutnya"
              disabled={meta.halaman >= halamanTerakhir || memuat}
              onClick={() => onHalaman?.(meta.halaman + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
