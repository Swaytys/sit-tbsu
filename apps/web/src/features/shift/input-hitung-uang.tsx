import { formatRupiah, PECAHAN_UANG } from '@sit/shared';
import { Eraser, Minus, Plus, X } from 'lucide-react';
import { InputRupiah } from '@/components/input-rupiah';
import { cn } from '@/lib/utils';
import { HITUNG_KOSONG, totalHitung, type NilaiHitung } from './hitung-uang';

const teksPecahan = (p: number) => formatRupiah(p).replace('Rp ', 'Rp');

/**
 * Hitung uang laci per pecahan atau total (K-121, K-135). Keyboard: ketik jumlah lembar, ↑/↓ pindah pecahan,
 * +/− ubah 1, Del kosongkan baris, Shift+Del kosongkan semua. Tombol −/+/× tidak ikut urutan Tab (cukup
 * mengetik angka).
 */
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
  const idBaris = (p: number) => `${id}-p-${p}`;
  const aturLembar = (p: number, n: number) =>
    onUbah({
      ...nilai,
      rincian: { ...nilai.rincian, [String(p)]: Math.max(0, Math.min(999_999, n)) },
    });
  const hapusSemua = () => onUbah({ ...HITUNG_KOSONG, mode: nilai.mode });
  const adaIsi = total !== null && total > 0;

  return (
    <div className="space-y-2" data-testid={`hitung-${id}`}>
      <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 text-sm" role="radiogroup">
        {(
          [
            ['PECAHAN', 'Per pecahan'],
            ['TOTAL', 'Total saja'],
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
          aria-label="Total uang shift"
          value={nilai.total}
          onChange={(v) => onUbah({ ...nilai, total: v })}
          onKeyDown={(e) => {
            if (e.key === 'Delete' && e.shiftKey) {
              e.preventDefault();
              hapusSemua();
            }
          }}
          autoFocus={autoFocus}
          className="h-12 text-2xl font-bold"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PECAHAN_UANG.map((p, i) => {
            const n = nilai.rincian[String(p)] ?? 0;
            return (
              <div key={p} className="flex items-center gap-1 text-sm">
                <label
                  htmlFor={idBaris(p)}
                  className="w-20 shrink-0 text-right font-medium tabular-nums"
                >
                  {teksPecahan(p)}
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Kurangi ${teksPecahan(p)}`}
                  onClick={() => aturLembar(p, n - 1)}
                  className="flex size-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  id={idBaris(p)}
                  aria-label={`Jumlah ${teksPecahan(p)}`}
                  inputMode="numeric"
                  autoFocus={autoFocus && i === 0}
                  value={n === 0 ? '' : String(n)}
                  placeholder="0"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    aturLembar(p, Number(e.target.value.replace(/\D/g, '').slice(0, 6) || '0'))
                  }
                  onKeyDown={(e) => {
                    const pindah = (k: number) => {
                      const target = PECAHAN_UANG[i + k];
                      if (target !== undefined) document.getElementById(idBaris(target))?.focus();
                    };
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      pindah(1);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      pindah(-1);
                    } else if (e.key === '+' || e.key === '=') {
                      e.preventDefault();
                      aturLembar(p, n + 1);
                    } else if (e.key === '-') {
                      e.preventDefault();
                      aturLembar(p, n - 1);
                    } else if (e.key === 'Delete') {
                      e.preventDefault();
                      if (e.shiftKey) hapusSemua();
                      else aturLembar(p, 0);
                    }
                  }}
                  className="h-8 w-14 rounded border px-2 text-right tabular-nums"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Tambah ${teksPecahan(p)}`}
                  onClick={() => aturLembar(p, n + 1)}
                  className="flex size-7 items-center justify-center rounded border text-slate-500 hover:bg-slate-100"
                >
                  <Plus className="size-3.5" />
                </button>
                <span className="ml-auto min-w-0 truncate text-xs text-slate-500 tabular-nums">
                  {n > 0 ? formatRupiah(n * p) : ''}
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Kosongkan ${teksPecahan(p)}`}
                  title="Kosongkan baris (Del)"
                  onClick={() => aturLembar(p, 0)}
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600',
                    n === 0 && 'invisible',
                  )}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {nilai.mode === 'PECAHAN' ? (
            <>
              <kbd className="font-mono">↑↓</kbd> pindah · <kbd className="font-mono">+ −</kbd> ubah
              1 · <kbd className="font-mono">Del</kbd> kosongkan ·{' '}
            </>
          ) : null}
          <kbd className="font-mono">Shift+Del</kbd> kosongkan semua
        </span>
        <button
          type="button"
          tabIndex={-1}
          disabled={!adaIsi}
          onClick={hapusSemua}
          className="flex items-center gap-1 rounded border px-2 py-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
        >
          <Eraser className="size-3.5" /> Kosongkan semua
        </button>
      </div>
      <div className="flex items-baseline justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
        <span className="text-sm">Total uang shift</span>
        <span className="text-2xl font-bold tabular-nums" data-testid={`total-${id}`}>
          {total === null ? 'Rp 0' : formatRupiah(total)}
        </span>
      </div>
    </div>
  );
}
