import {
  formatRupiah,
  type HargaTierBarang,
  type MetodeHarga,
  type TingkatHarga,
} from '@sit/shared';
import { ChevronDown } from 'lucide-react';
import { InputPersen } from '@/components/input-persen';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isianSah, type IsianHarga } from './isian-harga';

const LABEL_SINGKAT: Record<MetodeHarga, string> = { TETAP: 'Rp', IKUT_TIER: 'Tier', MARKUP: '%' };

export function PilihMetode({
  nilai,
  onUbah,
  t,
  label,
}: {
  nilai: MetodeHarga;
  onUbah: (m: MetodeHarga) => void;
  t: TingkatHarga;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-16 justify-between px-2 text-xs"
          aria-label={label}
        >
          {LABEL_SINGKAT[nilai]}
          <ChevronDown className="size-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Cara menentukan harga {t.nama}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={nilai} onValueChange={(v) => onUbah(v as MetodeHarga)}>
          <DropdownMenuRadioItem value="TETAP">Harga tetap (Rp)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="IKUT_TIER">
            Ikut markup tier
            {t.markupDefaultPersen ? ` (+${formatDesimal(t.markupDefaultPersen)}%)` : ''}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="MARKUP">Markup sendiri (%)</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Kotak isian sesuai metode: rupiah (TETAP), persen (MARKUP), atau harga hasil hitung (IKUT_TIER). */
export function IsianSel({
  isi,
  h,
  onUbah,
  label,
  berubah,
  className,
}: {
  isi: IsianHarga;
  h: HargaTierBarang | undefined;
  onUbah: (isi: IsianHarga) => void;
  label: string;
  berubah: boolean;
  className?: string;
}) {
  const salah = berubah && !isianSah(isi);
  const gaya = cn(
    'h-8 text-sm',
    berubah && 'border-amber-300 bg-amber-50',
    salah && 'border-red-400',
    className,
  );
  if (isi.metode === 'TETAP') {
    return (
      <InputRupiah
        value={isi.hargaTetap}
        onChange={(v) => onUbah({ ...isi, hargaTetap: v })}
        aria-label={label}
        placeholder="Wajib diisi"
        className={gaya}
      />
    );
  }
  if (isi.metode === 'MARKUP') {
    return (
      <InputPersen
        value={isi.markupPersen}
        onChange={(v) => onUbah({ ...isi, markupPersen: v })}
        aria-label={`${label} (markup %)`}
        className={gaya}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex items-center justify-end rounded-md border border-dashed px-3 tabular-nums text-slate-500',
        gaya,
      )}
      aria-label={label}
    >
      {berubah && h?.metode !== 'IKUT_TIER'
        ? 'dihitung saat simpan'
        : h
          ? formatRupiah(h.hargaJual)
          : '—'}
    </div>
  );
}
