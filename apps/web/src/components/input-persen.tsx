import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Input persen: tampil dengan koma ("18,5 %"), nilai form berupa teks desimal bertitik ("18.5") atau
 * `null` bila kosong. Validasi format tetap lewat skema Zod bersama (mis. `skemaPersen`).
 */
export function InputPersen({
  value,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string | null | undefined;
  onChange: (nilai: string | null) => void;
}) {
  const teks = value === null || value === undefined ? '' : value.replace('.', ',');
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        autoComplete="off"
        className={cn('pr-7 text-right tabular-nums', className)}
        {...props}
        value={teks}
        onChange={(e) => {
          const bersih = e.target.value.replace(/[^\d,.]/g, '').replace('.', ',');
          onChange(bersih === '' ? null : bersih.replace(',', '.'));
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
        %
      </span>
    </div>
  );
}
