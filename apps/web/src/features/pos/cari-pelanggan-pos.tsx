import type { Pelanggan } from '@sit/shared';
import { useState, type KeyboardEvent } from 'react';
import { useDaftarPelanggan } from '@/api/mitra';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

/**
 * Pilih pelanggan di layar POS (F4). Ketik nama/kode/no. HP, ↑/↓, Enter memilih; Enter pada kotak kosong =
 * pembeli umum (tanpa pelanggan); Esc batal.
 */
export function CariPelangganPos({
  id,
  onPilih,
  onEsc,
}: {
  id: string;
  onPilih: (p: Pelanggan | null) => void;
  onEsc: () => void;
}) {
  const [teks, setTeks] = useState('');
  const [sorot, setSorot] = useState(0);
  const cari = useTunda(teks.trim(), 120);
  const daftar = useDaftarPelanggan({ cari, status: 'AKTIF', halaman: 1, perHalaman: 8 });
  const segar = cari === teks.trim() && !daftar.isPlaceholderData && !daftar.isFetching;
  const hasil = teks.trim() && segar ? (daftar.data?.data ?? []) : [];

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSorot((s) => Math.min(s + 1, Math.max(0, hasil.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSorot((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!teks.trim()) onPilih(null);
      else if (hasil[sorot]) onPilih(hasil[sorot]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEsc();
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        autoFocus
        value={teks}
        onChange={(e) => {
          setTeks(e.target.value);
          setSorot(0);
        }}
        onKeyDown={tombol}
        placeholder="Cari pelanggan… (Enter kosong = pembeli umum, Esc batal)"
        aria-label="Cari pelanggan"
        autoComplete="off"
        className="h-9 w-full rounded-md border border-blue-500 px-2 text-sm ring-2 ring-blue-200 outline-none"
      />
      {teks.trim() && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg"
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
              onMouseDown={(e) => {
                e.preventDefault();
                onPilih(p);
              }}
              className={cn('cursor-pointer px-3 py-1.5 text-sm', i === sorot && 'bg-blue-50')}
            >
              <span className="font-mono text-xs text-slate-500">{p.kode}</span>{' '}
              <span className="font-medium">{p.namaPelanggan}</span>
              {p.namaGolongan && (
                <span className="text-xs text-slate-500"> · {p.namaGolongan}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
