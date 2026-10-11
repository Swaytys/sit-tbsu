import type { Pelanggan } from '@sit/shared';
import { UserPlus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useDaftarPelanggan } from '@/api/mitra';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

/**
 * Pilih pelanggan di layar POS (F4 atau klik nama pelanggan). Keyboard: ketik nama/kode/no. HP, ↑/↓, Enter
 * memilih, Esc batal; Enter pada kotak kosong = pembeli umum (bila `wajib` tidak diisi). Mouse: daftar
 * langsung tampil tanpa mengetik dan tiap baris bisa diklik (K-104).
 */
export function CariPelangganPos({
  id,
  wajib = false,
  onPilih,
  onTambahBaru,
  onEsc,
}: {
  id: string;
  /** Pengantaran: harus pelanggan terdata, pilihan "pembeli umum" tidak ada. */
  wajib?: boolean;
  onPilih: (p: Pelanggan | null) => void;
  onTambahBaru: () => void;
  onEsc: () => void;
}) {
  const [teks, setTeks] = useState('');
  const [sorot, setSorot] = useState(0);
  const cari = useTunda(teks.trim(), 120);
  const daftar = useDaftarPelanggan({ cari, status: 'AKTIF', halaman: 1, perHalaman: 8 });
  const segar = cari === teks.trim() && !daftar.isPlaceholderData && !daftar.isFetching;
  const hasil = segar ? (daftar.data?.data ?? []) : [];
  const mengetik = teks.trim() !== '';

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSorot((s) => Math.min(s + 1, Math.max(0, hasil.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSorot((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Kotak kosong: Enter = pembeli umum. Daftar yang tampil tanpa mengetik hanya untuk diklik.
      if (!mengetik) {
        if (!wajib) onPilih(null);
      } else if (hasil[sorot]) onPilih(hasil[sorot]);
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
        placeholder={
          wajib
            ? 'Cari pelanggan: nama, kode, atau No. HP… (Esc batal)'
            : 'Cari pelanggan… (Enter kosong = pembeli umum, Esc batal)'
        }
        aria-label="Cari pelanggan"
        autoComplete="off"
        className="h-9 w-full rounded-md border border-blue-500 px-2 text-sm ring-2 ring-blue-200 outline-none"
      />
      <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
        <ul role="listbox" aria-label="Pelanggan" className="max-h-72 overflow-y-auto">
          {hasil.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              {!segar
                ? 'Mencari…'
                : mengetik
                  ? 'Tidak ada pelanggan yang cocok.'
                  : 'Belum ada pelanggan.'}
            </li>
          )}
          {hasil.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={mengetik && i === sorot}
              // onMouseDown: memilih sebelum kotak cari kehilangan fokus.
              onMouseDown={(e) => {
                e.preventDefault();
                onPilih(p);
              }}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm hover:bg-blue-50',
                mengetik && i === sorot && 'bg-blue-50',
              )}
            >
              <div>
                <span className="font-mono text-xs text-slate-500">{p.kode}</span>{' '}
                <span className="font-medium">{p.namaPelanggan}</span>
                {p.namaGolongan && (
                  <span className="text-xs text-slate-500"> · {p.namaGolongan}</span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">
                {p.noHp ?? 'tanpa No. HP'}
                {p.alamat && ` · ${p.alamat}`}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t bg-slate-50 p-1.5">
          {!wajib && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPilih(null);
              }}
              className="rounded border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              Pembeli umum
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onTambahBaru();
            }}
            className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            <UserPlus className="size-3.5" /> Pelanggan baru
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onEsc();
            }}
            className="ml-auto rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
          >
            Batal (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
