import {
  formatRupiah,
  LABEL_METODE_PEMBAYARAN,
  type DataPembayaran,
  type MetodePembayaran,
} from '@sit/shared';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { digitSaja, tampilRibuan } from './model';

export type ModeBayar = 'langsung' | 'pengantaran' | 'pelunasan';

/**
 * Cara bayar yang dipilih kasir bila pembeli boleh belum lunas (K-104): lunas sekarang, DP (sebagian
 * sekarang, sisanya piutang), bayar nanti (seluruhnya piutang), atau ditagih saat barang diterima.
 */
type RencanaBayar = 'LUNAS' | 'DP' | 'NANTI' | 'SAAT_TERIMA';

const RENCANA: { nilai: RencanaBayar; huruf: string; label: string; ket: string }[] = [
  { nilai: 'LUNAS', huruf: 'L', label: 'Lunas', ket: 'Dibayar penuh sekarang' },
  { nilai: 'DP', huruf: 'U', label: 'DP', ket: 'Uang muka sekarang, sisanya piutang' },
  { nilai: 'NANTI', huruf: 'N', label: 'Bayar nanti', ket: 'Tanpa pembayaran, jadi piutang' },
  { nilai: 'SAAT_TERIMA', huruf: 'S', label: 'Saat terima', ket: 'Ditagih saat barang diterima' },
];
const HURUF_RENCANA = Object.fromEntries(RENCANA.map((r) => [r.huruf.toLowerCase(), r.nilai]));

const HURUF_METODE: Record<string, MetodePembayaran> = { t: 'TUNAI', b: 'TRANSFER', e: 'EDC' };

/** Klik tombol tanpa memindahkan fokus dari kotak "Bayar" (keyboard tetap bisa dipakai sesudahnya). */
const tahanFokus = (e: MouseEvent) => e.preventDefault();

