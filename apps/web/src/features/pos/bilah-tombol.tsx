import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Satu pintasan. `aksi` (K-228): pintasan yang bisa dijalankan dari mana saja ditampilkan sebagai tombol yang
 * bisa diklik/disentuh, karena HP/tablet tidak punya tombol F1–F12.
 */
export type Tombol = { kunci: string; label: string; aksi?: () => void };

const KUNCI_SIMPAN = 'bilah-tombol-ciut';

/** Belum pernah dipilih: layar pendek (< 760 px, mis. laptop dengan zoom) mulai tertutup agar tombol utama muat. */
function bacaCiut(): boolean {
  try {
    const v = localStorage.getItem(KUNCI_SIMPAN);
    if (v !== null) return v === '1';
  } catch {
    // Penyimpanan diblokir: pakai aturan tinggi layar.
  }
  // K-217: di HP/tablet (layar sempit atau layar sentuh tanpa keyboard) daftar tombol keyboard mulai tertutup.
  return (
    window.innerHeight < 760 ||
    window.matchMedia('(max-width: 1023px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Daftar tombol keyboard yang berlaku saat ini di halaman kerja cepat (K-073). Bisa diciutkan menjadi satu
 * tombol kecil (K-129) lewat klik atau `Ctrl+/`; pilihan diingat sebagai preferensi tampilan.
 */
export function BilahTombol({ daftar }: { daftar: Tombol[] }) {
  const [ciut, setCiut] = useState(bacaCiut);

  function ubah(v: boolean) {
    setCiut(v);
    try {
      localStorage.setItem(KUNCI_SIMPAN, v ? '1' : '0');
    } catch {
      // Penyimpanan diblokir: pilihan berlaku selama halaman terbuka.
    }
  }

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setCiut((v) => {
          try {
            localStorage.setItem(KUNCI_SIMPAN, v ? '0' : '1');
          } catch {
            // lihat ubah()
          }
          return !v;
        });
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  }, []);

  if (ciut) {
    return (
      <div className="flex shrink-0 justify-end">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => ubah(false)}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
          title="Tampilkan daftar tombol keyboard"
        >
          <Keyboard className="size-3.5" /> Pintasan
          <kbd className="rounded bg-slate-700 px-1 font-mono text-[10px] text-white">Ctrl+/</kbd>
          <ChevronUp className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-start gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
      aria-label="Tombol keyboard"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {daftar.map((t) =>
          t.aksi ? (
            <button
              key={t.kunci + t.label}
              type="button"
              tabIndex={-1}
              // Fokus tetap di kotak isian yang sedang dipakai (sama seperti menekan tombolnya).
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.aksi}
              title={`${t.label} (${t.kunci})`}
              aria-label={`${t.label} (${t.kunci})`}
              className="-mx-1 rounded px-1 py-0.5 whitespace-nowrap hover:bg-slate-700 hover:text-white"
            >
              <kbd className="mr-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono font-semibold text-white">
                {t.kunci}
              </kbd>
              {t.label}
            </button>
          ) : (
            <span key={t.kunci + t.label} className="whitespace-nowrap">
              <kbd className="mr-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono font-semibold text-white">
                {t.kunci}
              </kbd>
              {t.label}
            </span>
          ),
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ubah(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white"
        title="Sembunyikan daftar tombol (Ctrl+/)"
        aria-label="Sembunyikan daftar tombol keyboard"
      >
        <ChevronDown className="size-3.5" /> Ciutkan
        <kbd className="rounded bg-slate-700 px-1 font-mono text-[10px] text-white">Ctrl+/</kbd>
      </button>
    </div>
  );
}
