import { LABEL_PERAN } from '@sit/shared';
import { Bell, ChevronDown, KeyRound, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLogout, usePengguna } from '@/api/auth';
import { useNotifikasi } from '@/api/persediaan';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PindahPenjualan } from './pindah-penjualan';

type Props = { judul: string; onToggleSidebar: () => void };

/** Lonceng notifikasi (docs/05 ST2): isi dihitung API sesuai izin pengguna. */
function LoncengNotifikasi() {
  const notifikasi = useNotifikasi();
  const navigate = useNavigate();
  const daftar = notifikasi.data ?? [];
  const total = daftar.reduce((a, n) => a + n.jumlah, 0);

  return (
    <DropdownMenu onOpenChange={(buka) => buka && void notifikasi.refetch()}>
      <DropdownMenuTrigger
        className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label={total > 0 ? `Notifikasi (${total})` : 'Notifikasi'}
      >
        <Bell className="size-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[75vh] w-80 overflow-y-auto">
        <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {daftar.length === 0 ? (
          <div className="px-2 py-3 text-sm text-slate-500">Tidak ada notifikasi.</div>
        ) : (
          daftar.map((n) => (
            <DropdownMenuItem
              key={n.jenis}
              onSelect={() => void navigate(n.tautan)}
              className="flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{n.judul}</span>
              <span className="text-xs text-slate-500">{n.keterangan}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Pencarian global ditambahkan pada fase yang memerlukannya (Fase 7).
export function Topbar({ judul, onToggleSidebar }: Props) {
  const pengguna = usePengguna();
  const logout = useLogout();
  const navigate = useNavigate();

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
      <span className="flex-1 text-sm font-semibold text-slate-800">{judul}</span>
      <PindahPenjualan />
      <LoncengNotifikasi />

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-100"
          aria-label="Menu pengguna"
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {pengguna.namaPengguna.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-slate-700">{pengguna.namaPengguna}</div>
            <div className="text-xs text-slate-400">{LABEL_PERAN[pengguna.peran]}</div>
          </div>
          <ChevronDown className="size-3.5 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{pengguna.namaPengguna}</div>
            <div className="font-mono text-xs text-slate-500">{pengguna.username}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void navigate('/akun/password')}>
            <KeyRound /> Akun saya
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate()}>
            <LogOut /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