/**
 * Panel pembayaran POS (K-073). Kursor selalu di kotak "Bayar": ketik angka = uang diterima (tunai) atau
 * nominal (transfer/EDC); Enter menyelesaikan. Huruf: T tunai, B transfer, E EDC, C bayar campuran, D barang
 * ditinggal (langsung). Bila pembeli boleh belum lunas, kasir memilih cara bayar secara tegas (K-104):
 * L lunas, U DP, N bayar nanti, S saat terima (pengantaran). Semua pilihan juga bisa diklik. Nominal final
 * dihitung server (nominal kosong = lunasi).
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
  onBayarSaatTerima,
  jatuhTempo = '',
  onJatuhTempo,
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
  onBayarSaatTerima?: (v: boolean) => void;
  /** Jatuh tempo piutang (kosong = sesuai term pelanggan); tampil bila cara bayar bukan Lunas. */
  jatuhTempo?: string;
  onJatuhTempo?: (v: string) => void;
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
  const [pilihan, setPilihan] = useState<RencanaBayar>('LUNAS');

  // Pelunasan piutang (halaman Piutang) boleh sebagian tanpa memilih cara bayar: nominalnya sendiri jelas.
  const pakaiRencana = bolehKurang && mode !== 'pelunasan';
  const pilihanRencana = RENCANA.filter((r) => r.nilai !== 'SAAT_TERIMA' || mode === 'pengantaran');
  const rencana: RencanaBayar = pakaiRencana ? pilihan : 'LUNAS';
  const tanpaBayar = rencana === 'NANTI' || rencana === 'SAAT_TERIMA';

  const sudah = daftar.reduce((t, p) => t + (p.nominal ?? 0), 0);
  const sisa = Math.max(0, total - sudah);
  const angka = digit ? Number(digit) : null;
  const tunai = metode === 'TUNAI';
  const kosongBerartiLunas = rencana === 'LUNAS';
  // Perkiraan untuk layar; server menghitung ulang.
  const dibayarKini = tanpaBayar
    ? 0
    : angka === null
      ? kosongBerartiLunas
        ? sisa
        : 0
      : tunai
        ? Math.min(angka, sisa)
        : angka;
  const kembalian = tunai && angka !== null ? Math.max(0, angka - sisa) : 0;
  const kurang = Math.max(0, sisa - dibayarKini);

  function gantiMetode(m: MetodePembayaran) {
    setMetode(m);
    setRekening(m === 'TRANSFER' ? rekeningTransfer : m === 'EDC' ? rekeningEdc : '');
    setReferensi('');
    setGalat('');
  }

  function gantiRencana(r: RencanaBayar) {
    setPilihan(r);
    setGalat('');
    // Cara bayar tanpa uang sekarang: isian nominal dan bagian campuran dibuang.
    if (r === 'NANTI' || r === 'SAAT_TERIMA') {
      setDigit('');
      setDaftar([]);
    }
    onBayarSaatTerima?.(r === 'SAAT_TERIMA');
  }

  function entriKini(): DataPembayaran | null | 'galat' {
    if (tanpaBayar) return null;
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
    if (tanpaBayar) {
      setGalat('');
      onBayar([]);
      return;
    }
    if (rencana === 'DP') {
      if (sudah + dibayarKini <= 0) {
        setGalat('Ketik jumlah DP yang diterima dulu.');
        return;
      }
      if (kurang === 0) {
        setGalat('Jumlah itu melunasi seluruh tagihan; pilih Lunas (L).');
        return;
      }
    }
    const e = entriKini();
    if (e === 'galat') return;
    if (rencana === 'LUNAS' && mode !== 'pelunasan' && kurang > 0) {
      setGalat(
        pakaiRencana
          ? `Kurang ${formatRupiah(kurang)}. Bila pembeli membayar sebagian, pilih DP (U).`
          : `Kurang ${formatRupiah(kurang)} — pembeli umum wajib lunas.`,
      );
      return;
    }
    setGalat('');
    onBayar(e ? [...daftar, e] : daftar);
  }

  function campuran() {
    if (tanpaBayar) return;
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
    const rencanaHuruf = pakaiRencana ? HURUF_RENCANA[k] : undefined;
    if (e.key === 'Enter') {
      e.preventDefault();
      bayar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEsc();
    } else if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    } else if (rencanaHuruf && pilihanRencana.some((r) => r.nilai === rencanaHuruf)) {
      e.preventDefault();
      gantiRencana(rencanaHuruf);
    } else if (HURUF_METODE[k]) {
      e.preventDefault();
      gantiMetode(HURUF_METODE[k]);
    } else if (k === 'c') {
      e.preventDefault();
      campuran();
    } else if (k === 'd' && mode === 'langsung' && onDitinggal) {
      e.preventDefault();
      onDitinggal(!ditinggal);
    } else if (e.key.length === 1 && !/\d/.test(e.key)) {
      e.preventDefault(); // kotak bayar hanya angka
    }
  }

  const petunjukKosong =
    rencana === 'DP' ? 'jumlah DP' : tunai ? 'kosong = uang pas' : 'kosong = lunas';
  const labelTombol =
    rencana === 'LUNAS' || mode === 'pengantaran' ? labelBayar : 'Simpan sebagai piutang';

  return (
    <div className="flex flex-col gap-2">
      {pakaiRencana && (
        <div
          className="grid gap-1.5 text-sm"
          style={{ gridTemplateColumns: `repeat(${pilihanRencana.length}, minmax(0, 1fr))` }}
          role="radiogroup"
          aria-label="Pelunasan"
        >
          {pilihanRencana.map((r) => (
            <button
              key={r.nilai}
              type="button"
              role="radio"
              aria-checked={rencana === r.nilai}
              tabIndex={-1}
              title={r.ket}
              onMouseDown={tahanFokus}
              onClick={() => gantiRencana(r.nilai)}
              className={cn(
                'rounded-md border-2 px-1 py-1 font-semibold',
                rencana === r.nilai
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 text-slate-600',
              )}
            >
              <span className="mr-1 font-mono text-xs opacity-60">{r.huruf}</span>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {!tanpaBayar && (
        <div className="grid grid-cols-3 gap-1.5 text-sm">
          {(['TUNAI', 'TRANSFER', 'EDC'] as const).map((m) => (
            <button
              key={m}
              type="button"
              tabIndex={-1}
              onMouseDown={tahanFokus}
              onClick={() => gantiMetode(m)}
              className={cn(
                'rounded-md border-2 py-1 font-semibold',
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
      )}

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
        {tanpaBayar
          ? 'Tidak ada pembayaran sekarang (ketik angka untuk mengubahnya menjadi DP)'
          : `${tunai ? 'Uang diterima' : 'Nominal'} (${petunjukKosong})`}
      </label>
      <input
        id={id}
        value={tampilRibuan(digit)}
        onChange={(e) => {
          const d = digitSaja(e.target.value);
          // Mengetik angka saat "bayar nanti" berarti ada uang muka.
          if (tanpaBayar && d) gantiRencana('DP');
          setDigit(d);
          setGalat('');
        }}
        onKeyDown={tombol}
        onFocus={onFokus}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Bayar"
        placeholder={tanpaBayar ? 'Rp 0' : formatRupiah(sisa)}
        className={cn(
          'h-12 rounded-md border bg-white px-3 text-right text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300',
          aktif ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300',
        )}
      />
      {!tunai && !tanpaBayar && (
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

      {/* Kembalian hanya ada pada pembayaran penuh; DP diterima sebesar jumlahnya. */}
      {rencana === 'LUNAS' && (
        <div className="flex items-end justify-between">
          <span className="text-sm text-slate-500">Kembalian</span>
          <span className="text-2xl font-black text-blue-700 tabular-nums" data-testid="kembalian">
            {formatRupiah(kembalian)}
          </span>
        </div>
      )}
      {kurang > 0 && (
        <div className="flex justify-between text-sm" data-testid="ringkas-piutang">
          <span
            className={
              rencana === 'LUNAS' && mode !== 'pelunasan' ? 'text-red-600' : 'text-amber-700'
            }
          >
            {rencana === 'SAAT_TERIMA'
              ? 'Ditagih saat barang diterima'
              : rencana === 'NANTI'
                ? 'Seluruh tagihan jadi piutang'
                : rencana === 'DP' || mode === 'pelunasan'
                  ? 'Sisa jadi piutang'
                  : 'Kurang bayar'}
          </span>
          <span className="font-semibold tabular-nums">{formatRupiah(kurang)}</span>
        </div>
      )}
      {pakaiRencana && rencana !== 'LUNAS' && onJatuhTempo && (
        <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
          Jatuh tempo (kosong = sesuai term pelanggan)
          <input
            type="date"
            value={jatuhTempo}
            onChange={(e) => onJatuhTempo(e.target.value)}
            aria-label="Tanggal jatuh tempo"
            className="h-7 rounded border px-1"
          />
        </label>
      )}
      {mode !== 'pelunasan' && !tanpaBayar && (
        <div className="flex flex-wrap gap-2 text-xs">
          {mode === 'langsung' && onDitinggal && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={tahanFokus}
              onClick={() => onDitinggal(!ditinggal)}
              className={cn(
                'rounded px-1.5 py-0.5',
                ditinggal ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500',
              )}
            >
              <kbd className="font-mono font-bold">D</kbd> barang{' '}
              {ditinggal ? 'DITINGGAL di toko' : 'dibawa pembeli'}
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={tahanFokus}
            onClick={campuran}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500"
          >
            <kbd className="font-mono font-bold">C</kbd> bayar campuran
          </button>
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
        // Menempel di bawah kolom transaksi: tetap terlihat di layar pendek saat isi kolom digulir.
        className="sticky bottom-0 h-11 shrink-0 rounded-md bg-emerald-600 text-lg font-black text-white shadow-[0_-6px_8px_-4px_rgb(255_255_255)] hover:bg-emerald-700 disabled:bg-emerald-300"
      >
        {memproses ? 'Memproses…' : `${labelTombol} (Enter)`}
      </button>
    </div>
  );
}
