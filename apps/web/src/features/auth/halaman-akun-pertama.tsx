import { skemaPulihkanPassword, skemaResetLewatEmail } from '@sit/shared';
import { ArrowLeft, KeyRound, Mail, Send } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMintaKodeEmail, usePulihkanPassword, useResetLewatEmail } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TampilKodePemulihan } from './kartu-kode-pemulihan';

/*
 * Halaman publik lupa password. (Halaman "Buat akun pertama" K-191 diganti setup awal K-205 di /mulai; nama berkas
 * dipertahankan.) Dua cara: kode verifikasi ke email (K-209, perlu internet dan email toko) atau kode pemulihan
 * kertas (K-191, tanpa internet). Tanpa keduanya: Owner/Admin me-reset di Data Pengguna.
 */

/** Bingkai halaman publik: sama dengan halaman masuk. */
function Bingkai({ judul, ket, children }: { judul: string; ket: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <img src="/logo-bonsaiurip.svg" alt="BonsaiUrip" className="mb-4 h-14" />
        <h1 className="mb-1 text-xl font-semibold text-slate-800">{judul}</h1>
        <p className="mb-6 text-sm text-slate-500">{ket}</p>
        {children}
      </div>
    </div>
  );
}

function Isian({
  label,
  galat,
  children,
}: {
  label: string;
  galat?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {galat && <span className="text-xs text-red-600">{galat}</span>}
    </label>
  );
}

type Galat = Record<string, string | undefined>;

function galatDari(issues: { path: PropertyKey[]; message: string }[]): Galat {
  const g: Galat = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? '');
    g[k] ??= i.message;
  }
  return g;
}

type Cara = 'EMAIL' | 'KODE';

