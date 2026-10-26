import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLogout, usePengguna } from '@/api/auth';
import { Card } from '@/components/ui/card';
import { FormGantiPassword } from './form-ganti-password';
import { KartuKodePemulihan } from './kartu-kode-pemulihan';
import { KartuKontakPersetujuan } from './kartu-kontak-persetujuan';

/** Layar wajib ganti password (akun baru atau password direset Owner; docs/04 §7). */
export function HalamanWajibGantiPassword() {
  const pengguna = usePengguna();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md gap-4 p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600">
            <KeyRound className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Ganti password</h1>
            <p className="text-sm text-slate-500">Halo, {pengguna.namaPengguna}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Demi keamanan, Anda wajib mengganti password sebelum memakai aplikasi.
        </p>
        <FormGantiPassword onBerhasil={() => void navigate('/dashboard', { replace: true })} />
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="text-center text-sm text-slate-500 hover:text-slate-700 hover:underline"
        >
          Keluar
        </button>
      </Card>
    </div>
  );
}

/**
 * Akun saya, dari menu pengguna di topbar: ganti password, dan untuk pengguna yang berwenang menyetujui
 * (Admin/Owner) kontak penerima kode persetujuan (K-102).
 */
export function HalamanGantiPasswordAkun() {
  const navigate = useNavigate();
  const pengguna = usePengguna();
  const penyetuju = (
    ['retur.setujui', 'void.setujui', 'master.pelanggan.atur_kredit'] as const
  ).some((i) => pengguna.izin.includes(i));
  return (
    <div className="max-w-xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Akun saya</h1>
        <p className="text-sm text-slate-500">
          {pengguna.namaPengguna} · {pengguna.username}
        </p>
      </div>
      {penyetuju && <KartuKontakPersetujuan />}
      <Card className="gap-4 p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Ganti password</h2>
          <p className="text-sm text-slate-500">
            Setelah diganti, sesi login Anda di perangkat lain akan diakhiri.
          </p>
        </div>
        <FormGantiPassword onBerhasil={() => void navigate('/dashboard')} />
      </Card>
      <KartuKodePemulihan username={pengguna.username} />
    </div>
  );
}
