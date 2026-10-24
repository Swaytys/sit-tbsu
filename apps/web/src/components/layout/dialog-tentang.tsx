import { CATATAN_RILIS, VERSI_APLIKASI } from '@sit/shared';
import { useQuery } from '@tanstack/react-query';
import { ambilData, api } from '@/api/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatTanggal } from '@/lib/format';

/**
 * K-166: versi aplikasi, status migrasi database, dan catatan perubahan. Versi web dan versi server dibandingkan:
 * berbeda = halaman perlu dimuat ulang (Ctrl+F5) setelah server diperbarui.
 */
export function DialogTentang({ onTutup }: { onTutup: () => void }) {
  const sehat = useQuery({
    queryKey: ['health'],
    queryFn: async () => ambilData(await api.health.$get()),
  });
  const s = sehat.data;
  const beda = s !== undefined && s.versi !== VERSI_APLIKASI;
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tentang BonsaiUrip</DialogTitle>
          <DialogDescription>
            Versi tampilan {VERSI_APLIKASI}
            {s && (
              <>
                {' '}
                · server {s.versi} · struktur database {s.migrasi.terpasang ?? '?'}/
                {s.migrasi.tersedia}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {beda && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            Server sudah diperbarui ke versi {s.versi}. Tekan Ctrl+F5 untuk memuat tampilan terbaru.
          </p>
        )}
        {s && s.migrasi.terpasang !== s.migrasi.tersedia && (
          <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            Struktur database belum lengkap ({s.migrasi.terpasang ?? 0} dari {s.migrasi.tersedia}).
            Jalankan pembaruan server sampai selesai.
          </p>
        )}
        <div className="space-y-3">
          {CATATAN_RILIS.map((c) => (
            <section key={c.versi}>
              <h3 className="text-sm font-semibold text-slate-800">
                Versi {c.versi} · {formatTanggal(c.tanggal)}
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                {c.isi.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
