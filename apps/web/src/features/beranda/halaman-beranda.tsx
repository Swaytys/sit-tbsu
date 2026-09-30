import { LABEL_PERAN } from '@sit/shared';
import { Link } from 'react-router';
import { usePengguna } from '@/api/auth';
import { Card } from '@/components/ui/card';
import { menuUntuk } from '@/lib/menu';

/** Beranda sementara. Dashboard per peran (kartu, grafik, aksi cepat) dibangun di Fase 7. */
export function HalamanBeranda() {
  const pengguna = usePengguna();
  const halaman = menuUntuk(pengguna).flatMap((e) => (e.jenis === 'grup' ? e.item : [e]));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Selamat datang, {pengguna.namaPengguna}
        </h1>
        <p className="text-sm text-slate-500">
          Anda masuk sebagai <span className="font-medium">{LABEL_PERAN[pengguna.peran]}</span>.
          Dashboard lengkap dibangun pada Fase 7.
        </p>
      </div>
      <Card className="gap-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Halaman yang bisa Anda buka</h2>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {halaman
            .filter((h) => h.path !== '/dashboard')
            .map((h) => (
              <li key={h.path}>
                <Link
                  to={h.path}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  <h.ikon className="size-4 text-slate-400" />
                  {h.label}
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
