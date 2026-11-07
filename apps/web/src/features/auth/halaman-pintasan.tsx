import {
  AKSI_PINTASAN,
  DAFTAR_AKSI_PINTASAN,
  LABEL_LAYAR_PINTASAN,
  LAYAR_PINTASAN,
  pintasanLengkap,
  skemaPintasan,
  TOMBOL_PINTASAN,
  type AksiPintasan,
  type PintasanPengguna,
  type TombolPintasan,
} from '@sit/shared';
import { Keyboard, Loader2, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { usePintasanPengguna, useSimpanPintasan } from '@/api/pintasan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * K-145: menu akun › Pintasan keyboard. Tombol F di layar kasir dan Order Penjualan bisa dipindah per pengguna;
 * tersimpan di akun sehingga berlaku di komputer/tablet mana pun pengguna masuk.
 */
export function HalamanPintasan() {
  const data = usePintasanPengguna();
  if (data.isPending) return <Loader2 className="m-6 size-5 animate-spin text-slate-400" />;
  return <FormPintasan awal={data.data ?? {}} />;
}

function FormPintasan({ awal }: { awal: PintasanPengguna }) {
  const simpan = useSimpanPintasan();
  const [isi, setIsi] = useState<Record<AksiPintasan, string>>(pintasanLengkap(awal));
  const ubahan = (): PintasanPengguna => {
    const p: PintasanPengguna = {};
    for (const a of DAFTAR_AKSI_PINTASAN) {
      if (isi[a] !== AKSI_PINTASAN[a].bawaan) p[a] = isi[a] as TombolPintasan;
    }
    return p;
  };
  const cek = skemaPintasan.safeParse(ubahan());
  const galatPer = new Map<string, string>(
    cek.success ? [] : cek.error.issues.map((i) => [String(i.path[0]), i.message]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Keyboard className="size-5 text-blue-600" />
        <h1 className="text-lg font-semibold text-slate-900">Pintasan keyboard</h1>
      </div>
      <p className="text-sm text-slate-600">
        Pilih tombol F untuk setiap aksi di layar kerja. Berlaku untuk akun Anda di semua komputer
        dan tablet. F1 tetap untuk tanda kali jumlah (mis. 3*semen); F5, F11, dan F12 dipakai
        peramban sehingga tidak bisa dipilih. Semua aksi juga tetap bisa diklik.
      </p>
      {LAYAR_PINTASAN.map((layar) => (
        <Card key={layar} className="gap-2 p-5">
          <h2 className="font-semibold text-slate-800">{LABEL_LAYAR_PINTASAN[layar]}</h2>
          <ul className="divide-y">
            {DAFTAR_AKSI_PINTASAN.filter((a) => AKSI_PINTASAN[a].layar === layar).map((a) => (
              <li key={a} className="flex flex-wrap items-center gap-3 py-2">
                <label htmlFor={`pintasan-${a}`} className="min-w-0 flex-1 text-sm text-slate-700">
                  {AKSI_PINTASAN[a].label}
                  {isi[a] !== AKSI_PINTASAN[a].bawaan && (
                    <span className="ml-2 text-xs text-slate-400">
                      (bawaan {AKSI_PINTASAN[a].bawaan})
                    </span>
                  )}
                </label>
                <select
                  id={`pintasan-${a}`}
                  value={isi[a]}
                  onChange={(e) => setIsi({ ...isi, [a]: e.target.value })}
                  className="h-9 rounded-md border px-2 font-mono text-sm"
                >
                  {TOMBOL_PINTASAN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                {galatPer.get(a) && (
                  <p role="alert" className="basis-full text-xs text-red-600">
                    {galatPer.get(a)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!cek.success || simpan.isPending}
          onClick={() =>
            void simpan
              .mutateAsync(ubahan())
              .then(() => toast.success('Pintasan keyboard disimpan.'))
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        >
          {simpan.isPending ? <Loader2 className="animate-spin" /> : <Save />} Simpan
        </Button>
        <Button variant="outline" onClick={() => setIsi(pintasanLengkap({}))}>
          <RotateCcw /> Kembalikan semua ke bawaan
        </Button>
      </div>
    </div>
  );
}
