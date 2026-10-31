import { useEffect, useState } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { BilahKembaliSetup } from '@/features/setup-awal/bilah-kembali-setup';
import { BilahPemulihan } from '@/features/shift/bilah-pemulihan';
import { PenyediaTur } from '@/features/tur/penyedia-tur';
import { PencatatInteraksi } from './pencatat-interaksi';
import { PeringatanShift } from './peringatan-shift';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

// Preferensi tampilan boleh di localStorage (CLAUDE.md § Jangan); data bisnis tidak.
const KUNCI_SIDEBAR = 'sit.sidebarTerbuka';

function bacaPreferensiSidebar(): boolean {
  try {
    return localStorage.getItem(KUNCI_SIDEBAR) !== 'false';
  } catch {
    return true;
  }
}

function simpanPreferensiSidebar(terbuka: boolean): void {
  try {
    localStorage.setItem(KUNCI_SIDEBAR, String(terbuka));
  } catch {
    // Penyimpanan diblokir browser: preferensi tidak diingat, tidak masalah.
  }
}

function judulDariHandle(handle: unknown): string | undefined {
  if (typeof handle === 'object' && handle !== null && 'judul' in handle) {
    const { judul } = handle;
    if (typeof judul === 'string') return judul;
  }
  return undefined;
}

/** K-217: layar sempit (HP, tablet tegak): menu samping menjadi laci yang menutupi halaman. */
function useLayarSempit(): boolean {
  const kueri = '(max-width: 1023px)';
  const [sempit, setSempit] = useState(() => window.matchMedia(kueri).matches);
  useEffect(() => {
    const m = window.matchMedia(kueri);
    const ubah = () => setSempit(m.matches);
    m.addEventListener('change', ubah);
    return () => m.removeEventListener('change', ubah);
  }, []);
  return sempit;
}

export function Layout() {
  const [sidebarTerbuka, setSidebarTerbuka] = useState(bacaPreferensiSidebar);
  const sempit = useLayarSempit();
  const [laci, setLaci] = useState<string | null>(null);
  const lokasi = useLocation();
  // Laci menu tertutup sendiri setelah pindah halaman (dicatat per path, tanpa efek).
  const laciBuka = sempit && laci === lokasi.pathname;
  const matches = useMatches();
  const judul =
    matches
      .map((m) => judulDariHandle(m.handle))
      .filter((j) => j !== undefined)
      .at(-1) ?? 'BonsaiUrip';

  useEffect(() => {
    document.title = judul === 'BonsaiUrip' ? judul : `${judul} · BonsaiUrip`;
  }, [judul]);

  function toggleSidebar() {
    if (sempit) {
      setLaci(laciBuka ? null : lokasi.pathname);
      return;
    }
    const baru = !sidebarTerbuka;
    setSidebarTerbuka(baru);
    simpanPreferensiSidebar(baru);
  }

  return (
    <PenyediaTur>
      <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 print:block print:h-auto print:overflow-visible print:bg-white">
        {!sempit && <Sidebar terbuka={sidebarTerbuka} />}
        {laciBuka && (
          <div className="fixed inset-0 z-50 flex print:hidden" role="dialog" aria-label="Menu">
            <Sidebar terbuka />
            <button
              type="button"
              aria-label="Tutup menu"
              className="flex-1 bg-slate-900/50"
              onClick={() => setLaci(null)}
            />
          </div>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="print:hidden">
            <Topbar judul={judul} onToggleSidebar={toggleSidebar} />
          </div>
          <BilahPemulihan />
          <BilahKembaliSetup />
          <PeringatanShift />
          <PencatatInteraksi />
          {/* relative: elemen absolut (mis. input berkas sr-only) ikut wadah ini, tidak memanjangkan dokumen. */}
          <div className="relative flex-1 overflow-auto print:overflow-visible">
            <Outlet />
          </div>
        </main>
      </div>
    </PenyediaTur>
  );
}
