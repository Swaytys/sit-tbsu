import { useEffect, useState } from 'react';
import { Outlet, useMatches } from 'react-router';
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

export function Layout() {
  const [sidebarTerbuka, setSidebarTerbuka] = useState(bacaPreferensiSidebar);
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
    const baru = !sidebarTerbuka;
    setSidebarTerbuka(baru);
    simpanPreferensiSidebar(baru);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar terbuka={sidebarTerbuka} />
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar judul={judul} onToggleSidebar={toggleSidebar} />
        {/* relative: elemen absolut (mis. input berkas sr-only) ikut wadah ini, tidak memanjangkan dokumen. */}
        <div className="relative flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
