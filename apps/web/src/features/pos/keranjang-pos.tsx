import {
  bandingQty,
  formatRupiah,
  kunciBaris,
  kurangQty,
  tambahQty,
  type BarisPratinjau,
} from '@sit/shared';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { InfoPromo } from '@/components/info-promo';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  digitSaja,
  hargaBaris,
  qtyDasarBaris,
  qtySah,
  rapikanQty,
  satuanBerikut,
  subtotalBaris,
  tampilRibuan,
  type BarisPos,
} from './model';

type Sunting = { jenis: 'qty' | 'diskon'; nilai: string } | null;

/**
 * Daftar barang transaksi POS (K-073). Keyboard: ↑/↓ pilih baris, + / − ubah qty 1, ketik angka = qty baru
 * (Enter simpan), % = diskon rupiah (berizin), T = pilih tier: otomatis → tier tertentu (berizin, K-094),
 * P = lepas/pasang promo (berizin), S = ganti satuan (satuan dasar ↔ kemasan, K-091),
 * Delete = hapus, Enter = lanjut bayar, Esc/↑ di baris pertama = kembali ke kotak cari. Harga, promo, dan
 * subtotal diambil dari pratinjau API bila sudah tersedia.
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
  bolehLepasPromo,
  pratinjau,
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
  bolehLepasPromo: boolean;
  /** Hasil pratinjau API per baris (`kunciBaris`): harga, promo, subtotal, tier. */
  pratinjau: ReadonlyMap<string, BarisPratinjau>;
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

  /** Qty ±1 (tombol + / − di baris, atau tombol keyboard); qty tidak boleh 0 atau kurang. */
  function ubahQty(i: number, arah: 1 | -1) {
    const b = baris[i];
    if (!b) return;
    const q = arah === 1 ? tambahQty(b.qty, 1) : kurangQty(b.qty, 1);
    if (bandingQty(q, 0) > 0) onUbah(i, { qty: rapikanQty(q) });
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
      ubahQty(indeks, 1);
    } else if (e.key === '-') {
      e.preventDefault();
      ubahQty(indeks, -1);
    } else if (/^[\d.,]$/.test(e.key)) {
      e.preventDefault();
      setSunting({ jenis: 'qty', nilai: e.key });
    } else if (e.key === '%' && bolehDiskon) {
      e.preventDefault();
      setSunting({ jenis: 'diskon', nilai: b.diskonBaris ? String(b.diskonBaris) : '' });
    } else if ((e.key === 'p' || e.key === 'P') && bolehLepasPromo) {
      e.preventDefault();
      const pr = pratinjau.get(kunciBaris(b.idBarang, b.idSatuanJual));
      if (b.tanpaPromo || pr?.idPromo != null) onUbah(indeks, { tanpaPromo: !b.tanpaPromo });
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      const berikut = satuanBerikut(b);
      // K-095: satuan yang sudah punya baris sendiri untuk barang ini tidak dipakai dua kali.
      const bentrok =
        berikut &&
        baris.some(
          (x, j) =>
            j !== indeks && x.idBarang === b.idBarang && x.idSatuanJual === berikut.idSatuanJual,
        );
      if (bentrok) toast.info(`${b.nama} dalam ${berikut.satuan} sudah ada di baris lain.`);
      else if (berikut) onUbah(indeks, berikut);
    } else if ((e.key === 't' || e.key === 'T') && bolehTier && !b.hargaManual) {
      e.preventDefault();
      // Urutan: otomatis (syarat qty, K-097) → setiap tier → kembali ke otomatis.
      const pilihan: (number | null)[] = [null, ...urutanTier];
      const kini = Math.max(0, pilihan.indexOf(b.idTingkatHarga));
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
        // Minimal ±4 baris tetap terlihat walau panel bayar membesar (transfer/EDC/campuran).
        'min-h-40 flex-1 overflow-y-auto rounded-md border bg-white outline-none',
        aktif && 'ring-2 ring-blue-500',
      )}
    >
      {baris.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Belum ada barang.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {baris.map((r, i) => {
              const pr = pratinjau.get(kunciBaris(r.idBarang, r.idSatuanJual));
              const harga = pr?.hargaSatuan ?? hargaBaris(r, tierBawaan);
              // K-094: tier yang dipakai API (otomatis dari pelanggan/qty, atau dipilih kasir).
              const idTier = r.hargaManual
                ? null
                : (pr?.idTingkatHarga ?? r.idTingkatHarga ?? r.snapshot?.idTingkatHarga ?? null);
              const tampilTier =
                idTier !== null && (idTier !== tierBawaan || r.idTingkatHarga !== null);
              const dipilih = aktif && i === indeks;
              return (
                <tr
                  key={kunciBaris(r.idBarang, r.idSatuanJual)}
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
                      {tampilTier &&
                        ` · ${namaTier(idTier)}${r.idTingkatHarga === null ? ' otomatis' : ''}`}
                      {r.hargaManual && ' · harga manual'}
                      {r.diskonBaris > 0 && ` · diskon ${formatRupiah(r.diskonBaris)}`}
                      {pr?.idTingkatHargaSaran != null && (
                        <span className="text-blue-700">
                          {' '}
                          · saran {namaTier(pr.idTingkatHargaSaran)}
                          {bolehTier && ' (T)'}
                        </span>
                      )}
                    </div>
                    <InfoPromo
                      p={pr}
                      className="truncate"
                      aksi={
                        bolehLepasPromo && (pr?.idPromo != null || r.tanpaPromo) ? (
                          <kbd className="font-mono text-[10px] text-slate-400">P</kbd>
                        ) : null
                      }
                    />
                  </td>
                  <td className="w-40 py-1.5 text-right font-bold tabular-nums">
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
                        <div className="flex items-center justify-end gap-1">
                          <TombolQty
                            label={`Kurangi 1 ${r.nama}`}
                            disabled={bandingQty(r.qty, 1) <= 0}
                            onClick={() => ubahQty(i, -1)}
                          >
                            <Minus />
                          </TombolQty>
                          <span>
                            {formatDesimal(r.qty)}{' '}
                            <span className="text-xs font-normal">{r.satuan}</span>
                          </span>
                          <TombolQty label={`Tambah 1 ${r.nama}`} onClick={() => ubahQty(i, 1)}>
                            <Plus />
                          </TombolQty>
                        </div>
                        {qtyDasarBaris(r) !== null && (
                          <div className="text-[11px] font-normal text-slate-500">
                            = {formatDesimal(qtyDasarBaris(r) ?? '0')} {r.opsiSatuan[0]?.kodeSatuan}
                          </div>
                        )}
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
                      formatRupiah(pr?.subtotal ?? subtotalBaris(r, tierBawaan))
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

/** Tombol kecil qty ±1 di baris; tidak mengambil fokus agar navigasi keyboard tetap di daftar. */
function TombolQty({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 [&_svg]:size-3"
    >
      {children}
    </button>
  );
}
