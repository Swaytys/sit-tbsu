import { ArrowLeft, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { usePengguna } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { bolehAkses } from '@/lib/menu';
import { ingatLangkahSetup, langkahSetupTerakhir } from './ingat-langkah';

/** K-212: halaman yang dibuka dari setup awal menampilkan jalan kembali ke langkah setup terakhir. */
export function BilahKembaliSetup() {
  const pengguna = usePengguna();
  const lokasi = useLocation();
  const [tutup, setTutup] = useState(false);
  const langkah = langkahSetupTerakhir();
  if (tutup || !langkah || !bolehAkses(pengguna, 'sistem.pengaturan.kelola')) return null;
  return (
    <div
      className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 print:hidden"
      data-testid="bilah-kembali-setup"
      key={lokasi.pathname}
    >
      <Wand2 className="size-4 shrink-0" />
      <span className="flex-1">
        Anda sedang mengerjakan <b>setup awal</b>. Selesai di halaman ini? Kembali ke langkah setup.
      </span>
      <Button asChild size="sm">
        <Link to={`/mulai?langkah=${langkah}`}>
          <ArrowLeft /> Kembali ke setup awal
        </Link>
      </Button>
      <button
        type="button"
        className="rounded p-1 text-blue-700 hover:bg-blue-100"
        aria-label="Tutup bilah setup (setup bisa dilanjutkan dari Dashboard)"
        title="Tutup (setup bisa dilanjutkan dari Dashboard)"
        onClick={() => {
          ingatLangkahSetup(null);
          setTutup(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
