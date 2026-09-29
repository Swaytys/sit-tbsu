import { Menu } from 'lucide-react';

type Props = { judul: string; onToggleSidebar: () => void };

// Pencarian global, notifikasi, dan menu pengguna ditambahkan pada fase yang memerlukannya.
export function Topbar({ judul, onToggleSidebar }: Props) {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Buka atau tutup menu"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
      >
        <Menu className="size-5" />
      </button>
      <span className="text-sm font-semibold text-slate-800">{judul}</span>
    </header>
  );
}
