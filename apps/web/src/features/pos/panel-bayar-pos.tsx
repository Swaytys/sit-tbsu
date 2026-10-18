import {
  formatRupiah,
  LABEL_METODE_PEMBAYARAN,
  type DataPembayaran,
  type MetodePembayaran,
  type RekeningToko,
} from '@sit/shared';
import { X } from 'lucide-react';
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

const HURUF_METODE: Record<string, MetodePembayaran> = {
  t: 'TUNAI',
  b: 'TRANSFER',
  e: 'EDC',
  q: 'QRIS',
};
const METODE: { nilai: MetodePembayaran; huruf: string }[] = [
  { nilai: 'TUNAI', huruf: 'T' },
  { nilai: 'TRANSFER', huruf: 'B' },
  { nilai: 'EDC', huruf: 'E' },
  { nilai: 'QRIS', huruf: 'Q' },
];

/** Rekening bawaan (atau yang pertama) untuk satu metode non-tunai; `null` bila belum ada yang terdaftar. */
function rekeningBawaan(daftar: RekeningToko[], metode: MetodePembayaran): number | null {
  const pilihan = daftar.filter((r) => r.jenis === metode);
  return (pilihan.find((r) => r.isDefault) ?? pilihan[0])?.id ?? null;
}

/** Klik tombol tanpa memindahkan fokus dari kotak "Bayar" (keyboard tetap bisa dipakai sesudahnya). */
const tahanFokus = (e: MouseEvent) => e.preventDefault();

/**
 * Panel pembayaran POS (K-073). Kursor selalu di kotak "Bayar": ketik angka = uang diterima (tunai) atau
 * nominal (transfer/EDC/QRIS); Enter menyelesaikan. Huruf: T tunai, B transfer, E EDC, Q QRIS, C bayar
 * campuran, D barang ditinggal (langsung). Rekening tujuan non-tunai dipilih dari daftar rekening toko
 * (Pengaturan › Pembayaran, K-111), tidak diketik; bawaannya terpilih sendiri. Bila pembeli boleh belum lunas, kasir memilih cara bayar secara tegas (K-104):
 * L lunas, U DP, N bayar nanti, S saat terima (pengantaran). Semua pilihan juga bisa diklik. Nominal final
 * dihitung server (nominal kosong = lunasi).
 *
 * Bayar campuran (K-106) = satu tagihan dibayar dengan lebih dari satu cara (mis. transfer Rp 300.000 + tunai
 * sisanya). Alurnya: pilih cara bayar bagian pertama, ketik nominalnya, tekan C (bagian itu masuk daftar dan
 * sisa tagihan berkurang), ulangi untuk bagian berikutnya, lalu Enter pada bagian terakhir. Tiap bagian di
 * daftar bisa dihapus (tombol silang, atau Backspace saat kotak bayar kosong) selama belum dibayar. Pesan
 * galat selalu tampil tepat di bawah kotak bayar, tidak di bagian bawah panel yang bisa tergulung.
 */
