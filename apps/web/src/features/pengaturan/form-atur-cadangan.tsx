import { skemaAturCadangan } from '@sit/shared';
import { KeyRound, Save, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAturCadangan } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/** Sandi acak mudah dicatat: 4 kelompok huruf/angka tanpa huruf yang mirip (O/0, l/1). */
function sandiAcak(): string {
  const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const acak = crypto.getRandomValues(new Uint32Array(16));
  const t = [...acak].map((n) => huruf[n % huruf.length]).join('');
  return t.match(/.{4}/g)?.join('-') ?? t;
}

/**
 * K-198: Owner mengatur folder dan sandi cadangan dari layar (tanpa berkas .env). Langkah ditulis berurutan karena
 * sandi yang hilang = cadangan tidak bisa dibuka.
 */
export function FormAturCadangan({
  folderSekarang,
  onSelesai,
}: {
  folderSekarang: string | null;
  onSelesai?: () => void;
}) {
  const atur = useAturCadangan();
  const [repoLokal, setRepoLokal] = useState(folderSekarang ?? '');
  const [sandi, setSandi] = useState('');
  const [sandiUlang, setSandiUlang] = useState('');
  const [tampil, setTampil] = useState(false);
  const [dicatat, setDicatat] = useState(false);

  function simpan() {
    const v = skemaAturCadangan.safeParse({ repoLokal, sandi, sandiUlang, sudahDicatat: dicatat });
    if (!v.success) {
      toast.error(v.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    atur
      .mutateAsync(v.data)
      .then(() => {
        toast.success('Cadangan diatur. Klik "Cadangkan sekarang" untuk mencoba pertama kali.');
        onSelesai?.();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err), { duration: 10_000 }));
  }

  return (
    <Card className="gap-3 p-5 text-sm" data-testid="form-atur-cadangan">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-4 text-blue-600" /> Atur cadangan
      </h2>
      <ol className="list-decimal space-y-1 pl-5 text-slate-600">
        <li>
          Colokkan <b>disk kedua, flashdisk, atau hardisk eksternal</b> yang selalu terpasang di
          komputer server. Jangan di disk yang sama dengan aplikasi (biasanya C:): bila disk itu
          rusak, cadangan ikut hilang.
        </li>
        <li>
          Tulis lokasi foldernya lengkap, mis. <code>E:\BonsaiUrip-cadangan</code> (folder dibuat
          sendiri bila belum ada).
        </li>
        <li>
          Buat <b>sandi cadangan</b> (minimal 8 karakter) atau klik <b>Buat sandi</b>.{' '}
          <b>Catat sandi di kertas/buku dan simpan di tempat aman</b>: tanpa sandi ini cadangan
          tidak bisa dibuka, oleh siapa pun.
        </li>
        <li>
          Centang "sudah dicatat" → <b>Simpan</b> → di atas klik <b>Cadangkan sekarang</b> untuk
          mencoba. Setelah itu cadangan berjalan sendiri setiap hari.
        </li>
      </ol>
      <label className="grid gap-1">
        <span className="font-medium">Folder cadangan</span>
        <Input
          value={repoLokal}
          onChange={(e) => setRepoLokal(e.target.value)}
          placeholder="E:\BonsaiUrip-cadangan"
          aria-label="Folder cadangan"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-medium">Sandi cadangan</span>
          <Input
            type={tampil ? 'text' : 'password'}
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoComplete="new-password"
            aria-label="Sandi cadangan"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-medium">Ulangi sandi</span>
          <Input
            type={tampil ? 'text' : 'password'}
            value={sandiUlang}
            onChange={(e) => setSandiUlang(e.target.value)}
            autoComplete="new-password"
            aria-label="Ulangi sandi cadangan"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const s = sandiAcak();
            setSandi(s);
            setSandiUlang(s);
            setTampil(true);
          }}
        >
          <Wand2 /> Buat sandi
        </Button>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={tampil} onChange={(e) => setTampil(e.target.checked)} />
          Tampilkan sandi
        </label>
      </div>
      <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={dicatat}
          onChange={(e) => setDicatat(e.target.checked)}
          aria-label="Sandi sudah dicatat"
        />
        Sandi sudah saya catat di tempat aman (bukan hanya di komputer ini).
      </label>
      <div>
        <Button type="button" disabled={atur.isPending} onClick={simpan}>
          <Save /> {atur.isPending ? 'Memeriksa folder…' : 'Simpan'}
        </Button>
      </div>
    </Card>
  );
}
