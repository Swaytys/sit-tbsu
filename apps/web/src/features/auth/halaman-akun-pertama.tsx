import { skemaAkunPertama, skemaPulihkanPassword } from '@sit/shared';
import { ArrowLeft, KeyRound, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useBuatAkunPertama, usePulihkanPassword, useSaya, useStatusPenyiapan } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TampilKodePemulihan } from './kartu-kode-pemulihan';

/** Bingkai halaman publik (akun pertama, lupa password): sama dengan halaman masuk. */
function Bingkai({ judul, ket, children }: { judul: string; ket: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <img src="/logo-bonsaiurip.svg" alt="Sumber Urip Bonsai" className="mb-4 h-14" />
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

/**
 * K-191: pemakaian pertama (belum ada pengguna sama sekali). Pemilik membuat akun Owner sendiri, lalu menyimpan
 * kode pemulihan. Halaman ini tidak bisa dipakai lagi setelah ada satu pengguna.
 */
export function HalamanAkunPertama() {
  const status = useStatusPenyiapan();
  const saya = useSaya();
  const buat = useBuatAkunPertama();
  const navigate = useNavigate();
  const [isi, setIsi] = useState({ namaPengguna: '', username: '', password: '', konfirmasi: '' });
  const [galat, setGalat] = useState<Galat>({});
  const [kode, setKode] = useState<{ kode: string; username: string } | null>(null);

  if (kode) {
    return (
      <Bingkai
        judul="Simpan kode pemulihan"
        ket="Akun Owner sudah dibuat dan Anda sudah masuk. Satu langkah lagi: simpan kode di bawah."
      >
        <TampilKodePemulihan
          kode={kode.kode}
          username={kode.username}
          labelLanjut="Lanjut ke aplikasi"
          onLanjut={() => void navigate('/dashboard', { replace: true })}
        />
      </Bingkai>
    );
  }
  if (status.data && !status.data.perluAkunPertama) {
    return <Navigate to={saya.data ? '/dashboard' : '/login'} replace />;
  }

  function kirim() {
    const v = skemaAkunPertama.safeParse(isi);
    if (!v.success) {
      setGalat(galatDari(v.error.issues));
      return;
    }
    setGalat({});
    buat
      .mutateAsync(v.data)
      .then((h) => setKode({ kode: h.kodePemulihan, username: h.pengguna.username }))
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const ubah = (k: keyof typeof isi) => (e: { target: { value: string } }) =>
    setIsi((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Bingkai
      judul="Buat akun pertama"
      ket="Selamat datang di BonsaiUrip. Akun ini menjadi Owner (pemilik): bisa mengatur semua hal, termasuk membuat akun karyawan."
    >
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        <Isian label="Nama Anda" galat={galat.namaPengguna}>
          <Input autoFocus value={isi.namaPengguna} onChange={ubah('namaPengguna')} />
        </Isian>
        <Isian label="Username (untuk masuk)" galat={galat.username}>
          <Input
            autoComplete="username"
            value={isi.username}
            onChange={ubah('username')}
            placeholder="mis. budi atau owner"
          />
        </Isian>
        <Isian label="Password (minimal 8 karakter)" galat={galat.password}>
          <Input
            type="password"
            autoComplete="new-password"
            value={isi.password}
            onChange={ubah('password')}
          />
        </Isian>
        <Isian label="Ulangi password" galat={galat.konfirmasi}>
          <Input
            type="password"
            autoComplete="new-password"
            value={isi.konfirmasi}
            onChange={ubah('konfirmasi')}
          />
        </Isian>
        <Button type="submit" className="w-full" disabled={buat.isPending}>
          <UserPlus /> {buat.isPending ? 'Membuat akun…' : 'Buat akun dan masuk'}
        </Button>
      </form>
    </Bingkai>
  );
}

/**
 * K-191: lupa password. Dengan kode pemulihan: username + kode + password baru (kode baru diberikan). Tanpa kode:
 * minta Owner/Admin me-reset di Data Pengguna.
 */
export function HalamanLupaPassword() {
  const pulihkan = usePulihkanPassword();
  const navigate = useNavigate();
  const [isi, setIsi] = useState({
    username: '',
    kodePemulihan: '',
    passwordBaru: '',
    konfirmasi: '',
  });
  const [galat, setGalat] = useState<Galat>({});
  const [kode, setKode] = useState<string | null>(null);

  if (kode) {
    return (
      <Bingkai
        judul="Password sudah diganti"
        ket="Kode pemulihan lama sudah tidak berlaku. Simpan kode baru di bawah, lalu masuk dengan password baru."
      >
        <TampilKodePemulihan
          kode={kode}
          username={isi.username.trim().toLowerCase()}
          labelLanjut="Masuk sekarang"
          onLanjut={() => void navigate('/login', { replace: true })}
        />
      </Bingkai>
    );
  }

  function kirim() {
    const v = skemaPulihkanPassword.safeParse(isi);
    if (!v.success) {
      setGalat(galatDari(v.error.issues));
      return;
    }
    setGalat({});
    pulihkan
      .mutateAsync(v.data)
      .then((h) => setKode(h.kodePemulihan))
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const ubah = (k: keyof typeof isi) => (e: { target: { value: string } }) =>
    setIsi((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Bingkai
      judul="Lupa password"
      ket="Pakai kode pemulihan yang disimpan saat akun dibuat (atau dibuat di Akun saya)."
    >
      <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
        <b>Tidak punya kode pemulihan?</b> Minta Owner atau Admin membuka <i>Data Pengguna</i> ›
        akun Anda › <b>Reset password</b>. Anda lalu masuk dengan password sementara dan wajib
        menggantinya.
      </div>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        <Isian label="Username" galat={galat.username}>
          <Input
            autoFocus
            autoComplete="username"
            value={isi.username}
            onChange={ubah('username')}
          />
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
      <Link
        to="/login"
        className="mt-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft className="size-4" /> Kembali ke halaman masuk
      </Link>
    </Bingkai>
  );
}
