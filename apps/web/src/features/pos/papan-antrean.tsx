import { formatRupiah, type TiketAntrean } from '@sit/shared';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSekarang } from './use-sekarang';

const MAKS_BARIS = 4;

function umurMenit(t: TiketAntrean, sekarang: number): number {
  if (!t.waktuMasukAntrean) return 0;
  return Math.max(0, Math.floor((sekarang - new Date(t.waktuMasukAntrean).getTime()) / 60_000));
}

/**
 * Papan antrean (K-073): tiket order FIFO yang langsung menampilkan isi barang, total, dan lama menunggu,
 * agar kasir mengenali pembeli dari isi belanjaannya tanpa membuka detail. Keyboard: panah memilih tiket,
 * ketik nomor antrean lalu Enter untuk langsung memanggil nomor itu, Enter memproses, Esc keluar.
 */
export function PapanAntrean({
  id,
  tiket,
  indeks,
  onIndeks,
  onProses,
  onKeluar,
  onFokus,
  aktif,
  idTransaksi,
  idSaya,
  kolom,
  pengantaran = false,
}: {
  id: string;
  tiket: TiketAntrean[];
  indeks: number;
  onIndeks: (i: number) => void;
  onProses: (t: TiketAntrean) => void;
  onKeluar: () => void;
  onFokus: () => void;
  aktif: boolean;
  /** Order yang sedang dibayar di layar ini. */
  idTransaksi: number | null;
  idSaya: number;
  kolom: number;
  pengantaran?: boolean;
}) {
  const sekarang = useSekarang();
  const [nomor, setNomor] = useState('');

  // Nomor yang diketik terhapus sendiri bila tidak dilanjutkan.
  useEffect(() => {
    if (!nomor) return;
    const t = setTimeout(() => setNomor(''), 3000);
    return () => clearTimeout(t);
  }, [nomor]);

  const idSorot = tiket[indeks]?.id;
  useEffect(() => {
    if (idSorot !== undefined) {
      document.getElementById(`tiket-${idSorot}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [idSorot]);

  function proses(i: number) {
    const t = tiket[i];
    if (!t) return;
    onIndeks(i);
    onProses(t);
  }

  function tombol(e: KeyboardEvent<HTMLDivElement>) {
    const akhir = tiket.length - 1;
    const geser: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: kolom,
      ArrowUp: -kolom,
    };
    const g = geser[e.key];
    if (g !== undefined) {
      e.preventDefault();
      onIndeks(Math.max(0, Math.min(akhir, indeks + g)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onIndeks(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onIndeks(Math.max(0, akhir));
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      setNomor((n) => (n + e.key).slice(-4));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setNomor((n) => n.slice(0, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (nomor) {
        const i = tiket.findIndex((t) => t.noAntrean === Number(nomor));
        setNomor('');
        if (i < 0) toast.error(`Nomor ${nomor} tidak ada di antrean.`);
        else proses(i);
      } else {
        proses(indeks);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (nomor) setNomor('');
      else onKeluar();
    }
  }

  return (
    <div
      id={id}
      tabIndex={0}
      role="listbox"
      aria-label="Antrean order"
      aria-activedescendant={idSorot !== undefined ? `tiket-${idSorot}` : undefined}
      onKeyDown={tombol}
      onFocus={onFokus}
      className={cn(
        'relative min-h-0 flex-1 overflow-y-auto rounded-lg border bg-slate-100 p-2 outline-none',
        aktif && 'ring-2 ring-blue-500',
      )}
    >
      {nomor && (
        <div className="sticky top-0 z-10 mb-2 rounded-md bg-blue-600 px-3 py-1 text-sm font-bold text-white">
          Panggil nomor {nomor}… (Enter)
        </div>
      )}
      {tiket.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Antrean kosong.{' '}
          {pengantaran
            ? 'Order pengantaran baru akan muncul di sini.'
            : 'F2 untuk jual tanpa order.'}
        </p>
      ) : (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${kolom}, minmax(0, 1fr))` }}
        >
          {tiket.map((t, i) => {
            const umur = umurMenit(t, sekarang);
            const dipegangLain =
              t.status === 'DIPROSES' && t.idKasirProses !== idSaya && t.id !== idTransaksi;
            const nama = t.namaPelanggan ?? t.namaPembeli;
            return (
              <div
                key={t.id}
                id={`tiket-${t.id}`}
                role="option"
                aria-selected={i === indeks}
                aria-label={`Antrean ${t.noAntrean}`}
                onClick={() => proses(i)}
                className={cn(
                  'cursor-pointer rounded-lg border-2 bg-white p-2 text-sm',
                  i === indeks ? 'border-blue-600 shadow-md' : 'border-transparent',
                  t.id === idTransaksi && 'border-emerald-500 bg-emerald-50',
                  dipegangLain && 'opacity-50',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl leading-none font-black tabular-nums">
                    {t.noAntrean}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    {t.prioritas === 'TINGGI' && (
                      <span className="rounded bg-red-600 px-1 font-bold text-white">
                        Prioritas
                      </span>
                    )}
                    <span
                      className={cn(
                        'tabular-nums',
                        umur >= 10
                          ? 'font-bold text-red-600'
                          : umur >= 5
                            ? 'font-semibold text-amber-600'
                            : 'text-slate-500',
                      )}
                    >
                      {umur} mnt
                    </span>
                  </span>
                </div>
                {nama && (
                  <div className="truncate text-xs font-semibold text-slate-700">{nama}</div>
                )}
                {pengantaran && t.alamatKirim && (
                  <div className="truncate text-xs text-slate-500">{t.alamatKirim}</div>
                )}
                {t.catatan && (
                  <div
                    className="mt-0.5 line-clamp-2 rounded bg-amber-50 px-1 text-xs text-amber-900"
                    title={t.catatan}
                  >
                    Catatan: {t.catatan}
                  </div>
                )}
                <ul className="mt-1 space-y-0.5 leading-tight">
                  {t.ringkasan.slice(0, MAKS_BARIS).map((r, j) => (
                    <li key={j} className="flex justify-between gap-2">
                      <span className="truncate">{r.namaBarang}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatDesimal(r.qty)} {r.kodeSatuan}
                      </span>
                    </li>
                  ))}
                  {t.ringkasan.length > MAKS_BARIS && (
                    <li className="text-xs text-slate-500">
                      +{t.ringkasan.length - MAKS_BARIS} barang lagi
                    </li>
                  )}
                </ul>
                <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-1">
                  <span className="truncate text-xs text-slate-500">
                    {t.id === idTransaksi
                      ? 'sedang dibayar'
                      : t.status === 'DIPROSES'
                        ? `dipegang ${t.namaKasirProses ?? 'kasir lain'}`
                        : t.namaPengguna}
                  </span>
                  <span className="font-bold tabular-nums">{formatRupiah(t.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
