import { LABEL_PERAN } from '@sit/shared';
import { ID_SLOT_LENCANA } from '@/components/banner-lipat';
import { KotakCari } from './kotak-cari';
import {
  Bell,
  ChevronDown,
  Compass,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Store,
  Keyboard,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLogout, usePengguna } from '@/api/auth';
import { useNotifikasi } from '@/api/persediaan';
import { useStatusShiftToko } from '@/api/penjualan';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogTentang } from './dialog-tentang';
import { PindahPenjualan } from './pindah-penjualan';

type Props = { judul: string; onToggleSidebar: () => void };

/**
 * K-132: status shift toko untuk semua peran (Staf tidak punya menu Shift). Klik = halaman Shift bagi yang
 * berizin.
 */
function IndikatorShift() {
  const pengguna = usePengguna();
  const navigate = useNavigate();
  const st = useStatusShiftToko().data;
  const boleh = pengguna.izin.includes('kas.shift.kelola_sendiri');
  // K-186: menutup tab/jendela saat shift toko masih terbuka memunculkan peringatan peramban. Shift yang
  // tertinggal tetap aman (muncul sebagai "Shift kemarin belum ditutup" dan bisa ditutup belakangan).
  const shiftTerbuka = boleh && st !== undefined && st !== null;
  useEffect(() => {
    if (!shiftTerbuka) return;
    const tahan = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [shiftTerbuka]);
  const [teks, warna, judul] =
    st === undefined
      ? ['Shift …', 'border-slate-200 text-slate-400', '']
      : st === null
        ? [
            'Shift tutup',
            'border-slate-300 bg-slate-100 text-slate-600',
            'Shift toko belum dibuka.',
          ]
        : st.terlewat
          ? [
              'Shift kemarin belum ditutup',
              'border-red-300 bg-red-50 text-red-700',
              `${st.nomor} · shift kemarin belum ditutup`,
            ]
          : st.status === 'DIHITUNG'
            ? [
                'Shift sedang ditutup',
                'border-blue-300 bg-blue-50 text-blue-700',
                `${st.nomor} · shift sedang ditutup`,
              ]
            : [
                'Shift buka',
                st.lewatJadwal
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700',
                `${st.nomor} · dibuka ${st.namaPembuka}, ${formatWaktu(st.waktuBuka).slice(11)}`,
              ];
  return (
    <button
      type="button"
      disabled={!boleh}
      onClick={() => void navigate('/shift')}
      title={judul}
      data-testid="indikator-shift"
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap disabled:cursor-default',
        warna,
      )}
    >
      {st ? <Store className="size-3.5 shrink-0" /> : <LockKeyhole className="size-3.5 shrink-0" />}
      {/* K-172: layar sempit cukup kata pertama ("Shift"); teks lengkap di judul. */}
      <span className="hidden 2xl:inline">{teks}</span>
      <span className="2xl:hidden">{PENDEK[teks] ?? teks}</span>
    </button>
  );
}

const PENDEK: Record<string, string> = {
  'Shift kemarin belum ditutup': 'Belum ditutup',
  'Shift sedang ditutup': 'Menutup',
};

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
              {n.rincian && n.rincian.length > 0 && (
                <ul className="w-full space-y-0.5 pl-2 text-xs text-slate-700">
                  {n.rincian.map((x) => (
                    <li key={x} className="truncate" title={x}>
                      • {x}
                    </li>
                  ))}
                  {n.jumlah > n.rincian.length && (
                    <li className="text-slate-400">+{n.jumlah - n.rincian.length} lainnya</li>
                  )}
                </ul>
              )}
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
  const [tentang, setTentang] = useState(false);

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Buka atau tutup menu"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
      >
        <Menu className="size-5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold whitespace-nowrap text-slate-800">
        {judul}
      </span>
      <KotakCari />
      <div id={ID_SLOT_LENCANA} className="flex items-center gap-1.5" />
      <PindahPenjualan />
      <IndikatorShift />
      <LoncengNotifikasi />

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-100"
          aria-label="Menu pengguna"
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {pengguna.namaPengguna.charAt(0).toUpperCase()}
          </div>
          <div className="hidden leading-tight xl:block">
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
          <DropdownMenuItem onSelect={() => void navigate('/akun/pintasan')}>
            <Keyboard /> Pintasan keyboard
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigate('/tur')}>
            <Compass /> Tur & panduan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTentang(true)}>
            <Info /> Tentang aplikasi
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate()}>
            <LogOut /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {tentang && <DialogTentang onTutup={() => setTentang(false)} />}
    </header>
  );
}
