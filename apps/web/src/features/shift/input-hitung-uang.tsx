import { formatRupiah, PECAHAN_UANG } from '@sit/shared';
import { InputRupiah } from '@/components/input-rupiah';
import { cn } from '@/lib/utils';
import { totalHitung, type NilaiHitung } from './hitung-uang';

const teksPecahan = (p: number) => formatRupiah(p).replace('Rp ', 'Rp');

export function InputHitungUang({
  id,
  nilai,
  onUbah,
  autoFocus,
}: {
  id: string;
  nilai: NilaiHitung;
  onUbah: (n: NilaiHitung) => void;
  autoFocus?: boolean;
}) {
  const total = totalHitung(nilai);
  return (
    <div className="space-y-2" data-testid={`hitung-${id}`}>
      <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 text-sm" role="radiogroup">
        {(
          [
            ['PECAHAN', 'Hitung per pecahan'],
            ['TOTAL', 'Ketik total saja'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={nilai.mode === m}
            onClick={() => onUbah({ ...nilai, mode: m })}
            className={cn(
              'flex-1 rounded px-2 py-1',
              nilai.mode === m ? 'bg-white font-semibold shadow-sm' : 'text-slate-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {nilai.mode === 'TOTAL' ? (
        <InputRupiah
          id={`${id}-total`}
          aria-label="Total uang di laci"
          value={nilai.total}
          onChange={(v) => onUbah({ ...nilai, total: v })}
          autoFocus={autoFocus}
          className="h-12 text-2xl font-bold"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PECAHAN_UANG.map((p, i) => {
            const n = nilai.rincian[String(p)] ?? 0;
            return (
              <label key={p} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {teksPecahan(p)}
                </span>
                <span className="text-slate-400">×</span>
                <input
                  id={i === 0 ? `${id}-pecahan` : undefined}
                  aria-label={`Jumlah ${teksPecahan(p)}`}
                  inputMode="numeric"
                  autoFocus={autoFocus && i === 0}
                  value={n === 0 ? '' : String(n)}
                  placeholder="0"
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, '').slice(0, 6) || '0');
                    onUbah({ ...nilai, rincian: { ...nilai.rincian, [String(p)]: v } });
                  }}
                  className="h-8 w-16 rounded border px-2 text-right tabular-nums"
                />
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                  {n > 0 ? formatRupiah(n * p) : ''}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div className="flex items-baseline justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
        <span className="text-sm">Total uang di laci</span>
        <span className="text-2xl font-bold tabular-nums" data-testid={`total-${id}`}>
          {total === null ? 'Rp 0' : formatRupiah(total)}
        </span>
      </div>
    </div>
  );
}
