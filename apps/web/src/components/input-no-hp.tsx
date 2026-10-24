import { KODE_NEGARA, pecahNoHp } from '@sit/shared';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * K-137: isian No. HP dua bagian: kode negara (bawaan +62) + nomor tanpa 0 di depan. Nilai form = format
 * internasional `+62812…` (sama dengan yang disimpan API). Angka 0 di depan dibuang otomatis dengan pemberitahuan;
 * selain angka diabaikan; paling banyak 15 angka termasuk kode negara.
 */
export function InputNoHp({
  value,
  onChange,
  id,
  label = 'No. HP',
  disabled,
  autoFocus,
  className,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const awal = pecahNoHp(value);
  const [kode, setKode] = useState(awal.kode);
  const [pesan, setPesan] = useState<string | null>(null);
  const nomor = pecahNoHp(value).nomor;
  const maks = 15 - (kode.length - 1);

  function ubah(k: string, teks: string) {
    let angka = teks.replace(/\D/g, '');
    if (angka.startsWith('0')) {
      angka = angka.replace(/^0+/, '');
      setPesan('Angka 0 di depan dibuang: kode negara sudah mewakilinya.');
    } else if (teks !== '' && /\D/.test(teks.replace(/[\s-]/g, ''))) {
      setPesan('Hanya angka.');
    } else {
      setPesan(null);
    }
    angka = angka.slice(0, 15 - (k.length - 1));
    onChange(angka === '' ? '' : `${k}${angka}`);
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-1.5">
        <select
          aria-label="Kode negara"
          disabled={disabled}
          className="h-9 rounded-md border border-slate-300 bg-white px-1.5 text-sm"
          value={kode}
          onChange={(e) => {
            setKode(e.target.value);
            ubah(e.target.value, nomor);
          }}
        >
          {KODE_NEGARA.map((k) => (
            <option key={k.kode} value={k.kode} title={k.nama}>
              {k.kode}
            </option>
          ))}
        </select>
        <Input
          id={id}
          inputMode="tel"
          autoFocus={autoFocus}
          disabled={disabled}
          // Dengan `id`, nama aksesnya dari <label htmlFor> form; tanpa itu dari `label`.
          aria-label={id ? undefined : label}
          placeholder="812 3456 7890"
          maxLength={maks + 4}
          value={nomor}
          onChange={(e) => ubah(kode, e.target.value)}
        />
      </div>
      {pesan && <p className="text-xs text-amber-700">{pesan}</p>}
    </div>
  );
}
