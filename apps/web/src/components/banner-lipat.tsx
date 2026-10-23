import { ChevronUp } from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/** Tempat lencana banner yang diciutkan, dipasang di topbar. */
export const ID_SLOT_LENCANA = 'slot-lencana-banner';

type Warna = 'merah' | 'kuning' | 'biru';

const KELAS: Record<Warna, { banner: string; lencana: string; titik: string }> = {
  merah: {
    banner: 'border-red-300 bg-red-50 text-red-900',
    lencana: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
    titik: 'bg-red-500',
  },
  kuning: {
    banner: 'border-amber-300 bg-amber-50 text-amber-900',
    lencana: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
    titik: 'bg-amber-500',
  },
  biru: {
    banner: 'border-blue-200 bg-blue-50 text-blue-900',
    lencana: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100',
    titik: 'bg-blue-500',
  },
};

/** Cadangan di memori bila sessionStorage diblokir peramban. */
const ciutMemori = new Set<string>();

function bacaCiut(kunci: string): boolean {
  try {
    return sessionStorage.getItem(`ciut:${kunci}`) === '1' || ciutMemori.has(kunci);
  } catch {
    return ciutMemori.has(kunci);
  }
}

function tulisCiut(kunci: string, ciut: boolean) {
  // Preferensi tampilan saja (CLAUDE.md: bukan data bisnis); hilang saat tab ditutup.
  if (ciut) ciutMemori.add(kunci);
  else ciutMemori.delete(kunci);
  try {
    if (ciut) sessionStorage.setItem(`ciut:${kunci}`, '1');
    else sessionStorage.removeItem(`ciut:${kunci}`);
  } catch {
    // Penyimpanan diblokir: memori di atas sudah cukup selama halaman terbuka.
  }
}

const tanpaLangganan = () => () => undefined;

/**
 * Banner peringatan yang bisa diciutkan menjadi lencana berdenyut di topbar (U9, K-130). `kunci` menentukan
 * ingatan "diciutkan"; bila isinya berubah tingkat (kunci baru), banner tampil penuh lagi.
 */
export function BannerLipat({
  kunci,
  warna,
  ringkas,
  role = 'alert',
  testId,
  children,
}: {
  kunci: string;
  warna: Warna;
  /** Teks pendek di lencana, mis. "Shift lewat jam tutup". */
  ringkas: string;
  role?: 'alert' | 'status';
  testId?: string;
  children: ReactNode;
}) {
  const [, setVersi] = useState(0);
  const ciut = bacaCiut(kunci);
  // Slot di topbar baru ada setelah komit pertama; useSyncExternalStore memeriksa ulang setelah komit.
  const slot = useSyncExternalStore(tanpaLangganan, () => document.getElementById(ID_SLOT_LENCANA));
  const k = KELAS[warna];

  function ubah(v: boolean) {
    tulisCiut(kunci, v);
    setVersi((n) => n + 1);
  }

  if (ciut) {
    const lencana = (
      <button
        type="button"
        onClick={() => ubah(false)}
        title="Tampilkan lagi peringatannya"
        data-testid={testId ? `${testId}-lencana` : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm',
          k.lencana,
        )}
      >
        <span className="relative flex size-2">
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              k.titik,
            )}
          />
          <span className={cn('relative inline-flex size-2 rounded-full', k.titik)} />
        </span>
        {ringkas}
      </button>
    );
    return slot ? createPortal(lencana, slot) : null;
  }

  return (
    <div
      role={role}
      data-testid={testId}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-2 text-sm print:hidden',
        k.banner,
      )}
    >
      {children}
      <button
        type="button"
        onClick={() => ubah(true)}
        title="Ciutkan menjadi lencana di atas"
        aria-label="Ciutkan peringatan"
        className="shrink-0 rounded-md border border-current px-1.5 py-0.5 text-xs font-semibold opacity-80 hover:bg-white/60 hover:opacity-100"
      >
        <ChevronUp className="inline size-3.5" /> Ciutkan
      </button>
    </div>
  );
}
