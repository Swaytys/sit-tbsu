import type { ManifestData } from '@sit/shared';
import { Loader2, Plus, RotateCcw, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useBuatDataBaruMasuk,
  useDataTokoMasuk,
  usePakaiDataMasuk,
  type KredensialOwner,
} from '@/api/data';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatWaktu } from '@/lib/format';

/**
 * K-219: halaman masuk › Ganti / buat data toko. Owner data yang sedang dipakai memasukkan username dan password,
 * lalu memilih data toko lain yang tersimpan di komputer ini atau membuat data toko baru yang kosong. Data yang
 * sedang dipakai selalu disimpan dulu sehingga bisa dipakai kembali.
 */
export function DialogDataToko({ onTutup }: { onTutup: () => void }) {
  const [kred, setKred] = useState<KredensialOwner>({ username: '', password: '' });
  const [daftar, setDaftar] = useState<ManifestData[] | null>(null);
  const [yakinBaru, setYakinBaru] = useState(false);
  const cek = useDataTokoMasuk();
  const pakai = usePakaiDataMasuk();
  const baru = useBuatDataBaruMasuk();
  const sibuk = cek.isPending || pakai.isPending || baru.isPending;

  const selesai = (pesan: string) => {
    toast.success(pesan);
    setTimeout(() => window.location.assign('/'), 1200);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !sibuk && onTutup()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="size-5 text-blue-600" /> Ganti atau buat data toko
          </DialogTitle>
          <DialogDescription>
            Untuk Owner. Data toko yang sedang dipakai tidak dihapus: disimpan dulu dan bisa dipakai
            kembali kapan saja. Tutup shift lebih dulu.
          </DialogDescription>
        </DialogHeader>

        {daftar === null ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              cek
                .mutateAsync(kred)
                .then(setDaftar)
                .catch((err: unknown) => toast.error(pesanGalat(err)));
            }}
          >
            <p className="text-sm text-slate-600">
              Masukkan username dan password <b>Owner</b> dari data toko yang sedang dipakai.
            </p>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Username Owner</span>
              <Input
                autoFocus
                autoComplete="username"
                value={kred.username}
                onChange={(e) => setKred({ ...kred, username: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Password Owner</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={kred.password}
                onChange={(e) => setKred({ ...kred, password: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={!kred.username || !kred.password || sibuk}>
                {cek.isPending && <Loader2 className="animate-spin" />} Lanjut
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-slate-800">Buat data toko baru (kosong)</p>
              <p className="mt-1 text-xs text-slate-600">
                Aplikasi kembali ke setup awal seperti baru dipasang. Data yang sedang dipakai
                disimpan dan muncul di daftar di bawah ini untuk dipakai lagi.
              </p>
              {yakinBaru ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={sibuk}
                    onClick={() =>
                      void baru
                        .mutateAsync(kred)
                        .then(() => selesai('Data toko baru dibuat. Kerjakan setup awal.'))
                        .catch((err: unknown) => toast.error(pesanGalat(err)))
                    }
                  >
                    {baru.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Ya, buat data
                    toko baru
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setYakinBaru(false)}>
                    Batal
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="mt-2" onClick={() => setYakinBaru(true)}>
                  <Plus /> Buat data toko baru
                </Button>
              )}
            </div>
            <p className="text-sm font-medium text-slate-800">Data toko lain di komputer ini</p>
            {daftar.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data toko lain yang tersimpan.</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                {daftar.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {d.namaToko || 'Tanpa nama toko'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {d.label} · disimpan {formatWaktu(d.dibuatPada)} ·{' '}
                        {d.pengguna.map((p) => p.username).join(', ') || 'tanpa akun'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sibuk}
                      onClick={() =>
                        void pakai
                          .mutateAsync({ ...kred, id: d.id })
                          .then(() =>
                            selesai(
                              `Data ${d.namaToko || d.label} dipakai. Masuk dengan akun dari data itu.`,
                            ),
                          )
                          .catch((err: unknown) => toast.error(pesanGalat(err)))
                      }
                    >
                      <RotateCcw /> Pakai
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {sibuk && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin" /> Sedang memproses; bisa sampai beberapa
                menit. Jangan tutup halaman ini.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
