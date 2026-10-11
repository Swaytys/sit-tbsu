import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Satu langkah bernomor pada panduan penyiapan (K-105): lingkaran bernomor yang berubah menjadi centang hijau
 * bila langkahnya sudah beres. Dipakai untuk penyiapan yang harus berurutan (saluran kode persetujuan,
 * printer struk), supaya pengguna selalu tahu sedang di langkah mana dan apa yang belum selesai.
 */
export function Langkah({
  no,
  judul,
  selesai,
  children,
}: {
  no: number;
  judul: string;
  selesai: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3" data-selesai={selesai}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          selesai ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700',
        )}
        aria-label={selesai ? `Langkah ${no} selesai` : `Langkah ${no} belum selesai`}
      >
        {selesai ? <CheckCircle2 className="size-4" /> : no}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pb-1">
        <p className="text-sm font-semibold text-slate-800">
          Langkah {no}. {judul}
        </p>
        {children}
      </div>
    </div>
  );
}

/** Kotak hasil/peringatan yang tetap tampil di layar (bukan toast), supaya petunjuk berikutnya terbaca. */
export function KotakHasil({ berhasil, children }: { berhasil: boolean; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border p-2 text-sm',
        berhasil
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800',
      )}
    >
      {berhasil ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}
