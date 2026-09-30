import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLogout, usePengguna } from '@/api/auth';
import { Card } from '@/components/ui/card';
import { FormGantiPassword } from './form-ganti-password';

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

/** Ganti password atas kemauan sendiri, dari menu pengguna di topbar. */
export function HalamanGantiPasswordAkun() {
  const navigate = useNavigate();
  return (
    <div className="max-w-md space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ganti password</h1>
        <p className="text-sm text-slate-500">
          Setelah diganti, sesi login Anda di perangkat lain akan diakhiri.
        </p>
      </div>
      <Card className="p-6">
        <FormGantiPassword onBerhasil={() => void navigate('/dashboard')} />
      </Card>
    </div>
  );
}
