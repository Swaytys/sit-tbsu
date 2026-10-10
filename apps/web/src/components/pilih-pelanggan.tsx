import type { Pelanggan } from '@sit/shared';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { useDaftarPelanggan } from '@/api/mitra';
import { Input } from '@/components/ui/input';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

/**
 * Kotak cari pelanggan aktif (kode, nama, no. HP) dengan keyboard (↑/↓/Enter/Esc). Bila sudah terpilih,
 * menampilkan nama pelanggan dengan tombol hapus pilihan.
 */
export function PilihPelanggan({
  terpilih,
  onPilih,
  label = 'Cari pelanggan',
  disabled,
}: {
  terpilih: { id: number; nama: string } | null;
  onPilih: (p: Pelanggan | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [cari, setCari] = useState('');
  const [buka, setBuka] = useState(false);
  const [sorot, setSorot] = useState(0);
  const cariTertunda = useTunda(cari, 200);
  const daftar = useDaftarPelanggan({
    cari: cariTertunda,
    status: 'AKTIF',
    halaman: 1,
    perHalaman: 10,
  });
  const segar = cariTertunda === cari && !daftar.isPlaceholderData && !daftar.isFetching;
  const hasil = segar ? (daftar.data?.data ?? []) : [];
  const tampil = buka && cari.trim() !== '';

  function pilih(p: Pelanggan | undefined) {
    if (!p) return;
    onPilih(p);
    setCari('');
    setBuka(false);
    setSorot(0);
  }

  if (terpilih) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border bg-slate-50 px-3 text-sm">
        <span className="flex-1 truncate font-medium" data-testid="pelanggan-terpilih">
          {terpilih.nama}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onPilih(null)}
            aria-label="Hapus pilihan pelanggan"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={cari}
        disabled={disabled}
        onChange={(e) => {
          setCari(e.target.value);
          setBuka(true);
          setSorot(0);
        }}
        onFocus={() => setBuka(true)}
        onBlur={() => setTimeout(() => setBuka(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSorot((s) => Math.min(s + 1, hasil.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSorot((s) => Math.max(s - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pilih(hasil[sorot]);
          } else if (e.key === 'Escape') {
            setBuka(false);
          }
        }}
        placeholder="Cari pelanggan (nama, kode, no. HP)…"
        aria-label={label}
        className="pl-8"
        role="combobox"
        aria-expanded={tampil}
        aria-autocomplete="list"
      />
      {tampil && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg"
        >
          {hasil.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              {segar ? 'Tidak ada pelanggan yang cocok.' : 'Mencari…'}
            </li>
          )}
          {hasil.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === sorot}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm',
                i === sorot ? 'bg-blue-50' : 'hover:bg-slate-50',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pilih(p);
              }}
              onMouseEnter={() => setSorot(i)}
            >
              <span className="min-w-0">
                <span className="font-mono text-xs text-slate-500">{p.kode}</span>{' '}
                <span className="font-medium">{p.namaPelanggan}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">{p.namaGolongan ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
