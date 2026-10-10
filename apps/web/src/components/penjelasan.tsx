import { ChevronDown, Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const AWALAN_KUNCI = 'sit.penjelasan.';

function bacaTerbuka(kunci: string): boolean {
  try {
    return localStorage.getItem(AWALAN_KUNCI + kunci) !== 'tutup';
  } catch {
    return true;
  }
}

function simpanTerbuka(kunci: string, terbuka: boolean): void {
  try {
    localStorage.setItem(AWALAN_KUNCI + kunci, terbuka ? 'buka' : 'tutup');
  } catch {
    // Penyimpanan diblokir browser: pilihan lipat tidak diingat, tidak masalah.
  }
}

/**
 * Kotak "cara kerja" di halaman atau dialog: menjelaskan istilah dan aturan yang tampil di layar itu dengan
 * bahasa pengguna. Terbuka saat pertama dilihat dan bisa dilipat; pilihan lipat hanya preferensi tampilan
 * (localStorage, CLAUDE.md § Jangan), bukan data bisnis.
 */
export function Penjelasan({
  kunci,
  judul,
  children,
  className,
}: {
  /** Pengenal kotak untuk mengingat pilihan lipat, mis. `harga-jual`. */
  kunci: string;
  judul: string;
  children: ReactNode;
  className?: string;
}) {
  const [terbuka, setTerbuka] = useState(() => bacaTerbuka(kunci));

  function alih() {
    simpanTerbuka(kunci, !terbuka);
    setTerbuka(!terbuka);
  }

  return (
    <section
      className={cn('rounded-lg border border-blue-100 bg-blue-50/60 text-sm', className)}
      aria-label={judul}
    >
      <button
        type="button"
        onClick={alih}
        aria-expanded={terbuka}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-800"
      >
        <Info className="size-4 shrink-0 text-blue-600" />
        <span className="flex-1">{judul}</span>
        <span className="text-xs font-normal text-slate-500">
          {terbuka ? 'Sembunyikan' : 'Tampilkan'}
        </span>
        <ChevronDown
          className={cn('size-4 text-slate-400 transition-transform', terbuka && 'rotate-180')}
        />
      </button>
      {terbuka && (
        <div className="space-y-1.5 border-t border-blue-100 px-3 py-2.5 leading-relaxed text-slate-700">
          {children}
        </div>
      )}
    </section>
  );
}

/** Daftar butir di dalam `Penjelasan`. */
export function ButirPenjelasan({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}
