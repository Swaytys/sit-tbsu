import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { usePengguna } from '@/api/auth';
import { SEMUA_ITEM_MENU, bolehAkses } from '@/lib/menu';
import { cn } from '@/lib/utils';

/** Tiga layar kerja penjualan dan nomor pintasannya (Alt + angka). */
const LAYAR = [
  { path: '/order', label: 'Order', angka: '1' },
  { path: '/penjualan-langsung', label: 'Langsung', angka: '2' },
  { path: '/penjualan-pengantaran', label: 'Pengantaran', angka: '3' },
] as const;

/**
 * Pindah cepat antara Order Penjualan, Penjualan Langsung, dan Penjualan Pengantaran (K-099): tombol di bilah
 * atas dan Alt+1/2/3 dari halaman mana pun. Hanya layar yang boleh dibuka pengguna yang tampil; izin tetap
 * dijaga rute dan API. Halaman yang punya isian belum tersimpan tetap meminta konfirmasi (`useCegahKeluar`).
 */
export function PindahPenjualan() {
  const pengguna = usePengguna();
  const navigasi = useNavigate();
  const layar = LAYAR.filter((l) => {
    const item = SEMUA_ITEM_MENU.find((m) => m.path === l.path);
    return item !== undefined && bolehAkses(pengguna, item.izin);
  });
  const kunci = layar.map((l) => l.angka + l.path).join('|');

  useEffect(() => {
    if (kunci === '') return;
    const tujuan = new Map(kunci.split('|').map((k) => [`Digit${k.charAt(0)}`, k.slice(1)]));
    const tekan = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const path = tujuan.get(e.code);
      if (!path) return;
      e.preventDefault();
      void navigasi(path);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [kunci, navigasi]);

  if (layar.length < 2) return null;
  return (
    <nav aria-label="Pindah layar penjualan" className="flex items-center gap-1">
      {layar.map((l) => (
        <NavLink
          key={l.path}
          to={l.path}
          title={`Buka ${l.label} (Alt+${l.angka})`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
              isActive
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100',
            )
          }
        >
          {l.label}
          <kbd className="rounded bg-slate-200 px-1 font-mono text-[10px] text-slate-600">
            Alt+{l.angka}
          </kbd>
        </NavLink>
      ))}
    </nav>
  );
}
