import type { BarisBarang, DrafBarang } from '@sit/shared';
import { FileWarning } from 'lucide-react';
import { useEffect, useEffectEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDesimal, formatWaktu } from '@/lib/format';

/** Pilihan pengguna saat barang yang baru ditambahkan juga ada di draf lain. */
export type HasilCekDraf = { aksi: 'BIARKAN' } | { aksi: 'HAPUS' } | { aksi: 'BUKA'; id: number };

export type TanyaDraf = {
  b: BarisBarang;
  info: DrafBarang;
  diminta: string;
  selesai: (h: HasilCekDraf) => void;
};

/** Dialog peringatan barang yang juga ada di draf lain (K-122 butir 4). */
export function DialogDrafLain({
  t,
  onPilih,
  fokusSesudah,
}: {
  t: TanyaDraf;
  onPilih: (h: HasilCekDraf) => void;
  fokusSesudah: string | undefined;
}) {
  const { b, info } = t;
  const satuan = info.kodeSatuanDasar;
  const milikSaya = info.draf.find((d) => d.milikSaya);

  const tombol = useEffectEvent((e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'b' && milikSaya) {
      e.preventDefault();
      onPilih({ aksi: 'BUKA', id: milikSaya.id });
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => tombol(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <Dialog open onOpenChange={(buka) => !buka && onPilih({ aksi: 'HAPUS' })}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="peringatan-draf-lain"
        onCloseAutoFocus={(e) => {
          if (!fokusSesudah) return;
          e.preventDefault();
          document.getElementById(fokusSesudah)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="size-5 text-amber-600" /> {b.namaBarang} juga ada di draf lain
          </DialogTitle>
          <DialogDescription>
            Barang sudah ditambahkan ke order ini. Stok tersedia{' '}
            <b className="text-red-700">
              {formatDesimal(info.stokTersedia)} {satuan}
            </b>{' '}
            tidak cukup untuk order ini ({formatDesimal(t.diminta)} {satuan}) dan draf di bawah
            sekaligus. Draf belum menahan stok: pembeli yang lebih dulu dibayar yang mendapat
            barangnya.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          {info.draf.map((d) => (
            <li key={d.id} className="rounded-md border p-2">
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  <b>Draf {d.noAntrean}</b>{' '}
                  <span className="font-mono text-xs text-slate-500">{d.nomor}</span> ·{' '}
                  {d.namaPembeli ?? 'pembeli tanpa nama'}
                </span>
                <b className="tabular-nums">
                  {formatDesimal(d.qtyDasar)} {satuan}
                </b>
              </div>
              <p className="text-xs text-slate-500">
                {d.milikSaya ? 'Draf Anda' : `Draf milik ${d.namaPengguna}`}
                {d.diubahPada && ` · diubah ${formatWaktu(d.diubahPada)}`}
                {!d.milikSaya && ' · hubungi dia bila pembelinya masih menunggu'}
              </p>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onPilih({ aksi: 'HAPUS' })}>
            Hapus lagi dari order ini (Esc)
          </Button>
          <div className="flex gap-2">
            {milikSaya && (
              <Button
                variant="outline"
                onClick={() => onPilih({ aksi: 'BUKA', id: milikSaya.id })}
                title="Isian sekarang disimpan sebagai draf, lalu draf itu dibuka untuk dilanjutkan"
              >
                Buka draf {milikSaya.noAntrean} (B)
              </Button>
            )}
            <Button autoFocus onClick={() => onPilih({ aksi: 'BIARKAN' })}>
              Biarkan (Enter)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
