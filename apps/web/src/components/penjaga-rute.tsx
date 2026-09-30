import type { Izin } from '@sit/shared';
import { Loader2, ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { pesanGalat } from '@/api/client';
import { usePengguna, useSaya } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { bolehAkses } from '@/lib/menu';

export function LayarMemuat() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
      <Loader2 className="mr-2 size-5 animate-spin" />
      <span className="text-sm">Memuat…</span>
    </div>
  );
}

/**
 * Rute hanya untuk pengguna yang login. Belum login → ke /login (lalu kembali ke halaman ini).
 * Wajib ganti password → ke /ganti-password, kecuali `bolehWajibGanti`.
 */
export function WajibLogin({
  children,
  bolehWajibGanti = false,
}: {
  children: ReactNode;
  bolehWajibGanti?: boolean;
}) {
  const saya = useSaya();
  const lokasi = useLocation();

  if (saya.isPending) return <LayarMemuat />;
  if (saya.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <p className="text-sm text-red-600">{pesanGalat(saya.error)}</p>
        <Button variant="outline" size="sm" onClick={() => void saya.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }
  if (!saya.data) {
    const kembali = encodeURIComponent(lokasi.pathname + lokasi.search);
    return <Navigate to={`/login?kembali=${kembali}`} replace />;
  }
  if (saya.data.wajibGantiPassword && !bolehWajibGanti) {
    return <Navigate to="/ganti-password" replace />;
  }
  return children;
}

/** Halaman hanya untuk pemilik izin. Menyembunyikan saja; API tetap menolak dengan 403. */
export function WajibIzin({
  izin,
  children,
}: {
  izin: Izin | readonly Izin[];
  children: ReactNode;
}) {
  const pengguna = usePengguna();
  if (bolehAkses(pengguna, izin)) return children;
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center">
      <ShieldX className="size-8 text-slate-400" />
      <h1 className="text-lg font-semibold text-slate-800">Tidak memiliki izin</h1>
      <p className="text-sm text-slate-500">
        Peran Anda tidak memiliki izin untuk membuka halaman ini.
      </p>
    </div>
  );
}
