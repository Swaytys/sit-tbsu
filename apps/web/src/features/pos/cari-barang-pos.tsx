import { formatRupiah, type BarisBarang } from '@sit/shared';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { useDaftarBarang } from '@/api/barang';
import { ambilIsi, api, pesanGalat } from '@/api/client';
import { formatDesimal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import { opsiDariBarang, satuanAwal, uraikanCari } from './model';

const JUMLAH_HASIL = 8;

/** Pilih hasil terbaik: kode/barcode persis sama lebih dulu, selain itu hasil pertama. */
function terbaik(daftar: BarisBarang[], kata: string): BarisBarang | undefined {
  const k = kata.toLowerCase();
  return (
    daftar.find((b) => b.kode.toLowerCase() === k || b.barcode?.toLowerCase() === k) ?? daftar[0]
  );
}

/**
 * Kotak cari barang layar POS (K-073). "3*semen" atau "semen*3" = qty 3; F1 menyisipkan "*". Enter langsung menambah hasil yang disorot; bila
 * hasil belum tiba (mengetik cepat / scanner barcode), Enter menunggu jawaban server lalu memakai kecocokan
 * terbaik — tidak ada ketikan yang hilang. Enter pada kotak kosong = lanjut ke pembayaran.
 */
export function CariBarangPos({
  id,
  aktif,
  onTambah,
  onKosongEnter,
  onTurun,
  onEsc,
  onFokus,
  tierBawaan,
  placeholder = 'Ketik nama/kode atau scan barcode… (semen*3 = qty 3, F1 = *)',
}: {
  id: string;
  aktif: boolean;
  /** Tier untuk harga yang ditampilkan di hasil cari. */
  tierBawaan: number | null;
  onTambah: (b: BarisBarang, qty: string) => void;
  onKosongEnter: () => void;
  onTurun: () => void;
  onEsc: () => void;
  onFokus: () => void;
  placeholder?: string;
}) {
  const [teks, setTeks] = useState('');
  const [sorot, setSorot] = useState(0);
  const kotak = useRef<HTMLInputElement>(null);

  // F1 di mana pun: fokus ke kotak cari dan sisipkan "*" (qty) di posisi kursor.
  useEffect(() => {
    function f1(e: globalThis.KeyboardEvent) {
      if (e.key !== 'F1') return;
      e.preventDefault();
      const el = kotak.current;
      if (!el) return;
      const fokus = document.activeElement === el;
      el.focus();
      setTeks((t) => {
        const awal = fokus ? (el.selectionStart ?? t.length) : t.length;
        const akhir = fokus ? (el.selectionEnd ?? t.length) : t.length;
        const baru = `${t.slice(0, awal)}*${t.slice(akhir)}`;
        requestAnimationFrame(() => el.setSelectionRange(awal + 1, awal + 1));
        return baru;
      });
    }
    window.addEventListener('keydown', f1);
    return () => window.removeEventListener('keydown', f1);
  }, []);
  const [mencari, setMencari] = useState(false);
  const { qty, kata } = uraikanCari(teks);
  const kataTunda = useTunda(kata, 100);
  const daftar = useDaftarBarang({
    cari: kataTunda,
    idKategori: null,
    status: 'AKTIF',
    perluTinjau: false,
    halaman: 1,
    perHalaman: JUMLAH_HASIL,
  });
  const segar =
    kata !== '' && kataTunda === kata && !daftar.isPlaceholderData && !daftar.isFetching;
  const hasil = segar ? (daftar.data?.data ?? []) : [];

  function tambah(b: BarisBarang | undefined) {
    if (!b) {
      toast.error(`Barang "${kata}" tidak ditemukan.`);
      return;
    }
    onTambah(b, qty);
    setTeks('');
    setSorot(0);
  }

  async function enter() {
    if (!kata) {
      onKosongEnter();
      return;
    }
    if (segar) {
      tambah(hasil[sorot] ?? terbaik(hasil, kata));
      return;
    }
    setMencari(true);
    try {
      const r = await ambilIsi(
        await api.barang.$get({
          query: { cari: kata, status: 'AKTIF', halaman: '1', perHalaman: String(JUMLAH_HASIL) },
        }),
      );
      tambah(terbaik(r.data, kata));
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setMencari(false);
    }
  }

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hasil.length > 0) setSorot((s) => Math.min(s + 1, hasil.length - 1));
      else if (!teks) onTurun();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSorot((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void enter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (teks) setTeks('');
      else onEsc();
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        ref={kotak}
        value={teks}
        onChange={(e) => {
          setTeks(e.target.value);
          setSorot(0);
        }}
        onKeyDown={tombol}
        onFocus={onFokus}
        placeholder={placeholder}
        aria-label="Cari barang"
        autoComplete="off"
        className={cn(
          'h-10 w-full rounded-md border bg-white pr-3 pl-8 text-sm outline-none',
          aktif ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300',
        )}
      />
      {qty !== '1' && kata && (
        <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-blue-600 px-1.5 text-xs font-bold text-white">
          qty {formatDesimal(qty)}
        </span>
      )}
      {aktif && kata && (
        <ul
          role="listbox"
          aria-label="Hasil cari barang"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg"
        >
          {hasil.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              {segar && !mencari ? 'Tidak ada barang yang cocok.' : 'Mencari…'}
            </li>
          )}
          {hasil.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === sorot}
              onMouseDown={(e) => {
                e.preventDefault();
                tambah(b);
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm',
                i === sorot && 'bg-blue-50',
              )}
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-slate-500">{b.kode}</span>{' '}
                <span className="font-medium">{b.namaBarang}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                {(() => {
                  // K-091: satuan yang akan dipakai (barcode satuan jual / satuan bawaan) dan harganya.
                  const o = opsiDariBarang(b).find((x) => x.idSatuanJual === satuanAwal(b));
                  const h =
                    o?.hargaTier.find((x) => x.idTingkatHarga === tierBawaan) ?? o?.hargaTier[0];
                  return `${formatRupiah(h?.hargaJual ?? 0)}/${o?.kodeSatuan ?? b.kodeSatuan}`;
                })()}{' '}
                · stok {formatDesimal(b.stokTersedia)} {b.kodeSatuan}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
