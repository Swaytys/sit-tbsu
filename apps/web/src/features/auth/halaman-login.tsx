import { zodResolver } from '@hookform/resolvers/zod';
import { skemaLogin, type InputLogin } from '@sit/shared';
import { ChevronRight, Lock, Store, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useLogin, useSaya, useStatusPenyiapan } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DialogDataToko } from './dialog-data-toko';
import { MasukCepat } from './masuk-cepat';

/** Hanya izinkan kembali ke path internal (mencegah open redirect lewat ?kembali=). */
function tujuanAman(kembali: string | null): string {
  if (kembali?.startsWith('/') && !kembali.startsWith('//')) return kembali;
  return '/dashboard';
}

export function HalamanLogin() {
  const saya = useSaya();
  const penyiapan = useStatusPenyiapan();
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tujuan = tujuanAman(params.get('kembali'));
  const [dataToko, setDataToko] = useState(false);
  const toko = penyiapan.data ?? { namaToko: '', sloganToko: '', kotaToko: '' };

  const form = useForm<InputLogin>({
    resolver: zodResolver(skemaLogin),
    defaultValues: { username: '', password: '' },
  });

  if (saya.data) {
    return <Navigate to={saya.data.wajibGantiPassword ? '/ganti-password' : tujuan} replace />;
  }
  // K-191: belum ada pengguna sama sekali (pemakaian pertama) → buat akun Owner dulu.
  if (penyiapan.data?.perluAkunPertama) return <Navigate to="/mulai" replace />;

  async function kirim(nilai: InputLogin) {
    try {
      const pengguna = await login.mutateAsync(nilai);
      void navigate(pengguna.wajibGantiPassword ? '/ganti-password' : tujuan, { replace: true });
    } catch {
      form.setValue('password', '');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl shadow-2xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-blue-700 p-10 text-white lg:flex">
          <div>
            <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-white/20">
              <Store className="size-7 text-white" />
            </div>
            {/* K-207: identitas usaha dari setup awal; tanpa nama toko tertulis mati di kode. */}
            <h1 className="mb-1 text-3xl leading-tight font-bold">
              {toko.namaToko || 'BonsaiUrip'}
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-blue-100 italic">
              {toko.sloganToko || 'Toko rapi, stok terkendali, untung terlihat.'}
            </p>
            <p className="text-sm leading-relaxed text-blue-100">
              Penjualan, persediaan, dan kas toko dalam satu aplikasi: kasir, order, pengantaran,
              stok, dan laporan.
            </p>
          </div>
          <p className="text-xs text-blue-300">
            {toko.kotaToko ? `${toko.kotaToko} · ` : ''}BonsaiUrip
          </p>
        </div>

        <div className="flex flex-col justify-center bg-white p-8">
          <div className="mb-6 text-center lg:hidden">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-blue-600">
              <Store className="size-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{toko.namaToko || 'BonsaiUrip'}</h1>
          </div>

          <img src="/logo-bonsaiurip.svg" alt="BonsaiUrip" className="mb-4 h-14" />
          <h2 className="mb-1 text-xl font-semibold text-slate-800">Masuk ke Sistem</h2>
          <p className="mb-6 text-sm text-slate-500">Masukkan username dan password Anda.</p>

          <Form {...form}>
            <form
              onSubmit={(e) => void form.handleSubmit(kirim)(e)}
              className="mb-6 space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <div className="relative">
                      <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <FormControl>
                        <Input className="pl-9" autoComplete="username" autoFocus {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <FormControl>
                        <Input
                          type="password"
                          className="pl-9"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {login.isError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {pesanGalat(login.error)}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  'Memproses…'
                ) : (
                  <>
                    Masuk <ChevronRight />
                  </>
                )}
              </Button>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-center">
                <Link to="/lupa-password" className="text-sm text-blue-700 hover:underline">
                  Lupa password?
                </Link>
                <button
                  type="button"
                  onClick={() => setDataToko(true)}
                  className="text-sm text-slate-600 hover:text-blue-700 hover:underline"
                >
                  Ganti / buat data toko
                </button>
              </div>
            </form>
          </Form>

          {dataToko && <DialogDataToko onTutup={() => setDataToko(false)} />}
          {import.meta.env.DEV && (
            <MasukCepat onBerhasil={() => void navigate(tujuan, { replace: true })} />
          )}
        </div>
      </div>
    </div>
  );
}
