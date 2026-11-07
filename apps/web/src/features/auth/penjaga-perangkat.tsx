import { Loader2, Smartphone } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type StatusPerangkat = {
  jalurLan: boolean;
  status: 'BELUM_TERDAFTAR' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'DICABUT';
  kode: string | null;
};

async function bacaStatus(): Promise<StatusPerangkat> {
  const r = await fetch('/api/perangkat/status', { credentials: 'same-origin' });
  return ((await r.json()) as { data: StatusPerangkat }).data;
}

async function daftar(): Promise<{ status: StatusPerangkat['status']; kode: string }> {
  const r = await fetch('/api/perangkat/daftar', { method: 'POST', credentials: 'same-origin' });
  return ((await r.json()) as { data: { status: StatusPerangkat['status']; kode: string } }).data;
}

/**
 * K-229: HP/tablet yang membuka aplikasi lewat mode LAN toko harus disetujui Owner/Admin. Selama belum disetujui,
 * layar ini menampilkan kode 6 angka perangkat dan memeriksa persetujuannya setiap 3 detik.
 */
export function PenjagaPerangkat({ children }: { children: ReactNode }) {
  const [s, setS] = useState<StatusPerangkat | null>(null);
  const [galat, setGalat] = useState(false);

  useEffect(() => {
    let aktif = true;
    const muat = async () => {
      try {
        let st = await bacaStatus();
        if (st.jalurLan && st.status === 'BELUM_TERDAFTAR') {
          const d = await daftar();
          st = { ...st, status: d.status, kode: d.kode };
        }
        if (aktif) setS(st);
      } catch {
        if (aktif) setGalat(true);
      }
    };
    void muat();
    return () => {
      aktif = false;
    };
  }, []);

  useEffect(() => {
    if (!s?.jalurLan || s.status !== 'MENUNGGU') return;
    const t = setInterval(() => {
      void bacaStatus().then((st) => {
        if (st.status === 'DISETUJUI') window.location.reload();
        else setS(st);
      });
    }, 3000);
    return () => clearInterval(t);
  }, [s]);

  // Server tidak bisa dihubungi / bukan jalur LAN: aplikasi berjalan seperti biasa.
  if (galat || (s && (!s.jalurLan || s.status === 'DISETUJUI'))) return <>{children}</>;
  if (!s) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }
  const ditolak = s.status === 'DITOLAK' || s.status === 'DICABUT';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-sm">
        <Smartphone className="mx-auto size-10 text-blue-600" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">
          {ditolak ? 'Perangkat ini tidak diizinkan' : 'Daftarkan perangkat ini'}
        </h1>
        {ditolak ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Owner/Admin menolak atau mencabut akses perangkat ini. Hubungi Owner bila ini keliru.
            </p>
            <Button
              className="mt-4"
              onClick={() =>
                void daftar().then((d) => setS({ jalurLan: true, status: d.status, kode: d.kode }))
              }
            >
              Minta persetujuan lagi
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Sebutkan kode ini kepada Owner/Admin. Mereka menyetujuinya di laptop toko: Pengaturan
              › Akses HP/tablet › Menunggu persetujuan.
            </p>
            <div className="my-5 font-mono text-4xl font-bold tracking-[0.3em] text-slate-900">
              {s.kode}
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="size-3.5 animate-spin" /> Menunggu persetujuan… halaman terbuka
              sendiri setelah disetujui.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
