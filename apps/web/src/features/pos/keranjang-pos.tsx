import { formatRupiah, kurangQty, tambahQty, bandingQty } from '@sit/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  digitSaja,
  hargaBaris,
  qtySah,
  rapikanQty,
  subtotalBaris,
  tampilRibuan,
  type BarisPos,
} from './model';

type Sunting = { jenis: 'qty' | 'diskon'; nilai: string } | null;

/**
 * Daftar barang transaksi POS (K-073). Keyboard: ↑/↓ pilih baris, + / − ubah qty 1, ketik angka = qty baru
 * (Enter simpan), % = diskon rupiah (berizin), T = ganti tier (berizin), Delete = hapus, Enter = lanjut bayar,
 * Esc/↑ di baris pertama = kembali ke kotak cari.
 */
export function KeranjangPos({
  id,
  baris,
  tierBawaan,
  namaTier,
  urutanTier,
  indeks,
  onIndeks,
  aktif,
  onUbah,
  onHapus,
  onKeluar,
  onLanjut,
  onFokus,
  bolehTier,
  bolehDiskon,
}: {
  id: string;
  baris: BarisPos[];
  tierBawaan: number | null;
  namaTier: (idTier: number) => string;
  /** Tier aktif (urut) untuk tombol T. */
  urutanTier: number[];
  indeks: number;
  onIndeks: (i: number) => void;
  aktif: boolean;
  onUbah: (i: number, ubah: Partial<BarisPos>) => void;
  onHapus: (i: number) => void;
  onKeluar: () => void;
  onLanjut: () => void;
  onFokus: () => void;
  bolehTier: boolean;
  bolehDiskon: boolean;
}) {
  const [sunting, setSunting] = useState<Sunting>(null);
  const wadah = useRef<HTMLDivElement>(null);
  const b = baris[indeks];

  useEffect(() => {
    document.getElementById(`baris-pos-${indeks}`)?.scrollIntoView({ block: 'nearest' });
  }, [indeks]);

  function kembaliFokus() {
    setSunting(null);
    wadah.current?.focus();
  }

  function simpanSunting() {
    if (!sunting || !b) return kembaliFokus();
    if (sunting.jenis === 'qty') {
      const q = sunting.nilai.replace(',', '.');
      if (!qtySah(q)) {
        toast.error('Qty harus angka lebih dari 0 (maks. 3 desimal).');
        return;
      }
      onUbah(indeks, { qty: rapikanQty(q) });
    } else {
      onUbah(indeks, { diskonBaris: Number(digitSaja(sunting.nilai) || '0') });
    }
    kembaliFokus();
  }

  function tombol(e: KeyboardEvent<HTMLDivElement>) {
    if (sunting) return; // ditangani input sunting
    const akhir = baris.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onIndeks(Math.min(akhir, indeks + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (indeks <= 0) onKeluar();
      else onIndeks(indeks - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onKeluar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onLanjut();
    } else if (!b) {
      return;
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      onUbah(indeks, { qty: rapikanQty(tambahQty(b.qty, 1)) });
    } else if (e.key === '-') {
      e.preventDefault();
      const q = kurangQty(b.qty, 1);
      if (bandingQty(q, 0) > 0) onUbah(indeks, { qty: rapikanQty(q) });
    } else if (/^[\d.,]$/.test(e.key)) {
      e.preventDefault();
      setSunting({ jenis: 'qty', nilai: e.key });
    } else if (e.key === '%' && bolehDiskon) {
      e.preventDefault();
      setSunting({ jenis: 'diskon', nilai: b.diskonBaris ? String(b.diskonBaris) : '' });
    } else if ((e.key === 't' || e.key === 'T') && bolehTier && !b.hargaManual) {
      e.preventDefault();
      // Urutan: bawaan → tier lain → kembali ke bawaan.
      const pilihan: (number | null)[] = [null, ...urutanTier.filter((t) => t !== tierBawaan)];
      const kini = pilihan.indexOf(b.idTingkatHarga === tierBawaan ? null : b.idTingkatHarga);
      onUbah(indeks, { idTingkatHarga: pilihan[(kini + 1) % pilihan.length] ?? null });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onHapus(indeks);
    }
  }

  return (
    <div
      id={id}
      ref={wadah}
      tabIndex={0}
      role="listbox"
      aria-label="Barang transaksi"
      onKeyDown={tombol}
      onFocus={onFokus}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto rounded-md border bg-white outline-none',
        aktif && 'ring-2 ring-blue-500',
      )}
    >
      {baris.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Belum ada barang.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {baris.map((r, i) => {
              const harga = hargaBaris(r, tierBawaan);
              const tierLain =
                !r.hargaManual && r.idTingkatHarga !== null && r.idTingkatHarga !== tierBawaan;
              const dipilih = aktif && i === indeks;
              return (
                <tr
                  key={r.idBarang}
                  id={`baris-pos-${i}`}
                  role="option"
                  aria-selected={i === indeks}
                  onClick={() => {
                    onIndeks(i);
                    wadah.current?.focus();
                  }}
                  className={cn('border-b last:border-0', dipilih && 'bg-blue-50')}
                >
                  <td className="w-6 py-1.5 pl-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="max-w-0 py-1.5">
                    <div className="truncate font-medium">{r.nama}</div>
                    <div className="truncate text-xs text-slate-500">
                      {formatRupiah(harga ?? 0)}
                      {tierLain && r.idTingkatHarga !== null && ` · ${namaTier(r.idTingkatHarga)}`}
                      {r.hargaManual && ' · harga manual'}
                      {r.diskonBaris > 0 && ` · diskon ${formatRupiah(r.diskonBaris)}`}
                    </div>
                  </td>
                  <td className="w-28 py-1.5 text-right font-bold tabular-nums">
                    {dipilih && sunting?.jenis === 'qty' ? (
                      <input
                        autoFocus
                        aria-label={`Qty ${r.nama}`}
                        value={sunting.nilai}
                        inputMode="decimal"
                        onChange={(e) => setSunting({ jenis: 'qty', nilai: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            simpanSunting();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            kembaliFokus();
                          }
                        }}
                        onBlur={() => setSunting(null)}
                        className="h-7 w-20 rounded border border-blue-500 px-1 text-right"
                      />
                    ) : (
                      <>
                        {formatDesimal(r.qty)}{' '}
                        <span className="text-xs font-normal">{r.satuan}</span>
                      </>
                    )}
                  </td>
                  <td className="w-28 py-1.5 pr-2 text-right font-semibold tabular-nums">
                    {dipilih && sunting?.jenis === 'diskon' ? (
                      <input
                        autoFocus
                        aria-label={`Diskon ${r.nama}`}
                        placeholder="diskon Rp"
                        value={tampilRibuan(digitSaja(sunting.nilai))}
                        inputMode="numeric"
                        onChange={(e) => setSunting({ jenis: 'diskon', nilai: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            simpanSunting();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            kembaliFokus();
                          }
                        }}
                        onBlur={() => setSunting(null)}
                        className="h-7 w-24 rounded border border-blue-500 px-1 text-right"
                      />
                    ) : (
                      formatRupiah(subtotalBaris(r, tierBawaan))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
