import type { JenisHasilCari } from '@sit/shared';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePengguna } from '@/api/auth';
import { ambilData, api } from '@/api/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { bolehAkses, SEMUA_ITEM_MENU } from '@/lib/menu';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

/*
 * K-167: pencarian universal (Ctrl+K). Menu dicari di peramban; barang, pelanggan, pemasok, dan nomor dokumen
 * dicari API sesuai izin pengguna. Panah atas/bawah memilih, Enter membuka, Esc menutup.
 */

const LABEL: Record<JenisHasilCari | 'MENU', string> = {
  MENU: 'Halaman',
  BARANG: 'Barang',
  PELANGGAN: 'Pelanggan',
  PEMASOK: 'Pemasok',
  PENJUALAN: 'Penjualan',
  ORDER: 'Order',
  SURAT_JALAN: 'Surat jalan',
  RETUR: 'Retur',
  VOID: 'Void',
  PENERIMAAN: 'Penerimaan barang',
};

type Baris = {
  jenis: JenisHasilCari | 'MENU';
  judul: string;
  keterangan: string;
  tautan: string | null;
};

function Palet({ onTutup }: { onTutup: () => void }) {
  const pengguna = usePengguna();
  const navigate = useNavigate();
  const [teks, setTeks] = useState('');
  const [indeks, setIndeks] = useState(0);
  const q = useTunda(teks.trim(), 250);
  const hasil = useQuery({
    queryKey: ['cari', q],
    queryFn: async () => ambilData(await api.cari.$get({ query: { q } })),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
  const kecil = teks.trim().toLowerCase();
  const menu: Baris[] = kecil
    ? SEMUA_ITEM_MENU.filter(
        (m) => bolehAkses(pengguna, m.izin) && m.label.toLowerCase().includes(kecil),
      )
        .slice(0, 5)
        .map((m) => ({
          jenis: 'MENU' as const,
          judul: m.label,
          keterangan: m.path,
          tautan: m.path,
        }))
    : [];
  const baris: Baris[] = [...menu, ...((q.length >= 2 ? hasil.data : undefined) ?? [])];
  const aman = Math.min(indeks, Math.max(0, baris.length - 1));

  function buka(b: Baris | undefined) {
    if (!b?.tautan) return;
    onTutup();
    void navigate(b.tautan);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onTutup()}>
      <DialogContent
        className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Cari</DialogTitle>
        <div className="flex items-center gap-2 border-b pr-10 pl-3">
          <Search className="size-4 text-slate-400" />
          <input
            autoFocus
            value={teks}
            onChange={(e) => {
              setTeks(e.target.value);
              setIndeks(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndeks((i) => Math.min(i + 1, baris.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndeks((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                buka(baris[aman]);
              }
            }}
            placeholder="Cari halaman, barang, pelanggan, pemasok, atau nomor dokumen (INV-…, ORD-…)"
            aria-label="Cari di seluruh aplikasi"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-1" role="listbox" aria-label="Hasil cari">
          {teks.trim().length < 2 && (
            <li className="px-3 py-6 text-center text-xs text-slate-400">
              Ketik minimal 2 huruf. Nomor dokumen boleh sebagian, mis. <b>261024-0</b>. Esc =
              tutup.
            </li>
          )}
          {teks.trim().length >= 2 && baris.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-slate-400">
              {hasil.isFetching ? 'Mencari…' : 'Tidak ditemukan.'}
            </li>
          )}
          {baris.map((b, i) => (
            <li
              key={`${b.jenis}-${b.judul}-${i}`}
              role="option"
              aria-selected={i === aman}
              onMouseEnter={() => setIndeks(i)}
              onClick={() => buka(b)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                i === aman ? 'bg-blue-50' : 'hover:bg-slate-50',
                !b.tautan && 'cursor-default',
              )}
            >
              <span className="w-24 shrink-0 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {LABEL[b.jenis]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{b.judul}</span>
                <span className="block truncate text-xs text-slate-500">{b.keterangan}</span>
              </span>
              {i === aman && b.tautan && <CornerDownLeft className="size-3.5 text-slate-400" />}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Tombol cari di topbar; `Ctrl+K` dari halaman mana pun. */
export function KotakCari() {
  const [buka, setBuka] = useState(false);
  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuka(true);
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="flex h-8 min-w-0 shrink items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500 hover:border-slate-300 hover:bg-white lg:w-56 xl:w-72"
        title="Cari di seluruh aplikasi (Ctrl+K)"
        aria-label="Cari (Ctrl+K)"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden truncate lg:inline">Cari barang, pelanggan, nomor…</span>
        <kbd className="ml-auto hidden rounded bg-white px-1 font-mono text-[10px] text-slate-500 shadow-sm lg:inline">
          Ctrl+K
        </kbd>
      </button>
      {buka && <Palet onTutup={() => setBuka(false)} />}
    </>
  );
}
