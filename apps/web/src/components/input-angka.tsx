import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Input angka untuk kolom yang divalidasi `z.coerce.number()` (nilai form bisa angka atau teks).
 * Pakai: `<InputAngka {...field} />`.
 */
export function InputAngka({
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value'> & { value: unknown }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      {...props}
      value={typeof value === 'number' || typeof value === 'string' ? value : ''}
    />
  );
}
