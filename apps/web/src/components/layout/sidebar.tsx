import { ChevronDown, Package, Ruler, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

type ItemMenu = { path: string; label: string; ikon: LucideIcon };
type GrupMenu = { id: string; label: string; ikon: LucideIcon; item: ItemMenu[] };

// Fase 1: hanya halaman yang sudah ada. Menu lengkap yang disaring izin dibuat di Fase 2
// (docs/04 §4).
const MENU: GrupMenu[] = [
  {
    id: 'data-master',
    label: 'Data Master',
    ikon: Package,
    item: [{ path: '/satuan', label: 'Satuan', ikon: Ruler }],
  },
];

export function Sidebar({ terbuka }: { terbuka: boolean }) {
  const [grupTertutup, setGrupTertutup] = useState<Record<string, boolean>>({});

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-300',
        terbuka ? 'w-64' : 'w-16',
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-slate-800 px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-black text-white">
          BU
        </div>
        {terbuka && (
          <div className="ml-2.5 overflow-hidden leading-tight">
            <div className="truncate text-sm font-bold text-white">BonsaiUrip</div>
            <div className="truncate text-xs text-slate-400">UD. Sumber Urip</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto py-3" aria-label="Menu utama">
        {MENU.map((grup) => {
          const grupTerbuka = !grupTertutup[grup.id];

          if (!terbuka) {
            // Sidebar ciut: tampilkan ikon setiap halaman saja.
            return grup.item.map((item) => (
              <div key={item.path} className="px-2">
                <NavLink
                  to={item.path}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-center rounded-md px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    )
                  }
                >
                  <item.ikon className="size-4" />
                </NavLink>
              </div>
            ));
          }

          return (
            <div key={grup.id} className="px-2">
              <button
                type="button"
                onClick={() => setGrupTertutup((g) => ({ ...g, [grup.id]: grupTerbuka }))}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <grup.ikon className="size-4 shrink-0" />
                <span className="flex-1 text-left font-medium">{grup.label}</span>
                <ChevronDown
                  className={cn('size-3.5 transition-transform', !grupTerbuka && '-rotate-90')}
                />
              </button>
              {grupTerbuka && (
                <div className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-700 pl-4">
                  {grup.item.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                          isActive
                            ? 'bg-blue-600 font-medium text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                        )
                      }
                    >
                      <item.ikon className="size-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
