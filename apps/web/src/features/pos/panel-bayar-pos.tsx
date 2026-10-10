import {
  formatRupiah,
  LABEL_METODE_PEMBAYARAN,
  type DataPembayaran,
  type MetodePembayaran,
} from '@sit/shared';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { digitSaja, tampilRibuan } from './model';

export type ModeBayar = 'langsung' | 'pengantaran' | 'pelunasan';

const HURUF_METODE: Record<string, MetodePembayaran> = { t: 'TUNAI', b: 'TRANSFER', e: 'EDC' };

/**
 * Panel pembayaran POS (K-073). Kursor selalu di kotak "Bayar": ketik angka = uang diterima (tunai) atau
 * nominal (transfer/EDC). Enter pada kotak kosong: langsung/pelunasan = uang pas (lunas), pengantaran = tanpa
 * pembayaran. Huruf: T tunai, B transfer, E EDC, C bayar campuran, D barang ditinggal (langsung),
 * L isi lunas & S bayar saat terima (pengantaran). Nominal final dihitung server (nominal kosong = lunasi).
 */
export function PanelBayarPos({
  id,
  aktif,
  total,
  mode,
  bolehKurang,
  rekeningTransfer,
  rekeningEdc,
  memproses,
  nonaktif = false,
  ditinggal = false,
  onDitinggal,
  bayarSaatTerima = false,
  onBayarSaatTerima,
  labelBayar,
  onBayar,
  onFokus,
  onEsc,
}: {
  id: string;
  aktif: boolean;
  total: number;
  mode: ModeBayar;
  /** Boleh belum lunas (pelanggan terdata / pengantaran / pelunasan). */
  bolehKurang: boolean;
  rekeningTransfer: string;
  rekeningEdc: string;
  memproses: boolean;
  nonaktif?: boolean;
  ditinggal?: boolean;
  onDitinggal?: (v: boolean) => void;
  bayarSaatTerima?: boolean;
  onBayarSaatTerima?: (v: boolean) => void;
  labelBayar: string;
  onBayar: (pembayaran: DataPembayaran[]) => void;
  onFokus: () => void;
  onEsc: () => void;
}) {
  const [metode, setMetode] = useState<MetodePembayaran>('TUNAI');
  const [digit, setDigit] = useState('');
  const [rekening, setRekening] = useState('');
  const [referensi, setReferensi] = useState('');
  const [daftar, setDaftar] = useState<DataPembayaran[]>([]);
  const [galat, setGalat] = useState('');

  const sudah = daftar.reduce((t, p) => t + (p.nominal ?? 0), 0);
  const sisa = Math.max(0, total - sudah);
  const angka = digit ? Number(digit) : null;
  const tunai = metode === 'TUNAI';
  const kosongBerartiLunas = mode !== 'pengantaran';
  // Perkiraan untuk layar; server menghitung ulang.
  const dibayarKini =
    angka === null ? (kosongBerartiLunas ? sisa : 0) : tunai ? Math.min(angka, sisa) : angka;
  const kembalian = tunai && angka !== null ? Math.max(0, angka - sisa) : 0;
  const kurang = Math.max(0, sisa - dibayarKini);

  function gantiMetode(m: MetodePembayaran) {
    setMetode(m);
    setRekening(m === 'TRANSFER' ? rekeningTransfer : m === 'EDC' ? rekeningEdc : '');
    setReferensi('');
    setGalat('');
  }

  function entriKini(): DataPembayaran | null | 'galat' {
    if (angka === null && !kosongBerartiLunas) return null;
    if (angka === 0) return null;
    if (!tunai && !rekening.trim()) {
      setGalat('Isi rekening/mesin EDC (Tab ke kolom rekening).');
      return 'galat';
    }
    if (!tunai && angka !== null && angka > sisa) {
      setGalat(`Nominal melebihi sisa ${formatRupiah(sisa)}.`);
      return 'galat';
    }
    return {
      metode,
      // Kosong = lunasi (server); tunai dengan uang diterima → server memakai min(uang, sisa).
      nominal: tunai ? null : angka,
      uangDiterima: tunai ? angka : null,
      rekening: tunai ? null : rekening.trim(),
      referensi: tunai ? null : referensi.trim() || null,
      catatan: null,
    };
  }

  function bayar() {
    if (nonaktif || memproses) return;
    const e = entriKini();
    if (e === 'galat') return;
    if (!bolehKurang && kurang > 0) {
      setGalat(`Kurang ${formatRupiah(kurang)} — pembeli umum wajib lunas.`);
      return;
    }
    setGalat('');
    onBayar(e ? [...daftar, e] : daftar);
  }

  function campuran() {
    if (angka === null || angka === 0) {
      setGalat('Ketik nominal bagian pertama dulu, lalu C.');
      return;
    }
    if (angka >= sisa) {
      setGalat('Nominal sudah menutup sisa; tekan Enter untuk bayar.');
      return;
    }
    const e = entriKini();
    if (!e || e === 'galat') return;
    setDaftar((d) => [...d, { ...e, nominal: angka, uangDiterima: tunai ? angka : null }]);
    setDigit('');
    gantiMetode(tunai ? 'TRANSFER' : 'TUNAI');
  }

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') {
      e.preventDefault();
      bayar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEsc();
    } else if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    } else if (HURUF_METODE[k]) {
      e.preventDefault();
      gantiMetode(HURUF_METODE[k]);
    } else if (k === 'c') {
      e.preventDefault();
      campuran();
    } else if (k === 'd' && mode === 'langsung' && onDitinggal) {
      e.preventDefault();
      onDitinggal(!ditinggal);
    } else if (k === 's' && mode === 'pengantaran' && onBayarSaatTerima) {
      e.preventDefault();
      onBayarSaatTerima(!bayarSaatTerima);
    } else if (k === 'l' && mode === 'pengantaran') {
      e.preventDefault();
      setDigit(String(sisa));
    } else if (e.key.length === 1 && !/\d/.test(e.key)) {
      e.preventDefault(); // kotak bayar hanya angka
    }
  }

  const petunjukKosong =
    mode === 'pengantaran'
      ? 'kosong = tanpa pembayaran'
      : tunai
        ? 'kosong = uang pas'
        : 'kosong = lunas';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5 text-sm">
        {(['TUNAI', 'TRANSFER', 'EDC'] as const).map((m) => (
          <button
            key={m}
            type="button"
            tabIndex={-1}
            onClick={() => gantiMetode(m)}
            className={cn(
              'rounded-md border-2 py-1.5 font-semibold',
              metode === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200',
            )}
          >
            <span className="mr-1 font-mono text-xs opacity-60">
              {m === 'TUNAI' ? 'T' : m === 'TRANSFER' ? 'B' : 'E'}
            </span>
            {LABEL_METODE_PEMBAYARAN[m]}
          </button>
        ))}
      </div>

      {daftar.length > 0 && (
        <ul className="rounded-md bg-slate-50 px-2 py-1 text-sm">
          {daftar.map((p, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {LABEL_METODE_PEMBAYARAN[p.metode]}
                {p.rekening && ` · ${p.rekening}`}
              </span>
              <span className="tabular-nums">{formatRupiah(p.nominal ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}

      <label className="text-xs font-semibold text-slate-600" htmlFor={id}>
        {tunai ? 'Uang diterima' : 'Nominal'} ({petunjukKosong})
      </label>
      <input
        id={id}
        value={tampilRibuan(digit)}
        onChange={(e) => {
          setDigit(digitSaja(e.target.value));
          setGalat('');
        }}
        onKeyDown={tombol}
        onFocus={onFokus}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Bayar"
        placeholder={formatRupiah(sisa)}
        className={cn(
          'h-14 rounded-md border bg-white px-3 text-right text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300',
          aktif ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300',
        )}
      />
      {!tunai && (
        <div className="grid grid-cols-2 gap-1.5">
          <input
            value={rekening}
            onChange={(e) => setRekening(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                bayar();
              }
            }}
            maxLength={60}
            placeholder={metode === 'EDC' ? 'Mesin EDC' : 'Rekening tujuan'}
            aria-label="Rekening tujuan"
            className="h-8 rounded-md border px-2 text-sm"
          />
          <input
            value={referensi}
            onChange={(e) => setReferensi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                bayar();
              }
            }}
            maxLength={60}
            placeholder="No. referensi (opsional)"
            aria-label="Nomor referensi"
            className="h-8 rounded-md border px-2 text-sm"
          />
        </div>
      )}

      <div className="flex items-end justify-between">
        <span className="text-sm text-slate-500">Kembalian</span>
        <span className="text-3xl font-black text-blue-700 tabular-nums" data-testid="kembalian">
          {formatRupiah(kembalian)}
        </span>
      </div>
      {kurang > 0 && (
        <div className="flex justify-between text-sm">
          <span className={bolehKurang ? 'text-amber-700' : 'text-red-600'}>
            {mode === 'pengantaran' && dibayarKini === 0
              ? 'Belum dibayar (piutang)'
              : bolehKurang
                ? 'Sisa jadi piutang'
                : 'Kurang bayar'}
          </span>
          <span className="font-semibold tabular-nums">{formatRupiah(kurang)}</span>
        </div>
      )}
      {(mode === 'langsung' || mode === 'pengantaran') && (
        <div className="flex flex-wrap gap-2 text-xs">
          {mode === 'langsung' && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5',
                ditinggal ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500',
              )}
            >
              <kbd className="font-mono font-bold">D</kbd> barang{' '}
              {ditinggal ? 'DITINGGAL di toko' : 'dibawa pembeli'}
            </span>
          )}
          {mode === 'pengantaran' && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5',
                bayarSaatTerima ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500',
              )}
            >
              <kbd className="font-mono font-bold">S</kbd> bayar saat terima:{' '}
              {bayarSaatTerima ? 'YA' : 'tidak'}
            </span>
          )}
          {mode === 'pengantaran' && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
              <kbd className="font-mono font-bold">L</kbd> isi lunas
            </span>
          )}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            <kbd className="font-mono font-bold">C</kbd> bayar campuran
          </span>
        </div>
      )}
      {galat && (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {galat}
        </p>
      )}
      <button
        type="button"
        onClick={bayar}
        disabled={nonaktif || memproses}
        className="h-12 rounded-md bg-emerald-600 text-lg font-black text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {memproses ? 'Memproses…' : `${labelBayar} (Enter)`}
      </button>
    </div>
  );
}
