import {
  bandingQty,
  formatRupiah,
  kunciBaris,
  kurangQty,
  tambahQty,
  type BarisPratinjau,
} from '@sit/shared';
import { Minus, MoreVertical, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { InfoPromo } from '@/components/info-promo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDesimal } from '@/lib/format';
import { qtySah } from '@/lib/qty';
import { cn } from '@/lib/utils';
import {
  hargaBaris,
  qtyDasarBaris,
  rapikanQty,
  satuanBerikut,
  subtotalBaris,
  type BarisPos,
} from './model';

type Sunting = { jenis: 'qty'; nilai: string } | null;

/**
 * Daftar barang transaksi POS (K-073). Keyboard: ↑/↓ pilih baris, + / − ubah qty 1, ketik angka = qty baru
 * (Enter simpan), P = lepas/pasang promo (berizin), S = ganti satuan (satuan
 * dasar ↔ kemasan, K-091), M = menu baris, Delete = hapus, Enter = lanjut bayar, Esc/↑ di baris pertama =
 * kembali ke kotak cari. Setiap aksi juga ada di menu ⋮ baris untuk pengguna mouse (K-099). Harga, tier,
 * promo, dan subtotal diambil dari pratinjau API bila sudah tersedia; tier selalu otomatis.
 */
export function KeranjangPos({
  id,
  baris,
  tierBawaan,
  namaTier,
  indeks,
  onIndeks,
  aktif,
  onUbah,
  onHapus,
  onKeluar,
  onLanjut,
  onFokus,
  bolehLepasPromo,
  pratinjau,
}: {
  id: string;
  baris: BarisPos[];
  tierBawaan: number | null;
  namaTier: (idTier: number) => string;
  indeks: number;
  onIndeks: (i: number) => void;
  aktif: boolean;
  onUbah: (i: number, ubah: Partial<BarisPos>) => void;
  onHapus: (i: number) => void;
  onKeluar: () => void;
  onLanjut: () => void;
  onFokus: () => void;
  bolehLepasPromo: boolean;
  /** Hasil pratinjau API per baris (`kunciBaris`): harga, promo, subtotal, tier. */
  pratinjau: ReadonlyMap<string, BarisPratinjau>;
}) {
  const [sunting, setSunting] = useState<Sunting>(null);
  /** Indeks baris yang menu ⋮-nya terbuka. */
  const [menu, setMenu] = useState<number | null>(null);
  const wadah = useRef<HTMLDivElement>(null);
  /** Aksi menu yang membuka isian qty: dijalankan setelah menu tertutup agar fokusnya tidak direbut. */
  const setelahMenu = useRef<(() => void) | null>(null);
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
    const q = sunting.nilai.replace(',', '.');
    if (!qtySah(q)) {
      toast.error('Qty harus angka lebih dari 0 (maks. 3 desimal).');
      return;
    }
    onUbah(indeks, { qty: rapikanQty(q) });
    kembaliFokus();
  }

  /** Qty ±1 (tombol + / − di baris, atau tombol keyboard); qty tidak boleh 0 atau kurang. */
  function ubahQty(i: number, arah: 1 | -1) {
    const r = baris[i];
    if (!r) return;
    const q = arah === 1 ? tambahQty(r.qty, 1) : kurangQty(r.qty, 1);
    if (bandingQty(q, 0) > 0) onUbah(i, { qty: rapikanQty(q) });
  }

  function mulaiSunting(i: number, jenis: 'qty', awal?: string) {
    const r = baris[i];
    if (!r) return;
    onIndeks(i);
    setSunting({ jenis, nilai: awal ?? r.qty });
  }

  function gantiSatuan(i: number) {
    const r = baris[i];
    const berikut = r && satuanBerikut(r);
    if (!r || !berikut) return;
    // K-095: satuan yang sudah punya baris sendiri untuk barang ini tidak dipakai dua kali.
    const bentrok = baris.some(
      (x, j) => j !== i && x.idBarang === r.idBarang && x.idSatuanJual === berikut.idSatuanJual,
    );
    if (bentrok) toast.info(`${r.nama} dalam ${berikut.satuan} sudah ada di baris lain.`);
    else onUbah(i, berikut);
  }

  /** PR5: lepas atau pasang lagi promo baris (hanya bila ada promo atau sedang dilepas). */
  function bisaAlihPromo(r: BarisPos): boolean {
    const pr = pratinjau.get(kunciBaris(r.idBarang, r.idSatuanJual));
    return bolehLepasPromo && (r.tanpaPromo || pr?.idPromo != null);
  }

  function alihPromo(i: number) {
    const r = baris[i];
    if (r && bisaAlihPromo(r)) onUbah(i, { tanpaPromo: !r.tanpaPromo });
  }

  function tombol(e: KeyboardEvent<HTMLDivElement>) {
    // Tombol dari isian sunting, tombol baris, atau menu ⋮ (portal) ditangani elemen itu sendiri.
    if (e.target !== e.currentTarget) return;
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
      mulaiSunting(indeks, 'qty', e.key);
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      alihPromo(indeks);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      gantiSatuan(indeks);
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      setMenu(indeks);
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
        'min-h-24 flex-1 overflow-y-auto rounded-md border bg-white outline-none',
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
              // Tier yang dipakai API (otomatis menurut nilai belanja, K-098); tier dasar tidak ditulis.
              const idTier = r.hargaManual
                ? null
                : (pr?.idTingkatHarga ?? r.snapshot?.idTingkatHarga ?? null);
              const dipilih = aktif && i === indeks;
              const menyunting = i === indeks ? sunting : null;
              const berikut = satuanBerikut(r);
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
                  className={cn('group border-b align-top last:border-0', dipilih && 'bg-blue-50')}
                >
                  <td className="w-6 py-1.5 pl-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {/* Nama panjang tidak dipotong "…": maksimal dua baris, utuh saat baris dipilih/disorot. */}
                    <div
                      className={cn(
                        'font-medium wrap-break-word',
                        !dipilih && 'line-clamp-2 group-hover:line-clamp-none',
                      )}
                      title={r.nama}
                    >
                      {r.nama}
                    </div>
                    {pr?.qtyTidakBiasa && (
                      // K-200: kemungkinan salah ketik qty; periksa sebelum bayar.
                      <div
                        className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                        data-testid="qty-tidak-biasa"
                      >
                        Qty jauh di atas biasanya (paling banyak{' '}
                        {formatDesimal(pr.qtyTidakBiasa.biasanya)} per transaksi). Benar?
                      </div>
                    )}
                    {pr?.segelDibuka && (
                      // K-246: ecer di catatan kurang; box segel dibuka otomatis saat dibayar.
                      <div
                        className="mt-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900"
                        data-testid="segel-dibuka"
                      >
                        Ecer kurang: {pr.segelDibuka.jumlah} {pr.segelDibuka.kodeSatuan} segel
                        dibuka saat dibayar (tercatat atas nama Anda).
                      </div>
                    )}
                    {r.atribut && (
                      <div
                        className={cn(
                          'text-xs text-slate-600',
                          !dipilih && 'line-clamp-1 group-hover:line-clamp-none',
                        )}
                        title={r.atribut}
                      >
                        {r.atribut}
                      </div>
                    )}
                    <div className="text-xs text-slate-500">
                      {formatRupiah(harga ?? 0)}
                      {idTier !== null && idTier !== tierBawaan && ` · harga ${namaTier(idTier)}`}
                      {r.hargaManual && ' · harga manual'}
                      {r.diskonBaris > 0 && ` · diskon ${formatRupiah(r.diskonBaris)}`}
                    </div>
                    <InfoPromo
                      p={pr}
                      aksi={
                        bisaAlihPromo(r) ? (
                          <kbd className="font-mono text-[10px] text-slate-400">P</kbd>
                        ) : null
                      }
                    />
                  </td>
                  <td className="w-40 py-1.5 text-right font-bold whitespace-nowrap tabular-nums">
                    {menyunting?.jenis === 'qty' ? (
                      <input
                        autoFocus
                        aria-label={`Qty ${r.nama}`}
                        value={menyunting.nilai}
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
                          <TombolBaris
                            label={`Kurangi 1 ${r.nama}`}
                            disabled={bandingQty(r.qty, 1) <= 0}
                            onClick={() => ubahQty(i, -1)}
                          >
                            <Minus />
                          </TombolBaris>
                          <span>
                            {formatDesimal(r.qty)}{' '}
                            <span className="text-xs font-normal">{r.satuan}</span>
                          </span>
                          <TombolBaris label={`Tambah 1 ${r.nama}`} onClick={() => ubahQty(i, 1)}>
                            <Plus />
                          </TombolBaris>
                        </div>
                        {qtyDasarBaris(r) !== null && (
                          <div className="text-[11px] font-normal text-slate-500">
                            = {formatDesimal(qtyDasarBaris(r) ?? '0')} {r.opsiSatuan[0]?.kodeSatuan}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="w-28 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatRupiah(pr?.subtotal ?? subtotalBaris(r, tierBawaan))}
                  </td>
                  <td className="w-8 py-1.5 pr-1 text-right">
                    <DropdownMenu
                      open={menu === i}
                      onOpenChange={(buka) => {
                        if (buka) onIndeks(i);
                        setMenu(buka ? i : null);
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Aksi untuk ${r.nama}`}
                          title="Aksi baris (M)"
                          onClick={(e) => e.stopPropagation()}
                          className="flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none [&_svg]:size-4"
                        >
                          <MoreVertical />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        // Setelah menu ditutup: buka isian yang dipilih, atau kembalikan fokus ke daftar.
                        onCloseAutoFocus={(e) => {
                          e.preventDefault();
                          const aksi = setelahMenu.current;
                          setelahMenu.current = null;
                          if (aksi) aksi();
                          else wadah.current?.focus();
                        }}
                      >
                        <DropdownMenuItem
                          onSelect={() => {
                            setelahMenu.current = () => mulaiSunting(i, 'qty');
                          }}
                        >
                          Ubah qty<DropdownMenuShortcut>Angka</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        {berikut && (
                          <DropdownMenuItem onSelect={() => gantiSatuan(i)}>
                            Ganti satuan ke {berikut.satuan}
                            <DropdownMenuShortcut>S</DropdownMenuShortcut>
                          </DropdownMenuItem>
                        )}
                        {bisaAlihPromo(r) && (
                          <DropdownMenuItem onSelect={() => alihPromo(i)}>
                            {r.tanpaPromo ? 'Pasang promo lagi' : 'Lepas promo'}
                            <DropdownMenuShortcut>P</DropdownMenuShortcut>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onHapus(i)}>
                          Hapus dari daftar<DropdownMenuShortcut>Del</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

/**
 * Tombol kecil di baris (qty ±1). Bisa dicapai dengan Tab; klik mouse tidak memindahkan fokus dari daftar
 * agar tombol keyboard daftar tetap berlaku.
 */
function TombolBaris({
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
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:opacity-40 [&_svg]:size-3"
    >
      {children}
    </button>
  );
}
