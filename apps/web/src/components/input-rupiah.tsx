import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Maksimal 15 digit agar tetap bilangan bulat aman di JavaScript (CLAUDE.md aturan 7). */
const DIGIT_MAKS = 15;

/**
 * Input rupiah: tampil "Rp 1.500.000", nilai form berupa angka bulat atau `null` bila kosong.
 * Pakai: `<InputRupiah {...field} />`.
 */
export function InputRupiah({
  value,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: unknown;
  onChange: (nilai: number | null) => void;
}) {
  const teks = typeof value === 'number' ? value.toLocaleString('id-ID') : '';
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">
        Rp
      </span>
      <Input
        inputMode="numeric"
        autoComplete="off"
        className={cn('pl-9 text-right tabular-nums', className)}
        {...props}
        value={teks}
        onChange={(e) => {
          const digit = e.target.value.replace(/\D/g, '').slice(0, DIGIT_MAKS);
          onChange(digit === '' ? null : Number(digit));
        }}
      />
    </div>
  );
}
