import { cn } from '@/lib/utils';

/**
 * K-180: saran alasan sesuai konteks. Klik saran mengisi kotak alasan (masih bisa diubah); pengguna tidak perlu
 * mengetik alasan yang umum berulang-ulang.
 */

export function SaranAlasan({
  saran,
  onPilih,
  className,
}: {
  saran: readonly string[];
  onPilih: (teks: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group" aria-label="Saran alasan">
      {saran.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPilih(s)}
          className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700 hover:border-blue-400 hover:bg-blue-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
