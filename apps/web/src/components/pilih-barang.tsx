import type { BarisBarang } from '@sit/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useDaftarBarang } from '@/api/barang';
import { Input } from '@/components/ui/input';
import { formatDesimal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

/**
 * Kotak cari barang (kode, nama, barcode, merk, kategori, atribut; K-108) dengan daftar hasil; bisa dipakai penuh dengan keyboard:
 * ketik → ↑/↓ → Enter memilih, Esc menutup. Hanya barang AKTIF.
 */
export function PilihBarang({
  onPilih,
  saring,
  placeholder = 'Cari barang (nama, kode, barcode, merk, kategori, atribut)…',
  label = 'Cari barang',
  disabled,
  idInput,
  hanyaRusak,
}: {
  onPilih: (b: BarisBarang) => void;
  /** Hanya tampilkan barang yang lolos saringan (mis. hanya barang titipan pemasok tertentu). */
  saring?: (b: BarisBarang) => boolean;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  /** `id` input, mis. agar layar kasir bisa memfokuskannya dengan F2. */
  idInput?: string;
  /** Hanya barang yang punya stok rusak (pemusnahan, retur ke pemasok). */
  hanyaRusak?: boolean;
}) {
  const [cari, setCari] = useState('');
  const [buka, setBuka] = useState(false);
  const [sorot, setSorot] = useState(0);
  const cariTertunda = useTunda(cari, 200);
  const daftar = useDaftarBarang({
    cari: cariTertunda,
    idKategori: null,
    status: 'AKTIF',
    perluTinjau: false,
    adaRusak: hanyaRusak,
    halaman: 1,
    perHalaman: 20,
  });
  // Hasil hanya dipakai bila sudah sesuai kata kunci terbaru (bukan data lama saat pencarian berjalan),
  // agar Enter tidak memilih barang yang salah.
  const segar = cariTertunda === cari && !daftar.isPlaceholderData && !daftar.isFetching;
  const hasil = segar
    ? (daftar.data?.data ?? []).filter((b) => !saring || saring(b)).slice(0, 10)
    : [];
  const tampil = buka && cari.trim() !== '';

  function pilih(b: BarisBarang | undefined) {
    if (!b) return;
    onPilih(b);
    setCari('');
    setBuka(false);
    setSorot(0);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        id={idInput}
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
        placeholder={placeholder}
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
              {segar ? 'Tidak ada barang yang cocok.' : 'Mencari…'}
            </li>
          )}
          {hasil.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === sorot}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm',
                i === sorot ? 'bg-blue-50' : 'hover:bg-slate-50',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pilih(b);
              }}
              onMouseEnter={() => setSorot(i)}
            >
              <span className="min-w-0">
                <span className="font-mono text-xs text-slate-500">{b.kode}</span>{' '}
                <span className="font-medium">{b.namaBarang}</span>
                {b.namaMerk && <span className="text-xs text-slate-500"> · {b.namaMerk}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                {hanyaRusak
                  ? `rusak ${formatDesimal(b.stokRusak)} ${b.kodeSatuan}`
                  : `stok ${formatDesimal(b.stokTersedia)} ${b.kodeSatuan}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
