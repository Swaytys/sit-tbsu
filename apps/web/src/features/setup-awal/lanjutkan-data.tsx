import { LABEL_JENIS_DATA } from '@sit/shared';
import { FolderInput, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useDataSetup, useImporDataSetup, usePakaiDataSetup } from '@/api/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormImpor } from '@/features/pengaturan/tab-data';
import { formatWaktu, ukuranTeks } from '@/lib/format';

/**
 * K-213: setup awal pada komputer baru: lanjutkan data dari perangkat lain (berkas .bonsai) atau data yang sudah
 * tersimpan di Pustaka komputer ini (mis. setelah "Mulai dari nol" atau aplikasi terhapus). Sesudah dipakai, masuk
 * dengan akun dari data itu.
 */
export function LanjutkanData() {
  const [buka, setBuka] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <FolderInput className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <b>Sudah pernah memakai BonsaiUrip?</b> Pindah komputer, aplikasi terhapus, atau ingin
        memakai data lama: lanjutkan data itu tanpa setup dari awal.
      </span>
      <Button type="button" variant="outline" onClick={() => setBuka(true)}>
        Lanjutkan data yang sudah ada
      </Button>
      {buka && <DialogLanjutkan onTutup={() => setBuka(false)} />}
    </div>
  );
}

function selesai(nama: string) {
  toast.success(`Data ${nama} dipakai. Masuk dengan akun dari data itu.`);
  setTimeout(() => window.location.assign('/login'), 1200);
}

function DialogLanjutkan({ onTutup }: { onTutup: () => void }) {
  const daftar = useDataSetup(true);
  const pakai = usePakaiDataSetup();
  const impor = useImporDataSetup();
  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Lanjutkan data yang sudah ada</DialogTitle>
          <DialogDescription>
            Pilih data di komputer ini, atau impor berkas .bonsai dari komputer lain (dibuat di
            Pengaturan › Data › Ekspor). Setelah itu Anda masuk dengan username dan password dari
            data tersebut.
          </DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Data di komputer ini</h3>
          {daftar.isPending ? (
            <Loader2 className="size-5 animate-spin text-slate-400" />
          ) : (daftar.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              Tidak ada data lain yang tersimpan di komputer ini.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(daftar.data ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{d.namaToko || 'Tanpa nama toko'}</p>
                    <p className="text-xs text-slate-500">
                      {LABEL_JENIS_DATA[d.jenis]} · {formatWaktu(d.dibuatPada)} ·{' '}
                      {d.jumlah.penjualan} penjualan · akun:{' '}
                      {d.pengguna.map((p) => p.username).join(', ') || '-'} ·{' '}
                      {ukuranTeks(d.ukuranByte)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pakai.isPending}
                    onClick={() =>
                      void pakai
                        .mutateAsync(d.id)
                        .then(() => selesai(d.namaToko || d.label))
                        .catch((err: unknown) => toast.error(pesanGalat(err)))
                    }
                  >
                    {pakai.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Pakai
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Dari komputer lain (berkas .bonsai)
          </h3>
          <FormImpor
            sibuk={impor.isPending}
            labelTombol="Impor dan pakai"
            onKirim={(berkas, sandi) =>
              void impor
                .mutateAsync({ berkas, sandi })
                .then((m) => selesai(m.namaToko || m.label))
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          />
        </section>
      </DialogContent>
    </Dialog>
  );
}
