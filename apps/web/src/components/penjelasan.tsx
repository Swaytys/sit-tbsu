import { CircleHelp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Tombol "?" yang membuka penjelasan cara kerja sebuah halaman atau dialog: istilah dan aturan yang tampil
 * di layar itu, dengan bahasa pengguna (K-098; bentuk tombol K-099). Diletakkan di pojok kanan judul halaman
 * agar tidak memakan tempat. Rencana v2.0.0: setiap halaman punya tombol ini (docs/08 F3).
 */
export function Penjelasan({
  judul,
  children,
  className,
}: {
  /** Judul dialog sekaligus keterangan tombol, mis. "Cara kerja harga jual". */
  judul: string;
  children: ReactNode;
  className?: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('shrink-0 rounded-full', className)}
        aria-label={judul}
        title={judul}
        onClick={() => setTerbuka(true)}
      >
        <CircleHelp className="text-blue-600" />
      </Button>
      <Dialog open={terbuka} onOpenChange={setTerbuka}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="size-5 text-blue-600" /> {judul}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Penjelasan istilah dan aturan di layar ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
          <DialogFooter>
            <Button onClick={() => setTerbuka(false)}>Mengerti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Daftar butir di dalam `Penjelasan`. */
export function ButirPenjelasan({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