export function PanelBayarPos({
  id,
  aktif,
  total,
  mode,
  bolehKurang,
  rekening: daftarRekening,
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
  /** Rekening toko AKTIF (K-111) untuk dipilih pada pembayaran non-tunai. */
  rekening: RekeningToko[];
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
  const [idRekening, setIdRekening] = useState<number | null>(null);
  /** Hanya dipakai bila toko belum mendaftarkan rekening untuk metode itu. */
  const [rekening, setRekening] = useState('');
  const [referensi, setReferensi] = useState('');
  const [daftar, setDaftar] = useState<DataPembayaran[]>([]);
  const [galat, setGalat] = useState('');
  const [pilihan, setPilihan] = useState<RencanaBayar>('LUNAS');
  /** K-141: pembeli tidak mengambil kembaliannya (dicatat kas masuk khusus, bukan penjualan). */
  const [kembalianDitinggal, setKembalianDitinggal] = useState(false);

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

  const pilihanRekening = daftarRekening.filter((r) => r.jenis === metode);
  const namaRekening = (id: number | null) => daftarRekening.find((r) => r.id === id)?.nama ?? null;

  function gantiMetode(m: MetodePembayaran) {
    setMetode(m);
    setIdRekening(rekeningBawaan(daftarRekening, m));
    setRekening('');
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
    if (!tunai && pilihanRekening.length > 0 && idRekening === null) {
      setGalat('Pilih rekening tujuan dari daftar di bawah kotak bayar.');
      return 'galat';
    }
    if (!tunai && pilihanRekening.length === 0 && !rekening.trim()) {
      setGalat(
        `Belum ada rekening ${LABEL_METODE_PEMBAYARAN[metode]} yang didaftarkan toko. Ketik tujuannya di kolom di bawah, dan minta Admin/Owner mendaftarkannya di Pengaturan › Pembayaran.`,
      );
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
      idRekening: tunai ? null : idRekening,
      rekening: tunai || idRekening !== null ? null : rekening.trim(),
      referensi: tunai ? null : referensi.trim() || null,
      catatan: null,
      kembalianTidakDiambil: tunai && kembalianDitinggal && kembalian > 0,
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
      setGalat(
        `Bayar campuran: ketik dulu nominal bagian ${daftar.length + 1} (lebih kecil dari ${formatRupiah(sisa)}) di kotak di atas, lalu tekan C lagi. Bagian itu masuk daftar dan Anda mengisi bagian berikutnya.`,
      );
      return;
    }
    if (angka >= sisa) {
      setGalat(
        `Nominal itu sudah menutup sisa ${formatRupiah(sisa)}, jadi tidak perlu dipecah lagi: tekan Enter untuk membayar.`,
      );
      return;
    }
    const e = entriKini();
    if (!e || e === 'galat') return;
    setDaftar((d) => [...d, { ...e, nominal: angka, uangDiterima: tunai ? angka : null }]);
    setDigit('');
    gantiMetode(tunai ? 'TRANSFER' : 'TUNAI');
  }

  function hapusBagian(i: number) {
    setDaftar((d) => d.filter((_, n) => n !== i));
    setGalat('');
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
    } else if (e.key === 'Backspace' && digit === '' && daftar.length > 0) {
      // Kotak bayar kosong: Backspace membuang bagian campuran terakhir.
      e.preventDefault();
      hapusBagian(daftar.length - 1);
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
    } else if (k === 'k' && tunai && kembalian > 0) {
      e.preventDefault();
      setKembalianDitinggal((v) => !v);
    } else if (k === 'd' && mode === 'langsung' && onDitinggal) {
      e.preventDefault();
      onDitinggal(!ditinggal);
    } else if (e.key.length === 1 && !/\d/.test(e.key)) {
      e.preventDefault(); // kotak bayar hanya angka
    }
  }

  const campur = daftar.length > 0;
  const petunjukKosong =
    rencana === 'DP'
      ? 'jumlah DP'
      : campur
        ? `kosong = lunasi sisa ${formatRupiah(sisa)}`
        : tunai
          ? 'kosong = uang pas'
          : 'kosong = lunas';
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
        <div className="grid grid-cols-4 gap-1.5 text-sm">
          {METODE.map(({ nilai: m, huruf }) => (
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
              <span className="mr-1 font-mono text-xs opacity-60">{huruf}</span>
              {LABEL_METODE_PEMBAYARAN[m]}
            </button>
          ))}
        </div>
      )}

      {campur && (
        <div
          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-sm"
          data-testid="bayar-campuran"
        >
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-900">
            <span>Bayar campuran: bagian yang sudah dicatat</span>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={tahanFokus}
              onClick={() => {
                setDaftar([]);
                setGalat('');
              }}
              className="font-medium text-red-600 hover:underline"
            >
              Hapus semua
            </button>
          </div>
          <ul className="space-y-0.5">
            {daftar.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-4 text-xs text-slate-500 tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {LABEL_METODE_PEMBAYARAN[p.metode]}
                  {p.metode !== 'TUNAI' && ` · ${namaRekening(p.idRekening) ?? p.rekening ?? ''}`}
                </span>
                <span className="font-semibold tabular-nums">{formatRupiah(p.nominal ?? 0)}</span>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={tahanFokus}
                  onClick={() => hapusBagian(i)}
                  aria-label={`Hapus bagian ${i + 1}`}
                  title="Hapus bagian ini"
                  className="rounded p-0.5 text-slate-500 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 text-xs">
            <span className="text-slate-600">
              Sudah dicatat {formatRupiah(sudah)} dari {formatRupiah(total)}
            </span>
            <span className="font-bold text-blue-900">Sisa {formatRupiah(sisa)}</span>
          </div>
        </div>
      )}

      <label className="text-xs font-semibold text-slate-600" htmlFor={id}>
        {tanpaBayar
          ? 'Tidak ada pembayaran sekarang (ketik angka untuk mengubahnya menjadi DP)'
          : `${campur ? `Bagian ${daftar.length + 1}: ` : ''}${tunai ? 'Uang diterima' : 'Nominal'} (${petunjukKosong})`}
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
          {pilihanRekening.length > 0 ? (
            <select
              value={idRekening ?? ''}
              onChange={(e) => {
                setIdRekening(e.target.value ? Number(e.target.value) : null);
                setGalat('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  bayar();
                }
              }}
              aria-label="Rekening tujuan"
              title="Uang masuk ke rekening/mesin mana? Daftarnya diatur di Pengaturan › Pembayaran."
              className="h-8 rounded-md border bg-white px-1.5 text-sm"
            >
              {pilihanRekening.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama}
                </option>
              ))}
            </select>
          ) : (
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
              placeholder={`Tujuan ${LABEL_METODE_PEMBAYARAN[metode]} (belum terdaftar)`}
              aria-label="Rekening tujuan"
              className="h-8 rounded-md border border-amber-400 bg-amber-50 px-2 text-sm"
            />
          )}
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

      {galat && (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-sm font-semibold text-red-700"
          role="alert"
        >
          {galat}
        </p>
      )}

      {/* Kembalian hanya ada pada pembayaran penuh; DP diterima sebesar jumlahnya. */}
      {rencana === 'LUNAS' && (
        <div className="flex items-end justify-between gap-2">
          <span className="text-sm text-slate-500">Kembalian</span>
          {tunai && kembalian > 0 && (
            <label
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs',
                kembalianDitinggal
                  ? 'border-amber-400 bg-amber-50 font-semibold text-amber-900'
                  : 'text-slate-600',
              )}
              title="Pembeli tidak mengambil kembaliannya. Dicatat sebagai uang masuk laci, bukan penjualan."
            >
              <input
                type="checkbox"
                tabIndex={-1}
                checked={kembalianDitinggal}
                onChange={(e) => setKembalianDitinggal(e.target.checked)}
              />
              tidak diambil <kbd className="font-mono opacity-70">K</kbd>
            </label>
          )}
          <span
            className={cn(
              'ml-auto text-2xl font-black tabular-nums',
              kembalianDitinggal && tunai && kembalian > 0
                ? 'text-slate-400 line-through'
                : 'text-blue-700',
            )}
            data-testid="kembalian"
          >
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
            <kbd className="font-mono font-bold">C</kbd>{' '}
            {campur ? 'tambah bagian lagi' : 'bayar campuran (lebih dari satu cara bayar)'}
          </button>
          {campur && (
            <span className="px-1.5 py-0.5 text-slate-400">
              <kbd className="font-mono font-bold">Backspace</kbd> hapus bagian terakhir
            </span>
          )}
        </div>
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