export function HalamanLupaPassword() {
  const [cara, setCara] = useState<Cara>('EMAIL');
  const [kodeBaru, setKodeBaru] = useState<{ kode: string; username: string } | null>(null);
  const navigate = useNavigate();

  if (kodeBaru) {
    return (
      <Bingkai
        judul="Password sudah diganti"
        ket="Kode pemulihan lama sudah tidak berlaku. Simpan kode baru di bawah, lalu masuk dengan password baru."
      >
        <TampilKodePemulihan
          kode={kodeBaru.kode}
          username={kodeBaru.username}
          labelLanjut="Masuk sekarang"
          onLanjut={() => void navigate('/login', { replace: true })}
        />
      </Bingkai>
    );
  }

  return (
    <Bingkai judul="Lupa password" ket="Pilih cara mengganti password.">
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
        {(
          [
            ['EMAIL', Mail, 'Kode lewat email'],
            ['KODE', KeyRound, 'Kode pemulihan'],
          ] as const
        ).map(([id, Ikon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={cara === id}
            onClick={() => setCara(id)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm',
              cara === id
                ? 'border-blue-600 bg-blue-50 font-medium text-blue-800'
                : 'hover:bg-slate-50',
            )}
          >
            <Ikon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {cara === 'EMAIL' ? <LewatEmail /> : <LewatKode onSelesai={setKodeBaru} />}
      <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        <b>Tidak punya email terdaftar maupun kode pemulihan?</b> Minta Owner atau Admin membuka{' '}
        <i>Data Pengguna</i> › akun Anda › <b>Reset password</b>. Owner yang terkunci: di komputer
        tempat BonsaiUrip terpasang, buka menu Start › BonsaiUrip › <b>Pulihkan akses Owner</b>.
      </div>
      <Link
        to="/login"
        className="mt-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft className="size-4" /> Kembali ke halaman masuk
      </Link>
    </Bingkai>
  );
}

/** K-209: kode 6 angka ke email pengguna, lalu password baru. */
function LewatEmail() {
  const minta = useMintaKodeEmail();
  const reset = useResetLewatEmail();
  const navigate = useNavigate();
  const [isi, setIsi] = useState({ username: '', kode: '', passwordBaru: '', konfirmasi: '' });
  const [galat, setGalat] = useState<Galat>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const ubah = (k: keyof typeof isi) => (e: { target: { value: string } }) =>
    setIsi((s) => ({ ...s, [k]: e.target.value }));

  function kirimKode() {
    if (isi.username.trim() === '') {
      setGalat({ username: 'Username wajib diisi.' });
      return;
    }
    setGalat({});
    minta
      .mutateAsync(isi.username)
      .then((h) => setPesan(h.pesan))
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  function gantiPassword() {
    const v = skemaResetLewatEmail.safeParse(isi);
    if (!v.success) {
      setGalat(galatDari(v.error.issues));
      return;
    }
    setGalat({});
    reset
      .mutateAsync(v.data)
      .then((h) => {
        toast.success(h.pesan);
        void navigate('/login', { replace: true });
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pesan) gantiPassword();
        else kirimKode();
      }}
    >
      <Isian label="Username" galat={galat.username}>
        <Input autoFocus autoComplete="username" value={isi.username} onChange={ubah('username')} />
      </Isian>
      {!pesan ? (
        <Button type="submit" className="w-full" disabled={minta.isPending}>
          <Send /> {minta.isPending ? 'Mengirim…' : 'Kirim kode ke email saya'}
        </Button>
      ) : (
        <>
          <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">{pesan}</p>
          <Isian label="Kode 6 angka dari email" galat={galat.kode}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="font-mono tracking-widest"
              value={isi.kode}
              onChange={ubah('kode')}
            />
          </Isian>
          <Isian label="Password baru (minimal 8 karakter)" galat={galat.passwordBaru}>
            <Input
              type="password"
              autoComplete="new-password"
              value={isi.passwordBaru}
              onChange={ubah('passwordBaru')}
            />
          </Isian>
          <Isian label="Ulangi password baru" galat={galat.konfirmasi}>
            <Input
              type="password"
              autoComplete="new-password"
              value={isi.konfirmasi}
              onChange={ubah('konfirmasi')}
            />
          </Isian>
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            <KeyRound /> {reset.isPending ? 'Memproses…' : 'Ganti password'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={minta.isPending}
            onClick={kirimKode}
          >
            Kirim ulang kode
          </Button>
        </>
      )}
    </form>
  );
}

/** K-191: kode pemulihan kertas + password baru (kode baru diberikan). */
function LewatKode({ onSelesai }: { onSelesai: (k: { kode: string; username: string }) => void }) {
  const pulihkan = usePulihkanPassword();
  const [isi, setIsi] = useState({
    username: '',
    kodePemulihan: '',
    passwordBaru: '',
    konfirmasi: '',
  });
  const [galat, setGalat] = useState<Galat>({});
  const ubah = (k: keyof typeof isi) => (e: { target: { value: string } }) =>
    setIsi((s) => ({ ...s, [k]: e.target.value }));

  function kirim() {
    const v = skemaPulihkanPassword.safeParse(isi);
    if (!v.success) {
      setGalat(galatDari(v.error.issues));
      return;
    }
    setGalat({});
    pulihkan
      .mutateAsync(v.data)
      .then((h) =>
        onSelesai({ kode: h.kodePemulihan, username: isi.username.trim().toLowerCase() }),
      )
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        kirim();
      }}
    >
      <p className="text-xs text-slate-500">
        Kode pemulihan dibuat saat setup awal (atau di menu Akun saya), formatnya
        XXXXX-XXXXX-XXXXX-XXXXX.
      </p>
      <Isian label="Username" galat={galat.username}>
        <Input autoFocus autoComplete="username" value={isi.username} onChange={ubah('username')} />
      </Isian>
      <Isian label="Kode pemulihan" galat={galat.kodePemulihan}>
        <Input
          className="font-mono uppercase"
          autoComplete="off"
          value={isi.kodePemulihan}
          onChange={ubah('kodePemulihan')}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
        />
      </Isian>
      <Isian label="Password baru (minimal 8 karakter)" galat={galat.passwordBaru}>
        <Input
          type="password"
          autoComplete="new-password"
          value={isi.passwordBaru}
          onChange={ubah('passwordBaru')}
        />
      </Isian>
      <Isian label="Ulangi password baru" galat={galat.konfirmasi}>
        <Input
          type="password"
          autoComplete="new-password"
          value={isi.konfirmasi}
          onChange={ubah('konfirmasi')}
        />
      </Isian>
      <Button type="submit" className="w-full" disabled={pulihkan.isPending}>
        <KeyRound /> {pulihkan.isPending ? 'Memproses…' : 'Ganti password'}
      </Button>
    </form>
  );
}
