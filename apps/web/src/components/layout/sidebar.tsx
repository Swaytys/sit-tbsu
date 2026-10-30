import { LABEL_PERAN } from '@sit/shared';
import { ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { lupakanSaring } from '@/lib/ingat-saring';
import { useLogout, usePengguna } from '@/api/auth';
import { useTampilanToko } from '@/api/pengaturan';
import { menuUntuk, type ItemMenu } from '@/lib/menu';
import { cn } from '@/lib/utils';

function kelasTautan(aktif: boolean, kecil: boolean) {
  return cn(
    'flex items-center rounded-md transition-colors',
    kecil ? 'gap-2.5 px-2.5 py-1.5 text-xs' : 'gap-3 px-3 py-2 text-sm',
    aktif
      ? 'bg-blue-600 font-medium text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
  );
}

function TautanIkon({ item }: { item: ItemMenu }) {
  return (
    <div className="px-2">
      <NavLink
        to={item.path}
        onClick={lupakanSaring}
        title={item.label}
        aria-label={item.label}
        className={({ isActive }) => cn(kelasTautan(isActive, false), 'justify-center')}
      >
        <item.ikon className="size-4" />
      </NavLink>
    </div>
  );
}

/** Sidebar gelap seperti mockup; menu disaring izin pengguna (docs/04 §4). */
export function Sidebar({ terbuka }: { terbuka: boolean }) {
  const pengguna = usePengguna();
  const logout = useLogout();
  const [grupTertutup, setGrupTertutup] = useState<Record<string, boolean>>({});
  const menu = menuUntuk(pengguna);
  const toko = useTampilanToko().data;
  const namaToko = toko?.namaToko ?? 'BonsaiUrip';

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-300 print:hidden',
        terbuka ? 'w-64' : 'w-16',
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-slate-800 px-4">
        {toko?.logo ? (
          <img
            src={toko.logo}
            alt="Logo toko"
            className="size-7 shrink-0 rounded bg-white object-contain"
          />
        ) : (
          <img src="/favicon.svg" alt="" className="size-7 shrink-0 rounded" />
        )}
        {terbuka && (
          <div className="ml-2.5 overflow-hidden leading-tight">
            <div className="truncate text-sm font-bold text-white">{namaToko}</div>
            <div className="truncate text-xs text-slate-400">{toko?.namaBadanUsaha ?? ''}</div>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-3" aria-label="Menu utama">
        {menu.map((entri) => {
          if (entri.jenis === 'item') {
            if (!terbuka) return <TautanIkon key={entri.path} item={entri} />;
            return (
              <div key={entri.path} className="px-2">
                <NavLink
                  to={entri.path}
                  onClick={lupakanSaring}
                  className={({ isActive }) => kelasTautan(isActive, false)}
                >
                  <entri.ikon className="size-4 shrink-0" />
                  <span>{entri.label}</span>
                </NavLink>
              </div>
            );
          }

          if (!terbuka) return entri.item.map((item) => <TautanIkon key={item.path} item={item} />);

          const grupTerbuka = !grupTertutup[entri.id];
          return (
            <div key={entri.id} className="px-2">
              <button
                type="button"
                onClick={() => setGrupTertutup((g) => ({ ...g, [entri.id]: grupTerbuka }))}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <entri.ikon className="size-4 shrink-0" />
                <span className="flex-1 text-left font-medium">{entri.label}</span>
                <ChevronDown
                  className={cn('size-3.5 transition-transform', !grupTerbuka && '-rotate-90')}
                />
              </button>
              {grupTerbuka && (
                <div className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-700 pl-4">
                  {entri.item.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={lupakanSaring}
                      className={({ isActive }) => kelasTautan(isActive, true)}
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

      <div className="shrink-0 border-t border-slate-800 p-3">
        {terbuka ? (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {pengguna.namaPengguna.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-semibold text-white">{pengguna.namaPengguna}</p>
              <p className="truncate text-xs text-slate-400">{LABEL_PERAN[pengguna.peran]}</p>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              title="Keluar"
              aria-label="Keluar"
              className="p-1 text-slate-500 transition-colors hover:text-red-400"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logout.mutate()}
            title="Keluar"
            aria-label="Keluar"
            className="flex w-full justify-center p-1.5 text-slate-500 transition-colors hover:text-red-400"
          >
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
