import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Teks panjang (catatan, keterangan, alamat) di tempat sempit: tampil satu baris; bila terpotong muncul tombol
 * "lihat semua" untuk membuka seluruhnya di tempat dan "ringkas" untuk menutupnya lagi. Tombol hanya muncul bila
 * teksnya memang terpotong, jadi teks pendek tidak berubah tampilannya.
 */
export function TeksLipat({
  teks,
  className,
  baris = 1,
}: {
  teks: string;
  className?: string;
  /** Jumlah baris saat tertutup (1 atau 2). */
  baris?: 1 | 2;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [buka, setBuka] = useState(false);
  const [terpotong, setTerpotong] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || buka) return;
    const cek = () =>
      setTerpotong(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    cek();
    const ro = new ResizeObserver(cek);
    ro.observe(el);
    return () => ro.disconnect();
  }, [teks, buka]);

  return (
    <span className={cn('block min-w-0', className)}>
      <span
        ref={ref}
        className={cn(
          'block break-words whitespace-pre-wrap',
          !buka && (baris === 1 ? 'truncate whitespace-nowrap' : 'line-clamp-2'),
        )}
      >
        {teks}
      </span>
      {(terpotong || buka) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setBuka((b) => !b);
          }}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-700 hover:underline"
          aria-expanded={buka}
        >
          {buka ? (
            <>
              <ChevronUp className="size-3" /> ringkas
            </>
          ) : (
            <>
              <ChevronDown className="size-3" /> lihat semua
            </>
          )}
        </button>
      )}
    </span>
  );
}
