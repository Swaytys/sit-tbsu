import { Copy, Download, KeyRound, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBuatKodePemulihan, useInfoKodePemulihan } from '@/api/auth';
import { AreaCetak } from '@/components/area-cetak';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatWaktu } from '@/lib/format';

/**
 * K-191: menampilkan kode pemulihan SEKALI setelah dibuat. Pengguna wajib menyatakan sudah menyimpannya (salin,
 * unduh berkas, atau cetak) sebelum lanjut; kode tidak bisa dilihat lagi sesudahnya.
 */
export function TampilKodePemulihan({
  kode,
  username,
  labelLanjut,
  onLanjut,
}: {
  kode: string;
  username: string;
  labelLanjut: string;
  onLanjut: () => void;
}) {
  const [disimpan, setDisimpan] = useState(false);
  const [cetak, setCetak] = useState(false);
  const isiBerkas =
    `BonsaiUrip - kode pemulihan akun\r\n\r\nUsername       : ${username}\r\n` +
    `Kode pemulihan : ${kode}\r\n\r\nDipakai bila lupa password: halaman masuk > Lupa password? > isi username,\r\n` +
    `kode ini, dan password baru. Kode hanya berlaku sekali; setelah dipakai, kode baru diberikan.\r\n` +
    `Simpan di tempat aman di luar komputer ini. Siapa pun yang memegang kode ini bisa mengganti password akun ini.\r\n`;

  function salin() {
    navigator.clipboard
      .writeText(kode)
      .then(() => toast.success('Kode pemulihan disalin.'))
      .catch(() => toast.error('Tidak bisa menyalin otomatis; catat kodenya secara manual.'));
  }

  function unduh() {
    const url = URL.createObjectURL(new Blob([isiBerkas], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `kode-pemulihan-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function cetakKode() {
    setCetak(true);
    setTimeout(() => {
      window.print();
      setCetak(false);
    }, 100);
  }

  return (
    <div className="space-y-4" data-testid="kode-pemulihan">
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-center">
        <div className="mb-1 text-xs font-semibold tracking-wide text-amber-800 uppercase">
          Kode pemulihan · {username}
        </div>
        <div className="font-mono text-2xl font-bold tracking-wider text-slate-900 select-all">
          {kode}
        </div>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Simpan kode ini sekarang: <b>Salin</b>, <b>Unduh berkas</b>, atau <b>Cetak</b>, lalu
          simpan di tempat aman di luar komputer ini (mis. kertas di laci terkunci).
        </li>
        <li>
          Bila lupa password: halaman masuk › <b>Lupa password?</b> › isi username, kode ini, dan
          password baru.
        </li>
        <li>
          Kode hanya berlaku <b>sekali</b>. Setelah dipakai, kode baru langsung diberikan untuk
          disimpan lagi. Kode ini tidak bisa dilihat lagi setelah layar ini ditutup.
        </li>
        <li>
          Siapa pun yang memegang kode ini bisa mengganti password akun ini: jangan dibagikan.
        </li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={salin}>
          <Copy /> Salin
        </Button>
        <Button variant="outline" onClick={unduh}>
          <Download /> Unduh berkas
        </Button>
        <Button variant="outline" onClick={cetakKode}>
          <Printer /> Cetak
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4"
          checked={disimpan}
          onChange={(e) => setDisimpan(e.target.checked)}
        />
        Saya sudah menyimpan kode ini di tempat aman
      </label>
      <Button className="w-full" disabled={!disimpan} onClick={onLanjut}>
        {labelLanjut}
      </Button>
      {cetak && (
        <AreaCetak ukuranKertas="A4">
          <pre className="font-mono text-sm whitespace-pre-wrap">{isiBerkas}</pre>
        </AreaCetak>
      )}
    </div>
  );
}

/** Akun saya: status kode pemulihan dan tombol membuat kode baru (konfirmasi password). */
export function KartuKodePemulihan({ username }: { username: string }) {
  const info = useInfoKodePemulihan();
  const buat = useBuatKodePemulihan();
  const [password, setPassword] = useState('');
  const [kode, setKode] = useState<string | null>(null);

  function kirim() {
    if (!password) {
      toast.error('Isi password Anda saat ini.');
      return;
    }
    buat
      .mutateAsync(password)
      .then((h) => {
        setPassword('');
        setKode(h.kodePemulihan);
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Card className="gap-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound className="size-4" /> Kode pemulihan (lupa password)
        </h2>
        <p className="text-sm text-slate-500">
          {info.data?.ada
            ? `Sudah ada, dibuat ${formatWaktu(info.data.dibuatPada)}. Membuat kode baru membatalkan kode lama.`
            : 'Belum ada. Tanpa kode ini, password yang terlupa hanya bisa di-reset Owner/Admin lain.'}
        </p>
      </div>
      {kode ? (
        <TampilKodePemulihan
          kode={kode}
          username={username}
          labelLanjut="Selesai"
          onLanjut={() => setKode(null)}
        />
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            kirim();
          }}
        >
          <label className="grid flex-1 gap-1 text-sm">
            <span className="font-medium">Password saat ini</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password saat ini untuk kode pemulihan"
            />
          </label>
          <Button type="submit" disabled={buat.isPending}>
            <KeyRound />{' '}
            {buat.isPending ? 'Membuat…' : info.data?.ada ? 'Buat kode baru' : 'Buat kode'}
          </Button>
        </form>
      )}
    </Card>
  );
}
